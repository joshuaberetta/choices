import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
});

export interface Project {
  id: number;
  slug: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface ChoiceList {
  id: number;
  project: number;
  slug: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  choices?: Choice[];
}

export interface Choice {
  id: number;
  choice_list: number;
  value: string;
  label: string;
  order: number;
  created_at: string;
}

export const apiClient = {
  // Projects
  getProjects: () => API.get<Project[]>('/projects/'),
  getProject: (id: string | number) => API.get<Project>(`/projects/${id}/`),
  createProject: (data: Partial<Project>) => API.post<Project>('/projects/', data),
  updateProject: (id: string | number, data: Partial<Project>) =>
    API.patch<Project>(`/projects/${id}/`, data),
  deleteProject: (id: string | number) => API.delete(`/projects/${id}/`),

  // Choice Lists
  getChoiceLists: () => API.get<ChoiceList[]>('/choice-lists/'),
  getChoiceList: (id: string | number) => API.get<ChoiceList>(`/choice-lists/${id}/`),
  createChoiceList: (data: Partial<ChoiceList>) => API.post<ChoiceList>('/choice-lists/', data),
  updateChoiceList: (id: string | number, data: Partial<ChoiceList>) =>
    API.patch<ChoiceList>(`/choice-lists/${id}/`, data),
  deleteChoiceList: (id: string | number) => API.delete(`/choice-lists/${id}/`),

  // Choices
  getChoices: (listId: string | number) =>
    API.get<Choice[]>(`/choices/?choice_list=${listId}`),
  createChoice: (listId: string | number, data: Partial<Choice>) =>
    API.post<Choice>(`/choices/`, { ...data, choice_list: listId }),
  updateChoice: (id: string | number, data: Partial<Choice>) =>
    API.patch<Choice>(`/choices/${id}/`, data),
  deleteChoice: (id: string | number) => API.delete(`/choices/${id}/`),

  // CSV Export
  exportCSV: (projectId: string, listName: string) =>
    API.get(`/${projectId}/${listName}.csv`, { responseType: 'text' }),
};

export default apiClient;
