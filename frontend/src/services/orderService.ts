import axiosClient from '../api/axiosClient';
import { OrderStatus } from '../types';

export const orderService = {
  // Lấy danh sách
  getAll: () => axiosClient.get('/orders'),

  // Tạo đơn
  create: (items: { productId: string; quantity: number }[]) => {
    return axiosClient.post('/orders', { items });
  },

  // Cập nhật trạng thái duyệt đơn (Approved/Rejected)
  updateStatus: (id: string, status: OrderStatus) => {
    return axiosClient.put(`/orders/${id}/status`, { status });
  },

  // Cập nhật trạng thái "Đã nhận hàng" (Received)
  updateReceivedStatus: (id: string, isReceived: boolean) => {
    return axiosClient.put(`/orders/${id}/received`, { isReceived });
  },

  // --- MỚI: Cập nhật ngày tạo đơn (Dùng cho Admin0) ---
  updateOrderDate: (id: string, date: string) => {
    // date: ISO string
    return axiosClient.put(`/orders/${id}/date`, { date });
  },

  // Xóa đơn hàng
  delete: (id: string) => {
    return axiosClient.delete(`/orders/${id}`);
  }
};