import { create } from 'zustand';
import type { AuthResponse, LoginInput, UserDto } from '@scolarix/shared';
import { api, refreshSession, tokenStore } from '@/lib/api';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  status: Status;
  user: UserDto | null;
  /** Au chargement de la page : tente de restaurer la session via le cookie. */
  init: () => Promise<void>;
  login: (input: LoginInput) => Promise<UserDto>;
  logout: () => Promise<void>;
  /** Appelé quand la session ne peut plus être rafraîchie. */
  clear: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  status: 'loading',
  user: null,

  init: async () => {
    const session = await refreshSession();
    set(session ? { status: 'authenticated', user: session.user } : { status: 'anonymous', user: null });
  },

  login: async (input) => {
    const data = await api<AuthResponse>('/auth/login', { method: 'POST', body: input });
    tokenStore.set(data.accessToken);
    set({ status: 'authenticated', user: data.user });
    return data.user;
  },

  logout: async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    tokenStore.set(null);
    set({ status: 'anonymous', user: null });
  },

  clear: () => {
    tokenStore.set(null);
    set({ status: 'anonymous', user: null });
  },
}));

tokenStore.onSessionLost(() => useAuth.getState().clear());
