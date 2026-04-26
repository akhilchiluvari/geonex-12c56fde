import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTransactions, useAccounts, type TxnRow } from "@/lib/banking-queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill, RiskPill } from "@/components/StatusPills";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { Download, Filter, Receipt } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/statements")({
  head: () => ({ meta: [{ title: "Statements — GEONEX" }] }),
  component: StatementsPage,
});

const TYPES: { value: string; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "transfer", label: "Transfers" },
  { value: "deposit", label: "Deposits" },
  { value: "withdrawal", label: "Withdrawals" },
  { value: "bill_payment", label: "Bill payments" },
  { value: "card_payment", label: "Card payments" },
];

function toCSV(rows: TxnRow[]): string {
  const header = ["Date", "Type", "Recipient", "Account", "City", "Amount", "Currency", "Status", "Risk", "Score", "Note"];
  const lines = rows.map((t) => [
    new Date(t.created_at).toISOString(),
    t.txn_type,
    t.to_name ?? "",
    t.to_account_number ?? "",
    t.city ?? "",
    String(t.amount),
    t.currency,
    t.status,
    t.risk_tier ?? "",
    t.risk_score?.toString() ?? "",
    (t.note ?? "").replace(/[\r\n,]+/g, " "),
  ]);
  return [header, ...lines].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function StatementsPage() {
  const { txns, loading } = useTransactions(500);
  const { accounts } = useAccounts();
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [accountId, setAccountId] = useState("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return txns.filter((t) => {
      if (type !== "all" && t.txn_type !== type) return false;
      if (accountId !== "all" && t.from_account_id !== accountId) return false;
      const ts = new Date(t.created_at).getTime();
      if (from) {
        const f = new Date(from + "T00:00:00").getTime();
        if (ts < f) return false;
      }
      if (to) {
        const tt = new Date(to + "T23:59:59").getTime();
        if (ts > tt) return false;
      }
      if (query) {
        const q = query.toLowerCase();
        const hay = `${t.to_name ?? ""} ${t.to_account_number ?? ""} ${t.note ?? ""} ${t.city ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [txns, type, from, to, accountId, query]);

  const totalIn = filtered.filter((t) => t.txn_type === "deposit").reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = filtered.filter((t) => t.txn_type !== "deposit").reduce((s, t) => s + Number(t.amount), 0);

  const download = () => {
    if (filtered.length === 0) {
      toast.info("Nothing to export with current filters.");
      return;
    }
    const csv = toCSV(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `geonex-statement-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} transactions`);
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold tracking-tight flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" /> Statements
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Filter by date, type, or account. Export to CSV anytime.
          </p>
        </div>
        <Button onClick={download} variant="outline">
          <Download className="h-4 w-4" /> Download CSV
        </Button>
      </div>

      <Card className="p-5 shadow-soft">
        <div className="flex items-center gap-2 mb-4 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" /> Filters
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Search</Label>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, note, city…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="capitalize">
                    {a.account_type} · ••{a.account_number.slice(-4)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">From date</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To date</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </Card>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-4 shadow-soft">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Transactions</div>
          <div className="text-xl font-semibold mt-1">{filtered.length}</div>
        </Card>
        <Card className="p-4 shadow-soft">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Money in</div>
          <div className="text-xl font-semibold mt-1 text-success">{formatCurrency(totalIn)}</div>
        </Card>
        <Card className="p-4 shadow-soft">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Money out</div>
          <div className="text-xl font-semibold mt-1">{formatCurrency(totalOut)}</div>
        </Card>
      </div>

      <Card className="p-0 shadow-soft overflow-hidden">
        <div className="overflow-auto scrollbar-thin">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-6">Date</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right pr-6">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">No transactions match these filters.</TableCell></TableRow>
              )}
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="px-6 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(t.created_at)}</TableCell>
                  <TableCell className="font-medium">{t.to_name || t.note || "—"}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{t.txn_type.replace("_", " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{t.city || "—"}</TableCell>
                  <TableCell><RiskPill tier={t.risk_tier} score={t.risk_score} /></TableCell>
                  <TableCell><StatusPill status={t.status} /></TableCell>
                  <TableCell className={`text-right pr-6 font-mono ${t.txn_type === "deposit" ? "text-success" : ""}`}>
                    {t.txn_type === "deposit" ? "+" : "−"}{formatCurrency(t.amount, t.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
