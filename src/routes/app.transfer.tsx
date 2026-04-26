// Multi-step transfer flow with AI risk scoring + OTP step-up.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAccounts } from "@/lib/banking-queries";
import { useAuth } from "@/lib/auth-context";
import { useGeo } from "@/lib/geo-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { OtpModal } from "@/components/OtpModal";
import { evaluateAndCreateTransfer } from "@/server/transfer.functions";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, getDeviceFingerprint, maskAccountNumber } from "@/lib/format";
import { ArrowRight, Loader2, ShieldCheck, ShieldAlert, Ban, CheckCircle2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/transfer")({
  head: () => ({ meta: [{ title: "Transfer — GEONEX" }] }),
  component: TransferPage,
});

type Step = "form" | "review" | "scoring" | "result";
type Risk = { risk_score: number; tier: "LOW" | "MEDIUM" | "HIGH"; reasoning: string; top_factors: { name: string; impact: number; note: string }[] };

function TransferPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { city } = useGeo();
  const { accounts, refresh: refreshAccounts } = useAccounts();
  const evalFn = useServerFn(evaluateAndCreateTransfer);

  const [step, setStep] = useState<Step>("form");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toName, setToName] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [txnId, setTxnId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ status: string; risk: Risk; distance_km: number } | null>(null);
  const [otpOpen, setOtpOpen] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === fromAccountId) ?? accounts[0];
  if (!fromAccountId && accounts[0]) setFromAccountId(accounts[0].id);

  const reset = () => {
    setStep("form"); setToName(""); setToAccount(""); setAmount(""); setNote("");
    setTxnId(null); setOutcome(null); setOtpOpen(false);
  };

  const submit = async () => {
    if (!selectedAccount) return toast.error("Select a source account");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    if (amt > Number(selectedAccount.balance)) return toast.error("Amount exceeds balance");
    setSubmitting(true);
    setStep("scoring");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const result = await evalFn({
        data: {
          fromAccountId: selectedAccount.id,
          amount: amt,
          toAccountNumber: toAccount.trim(),
          toName: toName.trim(),
          note: note.trim() || undefined,
          city: city.name,
          deviceFingerprint: getDeviceFingerprint(),
        },
        headers: { Authorization: `Bearer ${token}` },
      } as never);
      const r = result as { transactionId: string; status: string; risk: Risk; distance_km: number };
      setTxnId(r.transactionId);
      setOutcome({ status: r.status, risk: r.risk, distance_km: r.distance_km });
      setStep("result");
      await refreshAccounts();
      if (r.status === "otp_required") {
        setOtpOpen(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transfer failed");
      setStep("review");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerified = async () => {
    setOtpOpen(false);
    setOutcome((o) => o ? { ...o, status: "success" } : o);
    await refreshAccounts();
  };

  const handleCancel = () => {
    setOtpOpen(false);
    toast.info("OTP cancelled. Transaction held pending verification.");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-display font-semibold tracking-tight flex items-center gap-2">
          <Send className="h-6 w-6 text-primary" /> New transfer
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every transfer is scored in real time. Low risk flows through. Medium triggers OTP. High is held.
        </p>
      </div>

      <Stepper step={step} />

      {step === "form" && (
        <Card className="p-6 shadow-soft space-y-4">
          <div className="space-y-2">
            <Label>From account</Label>
            <Select value={fromAccountId} onValueChange={setFromAccountId}>
              <SelectTrigger><SelectValue placeholder="Choose account" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="capitalize">
                    {a.account_type} · {maskAccountNumber(a.account_number)} · {formatCurrency(a.balance, a.currency)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Recipient name</Label>
              <Input value={toName} onChange={(e) => setToName(e.target.value)} placeholder="Jane Doe" />
            </div>
            <div className="space-y-2">
              <Label>Recipient account</Label>
              <Input value={toAccount} onChange={(e) => setToAccount(e.target.value)} placeholder="GNX1234567890" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Amount ({selectedAccount?.currency ?? "USD"})</Label>
            <Input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={160} placeholder="Rent, gift, etc." />
          </div>
          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-muted-foreground">Initiating from <span className="text-foreground font-medium">{city.name}</span></span>
            <Button onClick={() => setStep("review")} disabled={!toName || !toAccount || !amount}>
              Review <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {step === "review" && (
        <Card className="p-6 shadow-soft space-y-4">
          <h2 className="font-semibold">Confirm transfer</h2>
          <dl className="divide-y text-sm">
            {[
              ["From", `${selectedAccount?.account_type} · ${maskAccountNumber(selectedAccount?.account_number ?? "")}`],
              ["To", toName],
              ["Account", toAccount],
              ["Amount", formatCurrency(parseFloat(amount) || 0, selectedAccount?.currency ?? "USD")],
              ["Note", note || "—"],
              ["Initiating city", city.name],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium text-right">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex justify-between gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep("form")}>Back</Button>
            <Button onClick={submit} disabled={submitting} className="shadow-glow">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm & send <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {step === "scoring" && (
        <Card className="p-12 shadow-soft text-center">
          <div className="relative h-24 w-24 mx-auto">
            <div className="absolute inset-0 rounded-full bg-gradient-primary opacity-90" />
            <div className="absolute inset-0 rounded-full animate-radar bg-primary/40" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h2 className="mt-6 text-lg font-semibold">Analysing risk…</h2>
          <p className="text-sm text-muted-foreground mt-1">
            FraudNet is reviewing distance, device, history, and amount.
          </p>
        </Card>
      )}

      {step === "result" && outcome && (
        <ResultCard
          outcome={outcome}
          onNew={reset}
          onViewStatement={() => navigate({ to: "/app/statements" })}
          onRetryOtp={() => setOtpOpen(true)}
        />
      )}

      <OtpModal
        open={otpOpen}
        transactionId={txnId}
        recipientEmail={user?.email}
        onCancel={handleCancel}
        onVerified={handleVerified}
      />
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "form", label: "Details" },
    { key: "review", label: "Review" },
    { key: "scoring", label: "Risk scan" },
    { key: "result", label: "Result" },
  ];
  const idx = steps.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2 flex-1">
          <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold ${i <= idx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {i + 1}
          </div>
          <span className={`text-xs ${i <= idx ? "text-foreground font-medium" : "text-muted-foreground"}`}>{s.label}</span>
          {i < steps.length - 1 && <div className={`h-px flex-1 ${i < idx ? "bg-primary" : "bg-border"}`} />}
        </div>
      ))}
    </div>
  );
}

function ResultCard({ outcome, onNew, onViewStatement, onRetryOtp }: {
  outcome: { status: string; risk: Risk; distance_km: number };
  onNew: () => void;
  onViewStatement: () => void;
  onRetryOtp: () => void;
}) {
  const { status, risk, distance_km } = outcome;
  const map = {
    success: { Icon: CheckCircle2, tone: "text-success", bg: "bg-success/15", title: "Transfer completed", body: "The recipient will see the funds shortly." },
    otp_required: { Icon: ShieldAlert, tone: "text-warning-foreground", bg: "bg-warning/20", title: "Verification required", body: "We sent a 6-digit code to your email. Enter it to release the funds." },
    high_risk_review: { Icon: Ban, tone: "text-destructive", bg: "bg-destructive/15", title: "Held for manual review", body: "Our team will review and reach out. No funds have moved." },
  } as const;
  const m = map[status as keyof typeof map] ?? map.high_risk_review;
  const Icon = m.Icon;

  return (
    <Card className="p-8 shadow-soft text-center space-y-4">
      <div className={`mx-auto h-14 w-14 rounded-2xl flex items-center justify-center ${m.bg}`}>
        <Icon className={`h-7 w-7 ${m.tone}`} />
      </div>
      <div>
        <h2 className="text-xl font-display font-semibold">{m.title}</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{m.body}</p>
      </div>

      <div className="text-left bg-muted/50 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Risk score</span>
          <span className="font-mono">
            <span className={risk.tier === "LOW" ? "text-success" : risk.tier === "MEDIUM" ? "text-warning-foreground" : "text-destructive"}>
              {risk.tier}
            </span>{" "}
            <span className="text-muted-foreground">({risk.risk_score.toFixed(2)})</span>
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{risk.reasoning}</p>
        {risk.top_factors.length > 0 && (
          <ul className="space-y-1.5">
            {risk.top_factors.slice(0, 4).map((f) => (
              <li key={f.name} className="flex items-start justify-between gap-3 text-xs">
                <div>
                  <div className="font-medium">{f.name}</div>
                  <div className="text-muted-foreground">{f.note}</div>
                </div>
                <div className="font-mono text-muted-foreground">+{f.impact.toFixed(2)}</div>
              </li>
            ))}
          </ul>
        )}
        <div className="text-xs text-muted-foreground">Distance from trusted location: <span className="font-mono text-foreground">{distance_km.toLocaleString()} km</span></div>
      </div>

      <div className="flex flex-wrap justify-center gap-2 pt-2">
        {status === "otp_required" && (
          <Button onClick={onRetryOtp}>Enter code</Button>
        )}
        <Button variant="outline" onClick={onViewStatement}>View statement</Button>
        <Button variant="ghost" onClick={onNew}>New transfer</Button>
      </div>
    </Card>
  );
}
