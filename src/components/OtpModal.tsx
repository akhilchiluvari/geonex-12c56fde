// Email OTP step-up modal for MEDIUM-risk transactions.
// Uses client-side helpers in src/lib/banking-actions (RLS-protected) so
// MEDIUM-risk transfers resume after OTP verification without needing
// server-fn auth-header plumbing.
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
import { issueOtp, verifyOtp } from "@/lib/banking-actions";
import { useAuth } from "@/lib/auth-context";

interface Props {
  open: boolean;
  transactionId: string | null;
  recipientEmail?: string | null;
  onCancel: () => void;
  onVerified: () => void;
}

export function OtpModal({ open, transactionId, recipientEmail, onCancel, onVerified }: Props) {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  const sendCode = async () => {
    if (!transactionId || !user) return;
    setIssuing(true);
    setCode("");
    try {
      const r = await issueOtp(transactionId, user.id);
      setDevCode(r.devCode);
      setExpiresAt(new Date(r.expiresAt).getTime());
      setRemainingAttempts(3);
      toast.success("Verification code sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send OTP");
    } finally {
      setIssuing(false);
    }
  };

  useEffect(() => {
    if (open && transactionId && user) {
      sendCode();
    }
    if (!open) {
      setCode("");
      setDevCode(null);
      setExpiresAt(null);
      setRemainingAttempts(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transactionId, user?.id]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  const secondsLeft = expiresAt ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : 0;
  const expired = expiresAt != null && secondsLeft <= 0;

  const submit = async () => {
    if (!transactionId || !user || code.length !== 6) return;
    setVerifying(true);
    try {
      const r = await verifyOtp(transactionId, code, user.id);
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
      } else if (r.reason === "complete_failed") {
        toast.error(r.message ?? "Could not complete transfer");
      } else {
        toast.error("Verification failed");
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
