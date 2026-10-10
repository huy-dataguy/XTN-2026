# Refactor implementation and runbook

Branch: feature/redesign-ecommerce. Changes are in the local worktree; no production
migration/deployment or merge to main was performed. Earlier audit artifacts describe
baseline ecbac8b, not the refactored implementation.

## Implemented

- Pure domain policies for calendar, input, safe VND arithmetic, valuation and
  historical balance validation. Application modules: inventory, allocation,
  declarations/corrections, reporting periods and analytics. Mongo persistence and
  transaction adapter; HTTP routers separate commerce, periods, staff/finance.
- Atomic multi-line reservation, amendments by delta, partial receipts, cancellation
  releases only unreceived stock. Explicit stock adjustment and warehouse hư/tặng.
- Immutable receipt lots with order price/cost snapshots; report references lot IDs,
  effective timestamps, positive integer deltas. Server owns metrics; forged totals
  rejected. Approved corrections reverse old movement and post replacement in one
  transaction, checking the full affected timeline. Later closed periods block
  backdated posting until reopened; later member completion is invalidated.
- One member inventory serialization guard across weeks prevents write skew between
  two independent periods. Expected order/report version guards stale writes.
- Vietnam Monday periods; explicit deadlines, member extensions/reasons, completion,
  close and reopen. Period write guard serializes close vs affected commands.
- Snapshot analytics produces calendar member×week rows, opening/closing stock,
  revenue, COGS, gross profit, contribution, weekly and range revenue KPI; range KPI
  uses total actual / total targets and stays unknown when incomplete/missing targets.
  Warehouse damage/gift expenses included in organization contribution. Costs unknown
  remain null. Money cannot silently exceed safe integer arithmetic.
- Identity DB resolves role/active/tokenVersion per request; logout/disable/reset
  invalidates old sessions. No public admin registration/default password/hash leak
  or username-based superuser. Password >=12 characters, <=72 UTF-8 bytes for bcrypt.
- Versioned API /api/v1; unsafe legacy routes removed and /api returns 410. Structured
  errors/request IDs, rate limiting, explicit CORS; DB/topology/config ready before
  listen, health endpoints and graceful shutdown.
- Frontend replacement uses feature pages, typed contracts, strict tsc, TSX lint,
  TanStack Query, lazy routes, accessible forms and Vietnam/VND presentation.
  Operations screens retain task state transitions and bank cash/void history.
  No browser-generated financial aggregates remain. Bank tags retain non-additive filtering; purchase
  refunds/commission are not included in these workflows. Historical raw data is
  preserved in the DB and must be inventoried before rollout.
- Updated dependency lockfiles and removed unused libraries; npm audit reports
  zero known vulnerabilities for both projects at verification time.

## Deliberate business defaults

Per-receipt cost comes from the order's explicit unit-cost snapshot. No automatic
FIFO/weighted-average policy is implied. Unknown costs do not become zero. KPI is
revenue target configured per member/week; other metrics are shown separately.
Default report deadline Monday 23:59:59.999 +07 after the week, adjustable by admin.
This deadline is a configurable business decision for future changes, not a claim
about legacy practice. Contribution is before commissions/operating costs and taxes;
there is no claim of net accounting profit. Dispatch/receive are one atomic handoff
in this release; a distinct in-transit transport lifecycle is not implemented.

## Local run

Node 24, MongoDB replica set required. Local development uses persistent Mongo
on 27017; see [local development](local-development.md). Never point tests to
the development or production DB.

```bash
cd backend
npm ci
cp .env.example .env
# Fill local MONGO_URI and JWT_SECRET.
# Fresh DB only: set BOOTSTRAP_ADMIN=true, ADMIN_USERNAME, ADMIN_PASSWORD.
npm run bootstrap:admin
# Remove bootstrap password/environment afterward.
npm start
```

```bash
cd frontend
npm ci
npm run dev
```

Vite proxies /api to localhost:5000. Frontend API default /api/v1. For separate
production hosts set VITE_API_BASE_URL=https://your-backend.example/api/v1 before
build and set CORS_ORIGINS to the frontend origin. Vite proxy is development only.
The old hardcoded backend URL is intentionally removed.

## Automated verification

Start fresh isolated test infrastructure from the repository root:

```bash
bash scripts/start-test-mongo.sh
```

This creates three labeled Mongo 7.0 containers, a dedicated network, and binds only
127.0.0.1:27028. Existing named containers/network are never replaced. Port 27028
and database xtn_refactor_test_* are enforced in
the integration harness. Each rerun needs a fresh DB suffix, no drop/truncate.

```bash
cd backend
TEST_MONGO_URI='mongodb://127.0.0.1:27028/xtn_refactor_test_run7?directConnection=true' npm test
```

Browser tests require fresh dedicated browser DB, seeded by
backend/scripts/seed-browser-fixture.js and served by backend/server.js; Playwright
starts the built frontend preview automatically on 5174 (API test port 5001). Seed and launch API from a second shell:

```bash
cd backend
TEST_MONGO_URI="mongodb://127.0.0.1:27028/xtn_refactor_test_browser_local1?directConnection=true" node scripts/seed-browser-fixture.js
MONGO_URI="mongodb://127.0.0.1:27028/xtn_refactor_test_browser_local1?directConnection=true" JWT_SECRET="local-test-only-secret-longer-than-32-characters" NODE_ENV=test PORT=5001 npm start
```

Fixture credentials are public test-only strings; do not
seed them outside the URI guarded local test database.

```bash
cd frontend
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

Optional isolated election test after a successful integration run:

```bash
FAILOVER_TEST_DB=xtn_refactor_test_run7 node scripts/verify-failover.cjs
```

CI workflow reproduces these gates on an isolated runner. Request shape contracts
are exported to contracts/requests.v1.json by backend/scripts/export-contracts.js.
JSON Schema is supplementary: authorization/state/timeline rules remain server
validation, not encoded as a plain field schema.

## Recorded verification

Final local run: Node 24.15.0, MongoDB 7.0 on a dedicated three-node replica set.
21/21 backend tests passed, including 17 real-DB API cases; 4/4 Playwright browser
workflows passed. TypeScript, TSX lint, production build and both dependency audits
passed. Browser screenshots checked at desktop and 390px mobile width; tables scroll
inside their panels. Frontend main JS is approximately 382 KB before gzip.
The CI workflow was authored but has not been run on GitHub in this task.
Latest command exit codes/results are in evidence/full-check/verification.json.
Five real startup rejection gates and a local Mongo restart/persistence check also
passed. Browser tests exercise the built frontend, separate from the live dev app.

## Migration and release gate

The user explicitly authorized continuing local migrations and overriding the old
skill approval gate. Index migrations 001 and 002 have been applied to `xtn_local` and isolated
benchmark/test databases; no cloud/production data migration was executed. Startup
still disables automatic index creation: migrations are explicit and repeatable.
Deterministic _id claims protect command, username and bank-reference uniqueness.
Existing legacy username uniqueness still needs inventory during data cutover.

```bash
# From repository root; defaults to the local backend .env database.
node scripts/migrate-indexes.cjs          # read-only inspection
node scripts/migrate-indexes.cjs --apply  # create missing reviewed indexes, no drop
```

The script only accepts 127.0.0.1:27017/xtn_local or isolated test databases on 27028.
An existing index with the same name and incompatible options fails explicitly.
Equivalent existing indexes are retained. Repeating the migration is verified.

Read-only assessment:

```bash
cd backend
npm run inspect:legacy
```

Required opening plan: confirm physical sellable/damaged warehouse counts and
pending reservations; per-member lots/balances/valuation; stable legacy IDs and
prices; effective dates and week allocations; orphan/duplicate reports; banks and
existing tags. Legacy stock has already been decremented on order creation and
cannot be treated as physical onHand. Products without inventoryVersion=1 refuse
writes rather than fabricate stock. Legacy orders/reports are not mixed into new
analytics: cutover must reconcile and migrate them or preserve a clearly separate
read-only history, with balances signed off.

Index definitions are in backend/migrations/001-query-indexes.plan.json and
002-list-query-indexes.plan.json and were
applied with scripts/migrate-indexes.cjs. The member lookup now examines 88 documents
for 88 results. Benchmark results before/after are recorded in scale-verification.md.
Test backup restore and compare old/new totals before production data cutover.
Bank tag filters are non-additive: one transaction may match several tags; sums
across tag categories must not be added. Raw legacy tags must not be discarded.

## Evidence limits

Tests verify real local MongoDB transactions and browser workflows. Three-node
replica election preserved test order/report/movement/command counts. This proves
that scenario on the tested topology, not every failure mode in production.
No production data correctness claim, restore drill, load SLO, multi-tenant hardening,
external payment matching, refunds or commission calculation is made.

Posting/closing also writes a shared SystemGuard in the same transaction. This
serializes backdated receipts/declarations against later period closure, including
a period newly created during the race. MemberPeriod completion in later weeks
is invalidated by either receipts or declarations. Receipts in weeks before member creation
are rejected to prevent totals disappearing from the membership calendar spine.
The shared guard trades posting throughput for correctness at this project scale;
benchmark before replacing it with a finer-grained scheme.

## Measured scale

See [scale-verification.md](scale-verification.md) for the indexed 1,000-member
benchmark, concurrent HTTP writes and browser proof. Twenty-three query indexes are applied in
local dev and isolated scale/test databases. Snapshot aggregation and page-scoped
inventory reconstruction preserve totals, unknown cost and correction semantics.
The full 26-week organization report has an empirical 5-client p95 of 5.8 seconds,
down from 7.6 seconds before indexes/page-scoped inventory. This is a local sample,
not a production SLO. Set ANALYTICS_PROFILE=1 on the backend only when inspecting
per-phase timings; logs contain phase/duration, not member or report payloads.
