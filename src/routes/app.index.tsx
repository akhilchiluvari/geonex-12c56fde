// Customer dashboard: balance, accounts, recent activity, geo card,
// alerts, and a subtle risk-activity sparkline.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useAccounts, useTransactions } from "@/lib/banking-queries";
import { useAuth } from "@/lib/auth-context";
import { useGeo } from "@/lib/geo-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill, RiskPill } from "@/components/StatusPills";
import { formatCurrency, maskAccountNumber, relativeTime } from "@/lib/format";
import { CITIES, haversineKm } from "@/lib/cities";
import {
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  MapPin,
  AlertTriangle,
  Send,
  Wallet,
  Activity,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Dashboard — GEONEX" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { fullName, user } = useAuth();
  const { city } = useGeo();
  const { accounts, loading: aLoading } = useAccounts();
  const { txns, loading: tLoading } = useTransactions(60);

  const totalBalance = useMemo(
    () => accounts.reduce((s, a) => s + Number(a.balance), 0),
    [accounts],
  );
  const currency = accounts[0]?.currency ?? "USD";

  const homeCityName = "Hyderabad"; // home city from profile would arrive via auth context; fallback
  const homeCity = CITIES.find((c) => c.name === homeCityName) ?? CITIES[0];
  const distanceFromHome = Math.round(haversineKm(homeCity, city));
  const isAway = distanceFromHome > 50;

  const recent = txns.slice(0, 6);
  const alerts = txns.filter(
    (t) => t.risk_tier === "HIGH" || t.status === "high_risk_review" || t.status === "otp_required",
  ).slice(0, 4);

  // Risk activity sparkline: average risk per day (last 14 days)
  const sparkData = useMemo(() => {
    const days = 14;
    const buckets: number[] = Array(days).fill(0);
    const counts: number[] = Array(days).fill(0);
    const start = Date.now() - days * 24 * 60 * 60 * 1000;
    for (const t of txns) {
      if (t.risk_score == null) continue;
      const d = new Date(t.created_at).getTime();
      if (d < start) continue;
      const idx = Math.min(days - 1, Math.floor((d - start) / (24 * 60 * 60 * 1000)));
      buckets[idx] += Number(t.risk_score);
      counts[idx]++;
    }
    return buckets.map((v, i) => (counts[i] > 0 ? v / counts[i] : 0));
  }, [txns]);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Welcome */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">
            Welcome back{fullName ? `, ${fullName.split(" ")[0]}` : ""}.
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here's your money, your activity, and what our risk engine is watching.
          </p>
        </div>
        <Link to="/app/transfer">
          <Button className="shadow-glow">
            <Send className="h-4 w-4" /> New transfer
          </Button>
        </Link>
      </div>

      {/* Top cards: total balance, geo, risk activity */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-6 shadow-soft bg-gradient-card text-primary-foreground relative overflow-hidden">
          <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider opacity-80">Total balance</span>
              <Wallet className="h-4 w-4 opacity-70" />
            </div>
            <div className="mt-3 text-4xl font-display font-semibold tracking-tight">
              {aLoading ? "—" : formatCurrency(totalBalance, currency)}
            </div>
            <div className="mt-1 text-sm opacity-80">
              Across {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
            </div>
            <div className="mt-6 flex items-center gap-2 text-xs opacity-80">
              <Sparkles className="h-3.5 w-3.5" /> Adaptive AI watching every move
            </div>
          </div>
        </Card>

        <Card className="p-6 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Location</span>
            <MapPin className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-display font-semibold">{city.name}</div>
          <div className="text-sm text-muted-foreground">{city.country}</div>
          <div className="mt-4 flex items-center gap-2 text-xs">
            <span className="relative flex h-2 w-2">
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-70 animate-pulse-ring ${isAway ? "bg-warning" : "bg-success"}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isAway ? "bg-warning" : "bg-success"}`} />
            </span>
            <span className="text-muted-foreground">
              {isAway
                ? `${distanceFromHome.toLocaleString()} km from your trusted area`
                : "Inside your trusted area"}
            </span>
          </div>
        </Card>

        <Card className="p-6 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Risk activity (14d)</span>
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <Sparkline data={sparkData} />
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>14 days</span>
            <span>
              Avg{" "}
              <span className="font-mono text-foreground/80">
                {(sparkData.reduce((a, b) => a + b, 0) / Math.max(1, sparkData.filter((v) => v > 0).length || 1)).toFixed(2)}
              </span>
            </span>
          </div>
        </Card>
      </div>

      {/* Accounts strip */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Your accounts</h2>
          <Link to="/app/accounts" className="text-xs text-primary hover:underline">View all</Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {aLoading && <Card className="p-6 h-32 animate-pulse" />}
          {!aLoading && accounts.length === 0 && (
            <Card className="p-6 text-sm text-muted-foreground">No accounts yet.</Card>
          )}
          {accounts.map((a) => (
            <Card key={a.id} className="p-5 shadow-soft hover:shadow-elevated transition-shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground capitalize">
                  {a.account_type}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">{maskAccountNumber(a.account_number)}</span>
              </div>
              <div className="mt-2 text-2xl font-semibold">{formatCurrency(a.balance, a.currency)}</div>
              <div className="mt-3 text-xs text-muted-foreground">{a.currency} · {a.status}</div>
            </Card>
          ))}
        </div>
      </div>

      {/* Lower grid: recent + alerts */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-0 shadow-soft overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold">Recent activity</h2>
            <Link to="/app/statements" className="text-xs text-primary hover:underline">All statements</Link>
          </div>
          <div className="divide-y">
            {tLoading && (
              <div className="px-6 py-8 text-sm text-muted-foreground">Loading…</div>
            )}
            {!tLoading && recent.length === 0 && (
              <div className="px-6 py-12 text-sm text-muted-foreground text-center">
                No transactions yet. Start with a{" "}
                <Link to="/app/transfer" className="text-primary hover:underline">transfer</Link>.
              </div>
            )}
            {recent.map((t) => {
              const outgoing = t.txn_type !== "deposit";
              return (
                <div key={t.id} className="px-6 py-3 flex items-center gap-4">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center ${outgoing ? "bg-accent" : "bg-success/15"}`}>
                    {outgoing ? <ArrowUpRight className="h-4 w-4 text-foreground/70" /> : <ArrowDownLeft className="h-4 w-4 text-success" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {t.to_name || t.note || (t.txn_type === "deposit" ? "Deposit" : "Transfer")}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>{relativeTime(t.created_at)}</span>
                      {t.city && (<><span>·</span><span>{t.city}</span></>)}
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2">
                    <RiskPill tier={t.risk_tier} score={t.risk_score} />
                    <StatusPill status={t.status} />
                  </div>
                  <div className={`text-sm font-mono ${outgoing ? "" : "text-success"}`}>
                    {outgoing ? "−" : "+"}
                    {formatCurrency(t.amount, t.currency)}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-0 shadow-soft overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Security alerts
            </h2>
          </div>
          <div className="divide-y">
            {alerts.length === 0 && (
              <div className="px-6 py-10 text-center">
                <ShieldCheck className="h-8 w-8 mx-auto text-success mb-2" />
                <p className="text-sm text-muted-foreground">All clear. No risk events recently.</p>
              </div>
            )}
            {alerts.map((t) => (
              <div key={t.id} className="px-6 py-4">
                <div className="flex items-center gap-2 mb-1">
                  <RiskPill tier={t.risk_tier} score={t.risk_score} />
                  <StatusPill status={t.status} />
                </div>
                <div className="text-sm font-medium truncate">
                  {formatCurrency(t.amount, t.currency)} → {t.to_name || "Unknown"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {relativeTime(t.created_at)} · {t.city || "—"}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Footer note */}
      <p className="text-xs text-muted-foreground text-center pt-4">
        Signed in as {user?.email}. Demo banking — no real funds are moved.
      </p>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const w = 220;
  const h = 60;
  const max = Math.max(0.1, ...data);
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const points = data
    .map((v, i) => `${i * step},${h - (v / max) * (h - 6) - 3}`)
    .join(" ");
  const areaPoints = `0,${h} ${points} ${w},${h}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-14">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#sparkFill)" />
      <polyline
        points={points}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.map((v, i) => (
        <circle
          key={i}
          cx={i * step}
          cy={h - (v / max) * (h - 6) - 3}
          r={v > 0 ? 1.6 : 0}
          fill="var(--primary)"
        />
      ))}
    </svg>
  );
}
