// Shared visual primitives for transaction status & risk pills.
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ShieldAlert,
  Hourglass,
  Ban,
  XCircle,
  ShieldCheck,
} from "lucide-react";
import type { TxnRow } from "@/lib/banking-queries";

export function StatusPill({ status }: { status: TxnRow["status"] }) {
  const map: Record<
    TxnRow["status"],
    { label: string; cls: string; Icon: React.ComponentType<{ className?: string }> }
  > = {
    success: { label: "Completed", cls: "bg-success/15 text-success border-success/30", Icon: CheckCircle2 },
    pending: { label: "Pending", cls: "bg-muted text-muted-foreground border-border", Icon: Hourglass },
    otp_required: { label: "OTP required", cls: "bg-warning/20 text-warning-foreground border-warning/40", Icon: ShieldAlert },
    high_risk_review: { label: "Under review", cls: "bg-destructive/10 text-destructive border-destructive/30", Icon: ShieldAlert },
    blocked: { label: "Blocked", cls: "bg-destructive/15 text-destructive border-destructive/40", Icon: Ban },
    failed: { label: "Failed", cls: "bg-destructive/15 text-destructive border-destructive/40", Icon: XCircle },
  };
  const { label, cls, Icon } = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border", cls)}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

export function RiskPill({ tier, score }: { tier: TxnRow["risk_tier"]; score: number | null }) {
  if (!tier) return null;
  const tone =
    tier === "LOW"
      ? "bg-success/15 text-success border-success/30"
      : tier === "MEDIUM"
        ? "bg-warning/20 text-warning-foreground border-warning/40"
        : "bg-destructive/15 text-destructive border-destructive/40";
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border", tone)}>
      <ShieldCheck className="h-3 w-3" />
      {tier}
      {typeof score === "number" && (
        <span className="opacity-70 font-mono">{score.toFixed(2)}</span>
      )}
    </span>
  );
}
