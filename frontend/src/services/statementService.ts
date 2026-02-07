import axiosClient from '../api/axiosClient';
import { Tag } from './TagService'; // Import Tag interface

export interface Statement {
  _id: string;
  transactionDate: string;
  type: 'IN' | 'OUT';
  amount: number;
  partnerName: string;
  description: string;
  balance: number;
  tags: Tag[]; // GET trả về mảng object Tag đầy đủ
  createdAt: string;
}

export interface CreateStatementPayload {
  transactionDate: string;
  type: 'IN' | 'OUT';
  amount: number;
  partnerName: string;
  description: string;
  balance: number;
  tags: string[]; // POST chỉ gửi mảng ID
}

const statementService = {
  getAllStatements: async () => {
    const response = await axiosClient.get<Statement[]>('/statements');
    return response.data;
  },
  createStatement: async (data: CreateStatementPayload) => {
    const response = await axiosClient.post<Statement>('/statements', data);
    return response.data;
  },
  deleteStatement: async (id: string) => {
    const response = await axiosClient.delete(`/statements/${id}`);
    return response.data;
  }
  ,
  updateStatement: async (id: string, data: CreateStatementPayload) => {
      const response = await axiosClient.put<Statement>(`/statements/${id}`, data);
      return response.data;
    }
};

export default statementService;