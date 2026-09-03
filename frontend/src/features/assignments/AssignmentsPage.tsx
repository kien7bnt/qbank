import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList,
  Plus,
  Play,
  CheckCircle2,
  Clock,
  GraduationCap,
  Users,
  Award,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { assignmentApi, getErrorMessage } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { CreateAssignmentModal } from './CreateAssignmentModal';
import { AssignmentSubmissionsModal } from './AssignmentSubmissionsModal';
import type { Assignment } from '@/types';

export function AssignmentsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isTeacher = user?.roles.includes('teacher') || user?.roles.includes('admin');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submissionsModalAssignment, setSubmissionsModalAssignment] = useState<Assignment | null>(null);

  const { data: assignments, isLoading } = useQuery({
    queryKey: ['assignments'],
    queryFn: () => assignmentApi.list(),
  });

  const startExamMutation = useMutation({
    mutationFn: (assignmentId: string) => assignmentApi.start(assignmentId),
    onSuccess: (res) => {
      navigate(`/exam-taking/${res.data.attempt_id}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const list: Assignment[] = assignments?.data || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary-600" />
            {isTeacher ? 'Quản Lý Bài Kiểm Tra & Bài Tập' : 'Bài Kiểm Tra Của Tôi'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isTeacher
              ? 'Giao đề thi cho lớp học, theo dõi tiến độ nộp bài và kết quả học sinh.'
              : 'Danh sách các bài thi và bài tập được giao cho lớp của bạn.'}
          </p>
        </div>

        {isTeacher && (
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Giao bài mới
          </Button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <PageSpinner />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title="Chưa có bài kiểm tra nào"
          description={
            isTeacher
              ? 'Hãy chọn một đề thi và giao bài cho lớp học đầu tiên.'
              : 'Hiện tại bạn không có bài kiểm tra nào cần làm.'
          }
          action={
            isTeacher ? (
              <Button onClick={() => setCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Giao bài đầu tiên
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {list.map((assignment) => {
            const attempt = assignment.my_attempt;
            const isCompleted = attempt?.status === 'graded' || attempt?.status === 'submitted';
            const isInProgress = attempt?.status === 'in_progress';

            return (
              <div
                key={assignment.id}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold text-gray-900 text-base leading-snug">
                      {assignment.name}
                    </h3>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                        assignment.status === 'published'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {assignment.status === 'published' ? 'Đang mở' : 'Đã đóng'}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5 text-gray-400" />
                      <span>Lớp: <strong className="text-gray-700">{assignment.class_name || 'Toàn trường'}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      <span>{assignment.duration_minutes} phút</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Award className="h-3.5 w-3.5 text-gray-400" />
                      <span>Đạt: &ge; {assignment.pass_score} đ</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 mt-3 border-t border-gray-100">
                  {isTeacher ? (
                    <Button
                      variant="outline"
                      className="w-full text-xs font-semibold"
                      size="sm"
                      onClick={() => setSubmissionsModalAssignment(assignment)}
                    >
                      <Users className="h-3.5 w-3.5 mr-1.5" />
                      Xem bài nộp học sinh ({assignment.total_submissions ?? 0})
                    </Button>
                  ) : isCompleted ? (
                    <Button
                      variant="secondary"
                      className="w-full"
                      size="sm"
                      onClick={() => navigate(`/exam-result/${attempt?.id}`)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1.5 text-green-600" />
                      Xem lời giải & kết quả
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      size="sm"
                      loading={
                        startExamMutation.isPending &&
                        startExamMutation.variables === assignment.id
                      }
                      onClick={() => startExamMutation.mutate(assignment.id)}
                    >
                      <Play className="h-4 w-4 mr-1.5" />
                      {isInProgress ? 'Tiếp tục làm bài' : 'Bắt đầu làm bài'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <CreateAssignmentModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />

      <AssignmentSubmissionsModal
        assignmentId={submissionsModalAssignment?.id || null}
        assignmentName={submissionsModalAssignment?.name}
        open={!!submissionsModalAssignment}
        onOpenChange={(open) => {
          if (!open) setSubmissionsModalAssignment(null);
        }}
      />
    </div>
  );
}
