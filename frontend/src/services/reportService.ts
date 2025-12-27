import axiosClient from '../api/axiosClient';
import { WeeklyReport } from '../types';

export const reportService = {
  getAll: () => axiosClient.get('/reports'), // Backend tự lọc theo Role
  submit: (report: Partial<WeeklyReport>) => axiosClient.post('/reports', report),
  update: (id: string, report: Partial<WeeklyReport>) => axiosClient.put(`/reports/${id}`, report),
};