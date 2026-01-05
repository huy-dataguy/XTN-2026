// src/services/statementService.ts
import axiosClient from '../api/axiosClient';

// --- Types ---

export interface Statement {
  _id: string;
  transactionDate: string; // ISO Date string
  type: 'IN' | 'OUT';
  amount: number;
  partnerName: string;
  description: string;
  balance: number;
  createdAt: string;
}

// Omit loại bỏ _id và createdAt vì đây là dữ liệu gửi đi để tạo mới
export interface CreateStatementPayload {
  transactionDate: string;
  type: 'IN' | 'OUT';
  amount: number;
  partnerName: string;
  description: string;
  balance: number;
}

// --- API Calls ---

const statementService = {
  // Lấy danh sách sao kê
  getAllStatements: async () => {
    // URL là /statements vì baseURL đã là .../api
    const response = await axiosClient.get<Statement[]>('/statements');
    return response.data;
  },

  // Tạo mới sao kê
  createStatement: async (data: CreateStatementPayload) => {
    const response = await axiosClient.post<Statement>('/statements', data);
    return response.data;
  },

  // Xóa sao kê
  deleteStatement: async (id: string) => {
    const response = await axiosClient.delete(`/statements/${id}`);
    return response.data;
  }
};

export default statementService;