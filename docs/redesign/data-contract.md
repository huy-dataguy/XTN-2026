# Data contracts

Money: safe integer VND; multiplication/sum overflow rejected. IDs: ObjectId hex
strings across HTTP. Period IDs: YYYY-MM-DD Monday in Asia/Ho_Chi_Minh. Timestamps:
ISO with explicit timezone; no future business timestamps. Lists: bounded limit
(default 50, max 200), offset. Analytics range: <=26 weeks.

Receipt lot: orderId/memberId/productId/productName/quantity/price/unitCost nullable,
effectiveAt/createdAt; immutable. Movement: lotId nullable, memberId nullable for
warehouse, productId, sellableDelta/damagedDelta, sold/damage/gifts, revenue,
cogs/damageCost/giftCost nullable, effectiveAt/periodId, sourceId, actorId, createdAt.
Correction movements negate original values and reference source; no mutation.

Report: memberId/periodId/lines(lotId,effectiveAt,sold,damaged,giftGood,giftDamaged)/
notes/status/version/replacesId nullable/submittedAt/approvedAt; totals derived.
Period: id/revision/status OPEN|CLOSED; MemberPeriod: memberId/periodId,
extensionUntil/extensionReason/complete/completedAt/targetRevenue nullable/group snapshot.
Default deadline is calculated from period bounds; API returns deadlineAt.
Product: name/price/unitCost nullable/onHand/damagedOnHand/reserved/active/inventoryVersion.
Command: actor+operation+key identity, requestHash, response (no secrets).
Audit: actor/action/source/reason/after/time; no password/hash/token in returned DTOs.

A pending or rejected report does not contribute to sales/profit. Missing reports
are incomplete, not zeros represented as verified performance. Missing targets/cost
stay nullable. Cash IN-OUT labeled net cash flow, never revenue/profit/bank balance.
