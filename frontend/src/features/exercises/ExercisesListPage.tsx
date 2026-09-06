import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Plus,
  Send,
  Search,
  CheckCircle2,
  Eye,
  Trash2,
  Calendar,
  Layers,
  Sparkles,
  ClipboardList,
  AlertCircle,
  Clock,
  RotateCcw,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { exerciseApi, getErrorMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { CreateExerciseModal } from './CreateExerciseModal';
import { ExercisePreviewModal } from './ExercisePreviewModal';
import { CreateAssignmentModal } from '@/features/assignments/CreateAssignmentModal';
import type { Exam } from '@/types';

export function ExercisesListPage() {
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [previewExerciseId, setPreviewExerciseId] = useState<string | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedExerciseForAssign, setSelectedExerciseForAssign] = useState<{ id: string; name: string } | null>(null);

  // 1. Fetch all exercises
  const { data: exercisesData, isLoading } = useQuery({
    queryKey: ['exercises'],
    queryFn: () => exerciseApi.list(),
  });

  const exercises: Exam[] = exercisesData?.data || [];

  // Filter exercises
  const filteredExercises = useMemo(() => {
    if (!searchTerm.trim()) return exercises;
    const term = searchTerm.toLowerCase().trim();
    return exercises.filter((ex) => (ex.name || '').toLowerCase().includes(term));
  }, [exercises, searchTerm]);

  // Total questions across all exercises
  const totalQuestionsSum = useMemo(() => {
    return exercises.reduce((acc, curr) => acc + (curr.total_questions || curr.question_count || 0), 0);
  }, [exercises]);

  // Delete exercise mutation
  const deleteMutation = useMutation({
    mutationFn: (exerciseId: string) => exerciseApi.delete(exerciseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exercises'] });
      qc.invalidateQueries({ queryKey: ['questions'] });
      toast.success('Đã xóa bài tập khỏi Kho Bài Tập');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleOpenAssign = (exercise: { id: string; name: string }) => {
    setSelectedExerciseForAssign(exercise);
    setAssignModalOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-100/70 text-emerald-800 rounded-xl">
              <BookOpen className="h-6 w-6 text-emerald-700" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Kho Bài Tập</h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Quản lý các bộ bài tập và giao bài trực tiếp cho lớp học
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl px-4 py-2 sm:py-2.5 shadow-xs"
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Tạo bài tập mới
          </Button>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="flex flex-wrap items-center gap-3.5">
        <div className="bg-white border border-gray-200/90 rounded-2xl px-5 py-3 flex items-center gap-4 shadow-2xs min-w-[210px]">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100/80">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-gray-900 leading-tight">{exercises.length}</div>
            <div className="text-xs text-gray-500 font-medium mt-0.5">Bộ bài tập đã tạo</div>
          </div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl px-5 py-3 flex items-center gap-4 shadow-2xs min-w-[210px]">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100/80">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-gray-900 leading-tight">{totalQuestionsSum}</div>
            <div className="text-xs text-gray-500 font-medium mt-0.5">Tổng số câu hỏi</div>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-gray-200 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm bài tập theo tên..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-gray-50/80 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 placeholder:text-gray-400 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>

        <div className="text-xs text-gray-500 font-medium whitespace-nowrap">
          Hiển thị: <strong>{filteredExercises.length}</strong> / {exercises.length} bài tập
        </div>
      </div>

      {/* Exercise List */}
      {isLoading ? (
        <PageSpinner />
      ) : exercises.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-2xs">
          <EmptyState
            title="Chưa có bài tập nào trong Kho Bài Tập"
            action={
              <Button
                onClick={() => setCreateModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs mt-2 rounded-xl"
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Tạo bài tập mới ngay
              </Button>
            }
          />
        </div>
      ) : filteredExercises.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-500 text-xs">
          Không tìm thấy bài tập nào khớp với từ khóa "{searchTerm}"
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredExercises.map((exercise) => {
            const formattedDate = exercise.created_at
              ? new Date(exercise.created_at).toLocaleDateString('vi-VN')
              : 'Mới tạo';

            const count = exercise.total_questions || exercise.question_count || 0;

            return (
              <div
                key={exercise.id}
                className="bg-white border border-gray-200/90 hover:border-blue-300 rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between gap-4 group"
              >
                {/* Top Info */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-snug truncate group-hover:text-blue-600 transition-colors">
                        {exercise.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        <span>{formattedDate}</span>
                      </div>
                    </div>
                  </div>

                  <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <BookOpen className="h-3 w-3 text-emerald-600" />
                    {count} câu
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setPreviewExerciseId(exercise.id)}
                    className="flex-1 h-10 px-3 text-xs sm:text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Eye className="h-4 w-4 text-gray-500" />
                    Xem
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenAssign({ id: exercise.id, name: exercise.name })}
                    className="flex-[1.3] h-10 px-3 text-xs sm:text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Send className="h-4 w-4" />
                    Giao cho lớp
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Bạn có chắc muốn xóa bài tập "${exercise.name}" khỏi kho? (Câu hỏi trong ngân hàng vẫn được giữ nguyên)`)) {
                        deleteMutation.mutate(exercise.id);
                      }
                    }}
                    className="h-10 w-10 border border-gray-200 rounded-xl flex items-center justify-center text-gray-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors shrink-0"
                    title="Xóa bài tập"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Exercise Modal (with Tree Picker & Richtext Create Tabs) */}
      <CreateExerciseModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onAssignToClass={(id, name) => handleOpenAssign({ id, name })}
      />

      {/* Preview Modal */}
      <ExercisePreviewModal
        exerciseId={previewExerciseId}
        open={!!previewExerciseId}
        onClose={() => setPreviewExerciseId(null)}
        onAssign={(ex) => handleOpenAssign({ id: ex.id, name: ex.name })}
      />

      {/* Assign to Class Modal (Simplified for homework: only Due Date, no pass score, no timer) */}
      <CreateAssignmentModal
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        initialType="homework"
        initialExamId={selectedExerciseForAssign?.id}
        initialExamName={selectedExerciseForAssign?.name}
      />
    </div>
  );
}
