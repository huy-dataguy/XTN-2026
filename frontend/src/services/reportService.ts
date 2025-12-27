import axiosClient from '../api/axiosClient';
import { WeeklyReport, ReportStatus } from '../types';

export const reportService = {
  getAll: () => axiosClient.get('/reports'),
  submit: (report: Partial<WeeklyReport>) => axiosClient.post('/reports', report),
  update: (id: string, report: Partial<WeeklyReport>) => axiosClient.put(`/reports/${id}`, report),
  
  // THÊM HÀM NÀY ĐỂ ADMIN DUYỆT
  updateStatus: (id: string, status: ReportStatus) => axiosClient.put(`/reports/${id}/status`, { status })
};