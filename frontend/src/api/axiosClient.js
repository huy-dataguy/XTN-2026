import axios from 'axios';

const axiosClient = axios.create({
  // baseURL: 'https://be-vvnspkt-xtn.onrender.com/api'
  // baseURL: 'http://localhost:5000/api', // Địa chỉ Backend của bạn
  baseURL: '/api', // Địa chỉ Backend của bạn

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


