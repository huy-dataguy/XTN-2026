// src/services/userService.ts
import axiosClient from '../api/axiosClient';

export const userService = {
  getDistributors: () => axiosClient.get('/users/distributors'),
};