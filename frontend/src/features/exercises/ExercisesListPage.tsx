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
  ArrowUpDown,
  Tag,
  FolderMinus,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { exerciseApi, questionApi, domainApi, classApi, getErrorMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { CreateExerciseModal } from './CreateExerciseModal';
import { ExercisePreviewModal } from './ExercisePreviewModal';
import { CreateAssignmentModal } from '@/features/assignments/CreateAssignmentModal';
import type { Exam } from '@/types';

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

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name'>('newest');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [previewExerciseId, setPreviewExerciseId] = useState<string | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedExerciseForAssign, setSelectedExerciseForAssign] = useState<{ id: string; name: string } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Domain Management Modals
  const [createDomainModalOpen, setCreateDomainModalOpen] = useState(false);
  const [manageDomainsModalOpen, setManageDomainsModalOpen] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [newDomainDesc, setNewDomainDesc] = useState('');
  const [assignDomainItem, setAssignDomainItem] = useState<Exam | null>(null);
  const [targetDomainId, setTargetDomainId] = useState<string>('');

  // 1. Fetch Exercises
  const { data: exercisesData, isLoading } = useQuery({
    queryKey: ['exercises'],
    queryFn: () => exerciseApi.list(),
  });

  // 2. Fetch Domains
  const { data: domainsData } = useQuery({
    queryKey: ['domains'],
    queryFn: () => domainApi.list(),
  });

  const exercises: Exam[] = exercisesData?.data || [];
  const domains: any[] = domainsData?.data ?? [];

  // Map domain id -> domain name
  const domainMap = useMemo(() => {
    const map = new Map<string, string>();
    domains.forEach((d) => map.set(d.id, d.name));
    return map;
  }, [domains]);

  // Compute counts per domain dynamically from exercises
  const domainExerciseCounts = useMemo(() => {
    const counts = new Map<string, number>();
    exercises.forEach((ex) => {
      if (ex.domain_id) {
        counts.set(ex.domain_id, (counts.get(ex.domain_id) || 0) + 1);
      }
    });
    return counts;
  }, [exercises]);

  // Filter & sort
  const filteredExercises = useMemo(() => {
    let list = [...exercises];

    // Filter by domain
    if (selectedDomainId !== 'all') {
      list = list.filter((ex) => ex.domain_id === selectedDomainId);
    }

    // Filter by search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter((ex) => (ex.name || '').toLowerCase().includes(term));
    }

    // Sort
    if (sortOrder === 'newest') list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sortOrder === 'oldest') list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    else if (sortOrder === 'name') list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
    return list;
  }, [exercises, selectedDomainId, searchTerm, sortOrder]);

  // Delete exercise mutation
  const deleteMutation = useMutation({
    mutationFn: (exerciseId: string) => exerciseApi.delete(exerciseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exercises'] });
      qc.invalidateQueries({ queryKey: ['domains'] });
      toast.success('Đã xóa bài tập khỏi Kho Bài Tập');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Create Domain Mutation
  const createDomainMutation = useMutation({
    mutationFn: () => domainApi.createDomain({ name: newDomainName.trim(), description: newDomainDesc.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domains'] });
      toast.success(`Đã thêm lĩnh vực "${newDomainName.trim()}"`);
      setCreateDomainModalOpen(false);
      setNewDomainName('');
      setNewDomainDesc('');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Delete Domain Mutation
  const deleteDomainMutation = useMutation({
    mutationFn: (domainId: string) => domainApi.deleteDomain(domainId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domains'] });
      qc.invalidateQueries({ queryKey: ['exercises'] });
      toast.success('Đã xóa lĩnh vực thành công');
      if (selectedDomainId !== 'all') {
        setSelectedDomainId('all');
      }
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Update Exercise Domain Mutation (Assign / Remove from Domain)
  const updateDomainMutation = useMutation({
    mutationFn: ({ exerciseId, domainId }: { exerciseId: string; domainId: string | null }) =>
      exerciseApi.updateDomain(exerciseId, domainId),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['exercises'] });
      qc.invalidateQueries({ queryKey: ['domains'] });
      if (variables.domainId) {
        toast.success(`Đã gắn bài tập vào lĩnh vực "${domainMap.get(variables.domainId) || ''}"`);
      } else {
        toast.success('Đã xóa bài tập khỏi lĩnh vực');
      }
      setAssignDomainItem(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleOpenAssign = (exercise: { id: string; name: string }) => {
    setSelectedExerciseForAssign(exercise);
    setAssignModalOpen(true);
  };

  const handleDeleteDomain = (domain: any) => {
    const exCount = domainExerciseCounts.get(domain.id) || domain.exercise_count || 0;
    const msg = exCount > 0
      ? `Bạn có chắc muốn xóa lĩnh vực "${domain.name}"? ${exCount} bài tập trong lĩnh vực này sẽ được chuyển về "Chưa phân loại".`
      : `Bạn có chắc muốn xóa lĩnh vực "${domain.name}"?`;
    if (confirm(msg)) {
      deleteDomainMutation.mutate(domain.id);
    }
  };

  const handleRemoveFromDomain = (exercise: Exam) => {
    if (confirm(`Bạn có chắc muốn xóa bài tập "${exercise.name}" khỏi lĩnh vực này?`)) {
      updateDomainMutation.mutate({ exerciseId: exercise.id, domainId: null });
    }
  };

  const handleDeleteExercise = (id: string, name: string) => {
    if (confirm(`Bạn có chắc muốn xóa bài tập "${name}" khỏi kho?`)) {
      deleteMutation.mutate(id);
    }
  };

  const sortLabel = { newest: 'Mới nhất', oldest: 'Cũ nhất', name: 'Theo tên' }[sortOrder];

  return (
    <div className="flex flex-col md:flex-row h-full min-h-screen bg-gray-50">
      {/* ── Left sidebar: Lĩnh vực (Desktop) ─────────────────────── */}
      <aside className="hidden md:flex w-56 lg:w-60 shrink-0 border-r border-gray-200 bg-white flex-col py-4 gap-1 overflow-y-auto">
        <div className="px-4 flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Lĩnh vực</p>
          <button
            onClick={() => setCreateDomainModalOpen(true)}
            className="p-1 hover:bg-gray-100 text-gray-500 hover:text-blue-600 rounded-lg transition-colors"
            title="Thêm lĩnh vực mới"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Tất cả */}
        <button
          onClick={() => setSelectedDomainId('all')}
          className={`flex items-center justify-between mx-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedDomainId === 'all'
              ? 'bg-blue-50 text-blue-700 font-semibold'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <span>Tất cả</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${selectedDomainId === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
            {exercises.length}
          </span>
        </button>

        {/* Domain list */}
        {domains.map((domain) => {
          const count = domainExerciseCounts.get(domain.id) || domain.exercise_count || 0;
          const isSelected = selectedDomainId === domain.id;

          return (
            <div
              key={domain.id}
              className={`group flex items-center justify-between mx-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => setSelectedDomainId(domain.id)}
            >
              <span className="truncate text-left flex-1 mr-2">{domain.name}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isSelected ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                  {count}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDomain(domain);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                  title="Xóa lĩnh vực"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Divider + Thêm lĩnh vực */}
        <div className="border-t border-gray-100 mx-2 mt-2 pt-2">
          <button
            onClick={() => setCreateDomainModalOpen(true)}
            className="flex items-center gap-1.5 w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors font-medium"
          >
            <Plus className="h-3.5 w-3.5 text-blue-600" />
            Thêm lĩnh vực
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Domain Bar */}
        <div className="md:hidden bg-white border-b border-gray-200 px-3 py-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSelectedDomainId('all')}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              selectedDomainId === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>Tất cả</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${selectedDomainId === 'all' ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-600'}`}>
              {exercises.length}
            </span>
          </button>

          {domains.map((domain) => {
            const count = domainExerciseCounts.get(domain.id) || domain.exercise_count || 0;
            const isSelected = selectedDomainId === domain.id;
            return (
              <button
                key={domain.id}
                onClick={() => setSelectedDomainId(domain.id)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{domain.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isSelected ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {count}
                </span>
              </button>
            );
          })}

          <button
            onClick={() => setCreateDomainModalOpen(true)}
            className="shrink-0 px-2.5 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Thêm</span>
          </button>
        </div>

        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-emerald-50 rounded-lg shrink-0">
              <BookOpen className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-gray-900">Kho Bài Tập</h1>
                {selectedDomainId !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                    Lĩnh vực: {domainMap.get(selectedDomainId) || 'Đang chọn'}
                    <button
                      onClick={() => setSelectedDomainId('all')}
                      className="ml-1 hover:text-red-600 text-blue-600 font-bold"
                      title="Bỏ lọc lĩnh vực"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 truncate sm:whitespace-normal">Quản lý các bộ bài tập và giao bài trực tiếp cho lớp học</p>
            </div>
          </div>
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl px-4 py-2 shadow-xs shrink-0 w-full sm:w-auto justify-center"
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Tạo bài tập mới
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Search */}
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm bài tập theo tên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
            {/* Sort */}
            <button
              onClick={() => {
                const opts: Array<'newest' | 'oldest' | 'name'> = ['newest', 'oldest', 'name'];
                const next = opts[(opts.indexOf(sortOrder) + 1) % opts.length];
                setSortOrder(next);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
              Sắp xếp: {sortLabel}
            </button>

            {/* Count */}
            <div className="text-xs text-gray-400 whitespace-nowrap">
              Hiển thị <strong className="text-gray-700">{filteredExercises.length}</strong> / {exercises.length} bài tập
            </div>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4 pb-28">
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
              Không tìm thấy bài tập nào{selectedDomainId !== 'all' ? ` thuộc lĩnh vực "${domainMap.get(selectedDomainId)}"` : ''} {searchTerm ? `khớp với từ khóa "${searchTerm}"` : ''}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl shadow-xs">
              {filteredExercises.map((exercise, idx) => {
                const count = getExerciseQuestionCount(exercise);
                const date = exercise.created_at
                  ? new Date(exercise.created_at).toLocaleDateString('vi-VN')
                  : '—';
                const isLast = idx === filteredExercises.length - 1;
                const isNearBottom = idx >= Math.max(0, filteredExercises.length - 2);
                const domainName = exercise.domain_name || (exercise.domain_id ? domainMap.get(exercise.domain_id) : undefined);

                return (
                  <div
                    key={exercise.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3.5 hover:bg-gray-50 transition-colors ${!isLast ? 'border-b border-gray-100' : ''}`}
                  >
                    {/* Left: Icon + Title + Meta */}
                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                      <div className="h-9 w-9 shrink-0 rounded-lg bg-blue-50 flex items-center justify-center mt-0.5 sm:mt-0">
                        <FileText className="h-4 w-4 text-blue-500" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 break-words">{exercise.name}</p>
                          {domainName && (
                            <span className="sm:hidden px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                              <Tag className="h-3 w-3 text-blue-500" />
                              {domainName}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {date}
                          </span>
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            {count} câu
                          </span>
                          <span className="sm:hidden px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700">
                            Bài tập
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Badges (desktop) + Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 w-full sm:w-auto">
                      {/* Desktop Tags */}
                      <div className="hidden sm:flex items-center gap-1.5">
                        {domainName && (
                          <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                            <Tag className="h-3 w-3 text-blue-500" />
                            {domainName}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                          Bài tập
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                          type="button"
                          onClick={() => setPreviewExerciseId(exercise.id)}
                          className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
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
                            <div className={`absolute right-0 ${isNearBottom ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} z-50 bg-white border border-gray-200 rounded-xl shadow-xl py-1 w-48`}>
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setAssignDomainItem(exercise);
                                  setTargetDomainId(exercise.domain_id || '');
                                }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                <Tag className="h-3.5 w-3.5 text-blue-600" />
                                {exercise.domain_id ? 'Đổi lĩnh vực...' : 'Gắn vào lĩnh vực...'}
                              </button>

                              {exercise.domain_id && (
                                <button
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    handleRemoveFromDomain(exercise);
                                  }}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 transition-colors"
                                >
                                  <FolderMinus className="h-3.5 w-3.5 text-amber-600" />
                                  Xóa khỏi lĩnh vực
                                </button>
                              )}

                              <div className="border-t border-gray-100 my-1" />

                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  handleDeleteExercise(exercise.id, exercise.name);
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Thêm lĩnh vực mới ─────────────────────────────── */}
      <Modal
        open={createDomainModalOpen}
        onOpenChange={(v) => {
          if (!v) {
            setCreateDomainModalOpen(false);
            setNewDomainName('');
            setNewDomainDesc('');
          }
        }}
        title="Thêm lĩnh vực mới"
        description="Tạo lĩnh vực để phân loại và quản lý các bài tập"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setCreateDomainModalOpen(false)}>
              Hủy
            </Button>
            <Button
              loading={createDomainMutation.isPending}
              disabled={!newDomainName.trim()}
              onClick={() => createDomainMutation.mutate()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Tạo lĩnh vực
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Tên lĩnh vực <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={newDomainName}
              onChange={(e) => setNewDomainName(e.target.value)}
              placeholder="Ví dụ: Khoa học tự nhiên, Toán học, Lập trình..."
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Mô tả ngắn (tùy chọn)
            </label>
            <textarea
              rows={2}
              value={newDomainDesc}
              onChange={(e) => setNewDomainDesc(e.target.value)}
              placeholder="Mô tả phạm vi môn học hoặc lĩnh vực..."
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* ── Modal Gắn / Đổi lĩnh vực cho bài tập ─────────────────── */}
      <Modal
        open={!!assignDomainItem}
        onOpenChange={(v) => !v && setAssignDomainItem(null)}
        title="Gắn lĩnh vực cho bài tập"
        description={`Chọn lĩnh vực cho: ${assignDomainItem?.name || ''}`}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setAssignDomainItem(null)}>
              Hủy
            </Button>
            <Button
              loading={updateDomainMutation.isPending}
              onClick={() => {
                if (!assignDomainItem) return;
                updateDomainMutation.mutate({
                  exerciseId: assignDomainItem.id,
                  domainId: targetDomainId || null,
                });
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Lưu thay đổi
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Chọn lĩnh vực
            </label>
            <select
              value={targetDomainId}
              onChange={(e) => setTargetDomainId(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Chưa phân loại (Không gắn lĩnh vực) —</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

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

      {/* ── Modal Quản lý lĩnh vực (Hỗ trợ Mobile) ───────────────── */}
      <Modal
        open={manageDomainsModalOpen}
        onOpenChange={setManageDomainsModalOpen}
        title="Quản lý Lĩnh vực"
        description="Danh sách lĩnh vực phân loại bài tập"
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setManageDomainsModalOpen(false);
                setCreateDomainModalOpen(true);
              }}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Thêm mới
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setManageDomainsModalOpen(false)}>
              Đóng
            </Button>
          </div>
        }
      >
        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto -mx-6 px-6">
          {domains.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">Chưa có lĩnh vực nào</p>
          ) : (
            domains.map((domain) => {
              const count = domainExerciseCounts.get(domain.id) || domain.exercise_count || 0;
              return (
                <div key={domain.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{domain.name}</p>
                    <p className="text-xs text-gray-400">{count} bài tập</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteDomain(domain)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Xóa lĩnh vực"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </Modal>

      {/* Close dropdown on outside click */}
      {openMenuId && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
      )}
    </div>
  );
}
