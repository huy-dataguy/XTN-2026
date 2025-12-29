// src/types.ts

// --- ENUMS (Khớp với Database) ---
export enum UserRole {
  ADMIN = 'ADMIN',
  DISTRIBUTOR = 'DISTRIBUTOR'
}

export enum DistributorGroup {
  TaiChinh = 'Tài Chính',   // Thân thiết
  VanPhong = 'Văn Phòng', // Bình thường
  SuKien = 'Sự Kiện',
  TruyenThong = 'Truyền Thông',
  HauCan = 'Hậu Cần',
  BanBep = 'Bàn Bếp'  // Mới
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

// --- INTERFACES ---

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  group?: DistributorGroup; // Chỉ có nếu role là DISTRIBUTOR
}

export interface Product {
  id: string; // Lưu ý: Backend Mongo trả về _id, nhưng ta map thành id ở service
  name: string;
  price: number;
  stock: number;
  category: string;
  image: string;
}

// Dùng cho State giỏ hàng ở Frontend (lúc đang chọn mua)
export interface CartItem {
  productId: string;
  quantity: number;
}

// Dùng cho Đơn hàng đã lưu trong DB (Có snapshot tên và giá lúc mua)
export interface OrderItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  distributorId: string;
  distributorName?: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  
  // --- NEW: Thêm dòng này ---
  isReceived: boolean; 
}

export interface ReportDetail {
  productId: string;
  productName: string;
  quantityReceived: number;
  quantitySold: number;
  quantityDamaged: number;
  revenue: number;
  remainingStock: number;
}

export interface WeeklyReport {
  id: string;
  distributorId: string;
  
  // Các trường này Backend map ra ngoài để Dashboard dễ lọc
  distributorName?: string; 
  distributorGroup?: DistributorGroup; 

  weekStartDate: string;
  totalRevenue: number;
  totalSold: number;
  totalDamaged: number;
  details: ReportDetail[];
  notes: string;
  status: ReportStatus;
}