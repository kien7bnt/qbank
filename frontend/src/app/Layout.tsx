import { Outlet, Navigate } from 'react-router-dom';
import { Menu, Bell, ChevronDown, LogOut, User } from 'lucide-react';
import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';

function UserMenu() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuthStore();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-100 transition-colors"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-semibold">
          {user?.full_name?.[0]?.toUpperCase() ?? 'U'}
        </div>
        <span className="hidden sm:block max-w-[120px] truncate text-gray-700 font-medium">
          {user?.full_name}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <div className="border-b border-gray-100 px-3 py-2">
              <p className="text-sm font-medium text-gray-900">{user?.full_name}</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <button
              onClick={() => { logout(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function Layout() {
  const { isAuthenticated } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4">
          <button
            onClick={toggleSidebar}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <button className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 transition-colors relative">
              <Bell className="h-5 w-5" />
            </button>
            <UserMenu />
          </div>
        </header>
        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
