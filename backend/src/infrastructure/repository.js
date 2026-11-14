const { objectId, one, many } = require("./db");

const number = (value) => (value == null ? null : Number(value));
const json = (value) => (value == null ? null : JSON.stringify(value));

function userRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    username: r.username,
    password: r.password,
    name: r.name,
    role: r.role,
    group: r.group_name,
    active: r.active,
    inventoryRevision: r.inventory_revision,
    tokenVersion: r.token_version,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
function productRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    price: number(r.price),
    unitCost: number(r.unit_cost),
    onHand: r.on_hand,
    damagedOnHand: r.damaged_on_hand,
    reserved: r.reserved,
    active: r.active,
    inventoryVersion: r.inventory_version,
    category: r.category,
    image: r.image,
    stock: r.stock,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
function orderRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    memberId: r.member_id,
    memberName: r.member_name,
    intendedPeriodId: r.intended_period_id,
    items: r.items || [],
    totalAmount: number(r.total_amount),
    status: r.status,
    version: r.version,
    schemaVersion: r.schema_version,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
function receiptRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    orderId: r.order_id,
    memberId: r.member_id,
    productId: r.product_id,
    productName: r.product_name,
    quantity: r.quantity,
    price: number(r.price),
    unitCost: number(r.unit_cost),
    effectiveAt: r.effective_at,
    createdAt: r.created_at,
  };
}
function reportRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    memberId: r.member_id,
    memberName: r.member_name,
    periodId: r.period_id,
    lines: r.lines || [],
    notes: r.notes,
    status: r.status,
    version: r.version,
    replacesId: r.replaces_id,
    submittedAt: r.submitted_at,
    approvedAt: r.approved_at,
    schemaVersion: r.schema_version,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
function movementRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    productId: r.product_id,
    lotId: r.lot_id,
    memberId: r.member_id,
    sourceId: r.source_id,
    kind: r.kind,
    sellableDelta: r.sellable_delta,
    damagedDelta: r.damaged_delta,
    sold: r.sold,
    damaged: r.damaged,
    giftGood: r.gift_good,
    giftDamaged: r.gift_damaged,
    revenue: number(r.revenue),
    cogs: number(r.cogs),
    damageCost: number(r.damage_cost),
    giftCost: number(r.gift_cost),
    effectiveAt: r.effective_at,
    periodId: r.period_id,
    actorId: r.actor_id,
    createdAt: r.created_at,
  };
}
function periodRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    status: r.status,
    revision: r.revision,
    closedAt: r.closed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
function memberPeriodRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    memberId: r.member_id,
    periodId: r.period_id,
    extensionUntil: r.extension_until,
    extensionReason: r.extension_reason,
    complete: r.complete,
    completedAt: r.completed_at,
    targetRevenue: number(r.target_revenue),
    group: r.group_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
function statementRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    transactionDate: r.transaction_date,
    type: r.type,
    amount: number(r.amount),
    partnerName: r.partner_name,
    description: r.description,
    reference: r.reference,
    tags: r.tags || [],
    voided: r.voided,
    createdAt: r.created_at,
  };
}
function tagRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    active: r.active,
    createdAt: r.created_at,
  };
}
function groupRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    active: r.active,
    createdAt: r.created_at,
  };
}
function taskRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    assignee: r.assignee_id,
    creator: r.creator_id,
    status: r.status,
    priority: r.priority,
    dueDate: r.due_date,
    active: r.active,
    createdAt: r.created_at,
  };
}
function auditRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    actorId: r.actor_id,
    action: r.action,
    sourceId: r.source_id,
    reason: r.reason,
    after: r.after,
    createdAt: r.created_at,
  };
}

async function getUserById(executor, id) {
  return userRow(await one(executor, "SELECT * FROM users WHERE id = $1", [id]));
}
async function getUserForUpdate(executor, id) {
  return userRow(
    await one(executor, "SELECT * FROM users WHERE id = $1 FOR UPDATE", [id]),
  );
}
async function getUserByUsername(executor, username) {
  return userRow(
    await one(executor, "SELECT * FROM users WHERE username = $1", [username]),
  );
}
async function countUsers(executor) {
  const row = await one(executor, "SELECT count(*)::int AS count FROM users");
  return row.count;
}
async function usernameExists(executor, username) {
  return !!(await one(
    executor,
    "SELECT 1 AS found FROM users WHERE username = $1",
    [username],
  ));
}
async function createUser(executor, data) {
  const id = data.id || objectId();
  const row = await one(
    executor,
    `INSERT INTO users (id, username, password, name, role, group_name, active, inventory_revision, token_version, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, now())) RETURNING *`,
    [
      id,
      data.username,
      data.password,
      data.name,
      data.role,
      data.group || "",
      data.active !== false,
      data.inventoryRevision || 0,
      data.tokenVersion || 0,
      data.createdAt || null,
    ],
  );
  return userRow(row);
}
async function updateUser(executor, id, patch) {
  const sets = [],
    values = [id];
  const add = (column, value) => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };
  if (patch.name !== undefined) add("name", patch.name);
  if (patch.group !== undefined) add("group_name", patch.group);
  if (patch.active !== undefined) add("active", patch.active);
  if (patch.password !== undefined) add("password", patch.password);
  if (patch.tokenVersion !== undefined) add("token_version", patch.tokenVersion);
  if (patch.inventoryRevision !== undefined)
    add("inventory_revision", patch.inventoryRevision);
  if (!sets.length) return getUserById(executor, id);
  sets.push("updated_at = now()");
  const row = await one(
    executor,
    `UPDATE users SET ${sets.join(", ")} WHERE id = $1 RETURNING *`,
    values,
  );
  return userRow(row);
}
async function bumpTokenVersion(executor, id) {
  const row = await one(
    executor,
    "UPDATE users SET token_version = token_version + 1, updated_at = now() WHERE id = $1 RETURNING *",
    [id],
  );
  return userRow(row);
}
async function bumpInventoryRevision(executor, id) {
  const row = await one(
    executor,
    "UPDATE users SET inventory_revision = inventory_revision + 1, updated_at = now() WHERE id = $1 RETURNING *",
    [id],
  );
  return userRow(row);
}
async function listUsers(executor, { limit, offset }) {
  const rows = await many(
    executor,
    "SELECT * FROM users ORDER BY created_at DESC, id DESC OFFSET $1 LIMIT $2",
    [offset, limit],
  );
  return rows.map(userRow);
}
async function listMembers(
  executor,
  { createdBefore, memberId, activeOnly = false },
) {
  const rows = await many(
    executor,
    `SELECT * FROM users WHERE role = 'DISTRIBUTOR'
      ${activeOnly ? "AND active = true" : ""}
      AND created_at < $1 ${memberId ? "AND id = $2" : ""}
      ORDER BY created_at ASC, id ASC`,
    memberId ? [createdBefore, memberId] : [createdBefore],
  );
  return rows.map(userRow);
}

async function getProduct(executor, id) {
  return productRow(await one(executor, "SELECT * FROM products WHERE id = $1", [id]));
}
async function getProductForUpdate(executor, id) {
  return productRow(
    await one(executor, "SELECT * FROM products WHERE id = $1 FOR UPDATE", [id]),
  );
}
async function listProducts(executor, { limit, offset } = {}) {
  const rows = await many(
    executor,
    limit == null
      ? "SELECT * FROM products ORDER BY id"
      : "SELECT * FROM products ORDER BY created_at DESC, id DESC OFFSET $1 LIMIT $2",
    limit == null ? [] : [offset, limit],
  );
  return rows.map(productRow);
}
async function countLegacyProducts(executor) {
  const row = await one(
    executor,
    "SELECT count(*)::int AS count FROM products WHERE inventory_version IS DISTINCT FROM 1",
  );
  return row.count;
}
async function createProduct(executor, data) {
  const row = await one(
    executor,
    `INSERT INTO products (id, name, price, unit_cost, on_hand, damaged_on_hand, reserved, active, inventory_version, category, image)
     VALUES ($1, $2, $3, $4, $5, 0, 0, true, 1, $6, $7) RETURNING *`,
    [
      objectId(),
      data.name,
      data.price,
      data.unitCost,
      data.openingStock,
      data.category || "",
      data.image || "",
    ],
  );
  return productRow(row);
}
async function saveProduct(executor, product) {
  const row = await one(
    executor,
    `UPDATE products SET name = $2, price = $3, unit_cost = $4, on_hand = $5,
       damaged_on_hand = $6, reserved = $7, active = $8, inventory_version = $9,
       category = $10, image = $11, stock = $12, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [
      product.id,
      product.name,
      product.price,
      product.unitCost,
      product.onHand || 0,
      product.damagedOnHand || 0,
      product.reserved || 0,
      product.active !== false,
      product.inventoryVersion,
      product.category || "",
      product.image || "",
      product.stock ?? null,
    ],
  );
  return productRow(row);
}

async function createOrder(executor, data) {
  const row = await one(
    executor,
    `INSERT INTO orders (id, member_id, member_name, intended_period_id, items, total_amount, status, version, schema_version)
     VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', 0, 1) RETURNING *`,
    [
      objectId(),
      data.memberId,
      data.memberName,
      data.intendedPeriodId,
      json(data.items),
      data.totalAmount,
    ],
  );
  return orderRow(row);
}
async function getOrderForUpdate(executor, id) {
  return orderRow(
    await one(executor, "SELECT * FROM orders WHERE id = $1 FOR UPDATE", [id]),
  );
}
async function saveOrder(executor, order) {
  const row = await one(
    executor,
    `UPDATE orders SET items = $2, total_amount = $3, status = $4, version = $5, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [order.id, json(order.items), order.totalAmount, order.status, order.version],
  );
  return orderRow(row);
}
async function listOrders(executor, { memberId, limit, offset }) {
  const rows = await many(
    executor,
    `SELECT * FROM orders WHERE schema_version = 1 ${memberId ? "AND member_id = $3" : ""}
     ORDER BY created_at DESC, id DESC OFFSET $1 LIMIT $2`,
    memberId ? [offset, limit, memberId] : [offset, limit],
  );
  return rows.map(orderRow);
}
async function countLegacyOrders(executor) {
  const row = await one(
    executor,
    "SELECT count(*)::int AS count FROM orders WHERE schema_version IS DISTINCT FROM 1",
  );
  return row.count;
}

async function createReceipt(executor, data) {
  const row = await one(
    executor,
    `INSERT INTO receipts (id, order_id, member_id, product_id, product_name, quantity, price, unit_cost, effective_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [
      objectId(),
      data.orderId,
      data.memberId,
      data.productId,
      data.productName,
      data.quantity,
      data.price,
      data.unitCost,
      data.effectiveAt,
    ],
  );
  return receiptRow(row);
}
async function getReceiptForUpdate(executor, id) {
  return receiptRow(
    await one(executor, "SELECT * FROM receipts WHERE id = $1 FOR UPDATE", [id]),
  );
}
async function listReceiptsByMember(executor, memberId) {
  const rows = await many(
    executor,
    "SELECT * FROM receipts WHERE member_id = $1 ORDER BY effective_at, id",
    [memberId],
  );
  return rows.map(receiptRow);
}

async function createReport(executor, data) {
  const row = await one(
    executor,
    `INSERT INTO reports (id, member_id, member_name, period_id, lines, notes, status, version, replaces_id, submitted_at, approved_at, schema_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1) RETURNING *`,
    [
      objectId(),
      data.memberId,
      data.memberName,
      data.periodId,
      json(data.lines),
      data.notes || "",
      data.status || "PENDING",
      data.version || 0,
      data.replacesId || null,
      data.submittedAt || null,
      data.approvedAt || null,
    ],
  );
  return reportRow(row);
}
async function getReportForUpdate(executor, id) {
  return reportRow(
    await one(executor, "SELECT * FROM reports WHERE id = $1 FOR UPDATE", [id]),
  );
}
async function saveReport(executor, report) {
  const row = await one(
    executor,
    `UPDATE reports SET lines = $2, notes = $3, status = $4, version = $5,
       approved_at = $6, updated_at = now() WHERE id = $1 RETURNING *`,
    [
      report.id,
      json(report.lines),
      report.notes,
      report.status,
      report.version,
      report.approvedAt || null,
    ],
  );
  return reportRow(row);
}
async function listReports(executor, { memberId, limit, offset }) {
  const rows = await many(
    executor,
    `SELECT * FROM reports WHERE schema_version = 1 ${memberId ? "AND member_id = $3" : ""}
     ORDER BY created_at DESC, id DESC OFFSET $1 LIMIT $2`,
    memberId ? [offset, limit, memberId] : [offset, limit],
  );
  return rows.map(reportRow);
}
async function countLegacyReports(executor) {
  const row = await one(
    executor,
    "SELECT count(*)::int AS count FROM reports WHERE schema_version IS DISTINCT FROM 1",
  );
  return row.count;
}
async function pendingReportExists(executor, { periodId, memberId }) {
  const clauses = ["status = 'PENDING'", "schema_version = 1"];
  const params = [];
  if (periodId) {
    params.push(periodId);
    clauses.push(`period_id = $${params.length}`);
  }
  if (memberId) {
    params.push(memberId);
    clauses.push(`member_id = $${params.length}`);
  }
  const row = await one(
    executor,
    `SELECT 1 AS found FROM reports WHERE ${clauses.join(" AND ")} LIMIT 1`,
    params,
  );
  return !!row;
}

async function createMovement(executor, data) {
  const row = await one(
    executor,
    `INSERT INTO movements (id, product_id, lot_id, member_id, source_id, kind,
       sellable_delta, damaged_delta, sold, damaged, gift_good, gift_damaged,
       revenue, cogs, damage_cost, gift_cost, effective_at, period_id, actor_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *`,
    [
      objectId(),
      data.productId || null,
      data.lotId || null,
      data.memberId || null,
      data.sourceId || null,
      data.kind,
      data.sellableDelta || 0,
      data.damagedDelta || 0,
      data.sold || 0,
      data.damaged || 0,
      data.giftGood || 0,
      data.giftDamaged || 0,
      data.revenue || 0,
      data.cogs ?? null,
      data.damageCost ?? null,
      data.giftCost ?? null,
      data.effectiveAt,
      data.periodId || null,
      data.actorId || null,
    ],
  );
  return movementRow(row);
}
async function listMovementsByMember(executor, memberId) {
  const rows = await many(
    executor,
    "SELECT * FROM movements WHERE member_id = $1 ORDER BY effective_at, id",
    [memberId],
  );
  return rows.map(movementRow);
}
async function listMovementsBySourceKind(executor, sourceId, kind) {
  const rows = await many(
    executor,
    "SELECT * FROM movements WHERE source_id = $1 AND kind = $2 ORDER BY effective_at, id",
    [sourceId, kind],
  );
  return rows.map(movementRow);
}
async function countMovementsBySource(executor, sourceId) {
  const row = await one(
    executor,
    "SELECT count(*)::int AS count FROM movements WHERE source_id = $1",
    [sourceId],
  );
  return row.count;
}
async function listWarehouseCostMovements(executor, first, last) {
  const rows = await many(
    executor,
    `SELECT sold, damaged, gift_good, gift_damaged, revenue, cogs, damage_cost, gift_cost
     FROM movements WHERE member_id IS NULL AND kind = 'WAREHOUSE_ACTIVITY'
       AND effective_at >= $1 AND effective_at < $2`,
    [first, last],
  );
  return rows.map(movementRow);
}

async function openPeriod(executor, key) {
  const row = await one(
    executor,
    `INSERT INTO periods (id, status, revision) VALUES ($1, 'OPEN', 1)
     ON CONFLICT (id) DO UPDATE SET revision = periods.revision + 1, updated_at = now()
     RETURNING *`,
    [key],
  );
  return periodRow(row);
}
async function getPeriod(executor, id) {
  return periodRow(await one(executor, "SELECT * FROM periods WHERE id = $1", [id]));
}
async function getPeriodForUpdate(executor, id) {
  return periodRow(
    await one(executor, "SELECT * FROM periods WHERE id = $1 FOR UPDATE", [id]),
  );
}
async function getPeriods(executor, keys) {
  const rows = await many(executor, "SELECT * FROM periods WHERE id = ANY($1)", [
    keys,
  ]);
  return rows.map(periodRow);
}
async function savePeriod(executor, period) {
  const row = await one(
    executor,
    "UPDATE periods SET status = $2, revision = $3, closed_at = $4, updated_at = now() WHERE id = $1 RETURNING *",
    [period.id, period.status, period.revision, period.closedAt || null],
  );
  return periodRow(row);
}
async function laterClosedPeriodExists(executor, key) {
  return !!(await one(
    executor,
    "SELECT 1 AS found FROM periods WHERE id > $1 AND status = 'CLOSED' LIMIT 1",
    [key],
  ));
}

async function upsertMemberPeriod(executor, { memberId, key, group }) {
  const id = `${memberId}:${key}`;
  await many(
    executor,
    `INSERT INTO member_periods (id, member_id, period_id, complete, target_revenue, group_name)
     VALUES ($1, $2, $3, false, NULL, $4) ON CONFLICT (id) DO NOTHING`,
    [id, memberId, key, group || "Chưa phân nhóm"],
  );
  return memberPeriodRow(
    await one(executor, "SELECT * FROM member_periods WHERE id = $1 FOR UPDATE", [
      id,
    ]),
  );
}
async function getMemberPeriods(executor, { memberIds, keys }) {
  const rows = await many(
    executor,
    "SELECT * FROM member_periods WHERE member_id = ANY($1) AND period_id = ANY($2)",
    [memberIds, keys],
  );
  return rows.map(memberPeriodRow);
}
async function saveMemberPeriod(executor, state) {
  const row = await one(
    executor,
    `UPDATE member_periods SET extension_until = $2, extension_reason = $3,
       complete = $4, completed_at = $5, target_revenue = $6, group_name = $7, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [
      state.id,
      state.extensionUntil || null,
      state.extensionReason || null,
      state.complete === true,
      state.completedAt || null,
      state.targetRevenue ?? null,
      state.group || "Chưa phân nhóm",
    ],
  );
  return memberPeriodRow(row);
}
async function invalidateMemberPeriodsAfter(executor, { memberId, key }) {
  await many(
    executor,
    "UPDATE member_periods SET complete = false, completed_at = NULL, updated_at = now() WHERE member_id = $1 AND period_id > $2",
    [memberId, key],
  );
}

async function bumpGuard(executor, id) {
  return one(
    executor,
    `INSERT INTO system_guards (id, revision) VALUES ($1, 1)
     ON CONFLICT (id) DO UPDATE SET revision = system_guards.revision + 1, updated_at = now()
     RETURNING *`,
    [id],
  );
}

async function claimCommand(executor, { id, requestHash }) {
  return one(
    executor,
    `INSERT INTO commands (id, request_hash) VALUES ($1, $2)
     ON CONFLICT (id) DO NOTHING RETURNING id`,
    [id, requestHash],
  );
}
async function getCommand(executor, id) {
  return one(executor, "SELECT * FROM commands WHERE id = $1", [id]);
}
async function saveCommandResult(executor, id, result) {
  return one(
    executor,
    "UPDATE commands SET result = $2 WHERE id = $1 RETURNING id",
    [id, result == null ? null : JSON.stringify(result)],
  );
}
async function insertAudit(executor, data) {
  const row = await one(
    executor,
    `INSERT INTO audit_events (id, actor_id, action, source_id, reason, after)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      objectId(),
      data.actorId || null,
      data.action || null,
      data.sourceId || null,
      data.reason || null,
      data.after == null ? null : JSON.stringify(data.after),
    ],
  );
  return auditRow(row);
}
async function listAudit(executor, { limit, offset }) {
  const rows = await many(
    executor,
    "SELECT * FROM audit_events ORDER BY created_at DESC, id DESC OFFSET $1 LIMIT $2",
    [offset, limit],
  );
  return rows.map(auditRow);
}

async function listStatements(executor, { tagId, limit, offset }) {
  const rows = await many(
    executor,
    `SELECT * FROM statements WHERE voided = false ${tagId ? "AND $3 = ANY(tags)" : ""}
     ORDER BY created_at DESC, id DESC OFFSET $1 LIMIT $2`,
    tagId ? [offset, limit, tagId] : [offset, limit],
  );
  return rows.map(statementRow);
}
async function getStatementByReference(executor, reference) {
  return statementRow(
    await one(executor, "SELECT * FROM statements WHERE reference = $1", [reference]),
  );
}
async function createStatement(executor, data) {
  const row = await one(
    executor,
    `INSERT INTO statements (id, transaction_date, type, amount, partner_name, description, reference, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      objectId(),
      data.transactionDate,
      data.type,
      data.amount,
      data.partnerName,
      data.description || "",
      data.reference,
      data.tags || [],
    ],
  );
  return statementRow(row);
}
async function voidStatement(executor, id) {
  return statementRow(
    await one(
      executor,
      "UPDATE statements SET voided = true, updated_at = now() WHERE id = $1 AND voided = false RETURNING *",
      [id],
    ),
  );
}
async function cashSummary(executor, tagId) {
  const row = await one(
    executor,
    `SELECT coalesce(sum(amount) FILTER (WHERE type = 'IN'), 0)::bigint AS cash_in,
            coalesce(sum(amount) FILTER (WHERE type = 'OUT'), 0)::bigint AS cash_out
     FROM statements WHERE voided = false ${tagId ? "AND $1 = ANY(tags)" : ""}`,
    tagId ? [tagId] : [],
  );
  return { cashIn: Number(row.cash_in), cashOut: Number(row.cash_out) };
}

async function listTags(executor, { limit, offset }) {
  const rows = await many(
    executor,
    "SELECT * FROM tags WHERE active = true ORDER BY created_at DESC, id DESC OFFSET $1 LIMIT $2",
    [offset, limit],
  );
  return rows.map(tagRow);
}
async function activeTagExists(executor, id) {
  return !!(await one(
    executor,
    "SELECT 1 AS found FROM tags WHERE id = $1 AND active = true",
    [id],
  ));
}
async function createTag(executor, data) {
  return tagRow(
    await one(
      executor,
      "INSERT INTO tags (id, name, color) VALUES ($1, $2, $3) RETURNING *",
      [objectId(), data.name, data.color || "green"],
    ),
  );
}
async function updateTag(executor, id, patch) {
  return tagRow(
    await one(
      executor,
      `UPDATE tags SET name = COALESCE($2, name), active = COALESCE($3, active), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, patch.name ?? null, patch.active ?? null],
    ),
  );
}
async function listGroups(executor, { limit, offset }) {
  const rows = await many(
    executor,
    "SELECT * FROM groups WHERE active = true ORDER BY created_at DESC, id DESC OFFSET $1 LIMIT $2",
    [offset, limit],
  );
  return rows.map(groupRow);
}
async function createGroup(executor, data) {
  return groupRow(
    await one(
      executor,
      `INSERT INTO groups (id, name, color) VALUES ($1, $2, $3)
       ON CONFLICT (name) DO UPDATE
         SET color = EXCLUDED.color, active = true, updated_at = now()
       RETURNING *`,
      [objectId(), data.name, data.color || "green"],
    ),
  );
}
async function updateGroup(executor, id, patch) {
  return groupRow(
    await one(
      executor,
      `UPDATE groups SET name = COALESCE($2, name), active = COALESCE($3, active), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, patch.name ?? null, patch.active ?? null],
    ),
  );
}

async function listTasks(executor, { limit, offset }) {
  const rows = await many(
    executor,
    "SELECT * FROM tasks WHERE active = true ORDER BY created_at DESC, id DESC OFFSET $1 LIMIT $2",
    [offset, limit],
  );
  return rows.map(taskRow);
}
async function createTask(executor, data) {
  return taskRow(
    await one(
      executor,
      `INSERT INTO tasks (id, title, description, assignee_id, creator_id, status, priority, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        objectId(),
        data.title,
        data.description || "",
        data.assignee || null,
        data.creator || null,
        data.status || "TODO",
        data.priority || "MEDIUM",
        data.dueDate || null,
      ],
    ),
  );
}
async function updateTask(executor, id, patch) {
  return taskRow(
    await one(
      executor,
      `UPDATE tasks SET status = COALESCE($2, status), active = COALESCE($3, active), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, patch.status ?? null, patch.active ?? null],
    ),
  );
}

async function ping(executor) {
  await executor.query("SELECT 1");
}

module.exports = {
  ping,
  getUserById,
  getUserForUpdate,
  getUserByUsername,
  countUsers,
  usernameExists,
  createUser,
  updateUser,
  bumpTokenVersion,
  bumpInventoryRevision,
  listUsers,
  listMembers,
  getProduct,
  getProductForUpdate,
  listProducts,
  countLegacyProducts,
  createProduct,
  saveProduct,
  createOrder,
  getOrderForUpdate,
  saveOrder,
  listOrders,
  countLegacyOrders,
  createReceipt,
  getReceiptForUpdate,
  listReceiptsByMember,
  createReport,
  getReportForUpdate,
  saveReport,
  listReports,
  countLegacyReports,
  pendingReportExists,
  createMovement,
  listMovementsByMember,
  listMovementsBySourceKind,
  countMovementsBySource,
  listWarehouseCostMovements,
  openPeriod,
  getPeriod,
  getPeriodForUpdate,
  getPeriods,
  savePeriod,
  laterClosedPeriodExists,
  upsertMemberPeriod,
  getMemberPeriods,
  saveMemberPeriod,
  invalidateMemberPeriodsAfter,
  bumpGuard,
  claimCommand,
  getCommand,
  saveCommandResult,
  insertAudit,
  listAudit,
  listStatements,
  getStatementByReference,
  createStatement,
  voidStatement,
  cashSummary,
  listTags,
  activeTagExists,
  createTag,
  updateTag,
  listGroups,
  createGroup,
  updateGroup,
  listTasks,
  createTask,
  updateTask,
  many,
  one,
};
