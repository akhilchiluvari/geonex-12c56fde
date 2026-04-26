// Client-side risk + OTP logic for the demo. Uses RLS-protected Supabase calls
// so each user can only mutate their own data. AI risk scoring runs through a
// thin server route to keep the LOVABLE_API_KEY server-side.

import { supabase } from "@/integrations/supabase/client";
import { CITIES, haversineKm } from "./cities";

export interface RiskResult {
  risk_score: number;
  tier: "LOW" | "MEDIUM" | "HIGH";
  top_factors: { name: string; impact: number; note: string }[];
  reasoning: string;
  model: string;
}

export interface EvalResult {
  transactionId: string;
  status: "success" | "otp_required" | "high_risk_review";
  risk: RiskResult;
  distance_km: number;
}

export interface TransferInput {
  fromAccountId: string;
  amount: number;
  toAccountNumber: string;
  toName: string;
  note?: string;
  city: string;
  homeCity: string;
  deviceFingerprint: string;
  currency: string;
}

async function scoreViaApi(features: Record<string, unknown>): Promise<RiskResult> {
  try {
    const res = await fetch("/api/risk-score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ features }),
    });
    if (!res.ok) throw new Error("scoring api failed");
    return (await res.json()) as RiskResult;
  } catch {
    // very lightweight client fallback
    let s = 0;
    const distance = Number(features.location_distance_km) || 0;
    if (distance > 2000) s += 0.45;
    else if (distance > 500) s += 0.22;
    if (features.device_new) s += 0.18;
    const ratio = Number(features.transaction_amount) / Math.max(1, Number(features.user_avg_amount));
    if (ratio > 10) s += 0.3;
    else if (ratio > 3) s += 0.12;
    if (features.is_new_payee && Number(features.transaction_amount) > 500) s += 0.15;
    s = Math.min(1, s);
    const tier = s >= 0.7 ? "HIGH" : s >= 0.3 ? "MEDIUM" : "LOW";
    return {
      risk_score: Number(s.toFixed(3)),
      tier,
      top_factors: [],
      reasoning: "Heuristic score (offline fallback).",
      model: "heuristic-client",
    };
  }
}

export async function evaluateTransfer(input: TransferInput, userId: string): Promise<EvalResult> {
  // Fetch features
  const [recentTxnsRes, payeeRes, deviceRes] = await Promise.all([
    supabase.from("transactions").select("amount, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(60),
    supabase.from("payees").select("id, trust_score").eq("user_id", userId).eq("account_number", input.toAccountNumber).maybeSingle(),
    supabase.from("device_fingerprints").select("id").eq("user_id", userId).eq("fingerprint", input.deviceFingerprint).maybeSingle(),
  ]);

  const homeCity = CITIES.find((c) => c.name === input.homeCity) ?? CITIES[0];
  const txnCity = CITIES.find((c) => c.name === input.city) ?? homeCity;
  const distance = haversineKm(homeCity, txnCity);
  const recent = recentTxnsRes.data ?? [];
  const last24 = recent.filter((r) => Date.now() - new Date(r.created_at).getTime() < 24 * 60 * 60 * 1000);
  const avg = recent.length ? recent.reduce((a, r) => a + Number(r.amount), 0) / recent.length : input.amount;
  const max = recent.length ? Math.max(...recent.map((r) => Number(r.amount))) : input.amount;

  const features = {
    location_distance_km: distance,
    device_new: !deviceRes.data,
    transaction_amount: input.amount,
    time_hour: new Date().getHours(),
    transaction_frequency_24h: last24.length,
    payee_trust_score: Number(payeeRes.data?.trust_score ?? 0.2),
    user_avg_amount: avg,
    user_max_amount: max,
    is_new_payee: !payeeRes.data,
    city: input.city,
    home_city: input.homeCity,
  };

  const risk = await scoreViaApi(features);
  const status: EvalResult["status"] =
    risk.tier === "LOW" ? "success" : risk.tier === "MEDIUM" ? "otp_required" : "high_risk_review";

  // Insert transaction
  const { data: txn, error: txnErr } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      from_account_id: input.fromAccountId,
      to_account_number: input.toAccountNumber,
      to_name: input.toName,
      amount: input.amount,
      currency: input.currency,
      txn_type: "transfer",
      status,
      city: input.city,
      note: input.note ?? null,
      category: "transfer",
      risk_score: risk.risk_score,
      risk_tier: risk.tier,
      completed_at: status === "success" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (txnErr || !txn) throw new Error(txnErr?.message ?? "Failed to create transaction");

  await supabase.from("risk_assessments").insert({
    user_id: userId,
    transaction_id: txn.id,
    features: features as never,
    risk_score: risk.risk_score,
    risk_tier: risk.tier,
    top_factors: risk.top_factors as never,
    reasoning: risk.reasoning,
    model_name: risk.model,
  });

  if (!deviceRes.data) {
    await supabase.from("device_fingerprints").insert({ user_id: userId, fingerprint: input.deviceFingerprint });
  }
  if (risk.tier !== "LOW") {
    await supabase.from("security_events").insert({
      user_id: userId,
      event_type: risk.tier === "HIGH" ? "transaction_blocked" : "step_up_required",
      severity: risk.tier === "HIGH" ? "critical" : "warn",
      description: risk.tier === "HIGH" ? "Transaction blocked pending manual review" : "OTP step-up required",
      metadata: { transaction_id: txn.id, risk_score: risk.risk_score },
    });
  }

  if (status === "success") {
    const { error: rpcErr } = await supabase.rpc("complete_transfer", { _transaction_id: txn.id });
    if (rpcErr) {
      await supabase.from("transactions").update({ status: "failed" }).eq("id", txn.id);
      throw new Error(rpcErr.message);
    }
  }

  return { transactionId: txn.id, status, risk, distance_km: Math.round(distance) };
}

// ===== OTP: client-side issue + verify (demo mode) =====
const OTP_SALT = "geonex.otp.v1";

async function sha256(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function issueOtp(transactionId: string, userId: string): Promise<{ devCode: string; expiresAt: string }> {
  const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
  const codeHash = await sha256(`${OTP_SALT}.${code}`);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  await supabase
    .from("otp_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("transaction_id", transactionId)
    .is("consumed_at", null);

  const { error } = await supabase.from("otp_challenges").insert({
    user_id: userId,
    transaction_id: transactionId,
    code_hash: codeHash,
    expires_at: expiresAt,
  });
  if (error) throw new Error(error.message);

  await supabase.from("security_events").insert({
    user_id: userId,
    event_type: "otp_issued",
    severity: "info",
    description: "OTP challenge issued",
    metadata: { transaction_id: transactionId },
  });

  return { devCode: code, expiresAt };
}

export async function verifyOtp(transactionId: string, code: string, userId: string): Promise<
  { ok: true } | { ok: false; reason: "no_active_otp" | "expired" | "too_many_attempts" | "incorrect" | "complete_failed"; remaining?: number; message?: string }
> {
  const { data: rows, error } = await supabase
    .from("otp_challenges")
    .select("id, code_hash, attempts, max_attempts, expires_at, consumed_at")
    .eq("user_id", userId)
    .eq("transaction_id", transactionId)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const ch = rows?.[0];
  if (!ch) return { ok: false, reason: "no_active_otp" };
  if (new Date(ch.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (ch.attempts >= ch.max_attempts) return { ok: false, reason: "too_many_attempts" };

  const submitted = await sha256(`${OTP_SALT}.${code}`);
  if (submitted !== ch.code_hash) {
    await supabase.from("otp_challenges").update({ attempts: ch.attempts + 1 }).eq("id", ch.id);
    const remaining = ch.max_attempts - (ch.attempts + 1);
    await supabase.from("security_events").insert({
      user_id: userId,
      event_type: "otp_failed",
      severity: "warn",
      description: "Incorrect OTP attempt",
      metadata: { transaction_id: transactionId, remaining },
    });
    return { ok: false, reason: "incorrect", remaining };
  }

  await supabase.from("otp_challenges").update({ consumed_at: new Date().toISOString() }).eq("id", ch.id);
  const { error: rpcErr } = await supabase.rpc("complete_transfer", { _transaction_id: transactionId });
  if (rpcErr) return { ok: false, reason: "complete_failed", message: rpcErr.message };
  await supabase.from("security_events").insert({
    user_id: userId,
    event_type: "otp_verified",
    severity: "info",
    description: "OTP verified — transfer completed",
    metadata: { transaction_id: transactionId },
  });
  return { ok: true };
}
