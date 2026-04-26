import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAccounts, useTransactions } from "@/lib/banking-queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/StatusPills";
import { formatCurrency, formatAccountNumber, relativeTime } from "@/lib/format";
import { Wallet, Send, ArrowUpRight, ArrowDownLeft } from "lucide-react";

export const Route = createFileRoute("/app/accounts")({
  head: () => ({ meta: [{ title: "Accounts — GEONEX" }] }),
  component: AccountsPage,
});

function AccountsPage() {
  const { accounts, loading } = useAccounts();
  const { txns } = useTransactions(200);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeId = selectedId ?? accounts[0]?.id ?? null;
  const active = accounts.find((a) => a.id === activeId) ?? null;
  const mini = useMemo(
    () => txns.filter((t) => t.from_account_id === activeId).slice(0, 8),
    [txns, activeId],
  );

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage balances and review recent activity per account.
          </p>
        </div>
        <Link to="/app/transfer"><Button><Send className="h-4 w-4" />Transfer</Button></Link>
      </div>

      <Card className="p-6 shadow-soft bg-gradient-card text-primary-foreground">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider opacity-80">Combined balance</span>
          <Wallet className="h-4 w-4 opacity-70" />
        </div>
        <div className="mt-2 text-4xl font-display font-semibold">
          {formatCurrency(totalBalance, accounts[0]?.currency ?? "USD")}
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          {loading && <Card className="p-5 h-28 animate-pulse" />}
          {accounts.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedId(a.id)}
              className={`w-full text-left ${activeId === a.id ? "ring-2 ring-primary" : ""} rounded-xl`}
            >
              <Card className="p-5 shadow-soft hover:shadow-elevated transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground capitalize">{a.account_type}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{a.currency}</span>
                </div>
                <div className="mt-1 text-xl font-semibold">{formatCurrency(a.balance, a.currency)}</div>
                <div className="mt-2 text-xs font-mono text-muted-foreground">
                  {formatAccountNumber(a.account_number)}
                </div>
              </Card>
            </button>
          ))}
        </div>

        <Card className="lg:col-span-2 p-0 shadow-soft overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="font-semibold">Mini statement</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Last 8 transactions on {active ? `${active.account_type} · ${formatAccountNumber(active.account_number)}` : "—"}
            </p>
          </div>
          <div className="divide-y">
            {mini.length === 0 && (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                No transactions on this account yet.
              </div>
            )}
            {mini.map((t) => {
              const outgoing = t.txn_type !== "deposit";
              return (
                <div key={t.id} className="px-6 py-3 flex items-center gap-4">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center ${outgoing ? "bg-accent" : "bg-success/15"}`}>
                    {outgoing ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4 text-success" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{t.to_name || t.note || "Transfer"}</div>
                    <div className="text-xs text-muted-foreground">{relativeTime(t.created_at)} · {t.city || "—"}</div>
                  </div>
                  <StatusPill status={t.status} />
                  <div className={`text-sm font-mono ${outgoing ? "" : "text-success"}`}>
                    {outgoing ? "−" : "+"}{formatCurrency(t.amount, t.currency)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-6 py-3 border-t flex justify-end">
            <Link to="/app/statements" className="text-xs text-primary hover:underline">Full statement →</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
