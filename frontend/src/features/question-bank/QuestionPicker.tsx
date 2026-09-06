import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, CheckSquare, Square, CheckCircle2, Layers, AlertCircle, Sparkles } from 'lucide-react';
import { questionApi } from '@/services/api';
import { Spinner } from '@/components/ui/Spinner';
import type { QuestionListItem } from '@/types';

export interface QuestionPickerProps {
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll?: (ids: string[]) => void;
  onClearAll?: () => void;
  maxHeightClass?: string;
  showFilters?: boolean;
  subjectId?: string;
  inExerciseBankOnly?: boolean;
}

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

export function QuestionPicker({
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearAll,
  maxHeightClass = 'max-h-80',
  showFilters = true,
  subjectId,
  inExerciseBankOnly = false,
}: QuestionPickerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [bloomFilter, setBloomFilter] = useState<string>('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['questions-picker', subjectId, inExerciseBankOnly],
    queryFn: () =>
      questionApi.list({
        subject_id: subjectId,
        in_exercise_bank: inExerciseBankOnly ? true : undefined,
        page: 1,
        page_size: 200,
      }),
  });

  const allQuestions: QuestionListItem[] = data?.data?.items ?? [];

  // Filter in memory for instantaneous UX
  const filteredQuestions = useMemo(() => {
    return allQuestions.filter((q) => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const stemMatch = (q.stem_preview || '').toLowerCase().includes(term);
        const codeMatch = (q.item_id || '').toLowerCase().includes(term);
        const topicMatch = (q.topic_name || '').toLowerCase().includes(term);
        if (!stemMatch && !codeMatch && !topicMatch) return false;
      }
      if (typeFilter && q.type !== typeFilter) return false;
      if (bloomFilter && q.bloom_level !== bloomFilter) return false;
      if (difficultyFilter && q.expected_difficulty !== difficultyFilter) return false;
      return true;
    });
  }, [allQuestions, searchTerm, typeFilter, bloomFilter, difficultyFilter]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const handleSelectAllFiltered = () => {
    if (!onSelectAll) return;
    const currentFilteredIds = filteredQuestions.map((q) => q.id);
    const merged = Array.from(new Set([...selectedIds, ...currentFilteredIds]));
    onSelectAll(merged);
  };

  const handleClearSelected = () => {
    if (onClearAll) {
      onClearAll();
    } else if (onSelectAll) {
      onSelectAll([]);
    }
  };

  return (
    <div className="space-y-3 bg-white border border-gray-200 rounded-xl p-3 shadow-xs">
      {/* Search & Filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo nội dung, mã câu hỏi hoặc chủ đề..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-800"
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

        {showFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Tất cả loại câu hỏi</option>
              <option value="mcq">Trắc nghiệm</option>
              <option value="essay">Tự luận</option>
              <option value="coding">Lập trình</option>
            </select>

            <select
              value={bloomFilter}
              onChange={(e) => setBloomFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Tất cả mức Bloom</option>
              <option value="remember">Nhận biết</option>
              <option value="understand">Thông hiểu</option>
              <option value="apply">Vận dụng</option>
              <option value="analyze">Vận dụng cao</option>
            </select>

            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Tất cả độ khó</option>
              <option value="easy">Dễ</option>
              <option value="medium">Vừa</option>
              <option value="hard">Khó</option>
            </select>

            {(typeFilter || bloomFilter || difficultyFilter || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setTypeFilter('');
                  setBloomFilter('');
                  setDifficultyFilter('');
                  setSearchTerm('');
                }}
                className="text-xs text-primary-600 hover:text-primary-800 font-medium ml-auto"
              >
                Đặt lại bộ lọc
              </button>
            )}
          </div>
        )}
      </div>

      {/* Selection Control Bar */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded-lg text-xs border border-gray-100">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {inExerciseBankOnly && (
            <span className="bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded text-[11px] flex items-center gap-1 border border-emerald-300">
              <Layers className="h-3 w-3 text-emerald-700" />
              Kho bài tập
            </span>
          )}
          <span className="font-semibold text-gray-700">
            Đã chọn:{' '}
            <strong className="text-emerald-700 font-bold px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200">
              {selectedIds.length}
            </strong>{' '}
            câu hỏi
          </span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-500">
            Hiển thị: <strong>{filteredQuestions.length}</strong> / {allQuestions.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onSelectAll && filteredQuestions.length > 0 && (
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              className="text-primary-600 hover:text-primary-800 font-medium hover:underline"
            >
              Chọn tất cả ({filteredQuestions.length})
            </button>
          )}
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={handleClearSelected}
              className="text-rose-600 hover:text-rose-800 font-medium hover:underline"
            >
              Bỏ chọn tất cả
            </button>
          )}
        </div>
      </div>

      {/* Question List View */}
      <div className={`overflow-y-auto ${maxHeightClass} divide-y divide-gray-100 pr-1 space-y-1`}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <Spinner className="h-6 w-6 text-primary-500 mb-2" />
            <span className="text-xs">
              {inExerciseBankOnly ? 'Đang tải danh sách câu hỏi từ Kho bài tập...' : 'Đang tải danh sách câu hỏi từ ngân hàng...'}
            </span>
          </div>
        ) : isError ? (
          <div className="py-6 text-center text-xs text-rose-500 flex flex-col items-center gap-1">
            <AlertCircle className="h-5 w-5" />
            <span>Không thể tải câu hỏi từ hệ thống.</span>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400 space-y-1.5">
            <p className="font-semibold text-gray-700 text-sm">
              {inExerciseBankOnly
                ? 'Kho bài tập chưa có câu hỏi nào (hoặc không khớp bộ lọc)'
                : 'Không tìm thấy câu hỏi nào phù hợp'}
            </p>
            <p className="text-gray-500">
              {inExerciseBankOnly
                ? 'Hãy vào "Ngân hàng câu hỏi", tích chọn các câu hỏi mong muốn và bấm "Đưa vào Kho bài tập" trước khi giao.'
                : 'Hãy thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc'}
            </p>
          </div>
        ) : (
          filteredQuestions.map((q, idx) => {
            const isChecked = selectedSet.has(q.id);
            const typeInfo = TYPE_LABELS[q.type] || { label: q.type, color: 'bg-gray-50 text-gray-600' };
            const bloomInfo = q.bloom_level ? BLOOM_LABELS[q.bloom_level] : null;
            const diffInfo = q.expected_difficulty ? DIFFICULTY_LABELS[q.expected_difficulty] : null;

            return (
              <div
                key={q.id}
                onClick={() => onToggleSelect(q.id)}
                className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  isChecked
                    ? 'border-emerald-300 bg-emerald-50/40 shadow-xs'
                    : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/70 bg-white'
                }`}
              >
                <div className="pt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}} // Handled by parent div
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="font-mono font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">
                      #{idx + 1} {q.item_id || 'Q'}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${typeInfo.color}`}>
                      {typeInfo.label}
                    </span>
                    {bloomInfo && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${bloomInfo.color}`}>
                        {bloomInfo.label}
                      </span>
                    )}
                    {diffInfo && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${diffInfo.color}`}>
                        {diffInfo.label}
                      </span>
                    )}
                    {q.topic_name && (
                      <span className="text-gray-500 truncate max-w-[150px]" title={q.topic_name}>
                        • {q.topic_name}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-800 line-clamp-2 leading-relaxed">
                    {q.stem_preview || '(Chưa có nội dung câu hỏi)'}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
