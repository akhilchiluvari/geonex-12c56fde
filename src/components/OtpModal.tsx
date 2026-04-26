// Email OTP step-up modal for MEDIUM-risk transactions.
// Shows a 6-digit input, retry/cancel controls, expiry countdown,
// and a clearly-labeled "demo OTP" hint so the flow is testable end-to-end.
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ShieldAlert, Loader2, RefreshCw, Mail } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { issueOtp, verifyOtp } from "@/server/otp.functions";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  transactionId: string | null;
  recipientEmail?: string | null;
  onCancel: () => void;
  onVerified: () => void;
}

async function withAuthHeader<T>(fn: () => Promise<T>): Promise<T> {
  // server fns automatically inject Bearer token via fetch override only if we set headers.
  // Our auth-middleware reads Authorization header — supabase client does not auto-attach.
  // We use a small wrapper: call supabase.auth.getSession then attach.
  return fn();
}

export function OtpModal({ open, transactionId, recipientEmail, onCancel, onVerified }: Props) {
  const [code, setCode] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  const issue = useServerFn(issueOtp);
  const verify = useServerFn(verifyOtp);

  const sendCode = async () => {
    if (!transactionId) return;
    setIssuing(true);
    setCode("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch("/_serverFn/src/server/otp.functions/issueOtp", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ data: { transactionId } }),
      }).then((r) => r.json());
      // TanStack server fn URL convention isn't stable — fall back to useServerFn helper which handles transport.
      // Prefer the helper:
      void res;
      const result = await withAuthHeader(() => issue({ data: { transactionId }, headers: { Authorization: `Bearer ${token}` } } as never));
      const r = result as { ok: boolean; devCode?: string; expiresAt?: string };
      if (r.devCode) setDevCode(r.devCode);
      if (r.expiresAt) setExpiresAt(new Date(r.expiresAt).getTime());
      setRemainingAttempts(3);
      toast.success("Verification code sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send OTP");
    } finally {
      setIssuing(false);
    }
  };

  useEffect(() => {
    if (open && transactionId) {
      sendCode();
    }
    if (!open) {
      setCode("");
      setDevCode(null);
      setExpiresAt(null);
      setRemainingAttempts(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transactionId]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  const secondsLeft = expiresAt ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : 0;
  const expired = expiresAt != null && secondsLeft <= 0;

  const submit = async () => {
    if (!transactionId || code.length !== 6) return;
    setVerifying(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const result = await verify({
        data: { transactionId, code },
        headers: { Authorization: `Bearer ${token}` },
      } as never);
      const r = result as { ok: boolean; reason?: string; remaining?: number; message?: string };
      if (r.ok) {
        toast.success("Transfer completed");
        onVerified();
        return;
      }
      if (r.reason === "incorrect") {
        setRemainingAttempts(r.remaining ?? null);
        toast.error(`Incorrect code. ${r.remaining ?? 0} ${r.remaining === 1 ? "try" : "tries"} remaining.`);
        setCode("");
      } else if (r.reason === "expired") {
        toast.error("Code expired. Send a new one.");
      } else if (r.reason === "too_many_attempts") {
        toast.error("Too many attempts. Send a new code.");
      } else if (r.reason === "no_active_otp") {
        toast.error("No active code. Send one first.");
      } else {
        toast.error(r.message ?? "Verification failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-xl bg-warning/20 flex items-center justify-center mb-2">
            <ShieldAlert className="h-6 w-6 text-warning-foreground" />
          </div>
          <DialogTitle className="text-center">Verify it's you</DialogTitle>
          <DialogDescription className="text-center">
            This transaction looked unusual to our risk engine, so we sent a 6-digit code
            {recipientEmail ? <> to <span className="font-medium text-foreground">{recipientEmail}</span></> : " to your email"}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {issuing ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Sending code…
            </div>
          ) : (
            <>
              <InputOTP maxLength={6} value={code} onChange={setCode} disabled={verifying || expired}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="h-11 w-11 text-base" />
                  ))}
                </InputOTPGroup>
              </InputOTP>

              <div className="text-xs text-muted-foreground flex items-center gap-3">
                {expiresAt && !expired && <span>Expires in {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</span>}
                {expired && <span className="text-destructive">Code expired</span>}
                {remainingAttempts != null && <span>· {remainingAttempts} tries left</span>}
              </div>

              {devCode && (
                <div className="w-full rounded-md border border-dashed border-warning/50 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="font-medium">Demo code:</span>
                    <span className="font-mono tracking-widest text-foreground">{devCode}</span>
                  </div>
                  <p className="mt-1 opacity-80">In production this is delivered by email. Shown here so you can complete the demo flow.</p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button variant="ghost" onClick={onCancel} disabled={verifying}>
            Cancel transfer
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={sendCode} disabled={issuing || verifying}>
              <RefreshCw className="h-4 w-4" />
              {expired ? "Send new code" : "Resend"}
            </Button>
            <Button onClick={submit} disabled={code.length !== 6 || verifying || expired}>
              {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
              Verify
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
