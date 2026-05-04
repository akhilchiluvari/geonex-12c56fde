# GEONEX Banking Core (Java / Spring Boot)

Authoritative **ledger / system of record** for GEONEX. The TanStack frontend
handles UX, auth, and AI risk scoring; once a transfer is approved (and OTP-verified
for MEDIUM risk), the Node SSR layer proxies the request here and Spring Boot
performs the atomic balance movement inside a JDBC transaction with a
`SELECT ... FOR UPDATE` row lock.

## Stack

- Java 21, Spring Boot 3.3
- Spring Web + Spring Data JPA (Hibernate) + Spring Security
- PostgreSQL (the same Lovable Cloud / Supabase database as the frontend)
- HikariCP connection pool
- `com.auth0:java-jwt` for verifying Supabase HS256 access tokens

## Run locally

```bash
cd services/banking-core-java

export DB_URL="jdbc:postgresql://<host>:5432/postgres"
export DB_USER="postgres"
export DB_PASSWORD="<db password>"
export SUPABASE_JWT_SECRET="<from Cloud → Settings → API → JWT Secret>"

./mvnw spring-boot:run        # or: mvn spring-boot:run
```

The service binds to `http://localhost:8081`.

## Wire it into the Node app

In the project root `.env`:

```
JAVA_CORE_ENABLED=true
JAVA_CORE_URL=http://localhost:8081
```

When the flag is on, `src/server/transfer.functions.ts` proxies verified
transfers to `POST /api/v1/transfers` instead of calling the Postgres
`complete_transfer` RPC directly.

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET  | `/api/v1/health`    | none | liveness probe |
| POST | `/api/v1/transfers` | `Authorization: Bearer <supabase-jwt>` + `X-User-Id` | atomic debit + transaction insert |

## Why Java here

- Strong typing + JPA give compile-time safety for money movement code.
- `@Transactional` + pessimistic row locks are battle-tested for ledger workloads.
- Keeps the "system of record" cleanly separated from the React/edge layer.
