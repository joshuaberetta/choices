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
  collection_memberships?: CollectionMembership[];
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

export interface CollectionMembership {
  id: number;
  name: string;
  slug: string;
}

export interface CollectionProjectSummary {
  id: number;
  slug: string;
  name: string;
  description: string;
  owner_username: string;
  updated_at: string;
  list_count: number;
  order: number;
  choice_lists?: PublicChoiceList[];
}

export interface CollectionProjectsPage {
  count: number;
  num_pages: number;
  page: number;
  page_size: number;
  results: CollectionProjectSummary[];
}

export interface CollectionShare {
  username: string;
  created_at: string;
}

export interface Collection {
  id: number;
  slug: string;
  name: string;
  description: string;
  owner: number;
  owner_username: string;
  is_public: boolean;
  role: 'owner' | 'shared';
  project_count: number;
  created_at: string;
  updated_at: string;
  projects?: CollectionProjectSummary[];
}

export interface PublicCollection {
  id: number;
  slug: string;
  name: string;
  description: string;
  owner_username: string;
  is_public: boolean;
  project_count: number;
  updated_at: string;
  projects?: CollectionProjectSummary[];
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

// Phase 9: User follow / customise types
export interface UserChoiceListColumn {
  id: number;
  name: string;
  order: number;
}

export interface UserChoiceListConfig {
  id: number;
  choice_list: number;
  choice_list_name: string;
  choice_list_slug: string;
  project_id: number;
  project_name: string;
  project_slug: string;
  owner_username: string;
  label_column_name: string;
  original_label_column_name: string;
  export_url: string;
  original_columns: UserChoiceListColumn[];
  columns: UserChoiceListColumn[];
  created_at: string;
  updated_at: string;
}

export interface UserChoiceExtraValue {
  id: number;
  column: number;
  column_name: string;
  value: string;
}

// Choice as seen in the followed list detail (includes both original and user extra values)
export interface FollowedChoice {
  id: number;
  value: string;
  label: string;
  order: number;
  extra_values: { id: number; column: number; value: string }[];
  user_extra_values: { id: number; column: number; value: string }[];
}

const apiClient = {
  // Projects
  getProjects: () => API.get<PaginatedResponse<Project>>('/projects/'),
  getProjectsAll: async (): Promise<Project[]> => {
    let results: Project[] = [];
    let relUrl: string | null = '/projects/';
    while (relUrl) {
      const res: { data: PaginatedResponse<Project> } = await API.get<PaginatedResponse<Project>>(relUrl);
      results = [...results, ...res.data.results];
      if (res.data.next) {
        const parsed: URL = new URL(res.data.next);
        relUrl = parsed.pathname.replace(/^\/api/, '') + parsed.search;
      } else {
        relUrl = null;
      }
    }
    return results;
  },
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

  // Collections
  getCollections: () => API.get<PaginatedResponse<Collection>>('/collections/'),
  getCollection: (id: number) => API.get<Collection>(`/collections/${id}/`),
  createCollection: (data: { name: string; slug: string; description?: string }) =>
    API.post<Collection>('/collections/', data),
  updateCollection: (id: number, data: Partial<Collection>) =>
    API.patch<Collection>(`/collections/${id}/`, data),
  deleteCollection: (id: number) => API.delete(`/collections/${id}/`),
  addProjectToCollection: (collectionId: number, projectId: number) =>
    API.post<Collection>(`/collections/${collectionId}/add_project/`, { project_id: projectId }),
  removeProjectFromCollection: (collectionId: number, projectId: number) =>
    API.delete(`/collections/${collectionId}/remove_project/${projectId}/`),
  getCollectionShares: (id: number) => API.get<CollectionShare[]>(`/collections/${id}/shares/`),
  shareCollection: (id: number, username: string) =>
    API.post<{ username: string }>(`/collections/${id}/share/`, { username }),
  removeCollectionShare: (id: number, username: string) =>
    API.delete(`/collections/${id}/share/${username}/`),

  // Public collections
  getPublicCollections: (search?: string) =>
    API.get<PaginatedResponse<PublicCollection>>('/collections/public/', { params: search ? { search } : {} }),
  getPublicCollection: (id: number) => API.get<PublicCollection>(`/collections/public/${id}/`),
  getPublicCollectionProjects: (id: number, page = 1, pageSize = 10, search = '') =>
    API.get<CollectionProjectsPage>(`/collections/public/${id}/projects/`, { params: { page, page_size: pageSize, ...(search ? { search } : {}) } }),

  // Phase 9: User follow / customise
  getFollowedLists: () => API.get<PaginatedResponse<UserChoiceListConfig>>('/user-choice-lists/'),
  getFollowedList: (id: number) => API.get<UserChoiceListConfig>(`/user-choice-lists/${id}/`),
  getFollowedListChoices: (configId: number) =>
    API.get<FollowedChoice[]>(`/user-choice-lists/${configId}/choices/`),
  followList: (choiceListId: number) =>
    API.post<UserChoiceListConfig>('/user-choice-lists/', { choice_list: choiceListId }),
  unfollowList: (id: number) => API.delete(`/user-choice-lists/${id}/`),
  updateFollowConfig: (id: number, data: { label_column_name?: string }) =>
    API.patch<UserChoiceListConfig>(`/user-choice-lists/${id}/`, data),
  addUserColumn: (configId: number, name: string) =>
    API.post<UserChoiceListColumn>(`/user-choice-lists/${configId}/add_column/`, { name }),
  updateUserColumn: (configId: number, columnId: number, name: string) =>
    API.patch<UserChoiceListColumn>(`/user-choice-lists/${configId}/update_column/`, { column_id: columnId, name }),
  removeUserColumn: (configId: number, columnId: number) =>
    API.delete(`/user-choice-lists/${configId}/remove_column/`, { data: { column_id: columnId } }),
  setUserExtraValue: (choiceId: number, configId: number, columnId: number, value: string) =>
    API.patch<UserChoiceExtraValue>(`/choices/${choiceId}/set_user_extra_value/`, { config_id: configId, column_id: columnId, value }),
  importUserColumns: (configId: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return API.post(`/user-choice-lists/${configId}/import/`, form)
  },
};

export default apiClient;
