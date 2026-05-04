# GEONEX — AI-Powered Digital Banking Platform

GEONEX is a production-grade banking simulation with adaptive, ML-based fraud detection, geo-lock security, OTP step-up authentication, and a full transaction lifecycle. It is built on **TanStack Start (React 19 + Vite 7)** for the frontend and orchestration layer, **Lovable Cloud (Supabase: Postgres + Auth + RLS + Email)** for persistence and identity, and **Lovable AI Gateway (Gemini)** as the live ML risk scorer.

> This README is the single source of truth for running GEONEX **locally in VS Code** after cloning the GitHub repo, plus a deep architecture / development guide (including how the **Java Spring Boot** core fits into the system).

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone the Repository](#2-clone-the-repository)
3. [Open in VS Code](#3-open-in-vs-code)
4. [Install Dependencies](#4-install-dependencies)
5. [Environment Variables (`.env`)](#5-environment-variables-env)
6. [Run the Dev Server](#6-run-the-dev-server)
7. [Demo Accounts](#7-demo-accounts)
8. [Production Build & Preview](#8-production-build--preview)
9. [Project Structure](#9-project-structure)
10. [Troubleshooting](#10-troubleshooting)
11. [Development Documentation →](./docs/DEVELOPMENT.md)

---

## 1. Prerequisites

Install the following on your machine before cloning:

| Tool | Version | Why | Install |
|------|---------|-----|---------|
| **Node.js** | ≥ 20.11 LTS | Vite 7 / TanStack Start runtime | https://nodejs.org |
| **Bun** | ≥ 1.1 (recommended) **or npm 10+** | Fast install + lockfile | https://bun.sh |
| **Git** | any recent | Clone the repo | https://git-scm.com |
| **VS Code** | latest | IDE | https://code.visualstudio.com |
| **Java JDK** | 21 LTS *(optional, only if you run the Java microservice — see [DEVELOPMENT.md](./docs/DEVELOPMENT.md#java-spring-boot-core))* | Spring Boot core | https://adoptium.net |
| **Maven** | 3.9+ *(optional, with Java)* | Builds the Spring service | https://maven.apache.org |

### Recommended VS Code Extensions

Install these from the Extensions panel (`Ctrl+Shift+X`):

- **ESLint** — `dbaeumer.vscode-eslint`
- **Prettier — Code formatter** — `esbenp.prettier-vscode`
- **Tailwind CSS IntelliSense** — `bradlc.vscode-tailwindcss`
- **TanStack Router** *(optional, route tree IntelliSense)* — `tanstack.tanstack-router`
- **Supabase** *(optional)* — `supabase.supabase-vscode`
- **Extension Pack for Java** *(only if running the Java service)* — `vscjava.vscode-java-pack`

---

## 2. Clone the Repository

```bash
# HTTPS
git clone https://github.com/<your-username>/geonex.git

# or SSH
git clone git@github.com:<your-username>/geonex.git

cd geonex
```

---

## 3. Open in VS Code

```bash
code .
```

When VS Code prompts, **Trust the workspace** so ESLint/Prettier and the TanStack Router plugin can run.

---

## 4. Install Dependencies

We use **Bun** (faster, deterministic). npm also works.

```bash
# preferred
bun install

# or
npm install
```

This installs React 19, TanStack Start/Router, Supabase JS, Tailwind v4, shadcn/Radix UI, Recharts, Zod, and the Lovable Vite plugin.

---

## 5. Environment Variables (`.env`)

Create a `.env` file in the project root (the file is **git-ignored**). All `VITE_*` keys are public/anon — safe to ship to the browser.

```dotenv
# --- Lovable Cloud (Supabase) ---
VITE_SUPABASE_URL="https://bjytecimszmnjqyosugr.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqeXRlY2ltc3ptbmpxeW9zdWdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxODUwMzksImV4cCI6MjA5Mjc2MTAzOX0.uwuufatDJkF3Nwc1RW0v7OHPS9VeNY4BeTVBwtv80a4"
VITE_SUPABASE_PROJECT_ID="bjytecimszmnjqyosugr"

# --- Server-only (DO NOT prefix with VITE_) ---
# Used by createServerFn handlers and the AI risk-engine route.
SUPABASE_URL="https://bjytecimszmnjqyosugr.supabase.co"
SUPABASE_PUBLISHABLE_KEY="<same as VITE_SUPABASE_PUBLISHABLE_KEY>"
SUPABASE_SERVICE_ROLE_KEY="<paste from Lovable Cloud → Settings → API>"

# --- Lovable AI Gateway (fraud scorer) ---
LOVABLE_API_KEY="<paste from Lovable → AI → API Keys>"
```

Where to get the values:
- `VITE_SUPABASE_*` — already set above; they're the public anon credentials of the demo Cloud project.
- `SUPABASE_SERVICE_ROLE_KEY` — open the Lovable editor → **Cloud → Settings → API** → copy *service_role* key.
- `LOVABLE_API_KEY` — Lovable editor → **AI → API Keys → Create key**.

> **If you point at your own Supabase project instead**, run the SQL files in `supabase/migrations/` against it (in order) so the `profiles`, `accounts`, `transactions`, `risk_assessments`, `otp_challenges`, `security_events`, and `user_roles` tables exist with their RLS policies and the `complete_transfer` / `has_role` / `handle_new_user` functions.

---

## 6. Run the Dev Server

```bash
bun run dev
# or: npm run dev
```

Output:

```
  VITE v7.x  ready in xxx ms
  ➜  Local:   http://localhost:8080/
```

Open **http://localhost:8080** in your browser.

The TanStack Router Vite plugin auto-generates `src/routeTree.gen.ts` on save — **don't edit that file manually**.

---

## 7. Demo Accounts

Click the **Demo accounts** panel on `/login` to one-click sign in:

| Role | Email | Password |
|------|-------|----------|
| Customer A | `priya.sharma@geonex.demo` | `Demo1234!` |
| Customer B | `arjun.mehta@geonex.demo`  | `Demo1234!` |
| Admin     | `admin@geonex.demo`        | `Admin1234!` |

Each customer is auto-provisioned with a Checking account (+$1,000 starter balance) via the `handle_new_user` Postgres trigger.

---

## 8. Production Build & Preview

```bash
bun run build       # outputs .output/ (Cloudflare Worker bundle)
bun run preview     # serves the built app locally
```

Lint / format:

```bash
bun run lint
bun run format
```

---

## 9. Project Structure

```
geonex/
├── src/
│   ├── routes/                # File-based routing (TanStack Router)
│   │   ├── __root.tsx         # Root layout (html/head/body shell)
│   │   ├── index.tsx          # Landing page
│   │   ├── login.tsx | signup.tsx
│   │   ├── app.tsx            # Customer shell (sidebar + Outlet)
│   │   ├── app.index.tsx      # Dashboard
│   │   ├── app.accounts.tsx
│   │   ├── app.statements.tsx
│   │   ├── app.transfer.tsx   # 4-step risk-gated transfer flow
│   │   └── api.risk-score.ts  # Server route → AI risk scorer
│   ├── server/                # createServerFn handlers (RPC layer)
│   │   ├── risk-engine.server.ts
│   │   ├── otp.functions.ts
│   │   └── transfer.functions.ts
│   ├── components/            # AppLayout, OtpModal, StatusPills, ui/*
│   ├── lib/                   # auth-context, geo-context, banking-actions, cities, format
│   ├── integrations/supabase/ # client, client.server, auth-middleware, types (auto-gen)
│   └── styles.css             # Design tokens (warm fintech palette)
├── supabase/
│   ├── config.toml
│   └── migrations/*.sql       # Schema, RLS, RPCs
├── docs/
│   └── DEVELOPMENT.md         # Architecture, ML, Java service guide
├── vite.config.ts
├── package.json
└── README.md
```

---

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| `Failed to resolve import` | Re-run `bun install`. Make sure you're on Node ≥ 20.11. |
| Login works but `/app` redirects back to `/login` | Your `SUPABASE_*` server vars don't match the project the browser client is pointing to. They must be the **same** project. |
| `401 Unauthorized` from `/api/risk-score` | `LOVABLE_API_KEY` is missing from `.env`. Restart the dev server after adding it. |
| `process.env.X is undefined` inside a server function | Read `process.env` **inside** `.handler()`, not at module top-level. Restart `vite dev`. |
| Port 8080 already in use | `PORT=3000 bun run dev` |
| `window is not defined` during SSR | A browser-only module is imported at module scope. Move it inside a `useEffect` or a `<ClientOnly>` boundary. |
| Stale route types after adding a new route | Stop dev server, delete `src/routeTree.gen.ts`, restart `bun run dev`. The plugin regenerates it. |

---

## Continue Reading

➡️ **[docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)** — full architecture, ML risk engine details, security model, **and the Java Spring Boot core service** (where Java lives in GEONEX, why, and how to run it locally alongside the TanStack app).
