import { create } from 'zustand';

interface UIState {
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setSidebarMobileOpen: (v: boolean) => void;
  toggleSidebarMobile: () => void;
  closeSidebarMobile: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  sidebarMobileOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  setSidebarMobileOpen: (v) => set({ sidebarMobileOpen: v }),
  toggleSidebarMobile: () => set((s) => ({ sidebarMobileOpen: !s.sidebarMobileOpen })),
  closeSidebarMobile: () => set({ sidebarMobileOpen: false }),
}));
