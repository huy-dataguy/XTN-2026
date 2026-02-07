import axiosClient from '../api/axiosClient';

export interface Tag {
  _id: string;
  name: string;
  color: string;
}

const tagService = {
  getAllTags: async () => {
    const response = await axiosClient.get<Tag[]>('/tags');
    return response.data;
  },
  createTag: async (data: { name: string; color: string }) => {
    const response = await axiosClient.post<Tag>('/tags', data);
    return response.data;
  },
  updateTag: async (id: string, data: { name: string; color: string }) => {
    const response = await axiosClient.put<Tag>(`/tags/${id}`, data);
    return response.data;
  },
  deleteTag: async (id: string) => {
    const response = await axiosClient.delete(`/tags/${id}`);
    return response.data;
  }
};

export default tagService;