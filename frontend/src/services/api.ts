import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
  withCredentials: true,
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface AuthUser {
  id: number;
  username: string;
}
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
  owner_username: string | null;
  is_public: boolean;
  role: 'owner' | 'shared';
  created_at: string;
  updated_at: string;
  choice_lists?: ChoiceList[];
}

export interface PublicProject {
  id: number;
  slug: string;
  name: string;
  description: string;
  owner_username: string;
  list_count: number;
  updated_at: string;
  choice_lists?: PublicChoiceList[];
}

export interface PublicChoice {
  value: string;
  label: string;
  order: number;
}

export interface PublicChoiceList {
  id: number;
  slug: string;
  name: string;
  description: string;
  updated_at: string;
  choices: PublicChoice[];
}

export interface ProjectShare {
  username: string;
  created_at: string;
}

export interface ChoiceList {
  id: number;
  project: number;
  project_slug: string;
  project_name: string;
  slug: string;
  name: string;
  description: string;
  label_column_name: string;
  name_generation: 'uuid' | 'from_label';
  name_max_length: number;
  require_auth: boolean;
  created_at: string;
  updated_at: string;
  choices_count: number;
  columns?: ChoiceListColumn[];
  choices?: Choice[];
}

export interface ChoiceListColumn {
  id: number;
  name: string;
  order: number;
}

export interface ChoiceExtraValue {
  id: number;
  column: number;
  column_name: string;
  value: string;
}

export interface Choice {
  id: number;
  choice_list: number;
  value: string;
  label: string;
  order: number;
  created_at: string;
  extra_values: ChoiceExtraValue[];
}

const apiClient = {
  // Projects
  getProjects: () => API.get<PaginatedResponse<Project>>('/projects/'),
  getProject: (id: string | number) => API.get<Project>(`/projects/${id}/`),
  createProject: (data: Partial<Project>) => API.post<Project>('/projects/', data),
  updateProject: (id: string | number, data: Partial<Project>) =>
    API.patch<Project>(`/projects/${id}/`, data),
  deleteProject: (id: string | number) => API.delete(`/projects/${id}/`),

  // Project sharing
  getProjectShares: (slug: string) => API.get<ProjectShare[]>(`/projects/${slug}/shares/`),
  shareProject: (slug: string, username: string) =>
    API.post<{ username: string }>(`/projects/${slug}/share/`, { username }),
  removeProjectShare: (slug: string, username: string) =>
    API.delete(`/projects/${slug}/share/${username}/`),

  // Public projects
  getPublicProjects: (search?: string) =>
    API.get<PaginatedResponse<PublicProject>>('/projects/public/', { params: search ? { search } : {} }),
  getPublicProject: (id: string | number) => API.get<PublicProject>(`/projects/public/${id}/`),

  // Choice Lists
  getChoiceLists: () => API.get<PaginatedResponse<ChoiceList>>('/choice-lists/'),
  getChoiceList: (id: string | number) => API.get<ChoiceList>(`/choice-lists/${id}/`),
  getChoiceListBySlug: (projectSlug: string, choiceListSlug: string) =>
    API.get<ChoiceList>(`/choice-lists/`, { params: { project_slug: projectSlug, slug: choiceListSlug } }),
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

  // Extra columns
  addColumn: (listId: string | number, name: string) =>
    API.post<ChoiceListColumn>(`/choice-lists/${listId}/add_column/`, { name }),
  updateColumn: (listId: string | number, columnId: number, name: string) =>
    API.patch<ChoiceListColumn>(`/choice-lists/${listId}/update_column/`, { column_id: columnId, name }),
  removeColumn: (listId: string | number, columnId: number) =>
    API.delete(`/choice-lists/${listId}/remove_column/`, { data: { column_id: columnId } }),

  // Extra column cell values
  setExtraValue: (choiceId: number, columnId: number, value: string) =>
    API.patch<ChoiceExtraValue>(`/choices/${choiceId}/set_extra_value/`, { column_id: columnId, value }),

  // Auth
  getCSRF: () => API.get('/auth/csrf/'),
  login: (username: string, password: string) => API.post<AuthUser>('/auth/login/', { username, password }),
  logout: () => API.post('/auth/logout/'),
  getMe: () => API.get<AuthUser>('/auth/me/'),
  changePassword: (oldPassword: string, newPassword: string) =>
    API.post('/auth/change-password/', { old_password: oldPassword, new_password: newPassword }),
};

export default apiClient;
