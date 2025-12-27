// src/services/productService.ts
import axiosClient from '../api/axiosClient';
import { Product } from '../types';

export const productService = {
  // 1. Lấy tất cả (đã có)
  getAll: () => axiosClient.get('/products'),

  // 2. Tạo mới (Cần cho ProductManager)
  create: (product: Partial<Product>) => {
    return axiosClient.post('/products', product);
  },

  // 3. Xóa (Cần cho ProductManager)
  delete: (id: string) => {
    return axiosClient.delete(`/products/${id}`);
  },

  // 4. Cập nhật (Tùy chọn, nếu bạn muốn làm thêm tính năng Edit)
  update: (id: string, product: Partial<Product>) => {
    return axiosClient.put(`/products/${id}`, product);
  }
};