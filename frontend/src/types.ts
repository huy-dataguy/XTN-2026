export enum UserRole {
  ADMIN = 'ADMIN',
  DISTRIBUTOR = 'DISTRIBUTOR'
}

export enum DistributorGroup {
  GOLD = 'GOLD', // Thân thiết
  SILVER = 'SILVER', // Bình thường
  NEW = 'NEW' // Mới
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  group?: DistributorGroup; // Only for distributors
}

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  image: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export enum OrderStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export enum ReportStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface Order {
  id: string;
  distributorId: string;
  distributorName: string;
  items: CartItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: string; // ISO Date
}

export interface ReportDetail {
  productId: string;
  productName: string;
  quantityReceived: number; // Total received historically or in period
  quantitySold: number;
  quantityDamaged: number;
  revenue: number;
  remainingStock: number;
}

export interface WeeklyReport {
  id: string;
  distributorId: string;
  distributorName: string;
  distributorGroup?: DistributorGroup; // To help with analytics filtering
  weekStartDate: string;
  totalRevenue: number;
  totalSold: number;
  totalDamaged: number;
  details: ReportDetail[]; // Detailed breakdown per product
  notes: string;
  status: ReportStatus;
}