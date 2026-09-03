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
  BookMarked,
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
    label: 'Lớp học',
    icon: <GraduationCap className="h-4 w-4" />,
    to: '/classes',
  },
  {
    label: 'Bài kiểm tra',
    icon: <ClipboardList className="h-4 w-4" />,
    to: '/assignments',
  },
  { label: 'NGÂN HÀNG & ĐỀ THI', section: true, icon: <></> },
  {
    label: 'Ngân hàng câu hỏi',
    icon: <Database className="h-4 w-4" />,
    to: '/question-bank',
  },
  {
    label: 'Lĩnh vực · Chủ đề',
    icon: <FolderTree className="h-4 w-4" />,
    to: '/domains',
  },
  {
    label: 'Kho Tài Liệu',
    icon: <BookMarked className="h-4 w-4" />,
    to: '/document-library',
  },
  {
    label: 'Ma trận đề',
    icon: <CheckSquare className="h-4 w-4" />,
    to: '/exam-matrices',
  },
  {
    label: 'Đề thi',
    icon: <FileText className="h-4 w-4" />,
    to: '/exams',
  },
  { label: 'BÁO CÁO & KHẢO THÍ', section: true, icon: <></> },
  {
    label: 'Phân tích & Khảo thí',
    icon: <BarChart3 className="h-4 w-4" />,
    to: '/analytics',
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
    label: 'Bài kiểm tra',
    icon: <ClipboardList className="h-4 w-4" />,
    to: '/assignments',
  },
  {
    label: 'Lịch sử làm bài',
    icon: <History className="h-4 w-4" />,
    to: '/student-history',
  },
];

export function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const user = useAuthStore((s) => s.user);

  const isStudent = user?.roles.includes('student') && !user?.roles.includes('teacher') && !user?.roles.includes('admin');
  const navItems = isStudent ? STUDENT_NAV_ITEMS : TEACHER_NAV_ITEMS;

  return (
    <aside
      className={clsx(
        'flex h-screen flex-col border-r border-gray-200 bg-white transition-all duration-200 shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center border-b border-gray-100 px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white font-bold">
            <BookOpen className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-base font-bold text-gray-900 leading-none">QBank</span>
              <span className="text-[10px] text-gray-400 font-medium mt-0.5">
                {isStudent ? 'Cổng Học Sinh' : 'Cổng Khảo Thí'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-0.5">
          {navItems.map((item, idx) => {
            if (item.section) {
              if (collapsed) return null;
              return (
                <p
                  key={idx}
                  className="mt-4 px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400"
                >
                  {item.label}
                </p>
              );
            }
            return (
              <NavLink
                key={item.to}
                to={item.to!}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700 font-semibold'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )
                }
              >
                <span className="shrink-0">{item.icon}</span>
                {!collapsed && item.label}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
