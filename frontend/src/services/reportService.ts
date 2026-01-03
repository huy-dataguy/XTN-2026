import axiosClient from '../api/axiosClient';
import { WeeklyReport, ReportStatus } from '../types';

export const reportService = {
  // Lấy danh sách
  getAll: () => axiosClient.get('/reports'),
  
  // Tạo mới
  submit: (report: Partial<WeeklyReport>) => axiosClient.post('/reports', report),
  
  // Cập nhật nội dung (khi còn Pending)
  update: (id: string, report: Partial<WeeklyReport>) => axiosClient.put(`/reports/${id}`, report),
  
  // Cập nhật trạng thái (Duyệt/Từ chối)
  updateStatus: (id: string, status: ReportStatus) => axiosClient.put(`/reports/${id}/status`, { status }),

  // --- THÊM HÀM XÓA ---
  delete: (id: string) => axiosClient.delete(`/reports/${id}`)
};