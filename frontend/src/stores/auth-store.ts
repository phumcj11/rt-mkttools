import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthResult, AuthTokens, AuthUser, TenantSummary } from '@/lib/types';

interface AuthState {
  user: AuthUser | null;
  tenant: TenantSummary | null;
  accessToken: string | null;
  refreshToken: string | null;
  hydrated: boolean;
  setSession: (result: AuthResult) => void;
  setTokens: (tokens: AuthTokens) => void;
  clear: () => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tenant: null,
      accessToken: null,
      refreshToken: null,
      hydrated: false,
      setSession: (result) =>
        set({
          user: result.user,
          tenant: result.tenant,
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
        }),
      setTokens: (tokens) =>
        set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),
      clear: () => set({ user: null, tenant: null, accessToken: null, refreshToken: null }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'rt-mkttools-auth',
      partialize: (state) => ({
        user: state.user,
        tenant: state.tenant,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
