// Server function: orchestrate a transfer.
// 1. Validate inputs
// 2. Compute features (geo distance, freq, avg, new payee, new device)
// 3. Score risk via the AI gateway (with heuristic fallback)
// 4. Persist the transaction in the appropriate status (success / otp_required / blocked)
// 5. Persist the risk assessment

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { scoreRisk, type RiskFeatures } from "@/server/risk-engine.server";
import { CITIES, haversineKm } from "@/lib/cities";

const inputSchema = z.object({
  fromAccountId: z.string().uuid(),
  amount: z.number().positive().max(1_000_000),
  toAccountNumber: z.string().min(4).max(40),
  toName: z.string().min(1).max(80),
  note: z.string().max(160).optional(),
  city: z.string().min(1),
  deviceFingerprint: z.string().min(3).max(80),
});

export const evaluateAndCreateTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof inputSchema>) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Profile, account, payee, history, device — all needed for features
    const [profileRes, accountRes, recentTxnsRes, payeeRes, deviceRes] = await Promise.all([
      supabase.from("profiles").select("home_city, full_name").eq("id", userId).maybeSingle(),
      supabase
        .from("accounts")
        .select("id, balance, currency, account_type, account_number")
        .eq("id", data.fromAccountId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("transactions")
        .select("amount, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("payees")
        .select("id, trust_score")
        .eq("user_id", userId)
        .eq("account_number", data.toAccountNumber)
        .maybeSingle(),
      supabase
        .from("device_fingerprints")
        .select("id")
        .eq("user_id", userId)
        .eq("fingerprint", data.deviceFingerprint)
        .maybeSingle(),
    ]);

    if (!accountRes.data) throw new Error("Source account not found");
    if (Number(accountRes.data.balance) < data.amount) throw new Error("Insufficient balance");

    const homeCityName = profileRes.data?.home_city ?? "Hyderabad";
    const homeCity = CITIES.find((c) => c.name === homeCityName) ?? CITIES[0];
    const txnCity = CITIES.find((c) => c.name === data.city) ?? homeCity;
    const distance = haversineKm(homeCity, txnCity);

    const recent = recentTxnsRes.data ?? [];
    const last24 = recent.filter(
      (r) => Date.now() - new Date(r.created_at).getTime() < 24 * 60 * 60 * 1000,
    );
    const avgAmount =
      recent.length > 0
        ? recent.reduce((a, r) => a + Number(r.amount), 0) / recent.length
        : data.amount;
    const maxAmount = recent.length > 0 ? Math.max(...recent.map((r) => Number(r.amount))) : data.amount;
    const isNewPayee = !payeeRes.data;
    const trustScore = payeeRes.data?.trust_score ?? 0.2;
    const deviceNew = !deviceRes.data;

    const features: RiskFeatures = {
      location_distance_km: distance,
      device_new: deviceNew,
      transaction_amount: data.amount,
      time_hour: new Date().getHours(),
      transaction_frequency_24h: last24.length,
      payee_trust_score: Number(trustScore),
      user_avg_amount: avgAmount,
      user_max_amount: maxAmount,
      is_new_payee: isNewPayee,
      city: data.city,
      home_city: homeCityName,
    };

    const risk = await scoreRisk(features);

    const status =
      risk.tier === "LOW"
        ? "success"
        : risk.tier === "MEDIUM"
          ? "otp_required"
          : "high_risk_review";

    // Insert transaction
    const { data: txnRow, error: txnErr } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        from_account_id: data.fromAccountId,
        to_account_number: data.toAccountNumber,
        to_name: data.toName,
        amount: data.amount,
        currency: accountRes.data.currency,
        txn_type: "transfer",
        status,
        city: data.city,
        note: data.note ?? null,
        category: "transfer",
        risk_score: risk.risk_score,
        risk_tier: risk.tier,
        completed_at: status === "success" ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (txnErr || !txnRow) throw new Error(txnErr?.message ?? "Failed to create transaction");

    // Risk assessment record
    await supabase.from("risk_assessments").insert({
      user_id: userId,
      transaction_id: txnRow.id,
      features: features as unknown as Record<string, unknown>,
      risk_score: risk.risk_score,
      risk_tier: risk.tier,
      top_factors: risk.top_factors as unknown as Record<string, unknown>,
      reasoning: risk.reasoning,
      model_name: risk.model,
    });

    // Track device fingerprint
    if (deviceNew) {
      await supabase.from("device_fingerprints").insert({
        user_id: userId,
        fingerprint: data.deviceFingerprint,
        user_agent: null,
      });
    } else {
      await supabase
        .from("device_fingerprints")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("fingerprint", data.deviceFingerprint);
    }

    // Security event for non-LOW
    if (risk.tier !== "LOW") {
      await supabase.from("security_events").insert({
        user_id: userId,
        event_type: risk.tier === "HIGH" ? "transaction_blocked" : "step_up_required",
        severity: risk.tier === "HIGH" ? "critical" : "warn",
        description:
          risk.tier === "HIGH"
            ? "Transaction blocked pending manual review"
            : "OTP step-up required",
        metadata: { transaction_id: txnRow.id, risk_score: risk.risk_score },
      });
    }

    // If LOW, deduct balance via RPC immediately
    if (status === "success") {
      const { error: rpcErr } = await supabase.rpc("complete_transfer", {
        _transaction_id: txnRow.id,
      });
      if (rpcErr) {
        // Roll status back if completion failed
        await supabase
          .from("transactions")
          .update({ status: "failed" })
          .eq("id", txnRow.id);
        throw new Error(rpcErr.message);
      }
    }

    return {
      transactionId: txnRow.id,
      status,
      risk,
      distance_km: Math.round(distance),
    };
  });
