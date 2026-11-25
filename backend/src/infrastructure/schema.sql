CREATE SCHEMA IF NOT EXISTS xtn;

CREATE TABLE IF NOT EXISTS xtn.users (
  id text PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('ADMIN', 'DISTRIBUTOR')),
  group_name text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  inventory_revision integer NOT NULL DEFAULT 0,
  token_version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS xtn.products (
  id text PRIMARY KEY,
  name text NOT NULL,
  price bigint NOT NULL,
  unit_cost bigint,
  on_hand integer NOT NULL DEFAULT 0,
  damaged_on_hand integer NOT NULL DEFAULT 0,
  reserved integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  inventory_version integer,
  category text NOT NULL DEFAULT '',
  image text NOT NULL DEFAULT '',
  stock integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS xtn.orders (
  id text PRIMARY KEY,
  member_id text NOT NULL,
  member_name text NOT NULL DEFAULT '',
  intended_period_id text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'REJECTED', 'CANCELLED')),
  version integer NOT NULL DEFAULT 0,
  schema_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS xtn.receipts (
  id text PRIMARY KEY,
  order_id text,
  member_id text NOT NULL,
  product_id text NOT NULL,
  product_name text NOT NULL DEFAULT '',
  quantity integer NOT NULL,
  price bigint NOT NULL,
  unit_cost bigint,
  effective_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS xtn.reports (
  id text PRIMARY KEY,
  member_id text NOT NULL,
  member_name text NOT NULL DEFAULT '',
  period_id text NOT NULL,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED')),
  version integer NOT NULL DEFAULT 0,
  replaces_id text,
  submitted_at timestamptz,
  approved_at timestamptz,
  schema_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS xtn.movements (
  id text PRIMARY KEY,
  product_id text,
  lot_id text,
  member_id text,
  source_id text,
  kind text NOT NULL,
  sellable_delta integer NOT NULL DEFAULT 0,
  damaged_delta integer NOT NULL DEFAULT 0,
  sold integer NOT NULL DEFAULT 0,
  damaged integer NOT NULL DEFAULT 0,
  gift_good integer NOT NULL DEFAULT 0,
  gift_damaged integer NOT NULL DEFAULT 0,
  revenue bigint NOT NULL DEFAULT 0,
  cogs bigint,
  damage_cost bigint,
  gift_cost bigint,
  effective_at timestamptz NOT NULL,
  period_id text,
  actor_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS xtn.periods (
  id text PRIMARY KEY,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  revision integer NOT NULL DEFAULT 0,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS xtn.member_periods (
  id text PRIMARY KEY,
  member_id text NOT NULL,
  period_id text NOT NULL,
  extension_until timestamptz,
  extension_reason text,
  complete boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  target_revenue bigint,
  group_name text NOT NULL DEFAULT 'Chưa phân nhóm',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS xtn.commands (
  id text PRIMARY KEY,
  request_hash text,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS xtn.audit_events (
  id text PRIMARY KEY,
  actor_id text,
  action text,
  source_id text,
  reason text,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS xtn.statements (
  id text PRIMARY KEY,
  transaction_date timestamptz NOT NULL,
  type text NOT NULL CHECK (type IN ('IN', 'OUT')),
  amount bigint NOT NULL,
  partner_name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  reference text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  voided boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS xtn.tags (
  id text PRIMARY KEY,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'green',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS xtn.groups (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT 'green',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS xtn.tasks (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  assignee_id text,
  creator_id text,
  status text NOT NULL DEFAULT 'TODO' CHECK (status IN ('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE')),
  priority text NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
  due_date timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS xtn.system_guards (
  id text PRIMARY KEY,
  revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS xtn.kpi_phases (
  id text PRIMARY KEY,
  start_period text NOT NULL,
  end_period text NOT NULL,
  weekly_target bigint NOT NULL,
  reason text NOT NULL,
  created_by text,
  revision integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (start_period <= end_period)
);

CREATE TABLE IF NOT EXISTS xtn.kpi_snapshots (
  period_id text PRIMARY KEY,
  weekly_target bigint NOT NULL,
  phase_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_role_created_idx ON xtn.users (role, created_at, id);
CREATE INDEX IF NOT EXISTS users_active_idx ON xtn.users (active);
CREATE INDEX IF NOT EXISTS products_created_idx ON xtn.products (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS products_inventory_version_idx ON xtn.products (inventory_version);
CREATE INDEX IF NOT EXISTS orders_member_created_idx ON xtn.orders (member_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON xtn.orders (status);
CREATE INDEX IF NOT EXISTS orders_created_idx ON xtn.orders (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS receipts_member_effective_idx ON xtn.receipts (member_id, effective_at);
CREATE INDEX IF NOT EXISTS receipts_order_idx ON xtn.receipts (order_id);
CREATE INDEX IF NOT EXISTS reports_member_period_idx ON xtn.reports (member_id, period_id);
CREATE INDEX IF NOT EXISTS reports_status_idx ON xtn.reports (period_id, status);
CREATE INDEX IF NOT EXISTS reports_created_idx ON xtn.reports (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS movements_member_effective_idx ON xtn.movements (member_id, effective_at, id);
CREATE INDEX IF NOT EXISTS movements_source_kind_idx ON xtn.movements (source_id, kind);
CREATE INDEX IF NOT EXISTS movements_lot_idx ON xtn.movements (lot_id);
CREATE INDEX IF NOT EXISTS movements_period_id_idx ON xtn.movements (period_id);
CREATE INDEX IF NOT EXISTS movements_kind_effective_idx ON xtn.movements (kind, effective_at);
CREATE INDEX IF NOT EXISTS member_periods_member_idx ON xtn.member_periods (member_id, period_id);
CREATE INDEX IF NOT EXISTS member_periods_period_idx ON xtn.member_periods (period_id);
CREATE INDEX IF NOT EXISTS periods_status_idx ON xtn.periods (status);
CREATE INDEX IF NOT EXISTS statements_created_idx ON xtn.statements (created_at DESC, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS statements_reference_idx ON xtn.statements (reference);
CREATE INDEX IF NOT EXISTS statements_tags_idx ON xtn.statements USING gin (tags);
CREATE INDEX IF NOT EXISTS tags_created_idx ON xtn.tags (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS tasks_created_idx ON xtn.tasks (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS audit_created_idx ON xtn.audit_events (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS commands_created_idx ON xtn.commands (created_at);
CREATE INDEX IF NOT EXISTS kpi_phases_period_idx ON xtn.kpi_phases (start_period, end_period);
CREATE INDEX IF NOT EXISTS kpi_snapshots_created_idx ON xtn.kpi_snapshots (created_at DESC);
