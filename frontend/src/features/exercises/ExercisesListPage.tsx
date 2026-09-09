import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Plus,
  Send,
  Search,
  Eye,
  Trash2,
  Calendar,
  FileText,
  MoreVertical,
  ChevronDown,
  ArrowUpDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { exerciseApi, questionApi, domainApi, classApi, getErrorMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { CreateExerciseModal } from './CreateExerciseModal';
import { ExercisePreviewModal } from './ExercisePreviewModal';
import { CreateAssignmentModal } from '@/features/assignments/CreateAssignmentModal';
import type { Exam } from '@/types';
import { useAuthStore } from '@/stores/auth.store';

export const getExerciseQuestionCount = (ex: Exam) => {
  if (typeof ex.total_questions === 'number' && ex.total_questions > 0) return ex.total_questions;
  if (typeof ex.question_count === 'number' && ex.question_count > 0) return ex.question_count;
  if (ex.sections && ex.sections.length > 0) {
    return ex.sections.reduce((acc, s: any) => acc + (s.questions?.length || s.question_count || 0), 0);
  }
  return 0;
};

export function ExercisesListPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name'>('newest');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [previewExerciseId, setPreviewExerciseId] = useState<string | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedExerciseForAssign, setSelectedExerciseForAssign] = useState<{ id: string; name: string } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Fetch
  const { data: exercisesData, isLoading } = useQuery({
    queryKey: ['exercises'],
    queryFn: () => exerciseApi.list(),
  });

  const { data: domainsData } = useQuery({
    queryKey: ['domains'],
    queryFn: () => domainApi.list(),
  });

  const { data: classesData } = useQuery({
    queryKey: ['classes', 'mine'],
    queryFn: () => classApi.list({ view: 'mine' }),
  });

  const exercises: Exam[] = exercisesData?.data || [];
  const domains: any[] = domainsData?.data ?? [];
  const classes: any[] = classesData?.data?.items ?? [];

  // Filter & sort
  const filteredExercises = useMemo(() => {
    let list = [...exercises];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter((ex) => (ex.name || '').toLowerCase().includes(term));
    }
    if (sortOrder === 'newest') list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sortOrder === 'oldest') list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    else if (sortOrder === 'name') list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
    return list;
  }, [exercises, searchTerm, sortOrder]);

  // Delete mutation
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

  const sortLabel = { newest: 'Mới nhất', oldest: 'Cũ nhất', name: 'Theo tên' }[sortOrder];

  return (
    <div className="flex h-full min-h-screen bg-gray-50">
      {/* ── Left sidebar: Lĩnh vực ───────────────────────────────── */}
      <aside className="w-52 shrink-0 border-r border-gray-200 bg-white flex flex-col py-4 gap-1 overflow-y-auto">
        <p className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Lĩnh vực</p>

        {/* Tất cả */}
        <button
          onClick={() => setSelectedDomainId('all')}
          className={`flex items-center justify-between mx-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedDomainId === 'all'
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <span>Tất cả</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${selectedDomainId === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
            {exercises.length}
          </span>
        </button>

        {/* Domain list */}
        {domains.map((domain) => (
          <button
            key={domain.id}
            onClick={() => setSelectedDomainId(domain.id)}
            className={`flex items-center justify-between mx-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedDomainId === domain.id
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="truncate text-left">{domain.name}</span>
          </button>
        ))}

        {/* Divider + Thêm lĩnh vực */}
        <div className="border-t border-gray-100 mx-2 mt-2 pt-2">
          <a href="/domains" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors font-medium">
            <Plus className="h-3.5 w-3.5" />
            Thêm lĩnh vực
          </a>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <BookOpen className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Kho Bài Tập</h1>
              <p className="text-xs text-gray-500">Quản lý các bộ bài tập và giao bài trực tiếp cho lớp học</p>
            </div>
          </div>
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl px-4 py-2 shadow-xs"
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Tạo bài tập mới
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm bài tập theo tên, chủ đề, mô tả..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
            />
          </div>

          {/* Sort */}
          <div className="relative ml-auto">
            <button
              onClick={() => {
                const opts: Array<'newest' | 'oldest' | 'name'> = ['newest', 'oldest', 'name'];
                const next = opts[(opts.indexOf(sortOrder) + 1) % opts.length];
                setSortOrder(next);
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
              Sắp xếp: {sortLabel}
            </button>
          </div>

          {/* Count */}
          <div className="text-xs text-gray-400 whitespace-nowrap">
            Hiển thị <strong className="text-gray-700">{filteredExercises.length}</strong> / {exercises.length} bài tập
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <PageSpinner />
          ) : exercises.length === 0 ? (
            <div className="flex items-center justify-center h-64">
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
            <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
              Không tìm thấy bài tập nào khớp với từ khóa "{searchTerm}"
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
              {filteredExercises.map((exercise, idx) => {
                const count = getExerciseQuestionCount(exercise);
                const date = exercise.created_at
                  ? new Date(exercise.created_at).toLocaleDateString('vi-VN')
                  : '—';
                const isLast = idx === filteredExercises.length - 1;

                return (
                  <div
                    key={exercise.id}
                    className={`flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors ${!isLast ? 'border-b border-gray-100' : ''}`}
                  >
                    {/* Icon */}
                    <div className="h-9 w-9 shrink-0 rounded-lg bg-blue-50 flex items-center justify-center">
                      <FileText className="h-4 w-4 text-blue-500" />
                    </div>

                    {/* Title + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{exercise.name}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {date}
                        </span>
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {count} câu
                        </span>
                      </div>
                    </div>

                    {/* Tags */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                        Bài tập
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewExerciseId(exercise.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Xem
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenAssign({ id: exercise.id, name: exercise.name })}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-xs"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Giao cho lớp
                      </button>

                      {/* Three-dot menu */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenMenuId(openMenuId === exercise.id ? null : exercise.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {openMenuId === exercise.id && (
                          <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-40">
                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                if (confirm(`Bạn có chắc muốn xóa bài tập "${exercise.name}" khỏi kho?`)) {
                                  deleteMutation.mutate(exercise.id);
                                }
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Xóa bài tập
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateExerciseModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onAssignToClass={(id, name) => handleOpenAssign({ id, name })}
      />

      <ExercisePreviewModal
        exerciseId={previewExerciseId}
        open={!!previewExerciseId}
        onClose={() => setPreviewExerciseId(null)}
        onAssign={(ex) => handleOpenAssign({ id: ex.id, name: ex.name })}
      />

      <CreateAssignmentModal
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        initialType="homework"
        initialExamId={selectedExerciseForAssign?.id}
        initialExamName={selectedExerciseForAssign?.name}
      />

      {/* Close dropdown on outside click */}
      {openMenuId && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
      )}
    </div>
  );
}
