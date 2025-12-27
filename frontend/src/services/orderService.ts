// src/services/orderService.ts
import axiosClient from '../api/axiosClient';
import { OrderStatus } from '../types'; // Đảm bảo bạn đã import enum OrderStatus nếu cần dùng

export const orderService = {
  // 1. Hàm lấy danh sách đơn hàng
  // Backend đã tự xử lý: Nếu là Admin trả về tất cả, nếu là Distributor trả về đơn của họ.
  getAll: () => {
    return axiosClient.get('/orders');
  },

  // 2. Hàm tạo đơn hàng mới
  create: async (items: { productId: string; quantity: number }[]) => {
    return axiosClient.post('/orders', { items });
  },

  // 3. (Tùy chọn) Hàm cập nhật trạng thái (Dành cho Admin duyệt đơn sau này)
  updateStatus: (orderId: string, status: OrderStatus) => {
    return axiosClient.put(`/orders/${orderId}/status`, { status });
  }
};