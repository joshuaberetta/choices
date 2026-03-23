import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
  withCredentials: true,
});

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Project {
  id: number;
  slug: string;
  name: string;
  description: string;
  owner: number | null;
  created_at: string;
  updated_at: string;
  choice_lists?: ChoiceList[];
}

export interface ChoiceList {
  id: number;
  project: number;
  project_slug: string;
  project_name: string;
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

const apiClient = {
  // Projects
  getProjects: () => API.get<PaginatedResponse<Project>>('/projects/'),
  getProject: (id: string | number) => API.get<Project>(`/projects/${id}/`),
  createProject: (data: Partial<Project>) => API.post<Project>('/projects/', data),
  updateProject: (id: string | number, data: Partial<Project>) =>
    API.patch<Project>(`/projects/${id}/`, data),
  deleteProject: (id: string | number) => API.delete(`/projects/${id}/`),

  // Choice Lists
  getChoiceLists: () => API.get<PaginatedResponse<ChoiceList>>('/choice-lists/'),
  getChoiceList: (id: string | number) => API.get<ChoiceList>(`/choice-lists/${id}/`),
  createChoiceList: (data: Partial<ChoiceList>) => API.post<ChoiceList>('/choice-lists/', data),
  updateChoiceList: (id: string | number, data: Partial<ChoiceList>) =>
    API.patch<ChoiceList>(`/choice-lists/${id}/`, data),
  deleteChoiceList: (id: string | number) => API.delete(`/choice-lists/${id}/`),

  // Choices (POST to choice-lists action — auto-generates value ID)
  createChoice: (listId: string | number, label: string) =>
    API.post<Choice>(`/choice-lists/${listId}/choices/`, { label }),
  updateChoice: (id: string | number, data: Partial<Choice>) =>
    API.patch<Choice>(`/choices/${id}/`, data),
  deleteChoice: (id: string | number) => API.delete(`/choices/${id}/`),
  reorderChoices: (listId: string | number, items: { id: number; order: number }[]) =>
    API.post(`/choice-lists/${listId}/reorder/`, items),
  importChoices: (listId: string | number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return API.post<ChoiceList>(`/choice-lists/${listId}/import/`, form)
  },
};

export default apiClient;
