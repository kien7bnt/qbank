import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { Menu, Bell, ChevronDown, LogOut, User, GraduationCap, BookOpen, ArrowLeftRight, Sparkles } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Sidebar } from './Sidebar';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';

function UserMenu() {
  const [open, setOpen] = useState(false);
  const { user, logout, activeRole, toggleRole } = useAuthStore();
  const navigate = useNavigate();

  const handleRoleSwitch = () => {
    const nextRole = toggleRole();
    if (nextRole === 'teacher') {
      toast.success('Đã chuyển sang giao diện: Người dạy (Giáo viên)');
      navigate('/dashboard');
    } else {
      toast.success('Đã chuyển sang giao diện: Người học (Học viên)');
      navigate('/classes');
    }
    setOpen(false);
  };

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
          <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
            <div className="border-b border-gray-100 px-3 py-2">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-100">
                  {activeRole === 'teacher' ? '👨‍🏫 Đang là: Người dạy' : '🎒 Đang là: Người học'}
                </span>
              </div>
            </div>

            {/* Quick Switch in Menu */}
            <div className="p-1 border-b border-gray-100">
              <button
                onClick={handleRoleSwitch}
                className="flex w-full items-center gap-2 px-2.5 py-2 text-xs font-semibold rounded-lg text-primary-700 hover:bg-primary-50 transition-colors"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 text-primary-600" />
                <span>
                  {activeRole === 'teacher'
                    ? 'Chuyển sang vai trò Người học'
                    : 'Chuyển sang vai trò Người dạy'}
                </span>
              </button>
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
  const { isAuthenticated, activeRole, toggleRole } = useAuthStore();
  const { toggleSidebar, toggleSidebarMobile } = useUIStore();
  const navigate = useNavigate();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  const handleToggleRole = () => {
    const nextRole = toggleRole();
    if (nextRole === 'teacher') {
      toast.success('Đã chuyển sang giao diện: Người dạy (Giáo viên)');
      navigate('/dashboard');
    } else {
      toast.success('Đã chuyển sang giao diện: Người học (Học viên)');
      navigate('/classes');
    }
  };

  const handleMenuClick = () => {
    if (window.innerWidth < 768) {
      toggleSidebarMobile();
    } else {
      toggleSidebar();
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-3 sm:px-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleMenuClick}
              className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Prominent Role Switcher Button */}
            <button
              onClick={handleToggleRole}
              title="Nhấn để đổi ngay giữa giao diện Người dạy và Người học"
              className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs active:scale-95 ${
                activeRole === 'teacher'
                  ? 'bg-gradient-to-r from-indigo-50 to-primary-50 border-primary-200 text-primary-800 hover:border-primary-300'
                  : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200 text-emerald-800 hover:border-emerald-300'
              }`}
            >
              {activeRole === 'teacher' ? (
                <>
                  <GraduationCap className="h-4 w-4 text-primary-600 shrink-0" />
                  <span className="hidden sm:inline">Vai trò: <strong>Người dạy</strong></span>
                  <span className="sm:hidden font-semibold">Người dạy</span>
                  <div className="flex items-center gap-1 pl-1 sm:pl-1.5 border-l border-primary-200 text-primary-600 hover:text-primary-800 font-medium shrink-0">
                    <ArrowLeftRight className="h-3 w-3" />
                    <span className="hidden md:inline">Đổi</span>
                  </div>
                </>
              ) : (
                <>
                  <BookOpen className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="hidden sm:inline">Vai trò: <strong>Người học</strong></span>
                  <span className="sm:hidden font-semibold">Người học</span>
                  <div className="flex items-center gap-1 pl-1 sm:pl-1.5 border-l border-emerald-200 text-emerald-600 hover:text-emerald-800 font-medium shrink-0">
                    <ArrowLeftRight className="h-3 w-3" />
                    <span className="hidden md:inline">Đổi</span>
                  </div>
                </>
              )}
            </button>

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
