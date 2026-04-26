# GEONEX — AI-Powered Digital Banking Platform

A production-grade, multi-page banking simulation with adaptive ML-based fraud detection, geo-lock security, role-based access (Customer + Employee/Admin), and full transaction lifecycle UX. Built on TanStack Start + Lovable Cloud, with the LLM acting as the fraud risk model (replacing the XGBoost service).

## Visual Direction

Warm, premium, non-blue palette — **terracotta + warm sand + deep charcoal** with gold accents. Modern fintech feel (think Mercury × Monzo's coral era), sophisticated but approachable. Clean typography (Sora headings + Inter body), generous whitespace, smooth Framer-style transitions, glass-morphic risk indicators.

## Architecture

```text
Browser (React + TanStack Router)
  │   multi-page banking UI, modals, animations
  ▼
TanStack Start Server Functions  ← acts as "Java Spring Boot" core
  │   auth, accounts, transactions, OTP, geo-lock,
  │   transaction orchestration, audit logs
  ▼
ML Risk Scorer Server Function   ← acts as "Python FastAPI" service
  │   feature vector → Lovable AI (Gemini) → calibrated 0–1 score
  ▼
Lovable Cloud (Postgres + RLS + Auth + Email OTP)
```

## Roles

- **Customer** — full banking UI (dashboard, transfer, cards, payments, statements)
- **Employee/Admin** — separate admin panel: flagged transactions queue, risk scores, approve/reject, user lookup, fraud analytics

Roles stored in a dedicated `user_roles` table with a `has_role()` security-definer function (no privilege escalation).

## Pages & Flows

### Auth
- `/login` — email + password, role detected post-login, routed to `/app` or `/admin`
- `/signup` — creates customer account, profile, default checking account, debit card, sample trusted location
- `/forgot-password` + `/reset-password`

### Customer App (`/app/*`, sidebar layout)
1. **Dashboard** — total balance, account cards, last 10 transactions, geo-lock indicator (current city vs trusted), risk activity sparkline, alerts panel for blocked/suspicious activity
2. **Accounts** — list of accounts (Checking, Savings), balances, mini statements per account
3. **Fund Transfer** — the marquee flow (see below)
4. **Cards** — debit/credit card visuals, freeze/unfreeze toggle, "simulate suspicious activity" demo button, spending limits
5. **Payments / Bills** — Electricity, Mobile, Internet, DTH tiles; each opens the same risk-aware payment flow
6. **Statements** — full history, filters (date range, type, account, status), CSV download
7. **Security Logs** — login history, geo events, risk decisions (read-only)

### Admin Panel (`/admin/*`, separate sidebar)
1. **Flagged Transactions** — queue of HIGH/MEDIUM risk events with feature breakdown, approve/reject actions
2. **Risk Analytics** — counts by tier, top risk factors, recent blocks
3. **User Lookup** — find user, view accounts, recent activity, force-unlock
4. **Audit Log** — every admin action recorded

### Fund Transfer Flow (multi-step, NOT a single form)
1. **Step 1 — Recipient & Amount**: choose account, enter recipient (account or saved payee), amount, note
2. **Step 2 — Confirm**: review screen with summary card
3. **Step 3 — "Analyzing risk…"**: animated overlay (~1.2s) while server collects features (geo distance, device fingerprint hash, amount, hour, recent frequency, payee trust score) and calls the ML scorer
4. **Step 4 — Risk-tiered outcome**:
   - **LOW (<0.3)** → success screen with receipt, balance updated
   - **MEDIUM (0.3–0.7)** → OTP modal (real email OTP via Lovable Email), 6-digit code, verify, then success
   - **HIGH (>0.7)** → blocked screen with reason, "Request manual review" button, transaction logged for admin queue. For very high (>0.85), additionally prompt for confidential ID (last 4 of govt ID stored at signup)

Bills and QR payments funnel through the same risk pipeline.

## ML Fraud Engine (LLM-based)

A dedicated `scoreTransactionRisk` server function:
- Builds feature vector: `location_distance_km`, `device_new` (boolean), `transaction_amount`, `time_hour`, `transaction_frequency_24h`, `payee_trust_score`, plus contextual user history summary
- Sends to Lovable AI Gateway (Gemini 3 Flash) with a strict system prompt + tool-calling schema forcing a JSON response: `{ risk_score: 0–1, tier: "LOW|MEDIUM|HIGH", top_factors: [...], reasoning: "..." }`
- Score and reasoning logged to `risk_assessments` table; only the tier is exposed to the customer UI (raw score visible only to admins)
- No hardcoded rules; the model adapts to context (a $5k transfer at 3am from a new city scores very differently than $5k at noon from home)

## Geo-Lock

- On signup, capture approximate city via IP geolocation → stored as first trusted location
- Every login + transaction captures current location
- Distance from nearest trusted location feeds the ML feature vector
- Successful OTP verification from a new location auto-promotes it to trusted
- Top navbar shows current approximate city with shield icon (green = trusted, amber = new, red = blocked)

## Database Schema (high level)

- `profiles` — user profile, full name, phone, confidential ID hash
- `user_roles` — (user_id, role) with `has_role()` SECURITY DEFINER function
- `accounts` — type, number, balance, status
- `cards` — linked to account, card_number_masked, type, frozen, limits
- `transactions` — from/to, amount, status (pending/success/blocked/otp_required), risk_tier, risk_score
- `payees` — saved recipients with trust scores
- `trusted_locations` — user's known cities with lat/lng
- `device_fingerprints` — known devices per user
- `otp_challenges` — issued codes, expiry, attempts
- `risk_assessments` — full ML response per scored event
- `security_events` — login, geo anomaly, freeze, admin action
- `bill_payments` — utility payment records

All tables RLS-protected. Customers see only their own data; admins use `has_role('admin')` policies.

## Demo Seed Data

On first boot the app seeds:
- **Customer A**: `priya.sharma@geonex.demo` / `Demo1234!` — Checking ($12,480), Savings ($35,210), 2 cards, 35 historical transactions across 60 days, trusted locations (Hyderabad, Bangalore), 3 saved payees
- **Customer B**: `arjun.mehta@geonex.demo` / `Demo1234!` — single Checking ($4,200), 1 card, 18 transactions
- **Admin**: `admin@geonex.demo` / `Admin1234!` — employee role, sees admin panel

A "Demo accounts" panel on the login page lets you one-click sign in.

## OTP Delivery

Real email OTP via Lovable Email infrastructure (sender domain auto-provisioned). 6-digit code, 5-min expiry, max 3 attempts. Email template branded as GEONEX with the transaction amount and recipient masked.

## UX Polish

- Smooth route transitions (fade + subtle slide)
- "Analyzing risk" uses animated radar/pulse with shimmer
- Blocked screens use warm amber/red gradients, not harsh
- Modals for OTP and confidential-ID with backdrop blur
- Toasts for non-blocking events (card frozen, payee saved)
- Skeleton loaders everywhere data fetches
- Empty states with illustrations
- Fully responsive (sidebar collapses to bottom nav on mobile)
- Dark mode toggle

## Out of Scope (clearly not in v1)

- Real money movement / external bank rails
- Real KYC document upload
- Live SMS OTP (email only)
- Native mobile apps
- The actual Java Spring Boot or Python FastAPI services — their roles are fully simulated by TanStack server functions + Lovable AI as documented above

## Build Sequence

1. Database schema, RLS, roles, seed function
2. Auth, signup with profile + default account/card creation, role-based routing
3. Layout shells (customer sidebar + admin sidebar) with navbar, geo indicator
4. Dashboard + Accounts + Statements (read-only flows)
5. ML risk-scorer server function + Lovable AI integration
6. Fund transfer multi-step flow with risk gating + OTP modal
7. Email OTP infrastructure + transactional template
8. Cards page (freeze/unfreeze, simulate suspicious)
9. Bills/Payments tiles using same risk pipeline
10. Admin panel (flagged queue, analytics, user lookup, audit)
11. Security logs page + geo-lock auto-trust on OTP success
12. Visual polish, animations, dark mode, mobile nav, demo seed
