import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Users, CheckCircle2, XCircle, Clock, ExternalLink, Award } from 'lucide-react';
import { assignmentApi } from '@/services/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';

interface AssignmentSubmissionsModalProps {
  assignmentId: string | null;
  assignmentName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignmentSubmissionsModal({
  assignmentId,
  assignmentName,
  open,
  onOpenChange,
}: AssignmentSubmissionsModalProps) {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['assignment-submissions', assignmentId],
    queryFn: () => assignmentApi.submissions(assignmentId!),
    enabled: open && !!assignmentId,
  });

  const submissions = data?.data ?? [];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary-600" />
          <span>Danh sách nộp bài — {assignmentName}</span>
        </div>
      }
      size="xl"
      footer={
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Đóng
        </Button>
      }
    >
      {isLoading ? (
        <PageSpinner />
      ) : submissions.length === 0 ? (
        <EmptyState
          icon={<Clock className="h-8 w-8 text-gray-400" />}
          title="Chưa có học sinh nào nộp bài"
          description="Khi học sinh trong lớp hoàn thành bài thi, danh sách và điểm số sẽ xuất hiện ở đây."
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-gray-500 pb-2 border-b border-gray-100">
            <span>Tổng số lượt làm: <strong>{submissions.length}</strong></span>
            <span>
              Đã nộp:{' '}
              <strong>
                {submissions.filter((s: any) => s.status === 'graded' || s.status === 'submitted').length}
              </strong>
            </span>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">Học sinh</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Thời gian nộp</th>
                  <th className="px-4 py-3 text-center">Điểm số</th>
                  <th className="px-4 py-3 text-center">Kết quả</th>
                  <th className="px-4 py-3 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {submissions.map((sub: any) => {
                  const isGraded = sub.status === 'graded' || sub.status === 'submitted';
                  return (
                    <tr key={sub.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{sub.student_name}</div>
                        <div className="text-xs text-gray-400">{sub.student_email}</div>
                      </td>
                      <td className="px-4 py-3">
                        {sub.status === 'in_progress' ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-xs border border-amber-200">
                            <Clock className="h-3 w-3 animate-spin" /> Đang làm bài
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-full text-xs border border-green-200">
                            <CheckCircle2 className="h-3 w-3" /> Đã nộp bài
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {sub.submitted_at
                          ? format(new Date(sub.submitted_at), 'dd/MM/yyyy HH:mm', { locale: vi })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-center font-bold font-mono text-gray-900">
                        {isGraded && sub.score !== null ? `${sub.score}/${sub.max_score}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isGraded ? (
                          sub.is_passed ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-xs font-semibold">
                              <Award className="h-3.5 w-3.5" /> Đạt
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded-full text-xs font-semibold">
                              <XCircle className="h-3.5 w-3.5" /> Chưa đạt
                            </span>
                          )
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isGraded ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              onOpenChange(false);
                              navigate(`/exam-result/${sub.id}`);
                            }}
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />
                            Xem bài làm
                          </Button>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Đang thi</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}
