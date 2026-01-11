// src/services/userService.ts
import axiosClient from '../api/axiosClient';
import { User } from '../types';

export const userService = {
  // Lấy danh sách nhân viên phân phối (Trả về mảng User[])
  getDistributors: () => axiosClient.get<User[]>('/users/distributors'),

  // Lấy tất cả user (Dùng cho hàm fetchUsers chung nếu cần)
  getAll: () => axiosClient.get<User[]>('/users'),

  // Thêm mới nhân viên (Trả về 1 User)
  create: (userData: Omit<User, 'id'>) => axiosClient.post<User>('/users', userData),

  // Cập nhật thông tin nhân viên (Trả về 1 User sau khi update)
  update: (id: string, userData: Partial<User>) => axiosClient.put<User>(`/users/${id}`, userData),

  // Xóa nhân viên theo ID
  delete: (userId: string) => axiosClient.delete(`/users/${userId}`),
};