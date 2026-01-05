import axiosClient from '../api/axiosClient';

// Định nghĩa kiểu dữ liệu cho Task để TypeScript gợi ý code
export interface TaskType {
  _id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate?: string;
  assignee?: {
    _id: string;
    name: string;
  };
}

export const taskService = {
  getAll: () => axiosClient.get<TaskType[]>('/tasks'),
  
  create: (data: Partial<TaskType> & { assigneeId?: string }) => {
    return axiosClient.post<TaskType>('/tasks', data);
  },

  updateStatus: (id: string, status: string) => {
    return axiosClient.put<TaskType>(`/tasks/${id}/status`, { status });
  },

  delete: (id: string) => {
    return axiosClient.delete(`/tasks/${id}`);
  }
};