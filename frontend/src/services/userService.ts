// src/services/userService.ts
import axiosClient from '../api/axiosClient';
import { User } from '../types';

export const userService = {
  // Lấy danh sách nhân viên phân phối
  getDistributors: () => axiosClient.get<User[]>('/users/distributors'),

  // Thêm mới nhân viên (Omit id vì ID do MongoDB/Backend tự tạo)
  create: (userData: Omit<User, 'id'>) => axiosClient.post('/users', userData),

  // Xóa nhân viên theo ID
  delete: (userId: string) => axiosClient.delete(`/users/${userId}`),
};