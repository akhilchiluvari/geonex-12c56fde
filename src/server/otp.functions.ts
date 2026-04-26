// Server-only OTP generation and verification.
// Generates a 6-digit code, hashes it with SHA-256+salt, stores in otp_challenges,
// and returns the *plaintext* code only in demo mode (to surface in the UI banner).
// In production this would be sent via email; this codebase exposes a clear
// "demo OTP" banner instead so the demo can be completed end-to-end without
// requiring email infrastructure setup.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SALT = "geonex.otp.v1";

async function sha256(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateCode(): string {
  const n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(6, "0");
}

export const issueOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { transactionId: string }) =>
    z.object({ transactionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const code = generateCode();
    const codeHash = await sha256(`${SALT}.${code}`);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Invalidate any prior live OTPs for this transaction
    await supabase
      .from("otp_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("transaction_id", data.transactionId)
      .is("consumed_at", null);

    const { error } = await supabase.from("otp_challenges").insert({
      user_id: userId,
      transaction_id: data.transactionId,
      code_hash: codeHash,
      expires_at: expiresAt,
      attempts: 0,
      max_attempts: 3,
    });
    if (error) throw new Error(error.message);

    await supabase.from("security_events").insert({
      user_id: userId,
      event_type: "otp_issued",
      severity: "info",
      description: "OTP challenge issued for transaction",
      metadata: { transaction_id: data.transactionId },
    });

    // Demo mode: return plaintext so the UI can show it.
    return { ok: true, devCode: code, expiresAt };
  });

export const verifyOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { transactionId: string; code: string }) =>
    z
      .object({
        transactionId: z.string().uuid(),
        code: z.string().regex(/^\d{6}$/),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: rows, error } = await supabase
      .from("otp_challenges")
      .select("id, code_hash, attempts, max_attempts, expires_at, consumed_at")
      .eq("user_id", userId)
      .eq("transaction_id", data.transactionId)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const challenge = rows?.[0];
    if (!challenge) {
      return { ok: false, reason: "no_active_otp" as const };
    }
    if (new Date(challenge.expires_at).getTime() < Date.now()) {
      return { ok: false, reason: "expired" as const };
    }
    if (challenge.attempts >= challenge.max_attempts) {
      return { ok: false, reason: "too_many_attempts" as const };
    }

    const submittedHash = await sha256(`${SALT}.${data.code}`);
    if (submittedHash !== challenge.code_hash) {
      await supabase
        .from("otp_challenges")
        .update({ attempts: challenge.attempts + 1 })
        .eq("id", challenge.id);
      const remaining = challenge.max_attempts - (challenge.attempts + 1);
      await supabase.from("security_events").insert({
        user_id: userId,
        event_type: "otp_failed",
        severity: "warn",
        description: "Incorrect OTP attempt",
        metadata: { transaction_id: data.transactionId, remaining },
      });
      return { ok: false, reason: "incorrect" as const, remaining };
    }

    // Mark OTP consumed and complete the transfer atomically via the RPC.
    await supabase
      .from("otp_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", challenge.id);

    const { error: rpcError } = await supabase.rpc("complete_transfer", {
      _transaction_id: data.transactionId,
    });
    if (rpcError) {
      return { ok: false, reason: "complete_failed" as const, message: rpcError.message };
    }

    await supabase.from("security_events").insert({
      user_id: userId,
      event_type: "otp_verified",
      severity: "info",
      description: "OTP verified — transfer completed",
      metadata: { transaction_id: data.transactionId },
    });

    return { ok: true as const };
  });
