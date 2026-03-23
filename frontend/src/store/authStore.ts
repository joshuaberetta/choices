import { create } from 'zustand';
import apiClient, { type AuthUser } from '../services/api';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  checkAuth: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  checkAuth: async () => {
    try {
      const response = await apiClient.getMe();
      set({ user: response.data, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  login: async (username, password) => {
    const response = await apiClient.login(username, password);
    set({ user: response.data });
  },

  logout: async () => {
    await apiClient.logout();
    set({ user: null });
  },
}));
