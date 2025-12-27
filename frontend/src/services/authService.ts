// src/services/authService.ts
import axiosClient from '../api/axiosClient';
import { UserRole, DistributorGroup } from '../types';

export const authService = {
  login: async (username: string, password: string) => {
    return axiosClient.post('/auth/login', { username, password });
  },

  // CẬP NHẬT HÀM NÀY: Thêm tham số group (có thể null nếu là Admin)
  register: async (username: string, password: string, name: string, role: UserRole, group?: DistributorGroup) => {
    return axiosClient.post('/auth/register', { username, password, name, role, group });
  },

  getCurrentUser: async () => {
    const userStr = localStorage.getItem('user_info');
    return userStr ? JSON.parse(userStr) : null;
  }
};