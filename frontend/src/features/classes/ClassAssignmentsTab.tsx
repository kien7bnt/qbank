import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList,
  BookOpen,
  Plus,
  Play,
  CheckCircle2,
  Clock,
  Award,
  Users,
  Trash2,
  Calendar,
  RotateCcw,
  Search,
  FileCheck2,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { assignmentApi, getErrorMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { CreateAssignmentModal } from '@/features/assignments/CreateAssignmentModal';
import { AssignmentSubmissionsModal } from '@/features/assignments/AssignmentSubmissionsModal';
import type { Assignment } from '@/types';

interface ClassAssignmentsTabProps {
  classId: string;
  isTeacher: boolean;
}

export function ClassAssignmentsTab({ classId, isTeacher }: ClassAssignmentsTabProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [activeFilter, setActiveFilter] = useState<'all' | 'homework' | 'exam'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalType, setCreateModalType] = useState<'exam' | 'homework'>('exam');
  const [selectedSubmissionsAssignment, setSelectedSubmissionsAssignment] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const { data: assignmentsData, isLoading } = useQuery({
    queryKey: ['class-assignments', classId, isTeacher ? 'teacher' : 'student'],
    queryFn: () => assignmentApi.list({ class_id: classId, role: isTeacher ? 'teacher' : 'student' }),
    enabled: !!classId,
  });

  const allAssignments: Assignment[] = assignmentsData?.data || [];

  useEffect(() => {
    const openId =
      searchParams.get('openSubmissions') ||
      location.state?.openSubmissionsAssignmentId ||
      sessionStorage.getItem('reopen_submissions_assignment_id');

    if (openId && isTeacher) {
      const found = allAssignments.find((a) => a.id === openId);
      const name =
        found?.name ||
        location.state?.openSubmissionsAssignmentName ||
        sessionStorage.getItem('reopen_submissions_assignment_name') ||
        'Bài kiểm tra';

      setSelectedSubmissionsAssignment({ id: openId, name });

      sessionStorage.removeItem('reopen_submissions_assignment_id');
      sessionStorage.removeItem('reopen_submissions_assignment_name');

      if (searchParams.get('openSubmissions')) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('openSubmissions');
        setSearchParams(nextParams, { replace: true });
      }
    }
  }, [allAssignments, searchParams, location.state, isTeacher]);

  const isHomework = (t?: string) => t === 'homework' || t === 'assignment';

  const filteredAssignments = useMemo(() => {
    return allAssignments.filter((a) => {
      // Type filter
      if (activeFilter === 'homework' && !isHomework(a.assignment_type)) return false;
      if (activeFilter === 'exam' && isHomework(a.assignment_type)) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = a.name.toLowerCase().includes(q);
        const matchExam = a.exam_name?.toLowerCase().includes(q);
        const matchSession = a.session_name?.toLowerCase().includes(q);
        if (!matchName && !matchExam && !matchSession) return false;
      }

      return true;
    });
  }, [allAssignments, activeFilter, searchQuery]);

  // Mutations
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
      qc.invalidateQueries({ queryKey: ['class-assignments', classId] });
      qc.invalidateQueries({ queryKey: ['class-sessions', classId] });
      toast.success('Đã xóa thành công!');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const homeworkCount = allAssignments.filter((a) => isHomework(a.assignment_type)).length;
  const examCount = allAssignments.filter((a) => !isHomework(a.assignment_type)).length;

  const openCreateModal = (type: 'exam' | 'homework') => {
    setCreateModalType(type);
    setCreateModalOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Header action & Stats bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex -space-x-1">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold">
              <ClipboardList className="h-5 w-5" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Bài tập & Bài kiểm tra của lớp</h2>
            <p className="text-xs text-gray-500">
              Tổng cộng <strong>{allAssignments.length}</strong> bài ({homeworkCount} bài tập rèn luyện, {examCount} bài kiểm tra tính điểm)
            </p>
          </div>
        </div>

        {isTeacher && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openCreateModal('homework')}
              className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 bg-white"
            >
              <Plus className="h-4 w-4 mr-1 text-emerald-600" />
              Giao bài tập
            </Button>
            <Button
              size="sm"
              onClick={() => openCreateModal('exam')}
              className="bg-primary-600 hover:bg-primary-700 text-white"
            >
              <Plus className="h-4 w-4 mr-1" />
              Giao bài kiểm tra
            </Button>
          </div>
        )}
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="inline-flex items-center bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveFilter('all')}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            Tất cả ({allAssignments.length})
          </button>
          <button
            onClick={() => setActiveFilter('homework')}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeFilter === 'homework'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Bài tập ({homeworkCount})
          </button>
          <button
            onClick={() => setActiveFilter('exam')}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeFilter === 'exam'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            Bài kiểm tra ({examCount})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm theo tên bài hoặc đề..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Assignment List */}
      {isLoading ? (
        <PageSpinner />
      ) : filteredAssignments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 mb-3">
            <ClipboardList className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Chưa có bài tập hoặc bài kiểm tra nào</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
            {isTeacher
              ? 'Thầy cô có thể bấm nút "Giao bài tập" hoặc "Giao bài kiểm tra" từ Kho lưu trữ để giao cho lớp này.'
              : 'Hiện tại giảng viên chưa giao bài tập hay bài kiểm tra nào cho lớp này.'}
          </p>
          {isTeacher && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button size="sm" variant="outline" onClick={() => openCreateModal('homework')}>
                <Plus className="h-4 w-4 mr-1" />
                Giao bài tập từ kho
              </Button>
              <Button size="sm" onClick={() => openCreateModal('exam')}>
                <Plus className="h-4 w-4 mr-1" />
                Giao bài kiểm tra từ kho
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredAssignments.map((a) => {
            const isHw = isHomework(a.assignment_type);
            const myAttempt = (a as any).my_attempt;
            const hasAttempt = !!myAttempt;
            const isSubmitted = myAttempt?.status === 'submitted' || myAttempt?.status === 'graded';
            const canRetry = isHw || (a.max_attempts && a.max_attempts > 1);

            return (
              <div
                key={a.id}
                className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-xs hover:border-gray-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left info */}
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div
                    className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                      isHw
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                    }`}
                  >
                    {isHw ? <BookOpen className="h-5 w-5" /> : <Award className="h-5 w-5" />}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isHw
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}
                      >
                        {isHw ? 'Bài tập rèn luyện' : 'Bài kiểm tra'}
                      </span>

                      {a.session_name && (
                        <span className="text-[10px] font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                          {a.session_name}
                        </span>
                      )}

                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          a.status === 'published'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : a.status === 'closed'
                            ? 'bg-gray-100 text-gray-500'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {a.status === 'published' ? 'Đang mở' : a.status === 'closed' ? 'Đã đóng' : 'Bản nháp'}
                      </span>
                    </div>

                    <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-snug truncate" title={a.name}>
                      {a.name}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 pt-0.5">
                      {a.exam_name && (
                        <span className="flex items-center gap-1 truncate max-w-xs" title={`Đề nguồn: ${a.exam_name}`}>
                          <FileCheck2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          Đề: <strong className="text-gray-700 font-semibold">{a.exam_name}</strong>
                        </span>
                      )}

                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                        {a.duration_minutes} phút
                      </span>

                      {!isHw && a.pass_score && (
                        <span>
                          Điểm đạt: <strong className="text-gray-700">{a.pass_score}đ</strong>
                        </span>
                      )}

                      {isTeacher ? (
                        <span className="flex items-center gap-1 font-medium text-indigo-700">
                          <Users className="h-3.5 w-3.5" />
                          <strong>{a.total_submissions ?? 0}</strong> bài nộp
                        </span>
                      ) : hasAttempt ? (
                        <span className="flex items-center gap-1 font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Điểm của bạn: <strong>{myAttempt.score ?? 0}/{myAttempt.max_score ?? 10}</strong>
                        </span>
                      ) : null}

                      {a.end_time && (
                        <span className="flex items-center gap-1 text-gray-400">
                          <Calendar className="h-3.5 w-3.5" />
                          Hạn: {format(new Date(a.end_time), 'dd/MM/yyyy HH:mm', { locale: vi })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right actions */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  {isTeacher ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedSubmissionsAssignment({ id: a.id, name: a.name })}
                        className="text-xs h-8 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                      >
                        <Users className="h-3.5 w-3.5 mr-1" />
                        Xem bài nộp ({a.total_submissions ?? 0})
                      </Button>

                      <button
                        title="Xóa bài tập/kiểm tra này"
                        onClick={() => {
                          if (
                            confirm(
                              `Bạn có chắc muốn xóa "${a.name}"? Mọi kết quả bài làm của học sinh cho bài này cũng sẽ bị xóa.`
                            )
                          ) {
                            deleteAssignmentMutation.mutate(a.id);
                          }
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Student actions */}
                      {isSubmitted ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="text-xs h-8"
                            onClick={() => navigate(`/exam-result/${myAttempt.id}`)}
                          >
                            Xem kết quả
                          </Button>
                          {canRetry && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-8"
                              onClick={() => retryExamMutation.mutate(a.id)}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Làm lại
                            </Button>
                          )}
                        </div>
                      ) : hasAttempt ? (
                        <Button
                          size="sm"
                          className="text-xs h-8 bg-amber-600 hover:bg-amber-700"
                          onClick={() => navigate(`/exam-taking/${myAttempt.id}`)}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Tiếp tục làm bài
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="text-xs h-8"
                          onClick={() => startExamMutation.mutate(a.id)}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Bắt đầu làm bài
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Assignment Modal */}
      <CreateAssignmentModal
        open={createModalOpen}
        onOpenChange={(v) => {
          setCreateModalOpen(v);
          if (!v) {
            qc.invalidateQueries({ queryKey: ['class-assignments', classId] });
            qc.invalidateQueries({ queryKey: ['class-sessions', classId] });
          }
        }}
        initialClassId={classId}
        initialType={createModalType}
      />

      {/* Submissions Modal for Teacher */}
      {selectedSubmissionsAssignment && (
        <AssignmentSubmissionsModal
          open={!!selectedSubmissionsAssignment}
          onOpenChange={(open) => {
            if (!open) setSelectedSubmissionsAssignment(null);
          }}
          assignmentId={selectedSubmissionsAssignment.id}
          assignmentName={selectedSubmissionsAssignment.name}
        />
      )}
    </div>
  );
}
