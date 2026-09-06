import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Plus,
  Send,
  Search,
  Filter,
  CheckCircle2,
  FolderTree,
  Eye,
  Layers,
  Sparkles,
  ClipboardList,
  AlertCircle,
  HelpCircle,
  Trash2,
  FolderPlus,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { questionApi, exerciseApi, getErrorMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { PageSpinner, Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { FolderTreeSidebar, type SelectedFolder } from '@/features/question-bank/FolderTreeSidebar';
import { CreateAssignmentModal } from '@/features/assignments/CreateAssignmentModal';
import { CreateQuestionModal } from '@/features/question-bank/CreateQuestionModal';
import { QuestionDetailDrawer } from '@/features/question-bank/QuestionDetailDrawer';
import { QuestionPicker } from '@/features/question-bank/QuestionPicker';
import type { QuestionFilter, QuestionListItem, QuestionType, BloomLevel, DifficultyLevel } from '@/types';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  mcq: { label: 'Trắc nghiệm', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  essay: { label: 'Tự luận', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  coding: { label: 'Lập trình', color: 'bg-purple-50 text-purple-700 border-purple-200' },
};

const BLOOM_LABELS: Record<string, { label: string; color: string }> = {
  remember: { label: 'Nhận biết', color: 'bg-slate-100 text-slate-700' },
  understand: { label: 'Thông hiểu', color: 'bg-teal-50 text-teal-700' },
  apply: { label: 'Vận dụng', color: 'bg-orange-50 text-orange-700' },
  analyze: { label: 'Vận dụng cao', color: 'bg-rose-50 text-rose-700' },
};

const DIFFICULTY_LABELS: Record<string, { label: string; color: string }> = {
  easy: { label: 'Dễ', color: 'text-emerald-700 bg-emerald-50' },
  medium: { label: 'Vừa', color: 'text-amber-700 bg-amber-50' },
  hard: { label: 'Khó', color: 'text-red-700 bg-red-50' },
};

export function ExercisesListPage() {
  const qc = useQueryClient();

  // Selected folder from sidebar
  const [selectedFolder, setSelectedFolder] = useState<SelectedFolder | null>(null);
  const [mobileFolderOpen, setMobileFolderOpen] = useState(false);

  // Selected question IDs in Kho Bài Tập
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  // Modals
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [createQuestionOpen, setCreateQuestionOpen] = useState(false);
  const [addFromBankOpen, setAddFromBankOpen] = useState(false);
  const [pickerSelectedIds, setPickerSelectedIds] = useState<string[]>([]);

  // Filters - ONLY questions that have been added to exercise bank (in_exercise_bank: true)
  const [filter, setFilter] = useState<QuestionFilter>({
    page: 1,
    page_size: 50,
    in_exercise_bank: true,
  });
  const [searchInput, setSearchInput] = useState('');

  // Global total count in Exercise Bank
  const { data: exerciseBankCountData } = useQuery({
    queryKey: ['exercises-bank-global-count'],
    queryFn: () => questionApi.list({ in_exercise_bank: true, page: 1, page_size: 1 }),
  });
  const totalInExerciseBank = exerciseBankCountData?.data?.total ?? 0;

  // Query questions for current folder & filter (ONLY in_exercise_bank == true)
  const { data: questionsData, isLoading } = useQuery({
    queryKey: ['exercises-questions', filter, selectedFolder],
    queryFn: () => {
      const params: QuestionFilter = { ...filter, in_exercise_bank: true };
      if (selectedFolder) {
        if (selectedFolder.type === 'domain') {
          params.chapter_id = selectedFolder.id;
        } else if (selectedFolder.type === 'topic') {
          params.chapter_id = selectedFolder.parentId;
          params.topic_id = selectedFolder.id;
        }
      }
      return questionApi.list(params);
    },
  });

  const questions: QuestionListItem[] = questionsData?.data?.items ?? [];
  const totalQuestions = questionsData?.data?.total ?? 0;

  // Mutations
  const addQuestionsMutation = useMutation({
    mutationFn: (ids: string[]) => exerciseApi.addQuestionsToBank(ids),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['exercises-questions'] });
      qc.invalidateQueries({ queryKey: ['exercises-bank-global-count'] });
      qc.invalidateQueries({ queryKey: ['questions'] });
      toast.success(res?.data?.message || '✨ Đã thêm câu hỏi vào Kho Bài Tập thành công!');
      setAddFromBankOpen(false);
      setPickerSelectedIds([]);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const removeQuestionMutation = useMutation({
    mutationFn: (id: string) => exerciseApi.removeQuestionFromBank(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exercises-questions'] });
      qc.invalidateQueries({ queryKey: ['exercises-bank-global-count'] });
      qc.invalidateQueries({ queryKey: ['questions'] });
      toast.success('Đã gỡ câu hỏi khỏi Kho Bài Tập');
      setSelectedQuestionIds((prev) => prev.filter((item) => item !== selectedQuestionId));
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const removeMultipleMutation = useMutation({
    mutationFn: (ids: string[]) => exerciseApi.removeMultipleFromBank(ids),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['exercises-questions'] });
      qc.invalidateQueries({ queryKey: ['exercises-bank-global-count'] });
      qc.invalidateQueries({ queryKey: ['questions'] });
      toast.success(res?.data?.message || 'Đã gỡ các câu hỏi đã chọn khỏi Kho Bài Tập');
      setSelectedQuestionIds([]);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleSelectFolder = (folder: SelectedFolder | null) => {
    setSelectedFolder(folder);
    setSelectedQuestionIds([]);
    setFilter((prev) => ({ ...prev, page: 1 }));
  };

  const handleToggleSelectQuestion = (id: string) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllOnPage = () => {
    const pageIds = questions.map((q) => q.id);
    const merged = Array.from(new Set([...selectedQuestionIds, ...pageIds]));
    setSelectedQuestionIds(merged);
  };

  const handleClearSelected = () => {
    setSelectedQuestionIds([]);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/60 overflow-hidden">
      {/* Top Header Bar */}
      <div className="shrink-0 border-b border-gray-200/80 bg-white px-3 sm:px-6 py-2.5 sm:py-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
                  Kho Bài Tập
                </h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {totalInExerciseBank} câu đã chọn vào kho
                </span>
              </div>
              <p className="text-xs text-gray-500 hidden sm:block">
                Chỉ những câu hỏi được chọn từ Ngân hàng mới hiển thị tại đây. Tổ chức theo cây chuyên đề và giao bài tập nhanh.
              </p>
            </div>

            {/* Mobile Folder Toggle */}
            <button
              type="button"
              onClick={() => setMobileFolderOpen(true)}
              className="lg:hidden ml-auto inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200"
            >
              <FolderTree className="h-3.5 w-3.5 text-indigo-600" />
              <span>{selectedFolder ? selectedFolder.name : 'Thư mục'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => setAddFromBankOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm shadow-xs"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Thêm câu hỏi từ Ngân hàng
            </Button>

            <Button
              onClick={() => setAssignModalOpen(true)}
              disabled={totalInExerciseBank === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm shadow-xs disabled:opacity-50"
            >
              <Send className="h-4 w-4 mr-1.5" />
              {selectedQuestionIds.length > 0
                ? `Giao bài tập (${selectedQuestionIds.length} câu)`
                : 'Giao bài tập cho lớp'}
            </Button>

            <Link to="/question-bank" className="hidden sm:inline-block">
              <Button variant="outline" size="sm" className="text-xs sm:text-sm text-gray-600">
                Đến Ngân hàng gốc →
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Folder Tree Sidebar (Desktop) */}
        <div className="hidden lg:block w-72 shrink-0 border-r border-gray-200 bg-white overflow-hidden">
          <FolderTreeSidebar
            selectedFolder={selectedFolder}
            onSelectFolder={handleSelectFolder}
            totalQuestions={totalInExerciseBank}
          />
        </div>

        {/* Left: Folder Tree Drawer (Mobile) */}
        {mobileFolderOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <div
              className="fixed inset-0 bg-gray-600/60 backdrop-blur-xs"
              onClick={() => setMobileFolderOpen(false)}
            />
            <div className="relative w-80 max-w-[85vw] bg-white h-full z-50 shadow-xl flex flex-col">
              <FolderTreeSidebar
                selectedFolder={selectedFolder}
                onSelectFolder={(f) => {
                  handleSelectFolder(f);
                  setMobileFolderOpen(false);
                }}
                totalQuestions={totalInExerciseBank}
                onClose={() => setMobileFolderOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Right: Questions by Folder Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
          {/* Active Folder Breadcrumb & Filter Bar */}
          <div className="p-3 sm:p-4 border-b border-gray-200/80 bg-gray-50/40 space-y-3 shrink-0">
            {/* Folder Header */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Thư mục:
                </span>
                <span className="font-bold text-sm text-indigo-900 truncate bg-indigo-50/80 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-200/70">
                  {selectedFolder ? selectedFolder.name : 'Tất cả câu hỏi trong Kho Bài Tập'}
                </span>
                <span className="text-xs text-gray-500 font-medium">
                  ({totalQuestions} câu hỏi)
                </span>
              </div>

              {selectedQuestionIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md">
                    Đã chọn: {selectedQuestionIds.length} câu
                  </span>
                  <button
                    type="button"
                    onClick={handleClearSelected}
                    className="text-xs text-rose-600 hover:text-rose-800 underline font-medium"
                  >
                    Bỏ chọn
                  </button>
                </div>
              )}
            </div>

            {/* Filter & Search Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm nội dung câu hỏi trong Kho Bài Tập..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setFilter((prev) => ({ ...prev, search: searchInput.trim() || undefined, page: 1 }));
                    }
                  }}
                  className="w-full pl-9 pr-4 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800"
                />
              </div>

              {/* Type Filter */}
              <select
                value={filter.type || ''}
                onChange={(e) =>
                  setFilter((prev) => ({
                    ...prev,
                    type: (e.target.value as QuestionType) || undefined,
                    page: 1,
                  }))
                }
                className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Tất cả loại</option>
                <option value="mcq">Trắc nghiệm</option>
                <option value="essay">Tự luận</option>
                <option value="coding">Lập trình</option>
              </select>

              {/* Bloom Filter */}
              <select
                value={filter.bloom_level || ''}
                onChange={(e) =>
                  setFilter((prev) => ({
                    ...prev,
                    bloom_level: (e.target.value as BloomLevel) || undefined,
                    page: 1,
                  }))
                }
                className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Tất cả Bloom</option>
                <option value="remember">Nhận biết</option>
                <option value="understand">Thông hiểu</option>
                <option value="apply">Vận dụng</option>
                <option value="analyze">Vận dụng cao</option>
              </select>

              {/* Difficulty Filter */}
              <select
                value={filter.difficulty || ''}
                onChange={(e) =>
                  setFilter((prev) => ({
                    ...prev,
                    difficulty: (e.target.value as DifficultyLevel) || undefined,
                    page: 1,
                  }))
                }
                className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Tất cả độ khó</option>
                <option value="easy">Dễ</option>
                <option value="medium">Vừa</option>
                <option value="hard">Khó</option>
              </select>

              {questions.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllOnPage}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 hover:bg-indigo-50 rounded"
                >
                  Chọn trang này ({questions.length})
                </button>
              )}
            </div>
          </div>

          {/* Question List View */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3">
            {isLoading ? (
              <div className="py-16 text-center">
                <PageSpinner />
              </div>
            ) : totalInExerciseBank === 0 ? (
              <EmptyState
                icon={<BookOpen className="h-8 w-8 text-indigo-500" />}
                title="Kho Bài Tập chưa có câu hỏi nào"
                description="Chỉ những câu hỏi được bạn chọn từ Ngân hàng câu hỏi mới xuất hiện tại đây. Hãy chọn các câu hỏi phù hợp để đưa vào kho bài tập."
                action={
                  <Button
                    onClick={() => setAddFromBankOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Thêm câu hỏi từ Ngân hàng ngay
                  </Button>
                }
              />
            ) : questions.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="h-7 w-7 text-gray-400" />}
                title={
                  selectedFolder
                    ? `Thư mục "${selectedFolder.name}" chưa có câu hỏi nào trong Kho Bài Tập`
                    : 'Không tìm thấy câu hỏi phù hợp'
                }
                description="Hãy chọn thư mục khác hoặc thêm câu hỏi từ Ngân hàng vào thư mục này."
                action={
                  <Button
                    onClick={() => setAddFromBankOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Thêm câu hỏi vào thư mục
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2.5">
                {questions.map((q, idx) => {
                  const isChecked = selectedQuestionIds.includes(q.id);
                  const typeInfo = TYPE_LABELS[q.type] || { label: q.type, color: 'bg-gray-50 text-gray-600' };
                  const bloomInfo = q.bloom_level ? BLOOM_LABELS[q.bloom_level] : null;
                  const diffInfo = q.expected_difficulty ? DIFFICULTY_LABELS[q.expected_difficulty] : null;

                  return (
                    <div
                      key={q.id}
                      className={`p-3.5 rounded-xl border transition-all flex items-start gap-3.5 ${
                        isChecked
                          ? 'border-indigo-300 bg-indigo-50/40 shadow-xs ring-1 ring-indigo-300/50'
                          : 'border-gray-200/80 hover:border-gray-300 bg-white hover:shadow-xs'
                      }`}
                    >
                      {/* Checkbox */}
                      <div className="pt-0.5 shrink-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectQuestion(q.id)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {/* Meta Tags */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="font-mono font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">
                            #{idx + 1} {q.item_id || 'Q'}
                          </span>
                          <span className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${typeInfo.color}`}>
                            {typeInfo.label}
                          </span>
                          {bloomInfo && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${bloomInfo.color}`}>
                              {bloomInfo.label}
                            </span>
                          )}
                          {diffInfo && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${diffInfo.color}`}>
                              {diffInfo.label}
                            </span>
                          )}
                          {q.topic_name && (
                            <span className="text-gray-500 text-[11px] truncate max-w-[200px]" title={q.topic_name}>
                              📁 {q.topic_name}
                            </span>
                          )}
                          {q.usage_count !== undefined && q.usage_count > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                              Đã giao: {q.usage_count} lần
                            </span>
                          )}
                        </div>

                        {/* Stem */}
                        <p className="text-xs sm:text-sm text-gray-900 leading-relaxed font-normal">
                          {q.stem_preview || '(Chưa có nội dung câu hỏi)'}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0 self-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedQuestionId(q.id)}
                          title="Xem chi tiết câu hỏi và đáp án"
                          className="h-8 px-2 text-xs text-gray-600 hover:text-indigo-700 hover:bg-indigo-50"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Chi tiết
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedQuestionIds([q.id]);
                            setAssignModalOpen(true);
                          }}
                          className="h-8 px-2 text-xs text-indigo-700 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100"
                        >
                          <Send className="h-3 w-3 mr-1 text-indigo-600" />
                          Giao câu này
                        </Button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Bạn có chắc muốn gỡ câu hỏi này khỏi Kho Bài Tập? (Câu hỏi vẫn được lưu nguyên vẹn trong Ngân hàng câu hỏi)')) {
                              removeQuestionMutation.mutate(q.id);
                            }
                          }}
                          title="Gỡ khỏi Kho Bài Tập"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom Floating Bar when questions are selected */}
          {selectedQuestionIds.length > 0 && (
            <div className="shrink-0 p-3 bg-indigo-950 text-white flex items-center justify-between gap-4 px-4 sm:px-6 shadow-xl border-t border-indigo-800">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">
                  Đã chọn: <strong className="text-amber-300 font-bold text-base">{selectedQuestionIds.length}</strong> câu hỏi trong kho
                </span>
                <button
                  onClick={handleClearSelected}
                  className="text-xs text-gray-300 hover:text-white underline"
                >
                  Bỏ chọn tất cả
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Gỡ ${selectedQuestionIds.length} câu hỏi đã chọn khỏi Kho Bài Tập? (Câu hỏi vẫn còn nguyên trong Ngân hàng gốc)`)) {
                      removeMultipleMutation.mutate(selectedQuestionIds);
                    }
                  }}
                  className="text-red-300 border-red-500/50 hover:bg-red-950 hover:text-white text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1 text-red-400" />
                  Gỡ khỏi Kho ({selectedQuestionIds.length})
                </Button>

                <Button
                  onClick={() => setAssignModalOpen(true)}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm shadow-md"
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  Giao bài tập cho lớp ({selectedQuestionIds.length} câu)
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Thêm câu hỏi từ Ngân hàng câu hỏi vào Kho Bài Tập */}
      <Modal
        open={addFromBankOpen}
        onOpenChange={setAddFromBankOpen}
        title={
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <FolderPlus className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-gray-900">
                Chọn Câu Hỏi Từ Ngân Hàng Đưa Vào Kho Bài Tập
              </span>
              <p className="text-xs text-gray-500 font-normal">
                Tích chọn các câu hỏi cần thiết từ ngân hàng câu hỏi gốc để đưa vào Kho Bài Tập
              </p>
            </div>
          </div>
        }
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddFromBankOpen(false)}>
              Hủy
            </Button>
            <Button
              disabled={pickerSelectedIds.length === 0}
              loading={addQuestionsMutation.isPending}
              onClick={() => addQuestionsMutation.mutate(pickerSelectedIds)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              Thêm vào Kho Bài Tập ({pickerSelectedIds.length} câu)
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-gray-600">
            Sử dụng ô tìm kiếm và các bộ lọc bên dưới để chọn các câu hỏi muốn đưa vào <strong>Kho Bài Tập</strong>:
          </p>
          <QuestionPicker
            selectedIds={pickerSelectedIds}
            onToggleSelect={(id) =>
              setPickerSelectedIds((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
              )
            }
            onSelectAll={(ids) => setPickerSelectedIds(ids)}
            onClearAll={() => setPickerSelectedIds([])}
            maxHeightClass="max-h-80"
          />
        </div>
      </Modal>

      {/* Create Assignment Modal (with pre-selected question IDs and homework mode) */}
      <CreateAssignmentModal
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        initialType="homework"
        initialQuestionIds={selectedQuestionIds}
      />

      {/* Create Question Modal */}
      <CreateQuestionModal
        open={createQuestionOpen}
        onOpenChange={setCreateQuestionOpen}
        defaultChapterId={selectedFolder?.type === 'domain' ? selectedFolder.id : selectedFolder?.parentId}
        defaultTopicId={selectedFolder?.type === 'topic' ? selectedFolder.id : undefined}
      />

      {/* Question Detail Drawer */}
      <QuestionDetailDrawer
        questionId={selectedQuestionId}
        onClose={() => setSelectedQuestionId(null)}
      />
    </div>
  );
}
