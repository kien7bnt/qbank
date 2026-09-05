import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

export type UserActiveRole = 'teacher' | 'student';

interface AuthState {
  user: User | null;
  activeRole: UserActiveRole;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setActiveRole: (role: UserActiveRole) => void;
  toggleRole: () => UserActiveRole;
  logout: () => void;
  isAuthenticated: () => boolean;
  hasRole: (...roles: string[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      activeRole: 'teacher',
      accessToken: null,
      refreshToken: null,

      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
        
        // Determine default role: if user is student only -> 'student', else 'teacher'
        const currentActive = get().activeRole;
        const roles = Array.isArray(user?.roles) ? user.roles : [];
        const userWithRoles = { ...user, roles };
        const isOnlyStudent = roles.includes('student') && !roles.includes('teacher') && !roles.includes('admin');
        const nextActive = isOnlyStudent ? 'student' : (currentActive || 'teacher');

        set({ user: userWithRoles, activeRole: nextActive, accessToken, refreshToken });
      },

      setActiveRole: (role) => {
        set({ activeRole: role });
      },

      toggleRole: () => {
        const next: UserActiveRole = get().activeRole === 'teacher' ? 'student' : 'teacher';
        set({ activeRole: next });
        return next;
      },

      logout: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({ user: null, activeRole: 'teacher', accessToken: null, refreshToken: null });
      },

      isAuthenticated: () => !!get().accessToken && !!get().user,

      hasRole: (...roles) => {
        const user = get().user;
        if (!user || !Array.isArray(user.roles)) return false;
        return roles.some((r) => user.roles.includes(r));
      },
    }),
    {
      name: 'qbank-auth',
      partialize: (state) => ({
        user: state.user,
        activeRole: state.activeRole,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
