import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  CheckSquare,
  Database,
  BarChart3,
  Settings,
  GraduationCap,
  FileText,
  History,
  FolderCheck,
  BookMarked,
  Sparkles,
  Award,
  Scale,
  X,
} from 'lucide-react';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  to?: string;
  section?: boolean;
  badge?: string;
  badgeColor?: string;
  disabled?: boolean;
  isPrimary?: boolean;
}

const TEACHER_NAV_ITEMS: NavItem[] = [
  // 1. "Quản lý lớp học" đầu tiên mà mục chính và cho chữ to, nhấn mạnh luôn
  {
    label: 'Quản lý lớp học',
    icon: <GraduationCap className="h-5 w-5 text-primary-700" />,
    to: '/classes',
    isPrimary: true,
  },
  {
    label: 'Tổng quan',
    icon: <LayoutDashboard className="h-4 w-4 text-gray-500" />,
    to: '/dashboard',
  },

  // 2. Kho lưu trữ như hiện tại
  { label: 'KHO LƯU TRỮ', section: true, icon: <></> },
  {
    label: 'Kho tài liệu',
    icon: <BookMarked className="h-4 w-4 text-amber-600" />,
    to: '/document-library',
  },
  {
    label: 'Ngân hàng câu hỏi',
    icon: <Database className="h-4 w-4 text-blue-600" />,
    to: '/question-bank',
  },
  {
    label: 'Kho bài tập',
    icon: <FolderCheck className="h-4 w-4 text-emerald-600" />,
    to: '/exercises',
  },
  {
    label: 'Kho bài kiểm tra',
    icon: <FileText className="h-4 w-4 text-purple-600" />,
    to: '/exams',
  },

  // 3. Đánh giá
  { label: 'ĐÁNH GIÁ', section: true, icon: <></> },
  {
    label: 'A. Rublic/Tiêu chí chấm',
    icon: <ClipboardCheck className="h-4 w-4 text-purple-600" />,
    to: '/rubrics',
  },
  {
    label: 'B. Định cỡ câu hỏi',
    icon: <Scale className="h-4 w-4 text-indigo-600" />,
    to: '/calibration',
  },
  {
    label: 'C. Ma trận cấu trúc đề thi',
    icon: <CheckSquare className="h-4 w-4 text-teal-600" />,
    to: '/exam-matrices',
  },
  {
    label: 'D. Ngân hàng đề thi',
    icon: <Award className="h-4 w-4 text-blue-600" />,
    to: '/exams',
  },

  // 4. Trí tuệ nhân tạo
  { label: 'TRÍ TUỆ NHÂN TẠO', section: true, icon: <></> },
  {
    label: 'Quy tắc AI',
    icon: <Sparkles className="h-4 w-4 text-amber-500" />,
    to: '/ai-rules',
  },

  // 5. Báo cáo & Khảo thí
  { label: 'BÁO CÁO & KHẢO THÍ', section: true, icon: <></> },
  {
    label: 'Phân tích & Khảo thí',
    icon: <BarChart3 className="h-4 w-4 text-sky-600" />,
    to: '/analytics',
  },
  {
    label: 'Cài đặt hệ thống',
    icon: <Settings className="h-4 w-4 text-gray-500" />,
    to: '/settings',
  },
];

const STUDENT_NAV_ITEMS: NavItem[] = [
  {
    label: 'Quản lý lớp học',
    icon: <GraduationCap className="h-5 w-5 text-primary-700" />,
    to: '/classes',
    isPrimary: true,
  },
  { label: 'GÓC HỌC TẬP', section: true, icon: <></> },
  {
    label: 'Lịch sử làm bài',
    icon: <History className="h-4 w-4 text-gray-600" />,
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

        if (item.disabled) {
          return (
            <div
              key={idx}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-gray-400 select-none opacity-60 cursor-not-allowed"
              title="Tính năng đang được phát triển"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="shrink-0">{item.icon}</span>
                {(isMobileView || !collapsed) && <span className="truncate">{item.label}</span>}
              </div>
              {(isMobileView || !collapsed) && item.badge && (
                <span className="text-[9px] font-semibold bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200 shrink-0">
                  {item.badge}
                </span>
              )}
            </div>
          );
        }

        const active = isItemActive(item.to);

        if (item.isPrimary) {
          return (
            <div key={item.to || idx} className="mb-2.5">
              <NavLink
                to={item.to!}
                onClick={() => {
                  if (isMobileView) closeMobile();
                }}
                className={clsx(
                  'flex items-center justify-between rounded-xl px-3.5 py-3 transition-all duration-200 border',
                  active
                    ? 'bg-primary-600 border-primary-700 text-white font-bold shadow-sm'
                    : 'bg-primary-50/80 hover:bg-primary-100 border-primary-200/90 text-primary-950 font-bold shadow-2xs'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={clsx('shrink-0', active ? 'text-white' : 'text-primary-700')}>
                    {item.icon}
                  </span>
                  {(isMobileView || !collapsed) && (
                    <span className="text-[15px] font-bold tracking-tight whitespace-normal">
                      {item.label}
                    </span>
                  )}
                </div>
                {(isMobileView || !collapsed) && item.badge && (
                  <span
                    className={clsx(
                      'text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md shrink-0 tracking-wider',
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-primary-600 text-white shadow-2xs'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            </div>
          );
        }

        return (
          <NavLink
            key={item.to || idx}
            to={item.to!}
            onClick={() => {
              if (isMobileView) closeMobile();
            }}
            className={clsx(
              'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary-50 text-primary-700 font-semibold'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="shrink-0">{item.icon}</span>
              <span className="whitespace-normal leading-snug">{(isMobileView || !collapsed) && item.label}</span>
            </div>
            {(isMobileView || !collapsed) && item.badge && (
              <span
                className={clsx(
                  'text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0',
                  item.badgeColor || 'bg-primary-100 text-primary-700'
                )}
              >
                {item.badge}
              </span>
            )}
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
          collapsed ? 'w-16' : 'w-64'
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
