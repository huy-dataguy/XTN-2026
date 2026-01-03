// src/api/axiosClient.ts
import axios from 'axios';

const axiosClient = axios.create({
  // baseURL: 'https://be-vvnspkt-xtn2026.vercel.app/api', // Địa chỉ Backend của bạn
  baseURL: 'https://be-vvnspkt-xtn.onrender.com/api', // Địa chỉ Backend của bạn

  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: Tự động gắn Token vào header nếu có
axiosClient.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('token'); // Lấy token lúc login lưu vào
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default axiosClient;
