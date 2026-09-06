import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Archive,
  Tag,
  CheckCircle2,
  CheckSquare,
  MoreHorizontal,
  Eye,
  Pencil,
  Check,
  X,
  Filter,
  FolderTree,
  BookOpen,
  FolderPlus,
  Sparkles,
  BarChart2,
  History,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { questionApi, exerciseApi, getErrorMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageSpinner } from '@/components/ui/Spinner';
import type { QuestionFilter, QuestionListItem, Question } from '@/types';
import { AssignTopicModal } from './AssignTopicModal';
import { CreateExamFromQuestionsModal } from '@/features/exams/CreateExamFromQuestionsModal';
import { CreateExerciseModal } from '@/features/exercises/CreateExerciseModal';
import { AutoGenerateModal } from './AutoGenerateModal';
import { EditQuestionModal } from './EditQuestionModal';

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'review', label: 'Đang duyệt' },
  { value: 'draft', label: 'Bản nháp' },
  { value: 'archived', label: 'Lưu trữ' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'Tất cả loại' },
  { value: 'mcq', label: 'Trắc nghiệm' },
  { value: 'essay', label: 'Tự luận' },
  { value: 'coding', label: 'Lập trình' },
];

const BLOOM_OPTIONS = [
  { value: '', label: 'Tất cả Bloom' },
  { value: 'remember', label: 'Nhớ' },
  { value: 'understand', label: 'Hiểu' },
  { value: 'apply', label: 'Vận dụng' },
  { value: 'analyze', label: 'Vận dụng cao' },
];

const DIFFICULTY_OPTIONS = [
  { value: '', label: 'Tất cả mức độ' },
  { value: 'easy', label: 'Dễ' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'hard', label: 'Khó' },
];

interface QuestionTableProps {
  filter: QuestionFilter;
  onFilterChange: (updates: Partial<QuestionFilter>) => void;
  onSelectQuestion: (id: string) => void;
  selectedFolderName?: string;
  onOpenFolderDrawer?: () => void;
}

export function QuestionTable({
  filter,
  onFilterChange,
  onSelectQuestion,
  selectedFolderName,
  onOpenFolderDrawer,
}: QuestionTableProps) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState(filter.search ?? '');
  const [assignTopicOpen, setAssignTopicOpen] = useState(false);
  const [createExamOpen, setCreateExamOpen] = useState(false);
  const [createExerciseOpen, setCreateExerciseOpen] = useState(false);
  const [autoGenerateOpen, setAutoGenerateOpen] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Row action menu & edit modal
  const [activeRowMenuId, setActiveRowMenuId] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['questions', filter],
    queryFn: () => questionApi.list(filter),
    placeholderData: (prev) => prev,
  });

  const items = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const page = filter.page ?? 1;
  const totalPages = data?.data?.total_pages ?? 0;

  const bulkMutation = useMutation({
    mutationFn: ({ action, payload = {} }: { action: string; payload?: object }) =>
      questionApi.bulkAction(Array.from(selected), action, payload),
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ['questions'] });
      qc.invalidateQueries({ queryKey: ['domains'] });
      setSelected(new Set());
      const actName =
        vars.action === 'delete'
          ? 'xóa'
          : vars.action === 'archive'
          ? 'lưu trữ'
          : vars.action === 'approve'
          ? 'phê duyệt'
          : 'cập nhật';
      toast.success(`Đã ${actName} ${selected.size} câu hỏi thành công!`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteSingleMutation = useMutation({
    mutationFn: (id: string) => questionApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions'] });
      qc.invalidateQueries({ queryKey: ['domains'] });
      toast.success('Đã xóa câu hỏi');
      setActiveRowMenuId(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({ search: searchInput.trim() || undefined });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onFilterChange({ search: searchInput.trim() || undefined });
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  };

  const handleBulkDelete = () => {
    if (confirm(`Bạn có chắc muốn xóa vĩnh viễn ${selected.size} câu hỏi đã chọn?`)) {
      bulkMutation.mutate({ action: 'delete' });
    }
  };

  const handleOpenEdit = async (id: string) => {
    try {
      setActiveRowMenuId(null);
      const res = await questionApi.get(id);
      setEditingQuestion(res.data);
      setEditModalOpen(true);
    } catch (err) {
      toast.error('Không thể nạp thông tin câu hỏi để chỉnh sửa');
    }
  };

  // Helper render badge loại câu hỏi: Chỉ 3 dạng Trắc nghiệm, Tự luận, Lập trình
  const renderTypeBadge = (q: QuestionListItem) => {
    if (q.type === 'essay') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200/80">
          Tự luận
        </span>
      );
    }
    if (q.type === 'coding') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/80">
          Lập trình
        </span>
      );
    }
    // Mọi câu hỏi trắc nghiệm (đúng/sai, 1 đáp án, nhiều đáp án) đều là Trắc nghiệm
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/80">
        Trắc nghiệm
      </span>
    );
  };

  const BLOOM_MAP: Record<string, { label: string; cls: string }> = {
    remember: { label: 'Nhớ', cls: 'bg-gray-100 text-gray-700 border-gray-200' },
    understand: { label: 'Hiểu', cls: 'bg-blue-50 text-blue-700 border-blue-200/80' },
    apply: { label: 'Vận dụng', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/80' },
    analyze: { label: 'Vận dụng cao', cls: 'bg-purple-50 text-purple-700 border-purple-200/80' },
  };

  const renderBloom = (bloom?: string) => {
    if (!bloom) return <span className="text-gray-300 italic text-xs">—</span>;
    const item = BLOOM_MAP[bloom] || { label: bloom, cls: 'bg-gray-50 text-gray-600 border-gray-200' };
    return (
      <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border', item.cls)}>
        {item.label}
      </span>
    );
  };

  // Helper render mức độ matching user mockup
  const renderDifficulty = (q: QuestionListItem) => {
    const diff = q.expected_difficulty || 'easy';
    if (diff === 'easy') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span>Dễ</span>
          <Check className="h-3 w-3 text-emerald-600 inline -ml-0.5" />
        </span>
      );
    }
    if (diff === 'hard') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
          <span>Khó</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
        <span>Trung bình</span>
      </span>
    );
  };

  const activeFilterCount = [
    filter.status,
    filter.type,
    filter.bloom_level,
    filter.difficulty,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col h-full space-y-2.5 sm:space-y-3">
      {/* Top Search & Filter Bar */}
      <div className="bg-white border border-gray-200/80 rounded-2xl p-3 sm:p-3.5 shadow-xs space-y-2.5 sm:space-y-3">
        {/* Search Input & Mobile Action Toggles */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm câu hỏi theo nội dung..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-10 pr-10 py-2 sm:py-2.5 text-xs bg-gray-50 border border-gray-200/80 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder:text-gray-400 text-gray-800"
            />
            {searchInput && (
              <button
                onClick={() => {
                  setSearchInput('');
                  onFilterChange({ search: undefined });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Smart Auto Generate Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAutoGenerateOpen(true)}
            className="text-amber-800 bg-amber-50/80 border-amber-200 hover:bg-amber-100 font-semibold text-xs whitespace-nowrap shrink-0"
            leftIcon={<Sparkles className="h-3.5 w-3.5 text-amber-600" />}
          >
            <span className="hidden sm:inline">Sinh tự động theo tiêu chí</span>
            <span className="sm:hidden">Sinh đề/bài</span>
          </Button>

          {/* Mobile Filter Toggle */}
          <button
            type="button"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className={clsx(
              'sm:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold shrink-0 transition-colors',
              showMobileFilters || activeFilterCount > 0
                ? 'bg-primary-50 border-primary-200 text-primary-700'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Lọc</span>
            {activeFilterCount > 0 && (
              <span className="h-4 min-w-4 px-1 rounded-full bg-primary-600 text-white text-[10px] flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Filters Row: Collapsible on mobile, always visible on sm: */}
        <div
          className={clsx(
            'gap-2 flex-wrap items-center',
            showMobileFilters ? 'flex' : 'hidden sm:flex'
          )}
        >
          {/* Dropdown 1: Tất cả / Status selector */}
          <div className="relative flex-1 min-w-[125px] sm:flex-initial sm:w-36">
            <select
              value={filter.status ?? ''}
              onChange={(e) => onFilterChange({ status: (e.target.value as any) || undefined })}
              className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-2xs hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 pr-7 cursor-pointer"
            >
              <option value="">Tất cả ({total})</option>
              {STATUS_OPTIONS.filter((o) => o.value).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">
              ▼
            </span>
          </div>

          {/* Dropdown 2: Tất cả loại */}
          <div className="relative flex-1 min-w-[125px] sm:flex-initial sm:w-36">
            <select
              value={filter.type ?? ''}
              onChange={(e) => onFilterChange({ type: (e.target.value as any) || undefined })}
              className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-2xs hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 pr-7 cursor-pointer"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">
              ▼
            </span>
          </div>

          {/* Dropdown 3: Tất cả Bloom */}
          <div className="relative flex-1 min-w-[125px] sm:flex-initial sm:w-36">
            <select
              value={filter.bloom_level ?? ''}
              onChange={(e) => onFilterChange({ bloom_level: (e.target.value as any) || undefined })}
              className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-2xs hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 pr-7 cursor-pointer"
            >
              {BLOOM_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">
              ▼
            </span>
          </div>

          {/* Dropdown 4: Tất cả mức độ */}
          <div className="relative flex-1 min-w-[125px] sm:flex-initial sm:w-36">
            <select
              value={filter.difficulty ?? ''}
              onChange={(e) => onFilterChange({ difficulty: (e.target.value as any) || undefined })}
              className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-2xs hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500/20 pr-7 cursor-pointer"
            >
              {DIFFICULTY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">
              ▼
            </span>
          </div>

          {/* Active folder indicator & clear filter */}
          {selectedFolderName && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium w-full sm:w-auto sm:ml-auto">
              <span className="truncate">Thư mục: <strong>{selectedFolderName}</strong></span>
              <button
                onClick={() => onFilterChange({ chapter_id: undefined, topic_id: undefined })}
                className="hover:text-blue-900 ml-auto sm:ml-1"
                title="Bỏ lọc thư mục"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bulk actions toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-50 border border-blue-100 rounded-xl shadow-xs overflow-x-auto no-scrollbar">
          <span className="text-xs font-semibold text-blue-700 whitespace-nowrap shrink-0">
            Đã chọn {selected.size} câu hỏi
          </span>
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            <Button
              size="sm"
              variant="ghost"
              className="text-emerald-800 bg-emerald-100 hover:bg-emerald-200 font-semibold text-xs whitespace-nowrap shadow-2xs"
              leftIcon={<BookOpen className="h-3.5 w-3.5 text-emerald-700" />}
              onClick={async () => {
                try {
                  const ids = Array.from(selected);
                  await exerciseApi.addQuestionsToBank(ids);
                  qc.invalidateQueries({ queryKey: ['questions'] });
                  qc.invalidateQueries({ queryKey: ['exercises-questions'] });
                  qc.invalidateQueries({ queryKey: ['exercises-bank-global-count'] });
                  toast.success(`✨ Đã thêm ${ids.length} câu hỏi vào Kho Bài Tập!`);
                  setSelected(new Set());
                } catch (err) {
                  toast.error(getErrorMessage(err));
                }
              }}
            >
              Đưa vào Kho bài tập ({selected.size})
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-purple-700 bg-purple-100/70 hover:bg-purple-200/70 font-medium text-xs whitespace-nowrap"
              leftIcon={<CheckSquare className="h-3.5 w-3.5" />}
              onClick={() => setCreateExamOpen(true)}
            >
              Tạo đề thi ({selected.size})
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-primary-700 hover:bg-primary-100/60 font-medium text-xs whitespace-nowrap"
              leftIcon={<Tag className="h-3.5 w-3.5" />}
              onClick={() => setAssignTopicOpen(true)}
            >
              Gắn thư mục
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-emerald-700 hover:bg-emerald-50 font-medium text-xs whitespace-nowrap"
              leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
              loading={bulkMutation.isPending}
              onClick={() => bulkMutation.mutate({ action: 'approve' })}
            >
              Duyệt
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-gray-700 hover:bg-gray-100 font-medium text-xs whitespace-nowrap"
              leftIcon={<Archive className="h-3.5 w-3.5" />}
              loading={bulkMutation.isPending}
              onClick={() => bulkMutation.mutate({ action: 'archive' })}
            >
              Lưu trữ
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:bg-red-50 font-medium text-xs whitespace-nowrap"
              leftIcon={<Trash2 className="h-3.5 w-3.5" />}
              loading={bulkMutation.isPending}
              onClick={handleBulkDelete}
            >
              Xóa
            </Button>
          </div>
        </div>
      )}

      {/* Main Table / Cards Card */}
      <div className="flex-1 bg-white border border-gray-200/80 rounded-2xl overflow-hidden shadow-xs flex flex-col min-h-0">
        {isLoading ? (
          <div className="py-20 flex justify-center items-center flex-1">
            <PageSpinner />
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 flex-1 flex flex-col justify-center items-center px-4 text-center">
            <EmptyState
              title="Chưa có câu hỏi nào"
              description={
                selectedFolderName
                  ? `Thư mục "${selectedFolderName}" chưa có câu hỏi nào. Bạn có thể tạo mới hoặc gắn câu hỏi vào thư mục này.`
                  : 'Hãy tạo câu hỏi đầu tiên hoặc import từ Word/Excel/PDF.'
              }
            />
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            {/* 1. Mobile Cards View (< md) */}
            <div className="md:hidden divide-y divide-gray-100">
              {/* Select All on Mobile */}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-gray-50/80 border-b border-gray-100 text-xs text-gray-600 font-medium">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selected.size === items.length && items.length > 0}
                    onChange={toggleAll}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer h-4 w-4"
                  />
                  <span>Chọn tất cả ({items.length})</span>
                </label>
                <span className="text-[11px] text-gray-400">Tổng {total} câu</span>
              </div>

              {items.map((q) => {
                const isChecked = selected.has(q.id);
                const isMenuOpen = activeRowMenuId === q.id;

                return (
                  <div
                    key={q.id}
                    onClick={() => onSelectQuestion(q.id)}
                    className={clsx(
                      'p-3 transition-colors cursor-pointer relative',
                      isChecked ? 'bg-blue-50/50' : 'hover:bg-gray-50/70'
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Checkbox */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="pt-0.5 shrink-0"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(q.id)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer h-4 w-4"
                        />
                      </div>

                      {/* Card Content */}
                      <div className="flex-1 min-w-0">
                        {/* Badges row */}
                        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                          {renderTypeBadge(q)}
                          {renderBloom(q.bloom_level)}
                          {renderDifficulty(q)}
                          {q.is_calibrated ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-bold border border-green-200">
                              Đã định cỡ
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium border border-gray-200">
                              Chưa định cỡ
                            </span>
                          )}
                          <span className="text-[10px] text-gray-500 font-mono bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                            a:{q.irt_a !== undefined && q.irt_a !== null ? Number(q.irt_a).toFixed(2) : '1.05'} b:{q.irt_b !== undefined && q.irt_b !== null ? Number(q.irt_b).toFixed(2) : '0.05'} c:{q.irt_c !== undefined && q.irt_c !== null ? Number(q.irt_c).toFixed(2) : '0.25'}
                          </span>
                          {q.in_exercise_bank && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                              Kho bài tập
                            </span>
                          )}
                        </div>

                        {/* Question Stem Preview */}
                        <p className="text-xs font-medium text-gray-900 line-clamp-2 leading-relaxed">
                          {q.stem_preview}
                        </p>

                        {/* Folder / Topic info */}
                        <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                          <span className="truncate max-w-[200px] text-gray-500 font-normal">
                            📁 {q.topic_name || q.chapter_name || 'Chưa phân loại'}
                          </span>
                          <span className="text-primary-600 font-semibold text-[11px]">
                            Chi tiết →
                          </span>
                        </div>
                      </div>

                      {/* 3-dots Menu Button */}
                      <div
                        className="shrink-0 relative -mr-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveRowMenuId(isMenuOpen ? null : q.id)}
                          className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>

                        {isMenuOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-20"
                              onClick={() => setActiveRowMenuId(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 z-30 w-36 bg-white border border-gray-200 rounded-xl shadow-lg py-1 text-xs text-gray-700 text-left animate-in fade-in zoom-in-95">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveRowMenuId(null);
                                  onSelectQuestion(q.id);
                                }}
                                className="w-full px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Eye className="h-3.5 w-3.5 text-gray-500" />
                                Xem chi tiết
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(q.id)}
                                className="w-full px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Pencil className="h-3.5 w-3.5 text-gray-500" />
                                Chỉnh sửa
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm('Bạn có chắc muốn xóa câu hỏi này?')) {
                                    deleteSingleMutation.mutate(q.id);
                                  }
                                }}
                                className="w-full px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2 border-t border-gray-100"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Xóa câu hỏi
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 2. Desktop Table View (>= md) */}
            <table className="hidden md:table w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white border-b border-gray-200/80 z-10 text-[11px] font-semibold text-gray-500 uppercase tracking-wider select-none">
                <tr>
                  <th className="w-10 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selected.size === items.length && items.length > 0}
                      onChange={toggleAll}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer h-4 w-4"
                    />
                  </th>
                  <th className="px-4 py-3">Nội dung</th>
                  <th className="px-4 py-3 w-32">Loại</th>
                  <th className="px-4 py-3 w-28">Bloom</th>
                  <th className="px-4 py-3 w-28">Mức độ</th>
                  <th className="px-4 py-3 w-40">Định cỡ (a, b, c)</th>
                  <th className="px-4 py-3 w-28 text-center">Sử dụng</th>
                  <th className="px-4 py-3 w-44">Lĩnh vực · Chủ đề</th>
                  <th className="w-12 px-3 py-3 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white text-xs">
                {items.map((q) => {
                  const isChecked = selected.has(q.id);
                  const isMenuOpen = activeRowMenuId === q.id;

                  return (
                    <tr
                      key={q.id}
                      onClick={() => onSelectQuestion(q.id)}
                      className={clsx(
                        'hover:bg-blue-50/40 cursor-pointer transition-colors group',
                        isChecked && 'bg-blue-50/50'
                      )}
                    >
                      {/* Checkbox */}
                      <td
                        className="px-4 py-3.5 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(q.id)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer h-4 w-4"
                        />
                      </td>

                      {/* Nội dung */}
                      <td className="px-4 py-3.5 font-normal text-gray-900 max-w-md">
                        <p className="truncate line-clamp-1" title={q.stem_preview}>
                          {q.stem_preview}
                        </p>
                      </td>

                      {/* Loại */}
                      <td className="px-4 py-3.5 shrink-0 whitespace-nowrap">
                        {renderTypeBadge(q)}
                      </td>

                      {/* Bloom */}
                      <td className="px-4 py-3.5 shrink-0 whitespace-nowrap">
                        {renderBloom(q.bloom_level)}
                      </td>

                      {/* Mức độ */}
                      <td className="px-4 py-3.5 shrink-0 whitespace-nowrap">
                        {renderDifficulty(q)}
                      </td>

                      {/* Định cỡ (IRT) */}
                      <td className="px-4 py-3.5 shrink-0 whitespace-nowrap">
                        <div className="space-y-1">
                          <div>
                            {q.is_calibrated ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                Đã định cỡ ({q.response_count || 0} lượt)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                                Chưa định cỡ
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono flex items-center gap-1" title="Mô hình IRT: a (Độ phân biệt), b (Độ khó), c (Đoán mò)">
                            <span>a:<strong className="text-gray-700 font-semibold">{q.irt_a !== undefined && q.irt_a !== null ? Number(q.irt_a).toFixed(2) : (q.bloom_level === 'remember' ? '0.85' : q.bloom_level === 'understand' ? '1.05' : q.bloom_level === 'apply' ? '1.35' : q.bloom_level === 'analyze' ? '1.65' : '1.05')}</strong></span>
                            <span>•</span>
                            <span>b:<strong className="text-gray-700 font-semibold">{q.irt_b !== undefined && q.irt_b !== null ? Number(q.irt_b).toFixed(2) : (q.expected_difficulty === 'easy' ? '-1.20' : q.expected_difficulty === 'hard' ? '1.25' : '0.05')}</strong></span>
                            <span>•</span>
                            <span>c:<strong className="text-gray-700 font-semibold">{q.irt_c !== undefined && q.irt_c !== null ? Number(q.irt_c).toFixed(2) : (q.type === 'mcq' ? '0.25' : '0.00')}</strong></span>
                          </div>
                        </div>
                      </td>

                      {/* Sử dụng */}
                      <td className="px-4 py-3.5 shrink-0 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {q.in_exercise_bank && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
                              title="Đã được đưa vào Kho Bài Tập"
                            >
                              <BookOpen className="h-3 w-3" />
                              Kho bài tập
                            </span>
                          )}
                          {q.usage_count && q.usage_count > 0 ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                              title={`Đã xuất hiện trong ${q.usage_count} bài tập / đề thi`}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              {q.usage_count} lần
                            </span>
                          ) : !q.in_exercise_bank ? (
                            <span className="text-gray-300 text-xs">—</span>
                          ) : null}
                        </div>
                      </td>

                      {/* Lĩnh vực · Chủ đề */}
                      <td
                        className="px-4 py-3.5 text-gray-600 max-w-xs truncate font-normal"
                        title={q.topic_name || q.chapter_name || 'Chưa phân loại'}
                      >
                        {q.topic_name || q.chapter_name || (
                          <span className="text-gray-400 italic">Chưa phân loại</span>
                        )}
                      </td>

                      {/* Action context menu */}
                      <td
                        className="px-3 py-3.5 text-center relative"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setActiveRowMenuId(isMenuOpen ? null : q.id)
                          }
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>

                        {isMenuOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-20"
                              onClick={() => setActiveRowMenuId(null)}
                            />
                            <div className="absolute right-3 top-full mt-1 z-30 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-1 text-xs text-gray-700 text-left animate-in fade-in zoom-in-95">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveRowMenuId(null);
                                  onSelectQuestion(q.id);
                                }}
                                className="w-full px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Eye className="h-3.5 w-3.5 text-gray-500" />
                                Xem chi tiết
                              </button>
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setActiveRowMenuId(null);
                                  try {
                                    if (q.in_exercise_bank) {
                                      await exerciseApi.removeQuestionFromBank(q.id);
                                      toast.success('Đã gỡ câu hỏi khỏi Kho Bài Tập');
                                    } else {
                                      await exerciseApi.addQuestionsToBank([q.id]);
                                      toast.success('Đã thêm câu hỏi vào Kho Bài Tập');
                                    }
                                    qc.invalidateQueries({ queryKey: ['questions'] });
                                    qc.invalidateQueries({ queryKey: ['exercises-questions'] });
                                    qc.invalidateQueries({ queryKey: ['exercises-bank-global-count'] });
                                  } catch (err) {
                                    toast.error(getErrorMessage(err));
                                  }
                                }}
                                className={clsx(
                                  "w-full px-3 py-1.5 flex items-center gap-2 font-medium text-xs",
                                  q.in_exercise_bank ? "text-amber-700 hover:bg-amber-50" : "text-emerald-700 hover:bg-emerald-50"
                                )}
                              >
                                <BookOpen className={clsx("h-3.5 w-3.5", q.in_exercise_bank ? "text-amber-600" : "text-emerald-600")} />
                                {q.in_exercise_bank ? 'Gỡ khỏi Kho bài tập' : 'Đưa vào Kho bài tập'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(q.id)}
                                className="w-full px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Pencil className="h-3.5 w-3.5 text-gray-500" />
                                Chỉnh sửa
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm('Bạn có chắc muốn xóa câu hỏi này?')) {
                                    deleteSingleMutation.mutate(q.id);
                                  }
                                }}
                                className="w-full px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2 border-t border-gray-100"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Xóa câu hỏi
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination bar */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-gray-100 px-4 py-2.5 sm:px-5 sm:py-3 bg-white shrink-0">
            <span className="text-xs text-gray-500 text-center sm:text-left">
              Trang {page} / {totalPages} (Tổng {total} câu)
            </span>
            <div className="flex justify-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onFilterChange({ page: page - 1 })}
                disabled={page <= 1}
                className="h-8 px-2.5 rounded-lg border border-gray-200 text-xs"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Trước
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onFilterChange({ page: page + 1 })}
                disabled={page >= totalPages}
                className="h-8 px-2.5 rounded-lg border border-gray-200 text-xs"
              >
                Sau
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AssignTopicModal
        open={assignTopicOpen}
        onOpenChange={setAssignTopicOpen}
        questionIds={Array.from(selected)}
        onSuccess={() => setSelected(new Set())}
      />

      <CreateExamFromQuestionsModal
        open={createExamOpen}
        onClose={() => setCreateExamOpen(false)}
        selectedQuestionIds={Array.from(selected)}
        onSuccess={() => setSelected(new Set())}
      />

      <CreateExerciseModal
        open={createExerciseOpen}
        onClose={() => setCreateExerciseOpen(false)}
        selectedQuestionIds={Array.from(selected)}
        onSuccess={() => setSelected(new Set())}
      />

      <AutoGenerateModal
        open={autoGenerateOpen}
        onClose={() => setAutoGenerateOpen(false)}
      />

      {editingQuestion && (
        <EditQuestionModal
          question={editingQuestion}
          open={editModalOpen}
          onOpenChange={(open) => {
            setEditModalOpen(open);
            if (!open) setEditingQuestion(null);
          }}
        />
      )}
    </div>
  );
}
