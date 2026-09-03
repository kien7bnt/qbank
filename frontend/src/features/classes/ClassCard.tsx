import { useNavigate } from 'react-router-dom';
import { Calendar, Users, BookOpen, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ClassStatusBadge } from '@/components/ui/Badge';
import type { Class } from '@/types';

interface ClassCardProps {
  class_: Class;
  isTeacher: boolean;
}

export function ClassCard({ class_: c, isTeacher }: ClassCardProps) {
  const navigate = useNavigate();

  return (
    <div
      className="group cursor-pointer rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-primary-300 hover:shadow-md transition-all"
      onClick={() => navigate(`/classes/${c.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/classes/${c.id}`)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate group-hover:text-primary-700 transition-colors">
            {c.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
              {c.code}
            </span>
            <ClassStatusBadge status={c.status} />
          </div>
        </div>
      </div>

      {/* Subject */}
      {c.subject_name && (
        <div className="flex items-center gap-1.5 mb-2">
          <BookOpen className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span className="text-xs text-gray-600 truncate">{c.subject_name}</span>
        </div>
      )}

      {/* Teacher */}
      {!isTeacher && (
        <p className="mb-2 text-xs text-gray-500 truncate">
          GV: {c.teacher_name}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Users className="h-3.5 w-3.5" />
          <span>{c.member_count} học viên</span>
        </div>
        {c.expected_end_date && (
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Calendar className="h-3.5 w-3.5" />
            <span>{format(new Date(c.expected_end_date), 'dd/MM/yyyy', { locale: vi })}</span>
          </div>
        )}
      </div>
    </div>
  );
}
