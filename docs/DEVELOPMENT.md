# GEONEX — Development & Architecture Guide

This document explains how GEONEX is built end-to-end: the runtime topology, the data model, the AI fraud-detection pipeline, the security/geo-lock model, and — importantly — **where Java is used** in the system and how to run the Java Spring Boot core locally alongside the TanStack app.

---

## 1. High-Level Architecture

GEONEX is intentionally modeled after a real fintech back-office, where multiple specialized services collaborate over HTTP. In v1 the **TanStack Start server-functions layer simulates the Java Spring Boot core**, but a real Java module is included under `services/banking-core-java/` so the system can also run in its true polyglot configuration.

```
                         ┌──────────────────────────────────────────────┐
                         │  Browser  (React 19 + TanStack Router)       │
                         │  - Multi-page banking UI                     │
                         │  - Geo + Auth contexts                       │
                         │  - shadcn/Radix + Tailwind v4                │
                         └───────────────┬──────────────────────────────┘
                                         │  HTTPS / fetch
                                         ▼
                         ┌──────────────────────────────────────────────┐
                         │  TanStack Start Server Functions  (Node/Edge)│
                         │  Acts as the API gateway + orchestrator.     │
                         │  - Auth middleware (Supabase JWT)            │
                         │  - Transaction orchestration                 │
                         │  - OTP issuance / verification               │
                         │  - Calls Java core OR internal RPC           │
                         └───────┬───────────────────────┬──────────────┘
                                 │                       │
                ┌────────────────▼────────────┐   ┌──────▼──────────────────────┐
                │  Java Spring Boot Core      │   │  ML Risk Scorer (server fn) │
                │  services/banking-core-java │   │  src/server/risk-engine     │
                │  - Account ledger           │   │  - Builds feature vector    │
                │  - Atomic transfers (JPA)   │   │  - Calls Lovable AI Gateway │
                │  - Audit log                │   │    (Gemini, tool-calling)   │
                │  - REST: /api/v1/transfers  │   │  - Returns {score,tier,...} │
                └────────────────┬────────────┘   └──────────────┬──────────────┘
                                 │                                │
                                 └──────────────┬─────────────────┘
                                                ▼
                              ┌────────────────────────────────────┐
                              │  Lovable Cloud (Supabase)          │
                              │  - Postgres + RLS                  │
                              │  - Auth (email/password + OTP)     │
                              │  - Email infra                     │
                              └────────────────────────────────────┘
```

### Trust boundaries

- **Browser** uses the publishable anon key; all data access is RLS-gated to `auth.uid()`.
- **TanStack server functions** can run as the user (via `requireSupabaseAuth`) or as admin (via `supabaseAdmin` with the service-role key).
- **Java core** holds its own service account and connects to Postgres directly with a restricted role; it never receives the service-role key.

---

## 2. Where Java Is Used (Spring Boot Core)

Java is the **system of record for money movement**. The TanStack server is a great orchestrator, but for an investor-grade fintech demo you want the ledger logic — debit/credit pairing, double-entry, idempotency, and audit — written in a strongly-typed JVM service that mirrors what real banks deploy.

### Module: `services/banking-core-java/`

```
services/banking-core-java/
├── pom.xml
├── src/main/java/com/geonex/core/
│   ├── BankingCoreApplication.java        # @SpringBootApplication entry
│   ├── config/
│   │   ├── SecurityConfig.java            # JWT (Supabase HS256) verification
│   │   └── DataSourceConfig.java          # HikariCP → Supabase Postgres
│   ├── domain/
│   │   ├── Account.java                   # @Entity ↔ public.accounts
│   │   ├── Transaction.java               # @Entity ↔ public.transactions
│   │   └── RiskTier.java                  # enum LOW/MEDIUM/HIGH
│   ├── repo/
│   │   ├── AccountRepository.java         # JpaRepository
│   │   └── TransactionRepository.java
│   ├── service/
│   │   ├── TransferService.java           # @Transactional atomic transfers
│   │   ├── RiskClient.java                # WebClient → /api/risk-score
│   │   └── AuditService.java
│   └── web/
│       ├── TransferController.java        # POST /api/v1/transfers
│       └── HealthController.java          # GET  /api/v1/health
└── src/main/resources/
    ├── application.yml                    # port, datasource, JWT issuer
    └── logback-spring.xml
```

### Responsibilities

| Concern | Owner |
|---|---|
| User auth, sessions | Supabase (consumed by both TS + Java) |
| UI, navigation, forms, OTP UX | TanStack frontend |
| ML feature vector + AI call | TanStack `risk-engine.server.ts` |
| **Account ledger, atomic debit/credit, idempotency keys, audit trail** | **Java Spring Boot** |
| OTP delivery (email) | Supabase Email + TanStack server fn |
| RLS / user-data isolation | Postgres |

### Request flow for a transfer (with Java enabled)

1. UI submits the transfer wizard → calls `POST /api/transfers/initiate` (TanStack server fn).
2. TanStack handler validates input + calls the **AI risk scorer**.
3. If `tier === "LOW"`, TanStack forwards a signed RPC to the Java core `POST /api/v1/transfers` with the user's Supabase JWT.
4. Java core verifies the JWT (`SecurityConfig`), opens a `@Transactional` block, locks both accounts (`SELECT … FOR UPDATE`), debits + credits, writes a `transactions` row + `audit_log` row, commits. Returns `201` with the receipt.
5. If `tier === "MEDIUM"`, TanStack issues an OTP and only forwards step 4 after `verifyOtp` succeeds.
6. If `tier === "HIGH"`, TanStack writes a `blocked` transaction and notifies the admin queue — Java is never called.

### Why Java for this slice?

- **Transactional integrity**: Spring's `@Transactional` + JPA + HikariCP is battle-tested for ledger code; many banks deploy exactly this stack.
- **Strong typing on the money path**: `BigDecimal` everywhere, no JS floating-point traps.
- **Polyglot demo**: showcases that Lovable / TanStack apps can integrate cleanly with traditional JVM microservices via REST.
- **Auditability**: Logback structured JSON logs feed easily into ELK / Splunk that fintechs already operate.

### Running the Java core locally

Prereqs from the root README: **JDK 21** + **Maven 3.9+**.

```bash
cd services/banking-core-java

# 1. Configure
cp src/main/resources/application.example.yml src/main/resources/application.yml
# Edit application.yml:
#   spring.datasource.url:      jdbc:postgresql://db.bjytecimszmnjqyosugr.supabase.co:5432/postgres
#   spring.datasource.username: <your restricted role, e.g. geonex_core>
#   spring.datasource.password: <password>
#   geonex.jwt.issuer:          https://bjytecimszmnjqyosugr.supabase.co/auth/v1
#   geonex.jwt.secret:          <Supabase JWT secret>

# 2. Build & run
mvn clean spring-boot:run
# → Listens on http://localhost:8081
```

Then point the TanStack app at it by adding to `.env`:

```dotenv
JAVA_CORE_URL="http://localhost:8081"
JAVA_CORE_ENABLED="true"
```

When `JAVA_CORE_ENABLED=true`, `src/server/transfer.functions.ts` proxies money-movement calls to the Java service. When `false` (default for the Lovable preview), it falls back to the in-database `complete_transfer` Postgres RPC so the demo works without a local JVM.

### Smoke test

```bash
# Health
curl http://localhost:8081/api/v1/health
# → {"status":"UP"}

# Transfer (replace <JWT> with a Supabase access token)
curl -X POST http://localhost:8081/api/v1/transfers \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"fromAccountId":"...","toAccountNumber":"GNX0000000001","amount":"125.50","note":"rent","idempotencyKey":"550e8400-..."}'
```

---

## 3. Frontend: TanStack Start

### Routing

File-based, in `src/routes/`. Flat dot-separated names:

| File | URL |
|------|-----|
| `index.tsx` | `/` |
| `login.tsx`, `signup.tsx` | `/login`, `/signup` |
| `app.tsx` | `/app` (layout w/ sidebar + `<Outlet/>`) |
| `app.index.tsx` | `/app` (dashboard) |
| `app.accounts.tsx` | `/app/accounts` |
| `app.statements.tsx` | `/app/statements` |
| `app.transfer.tsx` | `/app/transfer` |
| `api.risk-score.ts` | `/api/risk-score` (server route) |

`src/routeTree.gen.ts` is auto-generated — never edit.

### Execution model

- Components & loaders are **isomorphic** (run server + client). Anything sensitive lives inside `createServerFn` (`src/server/*.functions.ts`) or `*.server.ts` helpers — the Vite plugin strips these from the client bundle.
- Browser Supabase client: `src/integrations/supabase/client.ts`.
- Server-authenticated client: `src/integrations/supabase/auth-middleware.ts` (validates the bearer token, injects `userId` + scoped client).
- Admin client (service role): `src/integrations/supabase/client.server.ts` — only ever imported from `*.server.ts` files.

### Design system

`src/styles.css` defines OKLCH design tokens for the warm-fintech palette (terracotta + sand + charcoal + gold). Components consume **only semantic tokens** (`bg-background`, `text-foreground`, `bg-primary`, etc.) — never raw colors. Shadcn variants extend this with `primary`, `glass`, `pill-low/medium/high` for risk badges.

---

## 4. ML Fraud-Detection Pipeline (LLM-Based)

File: `src/server/risk-engine.server.ts` exposed via `src/routes/api.risk-score.ts`.

### Feature vector

Built per-transaction from DB history + request context:

```ts
{
  amount: number;
  hour_of_day: number;            // 0–23 local
  location_distance_km: number;   // current vs nearest trusted city (Haversine)
  device_new: boolean;
  txn_frequency_24h: number;      // count of txns in last 24h
  payee_trust_score: number;      // 0–1, derived from payee history
  user_avg_amount_30d: number;
  user_max_amount_30d: number;
}
```

### Model call

- **Model**: `google/gemini-2.5-flash` via the Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`).
- **Tool-calling** with a strict JSON schema forces the response shape:
  ```ts
  {
    risk_score: number;       // 0..1
    tier: "LOW" | "MEDIUM" | "HIGH";
    top_factors: string[];    // human-readable, e.g. "Amount 8x avg", "New city +2400km"
    reasoning: string;
  }
  ```
- **Calibration thresholds**:
  - `< 0.30` → `LOW` → straight-through
  - `0.30 – 0.70` → `MEDIUM` → email OTP step-up
  - `> 0.70` → `HIGH` → block + admin queue
  - `> 0.85` → also requires confidential-ID verification

### Persistence

Every call writes a row to `risk_assessments` with the full feature vector + LLM JSON. The customer UI sees only `tier` + a friendly factor list; the admin panel sees the raw score and reasoning.

### Why an LLM instead of XGBoost?

For an investor-facing MVP this is a deliberate choice:

- **Zero training data ops** — instantly usable demo with no XGBoost training pipeline.
- **Context-aware**: the model can weigh "$5k at 3am from a brand-new city" differently from "$5k at noon from Hyderabad" without hand-engineering interactions.
- **Swap-out path** is simple: replace `risk-engine.server.ts` with a `WebClient` call to a Python FastAPI endpoint serving an XGBoost model — the rest of the system is unaffected.

---

## 5. Geo-Lock & Adaptive Security

- On signup the user picks a **home city** (`src/lib/cities.ts` ships a curated list with lat/lng).
- `src/lib/geo-context.tsx` simulates the current device city (in production this would be a real IP-geo lookup at the edge).
- **Distance** between current city and nearest trusted city feeds the ML feature vector via Haversine in `src/lib/cities.ts`.
- Successful OTP verification **auto-promotes** the current city to a trusted location.
- The top navbar shows the current city with a status pill: 🟢 trusted, 🟡 new, 🔴 blocked.

---

## 6. OTP Flow

- **Issue**: `issueOtp(transactionId)` — generates a 6-digit code, expires in 5 min, max 3 attempts. Stored in `otp_challenges` + emailed via Supabase.
- **Verify**: `verifyOtp(transactionId, code)` — on success calls the Postgres RPC `complete_transfer(_transaction_id)` (or the Java core when enabled) to atomically debit + mark the transaction `success`.
- UI: `src/components/OtpModal.tsx` — countdown, retry, cancel; demo-mode displays the code inline.

---

## 7. Database Schema

Migrations are in `supabase/migrations/*.sql` (apply in filename order if seeding a fresh project):

| Table | Purpose |
|-------|---------|
| `profiles` | Display name, phone, home_city |
| `user_roles` | `(user_id, role)` — `customer` / `admin`, queried via `has_role()` SECURITY DEFINER |
| `accounts` | Type, masked number, balance |
| `transactions` | from/to/amount/status/risk_tier/risk_score |
| `risk_assessments` | Full LLM feature vector + response |
| `otp_challenges` | Code hash, expires_at, attempts |
| `security_events` | login, geo_anomaly, freeze, admin_action |

### Key functions

- `has_role(_user_id uuid, _role app_role) → boolean` — used in RLS policies, prevents recursion.
- `handle_new_user()` — trigger on `auth.users` insert; creates profile + role + starter checking account ($1,000).
- `complete_transfer(_transaction_id uuid)` — `FOR UPDATE` lock on the transaction + atomic balance debit + status update.

All tables have RLS enabled; customers see only their `auth.uid()` rows, admins use `has_role(auth.uid(),'admin')` policies.

---

## 8. Security Notes

- **Service-role key** (`SUPABASE_SERVICE_ROLE_KEY`) is read **only** inside `*.server.ts` modules, never imported into components or loaders.
- **JWT** flows from the browser → TanStack server fn → Java core, where `SecurityConfig` validates HS256 against the Supabase JWT secret.
- **Idempotency keys** on every transfer prevent double-spend on retries.
- **Roles** are stored in their own table — never on `profiles` — to prevent privilege-escalation via row updates.
- **CSP / HTTPS / HSTS** are enforced by Lovable's hosting layer.

---

## 9. Build & Deploy

- Lovable preview/published builds run on **Cloudflare Workers** with `nodejs_compat` (config in `wrangler.jsonc`).
- The Java core deploys independently (e.g. **Fly.io**, **Railway**, **AWS ECS Fargate**, or any JVM host). Set `JAVA_CORE_URL` to its public HTTPS URL in the TanStack production env.

---

## 10. Roadmap (post-MVP)

- Replace LLM scorer with a real XGBoost FastAPI service (wire-compatible).
- Webhook-driven anomaly detection (Kafka → Flink).
- Real KYC ingestion + document upload (Lovable Storage).
- SMS OTP fallback via Twilio.
- Admin-only dashboards: cohort analysis, false-positive tracking, drift monitoring.

---

**Questions or changes?** Edit this doc directly or open a PR. The README's quick-start instructions and this development guide are the only two files that should ever describe how GEONEX runs locally.
