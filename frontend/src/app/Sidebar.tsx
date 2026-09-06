import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  CheckSquare,
  Database,
  BarChart3,
  Settings,
  GraduationCap,
  FileText,
  History,
  FolderTree,
  FolderCheck,
  BookMarked,
  Sparkles,
  X,
} from 'lucide-react';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  to?: string;
  section?: boolean;
}

const TEACHER_NAV_ITEMS: NavItem[] = [
  {
    label: 'Tổng quan',
    icon: <LayoutDashboard className="h-4 w-4" />,
    to: '/dashboard',
  },
  { label: 'QUẢN LÝ ĐÀO TẠO', section: true, icon: <></> },
  {
    label: 'Quản lý lớp học',
    icon: <GraduationCap className="h-4 w-4" />,
    to: '/classes',
  },
  {
    label: 'Kho tài liệu',
    icon: <BookMarked className="h-4 w-4" />,
    to: '/document-library',
  },
  {
    label: 'Bài kiểm tra',
    icon: <ClipboardList className="h-4 w-4" />,
    to: '/assignments?type=exam',
  },
  {
    label: 'Bài tập',
    icon: <BookOpen className="h-4 w-4" />,
    to: '/assignments?type=homework',
  },
  { label: 'NGÂN HÀNG & ĐỀ THI', section: true, icon: <></> },
  {
    label: 'Ngân hàng câu hỏi',
    icon: <Database className="h-4 w-4" />,
    to: '/question-bank',
  },
  {
    label: 'Kho bài tập',
    icon: <FolderCheck className="h-4 w-4 text-emerald-600" />,
    to: '/exercises',
  },
  {
    label: 'Kho đề kiểm tra',
    icon: <FileText className="h-4 w-4 text-purple-600" />,
    to: '/exams',
  },
  {
    label: 'Ma trận đề',
    icon: <CheckSquare className="h-4 w-4" />,
    to: '/exam-matrices',
  },
  { label: 'TRÍ TUỆ NHÂN TẠO', section: true, icon: <></> },
  {
    label: 'Quy tắc AI',
    icon: <Sparkles className="h-4 w-4 text-amber-500" />,
    to: '/ai-rules',
  },
  { label: 'BÁO CÁO & KHẢO THÍ', section: true, icon: <></> },
  {
    label: 'Phân tích & Khảo thí',
    icon: <BarChart3 className="h-4 w-4" />,
    to: '/analytics',
  },
  {
    label: 'Cài đặt hệ thống',
    icon: <Settings className="h-4 w-4" />,
    to: '/settings',
  },
];

const STUDENT_NAV_ITEMS: NavItem[] = [
  { label: 'GÓC HỌC TẬP', section: true, icon: <></> },
  {
    label: 'Lớp học của tôi',
    icon: <GraduationCap className="h-4 w-4" />,
    to: '/classes',
  },
  {
    label: 'Bài tập',
    icon: <BookOpen className="h-4 w-4" />,
    to: '/assignments?type=homework',
  },
  {
    label: 'Bài kiểm tra',
    icon: <ClipboardList className="h-4 w-4" />,
    to: '/assignments?type=exam',
  },
  {
    label: 'Lịch sử làm bài',
    icon: <History className="h-4 w-4" />,
    to: '/student-history',
  },
];

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const mobileOpen = useUIStore((s) => s.sidebarMobileOpen);
  const closeMobile = useUIStore((s) => s.closeSidebarMobile);
  const activeRole = useAuthStore((s) => s.activeRole);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  const isAdmin = !!user?.roles?.includes('admin');
  const isStudent = activeRole === 'student';
  const rawItems = isStudent ? STUDENT_NAV_ITEMS : TEACHER_NAV_ITEMS;
  const navItems = rawItems.filter((item) => item.to !== '/settings' || isAdmin);

  const isItemActive = (targetTo?: string) => {
    if (!targetTo) return false;
    const currentFull = `${location.pathname}${location.search}`;
    if (targetTo.includes('?')) {
      return currentFull === targetTo;
    }
    return location.pathname === targetTo;
  };

  const renderNavLinks = (isMobileView: boolean) => (
    <div className="space-y-0.5">
      {navItems.map((item, idx) => {
        if (item.section) {
          if (!isMobileView && collapsed) return null;
          return (
            <p
              key={idx}
              className="mt-4 px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400"
            >
              {item.label}
            </p>
          );
        }

        const active = isItemActive(item.to);

        return (
          <NavLink
            key={item.to}
            to={item.to!}
            onClick={() => {
              if (isMobileView) closeMobile();
            }}
            className={clsx(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary-50 text-primary-700 font-semibold'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <span className="shrink-0">{item.icon}</span>
            {(isMobileView || !collapsed) && item.label}
          </NavLink>
        );
      })}
    </div>
  );

  return (
    <>
      {/* 1. Mobile Drawer Backdrop & Sidebar (< md) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden transition-opacity"
          onClick={closeMobile}
        />
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Mobile Header with close button */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-100 px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white font-bold">
              <BookOpen className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold text-gray-900 leading-none">Edumate</span>
              <span className="text-[10px] text-primary-600 font-bold mt-0.5">
                {isStudent ? '🎒 Cổng Học Viên' : '👨‍🏫 Cổng Giảng Viên'}
              </span>
            </div>
          </div>
          <button
            onClick={closeMobile}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Đóng menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mobile Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {renderNavLinks(true)}
        </nav>
      </aside>

      {/* 2. Desktop Collapsible Sidebar (>= md) */}
      <aside
        className={clsx(
          'hidden md:flex h-screen flex-col border-r border-gray-200 bg-white transition-all duration-200 shrink-0',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        {/* Desktop Header */}
        <div className="flex h-14 shrink-0 items-center border-b border-gray-100 px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white font-bold">
              <BookOpen className="h-4 w-4" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-base font-bold text-gray-900 leading-none">Edumate</span>
                <span className="text-[10px] text-primary-600 font-bold mt-0.5">
                  {isStudent ? '🎒 Cổng Học Viên' : '👨‍🏫 Cổng Giảng Viên'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {renderNavLinks(false)}
        </nav>
      </aside>
    </>
  );
}
