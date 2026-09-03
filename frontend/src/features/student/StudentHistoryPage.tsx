import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  ChevronRight,
  GraduationCap,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { assignmentApi } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';

export function StudentHistoryPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['student-history'],
    queryFn: () => assignmentApi.history(),
  });

  const attempts = data?.data ?? [];

  if (isLoading) return <PageSpinner />;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <History className="h-6 w-6 text-primary-600" />
          Lịch Sử Làm Bài & Kết Quả
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Xem lại tất cả các bài kiểm tra đã hoàn thành, điểm số và lời giải chi tiết.
        </p>
      </div>

      {/* List */}
      {attempts.length === 0 ? (
        <EmptyState
          icon={<History className="h-10 w-10 text-gray-400" />}
          title="Chưa có lịch sử làm bài"
          description="Bạn chưa hoàn thành bài kiểm tra nào. Hãy vào mục 'Bài kiểm tra' để bắt đầu làm bài!"
          action={
            <Button onClick={() => navigate('/assignments')}>
              Đến danh sách bài kiểm tra
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {attempts.map((att: any) => (
            <div
              key={att.id}
              className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:border-primary-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-900 text-base">
                    {att.assignment_name}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                    <GraduationCap className="h-3.5 w-3.5 text-gray-500" />
                    {att.class_name}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {att.submitted_at
                      ? format(new Date(att.submitted_at), 'dd/MM/yyyy HH:mm', { locale: vi })
                      : 'Đang làm dở'}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span>Đề: <strong>{att.exam_name}</strong></span>
                </div>
              </div>

              {/* Score & Action */}
              <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-100">
                <div className="text-right">
                  <div className="flex items-center gap-1.5">
                    {att.is_passed ? (
                      <span className="text-xs bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded-full border border-green-200 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Đạt
                      </span>
                    ) : (
                      <span className="text-xs bg-red-50 text-red-700 font-bold px-2 py-0.5 rounded-full border border-red-200 flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> Chưa đạt
                      </span>
                    )}
                    <span className="text-xl font-black text-gray-900 ml-1">
                      {att.score ?? 0}
                    </span>
                    <span className="text-xs text-gray-400">/{att.max_score || 10}đ</span>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  rightIcon={<ChevronRight className="h-4 w-4" />}
                  onClick={() => navigate(`/exam-result/${att.id}`)}
                >
                  Xem lời giải
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
