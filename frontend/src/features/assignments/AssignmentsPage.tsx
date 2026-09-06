import React, { useState, useMemo } from 'react';
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
  Trash2,
  Calendar,
  RotateCcw,
  BookOpen,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const { user, activeRole } = useAuthStore();
  const isTeacher = activeRole === 'teacher';

  const typeFilter = searchParams.get('type') as 'exam' | 'homework' | null;

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submissionsModalAssignment, setSubmissionsModalAssignment] = useState<Assignment | null>(null);

  const isHomework = (t?: string) => t === 'homework' || t === 'assignment';
  const isExam = (t?: string) => !isHomework(t);

  const { data: assignments, isLoading } = useQuery({
    queryKey: ['assignments', activeRole],
    queryFn: () => assignmentApi.list({ role: activeRole }),
  });

  const startExamMutation = useMutation({
    mutationFn: (assignmentId: string) => assignmentApi.start(assignmentId),
    onSuccess: (res) => {
      navigate(`/exam-taking/${res.data.attempt_id}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const retryExamMutation = useMutation({
    mutationFn: (assignmentId: string) => assignmentApi.retry(assignmentId),
    onSuccess: (res) => {
      navigate(`/exam-taking/${res.data.attempt_id}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: (assignmentId: string) => assignmentApi.delete(assignmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Đã xóa thành công!');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const allAssignments: Assignment[] = assignments?.data || [];

  // Filter based on URL parameter (?type=exam or ?type=homework)
  const filteredList = useMemo(() => {
    if (!typeFilter) return allAssignments;
    if (typeFilter === 'homework') return allAssignments.filter((a) => isHomework(a.assignment_type));
    return allAssignments.filter((a) => isExam(a.assignment_type));
  }, [allAssignments, typeFilter]);

  const pageTitle = typeFilter === 'exam'
    ? (isTeacher ? 'Quản Lý Bài Kiểm Tra' : 'Bài Kiểm Tra Chính Thức')
    : typeFilter === 'homework'
    ? (isTeacher ? 'Quản Lý Bài Tập' : 'Bài Tập Của Tôi')
    : (isTeacher ? 'Quản Lý Bài Kiểm Tra & Bài Tập' : 'Bài Kiểm Tra & Bài Tập Của Tôi');

  const pageDesc = typeFilter === 'exam'
    ? (isTeacher ? 'Giao đề kiểm tra chính thức, thiết lập thời gian đếm lui và giám sát kết quả thi.' : 'Các bài thi chính thức tính điểm định kỳ. Mỗi bài chỉ được nộp 1 lần duy nhất.')
    : typeFilter === 'homework'
    ? (isTeacher ? 'Giao bài tập thực hành cho học sinh (cho phép làm lại nhiều lần để rèn luyện).' : 'Các bài tập thực hành. Bạn có thể làm đi làm lại nhiều lần để nâng cao kiến thức.')
    : (isTeacher ? 'Giao bài và theo dõi toàn bộ bài kiểm tra lẫn bài tập của học sinh.' : 'Danh sách toàn bộ bài thi và bài tập được giao cho bạn.');

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {typeFilter === 'homework' ? (
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                <BookOpen className="h-6 w-6" />
              </div>
            ) : (
              <div className="p-2 bg-primary-50 text-primary-700 rounded-xl">
                <ClipboardList className="h-6 w-6" />
              </div>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                {pageTitle}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                {pageDesc}
              </p>
            </div>
          </div>
        </div>

        {isTeacher && (
          <Button onClick={() => setCreateModalOpen(true)} className="shrink-0 shadow-xs">
            <Plus className="h-4 w-4 mr-1.5" />
            {typeFilter === 'homework' ? 'Giao bài tập mới' : 'Giao bài kiểm tra mới'}
          </Button>
        )}
      </div>

      {/* Filter Tabs if no query or general view */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setSearchParams(typeFilter === null ? {} : {})}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
            !typeFilter ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Tất cả ({allAssignments.length})
        </button>
        <button
          type="button"
          onClick={() => setSearchParams({ type: 'exam' })}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
            typeFilter === 'exam' ? 'bg-rose-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Bài kiểm tra ({allAssignments.filter((a) => isExam(a.assignment_type)).length})
        </button>
        <button
          type="button"
          onClick={() => setSearchParams({ type: 'homework' })}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
            typeFilter === 'homework' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Bài tập ({allAssignments.filter((a) => isHomework(a.assignment_type)).length})
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <PageSpinner />
      ) : filteredList.length === 0 ? (
        <EmptyState
          icon={typeFilter === 'homework' ? <BookOpen className="h-6 w-6" /> : <ClipboardList className="h-6 w-6" />}
          title={
            typeFilter === 'homework'
              ? 'Chưa có bài tập nào'
              : typeFilter === 'exam'
              ? 'Chưa có bài kiểm tra nào'
              : 'Chưa có mục nào'
          }
          description={
            isTeacher
              ? 'Hãy chọn đề thi và giao bài tập/kiểm tra đầu tiên cho lớp học.'
              : 'Hiện tại bạn chưa có bài nào cần làm trong danh mục này.'
          }
          action={
            isTeacher ? (
              <Button onClick={() => setCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Giao bài ngay
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredList.map((assignment) => {
            const attempt = assignment.my_attempt;
            const isCompleted = attempt?.status === 'graded' || attempt?.status === 'submitted';
            const isInProgress = attempt?.status === 'in_progress';

            const now = new Date();
            const hasStart = !!assignment.start_time;
            const hasEnd = !!assignment.end_time;
            const startDate = hasStart ? new Date(assignment.start_time!) : null;
            const endDate = hasEnd ? new Date(assignment.end_time!) : null;

            const isNotStarted = startDate ? now < startDate : false;
            const isExpired = endDate ? now > endDate : false;

            return (
              <div
                key={assignment.id}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    {isHomework(assignment.assignment_type) ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 inline-flex items-center gap-1">
                        <BookOpen className="h-3 w-3" /> Bài tập
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Bài kiểm tra
                      </span>
                    )}

                    {/* Time Window Status Badge */}
                    {isNotStarted ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        Chưa mở
                      </span>
                    ) : isExpired ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                        Đã kết thúc
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Đang mở
                      </span>
                    )}
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-bold text-gray-900 text-base leading-snug">
                      {assignment.name}
                    </h3>
                    {isTeacher && (
                      <button
                        title="Xóa đợt giao bài này"
                        onClick={() => {
                          if (
                            confirm(
                              `Bạn có chắc muốn xóa "${assignment.name}"? Toàn bộ kết quả bài nộp của học sinh cũng sẽ bị xóa.`
                            )
                          ) {
                            deleteAssignmentMutation.mutate(assignment.id);
                          }
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="mt-3.5 space-y-1.5 text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5 text-gray-400" />
                      <span>Lớp: <strong className="text-gray-700">{assignment.class_name || 'Toàn trường'}</strong></span>
                    </div>

                    {assignment.session_name && (
                      <div className="flex items-center gap-1.5 text-primary-700 font-medium">
                        <Calendar className="h-3.5 w-3.5 text-primary-500" />
                        <span>Buổi học: <strong>{assignment.session_name}</strong></span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      <span>Thời gian làm bài: <strong>{assignment.duration_minutes} phút</strong></span>
                    </div>

                    {/* Start Time & End Time Display */}
                    {(hasStart || hasEnd) && (
                      <div className="pt-2 mt-2 border-t border-gray-100 space-y-1 text-[11px]">
                        {hasStart && startDate && (
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <span className="font-semibold text-gray-700">Mở bài:</span>
                            <span>{format(startDate, 'HH:mm - dd/MM/yyyy')}</span>
                          </div>
                        )}
                        {hasEnd && endDate && (
                          <div className="flex items-center gap-1.5 text-gray-600">
                            <span className="font-semibold text-rose-700">Hạn chót:</span>
                            <span className="text-rose-600 font-medium">{format(endDate, 'HH:mm - dd/MM/yyyy')}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {!isHomework(assignment.assignment_type) && assignment.pass_score ? (
                      <div className="flex items-center gap-1.5 pt-1">
                        <Award className="h-3.5 w-3.5 text-gray-400" />
                        <span>Điểm đạt: &ge; {assignment.pass_score} đ</span>
                      </div>
                    ) : null}
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
                    isHomework(assignment.assignment_type) ? (
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          className="flex-1 text-xs"
                          size="sm"
                          onClick={() => navigate(`/exam-result/${attempt?.id}`)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-green-600" />
                          Kết quả
                        </Button>
                        <Button
                          disabled={isExpired}
                          className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
                          size="sm"
                          loading={
                            retryExamMutation.isPending &&
                            retryExamMutation.variables === assignment.id
                          }
                          onClick={() => retryExamMutation.mutate(assignment.id)}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          {isExpired ? 'Đã hết hạn' : 'Làm lại'}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        className="w-full text-xs font-semibold"
                        size="sm"
                        onClick={() => navigate(`/exam-result/${attempt?.id}`)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1.5 text-green-600" />
                        Xem kết quả thi
                      </Button>
                    )
                  ) : isNotStarted ? (
                    <Button
                      className="w-full text-xs bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed hover:bg-gray-100"
                      size="sm"
                      disabled
                    >
                      <Lock className="h-3.5 w-3.5 mr-1" />
                      Chưa đến giờ làm bài
                    </Button>
                  ) : isExpired ? (
                    <Button
                      className="w-full text-xs bg-gray-100 text-rose-500 border border-rose-200 cursor-not-allowed hover:bg-gray-100"
                      size="sm"
                      disabled
                    >
                      <AlertCircle className="h-3.5 w-3.5 mr-1" />
                      Đã quá hạn nộp bài
                    </Button>
                  ) : (
                    <Button
                      className="w-full text-xs font-semibold"
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
        initialType={typeFilter || 'exam'}
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

