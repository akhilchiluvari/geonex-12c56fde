-- Insert/update permissions for users on their own data
CREATE POLICY "transactions_insert_own" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions_update_own" ON public.transactions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "transactions_update_admin" ON public.transactions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "otp_insert_own" ON public.otp_challenges
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "otp_update_own" ON public.otp_challenges
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "risk_assessments_insert_own" ON public.risk_assessments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "security_events_insert_own" ON public.security_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "accounts_update_own" ON public.accounts
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "accounts_insert_own" ON public.accounts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cards_insert_own" ON public.cards
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "trusted_locations_insert_own" ON public.trusted_locations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "device_fingerprints_insert_own" ON public.device_fingerprints
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "device_fingerprints_update_own" ON public.device_fingerprints
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "bill_payments_insert_own" ON public.bill_payments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admin_audit_insert_admin" ON public.admin_audit
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON public.transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON public.transactions(from_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_user_txn ON public.otp_challenges(user_id, transaction_id);

-- Atomic completion function for the demo: deduct sender balance and mark txn complete.
-- Restricted via SECURITY INVOKER so RLS still applies (user can only update own accounts/txn).
CREATE OR REPLACE FUNCTION public.complete_transfer(_transaction_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _txn public.transactions%ROWTYPE;
BEGIN
  SELECT * INTO _txn FROM public.transactions
   WHERE id = _transaction_id AND user_id = auth.uid()
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found or not yours';
  END IF;
  IF _txn.status = 'success' THEN
    RETURN;
  END IF;

  UPDATE public.accounts
     SET balance = balance - _txn.amount
   WHERE id = _txn.from_account_id
     AND user_id = auth.uid()
     AND balance >= _txn.amount;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.transactions
     SET status = 'success', completed_at = now()
   WHERE id = _transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_transfer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_transfer(uuid) TO authenticated;