// src/services/orderService.ts
import axiosClient from '../api/axiosClient';
import { OrderStatus } from '../types';

export const orderService = {
  // Lấy danh sách (đã làm ở bước trước)
  getAll: () => axiosClient.get('/orders'),

  // Tạo đơn (đã làm ở bước trước)
  create: (items: { productId: string; quantity: number }[]) => {
    return axiosClient.post('/orders', { items });
  },

  // THÊM HÀM NÀY: Cập nhật trạng thái (Duyệt/Từ chối)
  updateStatus: (id: string, status: OrderStatus) => {
    return axiosClient.put(`/orders/${id}/status`, { status });
  }
};