# Refactor contract — 2026-10-09

Scope: retain Express/Mongoose/React; one operational database; domain policies
separate from Mongo adapters and HTTP. Versioned /api/v1 replaces legacy writes;
/api legacy paths return 410 (no unsafe alternate write route).

Confirmed: multiple orders/receipts/delta reports weekly; delayed receipts and
explicit member-period extensions; damaged inventory may be gifted. Use Vietnam
calendar weeks Monday→Monday. Submission deadline is Monday 23:59:59.999 Vietnam
after that week; admin may extend, with reason. Performance date is explicit and
separate from submission. Targets optional per member-period, configured by admin.

Inventory: warehouse onHand and reserved separate. New products post opening
movement. Legacy products without inventoryVersion=1 fail writes until reviewed
migration; no inference from stock. Allocation reserves atomically; partial receipt
moves physical goods to member at actual receipt time (no separate transport stage
in this release). Each receipt is a valuation lot, with order snapshot selling price
and optional unit cost. This is explicit per-receipt costing, not implied FIFO.
Reports reference lot IDs and effective timestamps; positive integer deltas only.
DAMAGE: sellable→damaged, cost expense once. GIFT_DAMAGED: damaged→outside,
no second expense; GIFT_GOOD: sellable→outside, own cost. Sales are sold units
at lot snapshot price. Cost missing => profit=null. Refund/returns/commission and
shipping are not invented: dashboard labels contribution before such expenses.

Transactional command unit: stable actor+operation+idempotency key, canonical
payload hash, document+reservation/movement+audit+stored result, same session.
Expected state/version controls amendments. Every member-lot historical balance
must stay nonnegative after backdating/correction, not just its current balance.
Periods are persisted and touched inside approve/receive/close transactions so a
close vs write cannot pass concurrently. Multi-week analytics reads a DB snapshot,
returns member×week calendar spine, totals, missing-target flags and asOf time;
closing stock sums across lots, not across weeks. Member group snapshot on period
target configuration; absent snapshot explicitly uses current group with warning.

Approved reports immutable; corrections post reversals and a replacement under
admin authority with reason. Old report marked SUPERSEDED; latest revision retained.
Closed periods need explicit reopen before correction. Final reports require a
member-week completion marker; a submission alone is not completeness. More
submissions or receipts reset completion. Close requires all active members complete.

Auth: no public admin signup; distributor signup requires configured invite.
Server resolves active user and tokenVersion from DB per request. Password resets,
logout and disabling invalidate sessions. Admin-created passwords explicit >=12.
No impersonation until audited support can be fully validated; endpoint returns 410.
Strict JSON validation, structured errors, admin policy for internal tasks/finance,
request IDs, rate limiting, fail startup before listen if config/DB/topology invalid.

Verification: unit domain, real Mongo replica-set API tests including rollback,
concurrency, retries, damage→gift, delayed/week backdating, corrections, session
invalidation. Frontend strict tsc/lint/build + Playwright browser flow on isolated DB.
No production deployment/schema migration in this task. Migration deliverable is
read-only inventory/source inspection plus reviewed opening-stock plan.

Posting/closing also writes a shared SystemGuard in the same transaction. This
serializes backdated receipts/declarations against later period closure, including
a period newly created during the race. MemberPeriod completion in later weeks
is invalidated by either receipts or declarations. Receipts in weeks before member creation
are rejected to prevent totals disappearing from the membership calendar spine.
The shared guard trades posting throughput for correctness at this project scale;
benchmark before replacing it with a finer-grained scheme.
