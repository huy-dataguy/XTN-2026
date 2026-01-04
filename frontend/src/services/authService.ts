import axiosClient from '../api/axiosClient';
import { UserRole, DistributorGroup } from '../types';

export const authService = {
  login: async (username: string, password: string) => {
    return axiosClient.post('/auth/login', { username, password });
  },

  // CẬP NHẬT: Thêm tham số securityCode vào cuối
  register: async (
    username: string, 
    password: string, 
    name: string, 
    role: UserRole, 
    group?: DistributorGroup,
    securityCode?: string // <--- Mới thêm
  ) => {
    // Gửi securityCode xuống backend
    return axiosClient.post('/auth/register', { 
      username, 
      password, 
      name, 
      role, 
      group,
      securityCode 
    });
  },

  getCurrentUser: async () => {
    const userStr = localStorage.getItem('user_info');
    return userStr ? JSON.parse(userStr) : null;
  }
};