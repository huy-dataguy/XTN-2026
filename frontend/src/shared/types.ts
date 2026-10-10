export type Role = "ADMIN" | "DISTRIBUTOR";
export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  group?: string;
  active: boolean;
}
export interface Product {
  id: string;
  name: string;
  price: number;
  unitCost: number | null;
  stock: number | null;
  onHand?: number;
  reserved: number;
  damagedOnHand: number;
  active: boolean;
  needsMigration: boolean;
  category: string;
}
export interface OrderLine {
  productId: string;
  productName: string;
  quantity: number;
  receivedQuantity: number;
  price: number;
  unitCost: number | null;
}
export interface Order {
  id: string;
  memberId: string;
  memberName: string;
  intendedPeriodId: string;
  items: OrderLine[];
  totalAmount: number;
  version: number;
  status:
    | "PENDING"
    | "APPROVED"
    | "PARTIALLY_RECEIVED"
    | "RECEIVED"
    | "REJECTED"
    | "CANCELLED";
  createdAt: string;
}
export interface Activity {
  lotId: string;
  effectiveAt: string;
  sold: number;
  damaged: number;
  giftGood: number;
  giftDamaged: number;
}
export interface Report {
  id: string;
  memberId: string;
  memberName: string;
  periodId: string;
  lines: Activity[];
  notes: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUPERSEDED";
  version: number;
  replacesId?: string;
  submittedAt: string;
}
export interface Lot {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  unitCost: number | null;
  effectiveAt: string;
  sellable: number;
  damaged: number;
  physical: number;
}
export interface Warehouse extends Product {
  sellable: number | null;
  physical: number | null;
  available: number | null;
}
export interface Inventory {
  warehouse: Warehouse[];
  lots: Lot[];
}
export interface Balance {
  sellable: number;
  damaged: number;
  physical: number;
}
export interface WeeklyRow {
  memberId: string;
  memberName: string;
  group: string;
  periodId: string;
  revenue: number;
  sold: number;
  damaged: number;
  giftGood: number;
  giftDamaged: number;
  contribution: number | null;
  grossProfit: number | null;
  cogs: number | null;
  targetRevenue: number | null;
  achievement: number | null;
  opening: Balance;
  closing: Balance;
  received: number;
  complete: boolean;
  pendingReports: number;
  deadlineAt: string;
  hasExtension: boolean;
  timeliness: string;
  periodStatus: string;
  revision: number;
}
export interface MemberTotal {
  memberId: string;
  memberName: string;
  revenue: number;
  sold: number;
  contribution: number | null;
  targetRevenue: number;
  achievement: number | null;
  complete: boolean;
  missingTargets: number;
  closing: Balance;
}
export interface Weekly {
  pagination: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  memberTotals: MemberTotal[];
  from: string;
  to: string;
  asOfRecordedAt: string;
  provisional: boolean;
  rows: WeeklyRow[];
  totals: {
    revenue: number;
    sold: number;
    contribution: number | null;
    targetRevenue: number;
    missingTargets: number;
    incompleteRows: number;
    achievement: number | null;
  };
}
export interface Task {
  id: string;
  title: string;
  description: string;
  status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH";
  dueDate: string | null;
}
export interface Tag {
  id: string;
  name: string;
  color: string;
}
export interface Statement {
  tags: string[];
  id: string;
  transactionDate: string;
  type: "IN" | "OUT";
  amount: number;
  partnerName: string;
  reference: string;
  description: string;
}
export interface Page<T> {
  items: T[];
  hasMore: boolean;
  offset: number;
  limit: number;
}
