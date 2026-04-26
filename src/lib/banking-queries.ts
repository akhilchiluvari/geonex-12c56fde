// Lightweight data hooks built on Supabase RLS-protected queries.
// Keep query logic out of components.

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export interface AccountRow {
  id: string;
  account_number: string;
  account_type: "checking" | "savings";
  balance: number;
  currency: string;
  status: string;
  created_at: string;
}

export interface TxnRow {
  id: string;
  amount: number;
  currency: string;
  to_name: string | null;
  to_account_number: string | null;
  note: string | null;
  status: "pending" | "otp_required" | "high_risk_review" | "blocked" | "success" | "failed";
  txn_type: "transfer" | "bill_payment" | "deposit" | "withdrawal" | "card_payment";
  city: string | null;
  category: string | null;
  risk_score: number | null;
  risk_tier: "LOW" | "MEDIUM" | "HIGH" | null;
  created_at: string;
  completed_at: string | null;
  from_account_id: string | null;
}

export function useAccounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    setAccounts((data as AccountRow[] | null) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { accounts, loading, refresh };
}

export function useTransactions(limit = 200) {
  const { user } = useAuth();
  const [txns, setTxns] = useState<TxnRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    setTxns((data as TxnRow[] | null) ?? []);
    setLoading(false);
  }, [user, limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { txns, loading, refresh };
}
