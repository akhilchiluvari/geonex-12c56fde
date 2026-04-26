
-- =========================================================
-- GEONEX banking schema
-- =========================================================

-- Roles enum and table (security: separate table, never on profiles)
CREATE TYPE public.app_role AS ENUM ('customer', 'admin');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  confidential_id_hash TEXT, -- last4 of govt id, hashed
  home_city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Security definer role check function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Accounts
CREATE TYPE public.account_type AS ENUM ('checking', 'savings');

CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL UNIQUE,
  account_type public.account_type NOT NULL,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cards
CREATE TYPE public.card_type AS ENUM ('debit', 'credit');

CREATE TABLE public.cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_number_masked TEXT NOT NULL,
  card_type public.card_type NOT NULL,
  card_holder TEXT NOT NULL,
  expiry_month INT NOT NULL,
  expiry_year INT NOT NULL,
  network TEXT NOT NULL DEFAULT 'VISA',
  is_frozen BOOLEAN NOT NULL DEFAULT false,
  daily_limit NUMERIC(14,2) NOT NULL DEFAULT 5000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Saved payees
CREATE TABLE public.payees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  bank_name TEXT,
  trust_score NUMERIC(3,2) NOT NULL DEFAULT 0.5, -- 0..1
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trusted locations
CREATE TABLE public.trusted_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city TEXT NOT NULL,
  country TEXT,
  lat NUMERIC(9,6) NOT NULL,
  lng NUMERIC(9,6) NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Device fingerprints
CREATE TABLE public.device_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  user_agent TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, fingerprint)
);

-- Transactions
CREATE TYPE public.txn_status AS ENUM ('pending','otp_required','high_risk_review','blocked','success','failed');
CREATE TYPE public.txn_type AS ENUM ('transfer','bill_payment','deposit','withdrawal','card_payment');
CREATE TYPE public.risk_tier AS ENUM ('LOW','MEDIUM','HIGH');

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_account_id UUID REFERENCES public.accounts(id),
  to_account_number TEXT,
  to_name TEXT,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  txn_type public.txn_type NOT NULL,
  status public.txn_status NOT NULL DEFAULT 'pending',
  risk_tier public.risk_tier,
  risk_score NUMERIC(4,3),
  note TEXT,
  category TEXT,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_transactions_user_created ON public.transactions(user_id, created_at DESC);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_risk_tier ON public.transactions(risk_tier);

-- Risk assessments (raw ML output)
CREATE TABLE public.risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  features JSONB NOT NULL,
  risk_score NUMERIC(4,3) NOT NULL,
  risk_tier public.risk_tier NOT NULL,
  top_factors JSONB,
  reasoning TEXT,
  model_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- OTP challenges
CREATE TABLE public.otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Security events
CREATE TABLE public.security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'login','geo_anomaly','card_freeze','admin_action','txn_blocked','otp_sent','otp_verified'
  severity TEXT NOT NULL DEFAULT 'info', -- info, warn, critical
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_events_user_created ON public.security_events(user_id, created_at DESC);

-- Bill payments
CREATE TABLE public.bill_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  biller_type TEXT NOT NULL, -- electricity, mobile, internet, dth
  biller_name TEXT NOT NULL,
  consumer_number TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin audit
CREATE TABLE public.admin_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_user_id UUID,
  target_transaction_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- RLS
-- =========================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trusted_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;

-- Profiles: own row OR admin
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- user_roles: user can view own; only admins can modify
CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- Accounts
CREATE POLICY "accounts_select_own_or_admin" ON public.accounts FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- Cards
CREATE POLICY "cards_select_own_or_admin" ON public.cards FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "cards_update_own" ON public.cards FOR UPDATE USING (auth.uid() = user_id);

-- Payees
CREATE POLICY "payees_select_own" ON public.payees FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "payees_insert_own" ON public.payees FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "payees_update_own" ON public.payees FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "payees_delete_own" ON public.payees FOR DELETE USING (auth.uid() = user_id);

-- Trusted locations
CREATE POLICY "trusted_locations_select_own" ON public.trusted_locations FOR SELECT USING (auth.uid() = user_id);

-- Device fingerprints
CREATE POLICY "device_fingerprints_select_own" ON public.device_fingerprints FOR SELECT USING (auth.uid() = user_id);

-- Transactions
CREATE POLICY "transactions_select_own_or_admin" ON public.transactions FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- Risk assessments: only admin can view raw scores; users see only via transactions table
CREATE POLICY "risk_assessments_select_admin" ON public.risk_assessments FOR SELECT USING (public.has_role(auth.uid(),'admin'));

-- OTP: own only
CREATE POLICY "otp_select_own" ON public.otp_challenges FOR SELECT USING (auth.uid() = user_id);

-- Security events: own or admin
CREATE POLICY "security_events_select_own_or_admin" ON public.security_events FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- Bill payments
CREATE POLICY "bill_payments_select_own_or_admin" ON public.bill_payments FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- Admin audit
CREATE POLICY "admin_audit_select_admin" ON public.admin_audit FOR SELECT USING (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- Trigger to auto-create profile on signup
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, home_city)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'home_city','Hyderabad')
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');

  -- Default checking account
  INSERT INTO public.accounts (user_id, account_number, account_type, balance)
  VALUES (
    NEW.id,
    'GNX' || LPAD((floor(random()*1000000000))::text, 10, '0'),
    'checking',
    1000.00
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
