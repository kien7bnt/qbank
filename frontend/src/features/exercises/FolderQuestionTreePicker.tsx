import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  CheckSquare,
  Square,
  MinusSquare,
  Search,
  Layers,
  FileQuestion,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { domainApi, questionApi } from '@/services/api';
import { Spinner } from '@/components/ui/Spinner';
import type { QuestionListItem } from '@/types';

export interface FolderQuestionTreePickerProps {
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll?: (ids: string[]) => void;
  onClearAll?: () => void;
  maxHeightClass?: string;
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

export function FolderQuestionTreePicker({
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearAll,
  maxHeightClass = 'max-h-[420px]',
}: FolderQuestionTreePickerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // 1. Fetch domains & topics hierarchy
  const { data: domainsData, isLoading: loadingDomains } = useQuery({
    queryKey: ['curriculum-domains-tree'],
    queryFn: () => domainApi.list(),
  });

  // 2. Fetch questions from Question Bank that are in the exercise bank
  const { data: questionsData, isLoading: loadingQuestions } = useQuery({
    queryKey: ['questions-exercise-bank-tree'],
    queryFn: () => questionApi.list({ page: 1, page_size: 500, in_exercise_bank: true }),
  });

  const domains: any[] = domainsData?.data || [];
  const allQuestions: QuestionListItem[] = useMemo(() => {
    const raw: QuestionListItem[] = questionsData?.data?.items || [];
    return raw.filter((q) => q.in_exercise_bank !== false);
  }, [questionsData]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Group questions by domain/chapter and topic
  const { groupedTree, uncategorizedQuestions, totalVisibleQuestions } = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    // Filter questions by search term first
    const matchedQuestions = allQuestions.filter((q) => {
      if (!term) return true;
      const stemMatch = (q.stem_preview || '').toLowerCase().includes(term);
      const codeMatch = (q.item_id || '').toLowerCase().includes(term);
      const topicMatch = (q.topic_name || '').toLowerCase().includes(term);
      return stemMatch || codeMatch || topicMatch;
    });

    const byChapterAndTopic: Record<string, { direct: QuestionListItem[]; topics: Record<string, QuestionListItem[]> }> = {};
    const uncat: QuestionListItem[] = [];

    // Initialize map
    for (const d of domains) {
      byChapterAndTopic[d.id] = {
        direct: [],
        topics: {},
      };
      if (d.topics) {
        for (const t of d.topics) {
          byChapterAndTopic[d.id].topics[t.id] = [];
        }
      }
    }

    // Distribute questions
    for (const q of matchedQuestions) {
      if (!q.chapter_id) {
        uncat.push(q);
      } else if (byChapterAndTopic[q.chapter_id]) {
        if (q.topic_id && byChapterAndTopic[q.chapter_id].topics[q.topic_id]) {
          byChapterAndTopic[q.chapter_id].topics[q.topic_id].push(q);
        } else {
          byChapterAndTopic[q.chapter_id].direct.push(q);
        }
      } else {
        // Unknown chapter
        uncat.push(q);
      }
    }

    return {
      groupedTree: byChapterAndTopic,
      uncategorizedQuestions: uncat,
      totalVisibleQuestions: matchedQuestions.length,
    };
  }, [domains, allQuestions, searchTerm]);

  // Toggle expand/collapse of a node
  const toggleExpand = (key: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Expand all
  const expandAll = () => {
    const map: Record<string, boolean> = { uncat: true };
    for (const d of domains) {
      map[`d_${d.id}`] = true;
      if (d.topics) {
        for (const t of d.topics) {
          map[`t_${t.id}`] = true;
        }
      }
    }
    setExpandedNodes(map);
  };

  // Collapse all
  const collapseAll = () => {
    setExpandedNodes({});
  };

  // Helper to select/deselect a list of questions
  const toggleBatch = (qList: QuestionListItem[]) => {
    if (!onSelectAll) return;
    const listIds = qList.map((q) => q.id);
    const allSelected = listIds.every((id) => selectedSet.has(id));

    if (allSelected) {
      // Remove all listIds
      const next = selectedIds.filter((id) => !listIds.includes(id));
      onSelectAll(next);
    } else {
      // Add all listIds
      const next = Array.from(new Set([...selectedIds, ...listIds]));
      onSelectAll(next);
    }
  };

  const isLoading = loadingDomains || loadingQuestions;

  return (
    <div className="space-y-2.5 bg-white border border-gray-200 rounded-xl p-3 shadow-xs">
      {/* Search Header */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Tìm kiếm nhanh câu hỏi theo nội dung, mã số hoặc chủ đề..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-800 placeholder:text-gray-400"
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

      {/* Control Bar: Expand/Collapse & Counters */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-700">
            Đã chọn:{' '}
            <strong className="text-emerald-700 font-bold px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200">
              {selectedIds.length}
            </strong>{' '}
            câu hỏi
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500">
            Tổng số trong kho bài tập: <strong>{totalVisibleQuestions}</strong> câu
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="text-gray-600 hover:text-gray-900 hover:underline text-[11px]"
          >
            Mở rộng tất cả
          </button>
          <span className="text-gray-300">•</span>
          <button
            type="button"
            onClick={collapseAll}
            className="text-gray-600 hover:text-gray-900 hover:underline text-[11px]"
          >
            Thu gọn
          </button>
          {onSelectAll && totalVisibleQuestions > 0 && (
            <>
              <span className="text-gray-300">•</span>
              <button
                type="button"
                onClick={() => {
                  const allVisibleIds = allQuestions.map((q) => q.id);
                  onSelectAll(Array.from(new Set([...selectedIds, ...allVisibleIds])));
                }}
                className="text-primary-600 hover:text-primary-800 font-medium hover:underline text-[11px]"
              >
                Chọn tất cả ({totalVisibleQuestions})
              </button>
            </>
          )}
          {selectedIds.length > 0 && (
            <>
              <span className="text-gray-300">•</span>
              <button
                type="button"
                onClick={() => (onClearAll ? onClearAll() : onSelectAll?.([]))}
                className="text-rose-600 hover:text-rose-800 font-medium hover:underline text-[11px]"
              >
                Bỏ chọn
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tree Content */}
      <div
        className={clsx(
          'p-3 overflow-y-auto border border-gray-200 rounded-xl bg-white space-y-1',
          maxHeightClass
        )}
      >
        {loadingDomains || loadingQuestions ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Spinner className="h-6 w-6 text-primary-500 mb-2" />
            <span className="text-xs">Đang tải cấu trúc cây thư mục kho bài tập...</span>
          </div>
        ) : totalVisibleQuestions === 0 ? (
          <div className="py-8 text-center text-gray-400 space-y-1">
            <AlertCircle className="h-6 w-6 mx-auto text-amber-500 mb-1" />
            <p className="font-medium text-gray-600">Kho bài tập chưa có câu hỏi nào</p>
            <p className="text-[11px]">Hãy soạn câu hỏi mới ở Tab "Soạn câu hỏi mới" hoặc gắn thêm câu hỏi từ Ngân hàng câu hỏi.</p>
          </div>
        ) : (
          <div>
            {/* Render each Domain / Chapter */}
            {domains.map((domain) => {
              const nodeKey = `d_${domain.id}`;
              const isExpanded = expandedNodes[nodeKey] ?? (searchTerm ? true : false);
              const domainGroup = groupedTree[domain.id] || { direct: [], topics: {} };

              // Collect all questions under this domain (direct + topics)
              const allDomainQuestions: QuestionListItem[] = [
                ...domainGroup.direct,
                ...Object.values(domainGroup.topics).flat(),
              ];

              if (allDomainQuestions.length === 0) {
                return null; // Chỉ hiển thị các thư mục có câu hỏi thuộc kho bài tập
              }

              const domainSelectedCount = allDomainQuestions.filter((q) => selectedSet.has(q.id)).length;
              const isAllDomainSelected = allDomainQuestions.length > 0 && domainSelectedCount === allDomainQuestions.length;
              const isSomeDomainSelected = domainSelectedCount > 0 && !isAllDomainSelected;

              return (
                <div key={domain.id} className="select-none">
                  {/* Domain Row */}
                  <div
                    className={clsx(
                      'flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer group',
                      isExpanded ? 'bg-slate-50 font-semibold' : 'text-gray-700'
                    )}
                  >
                    {/* Expand Arrow */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(nodeKey);
                      }}
                      className="p-0.5 hover:bg-slate-200 rounded text-gray-500"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-600" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </button>

                    {/* Batch Checkbox for Domain */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBatch(allDomainQuestions);
                      }}
                      className="text-primary-600 hover:text-primary-800"
                    >
                      {isAllDomainSelected ? (
                        <CheckSquare className="h-4 w-4 text-emerald-600" />
                      ) : isSomeDomainSelected ? (
                        <MinusSquare className="h-4 w-4 text-amber-600" />
                      ) : (
                        <Square className="h-4 w-4 text-gray-300 group-hover:text-gray-400" />
                      )}
                    </button>

                    {/* Folder Icon & Title */}
                    <div
                      onClick={() => toggleExpand(nodeKey)}
                      className="flex-1 flex items-center gap-1.5 min-w-0"
                    >
                      {isExpanded ? (
                        <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
                      ) : (
                        <Folder className="h-4 w-4 text-amber-500 shrink-0" />
                      )}
                      <span className="truncate text-gray-800">{domain.name}</span>
                      <span className="text-[11px] text-gray-400 font-normal">
                        ({domainSelectedCount > 0 ? `${domainSelectedCount}/` : ''}
                        {allDomainQuestions.length} câu)
                      </span>
                    </div>
                  </div>

                  {/* Domain Children */}
                  {isExpanded && (
                    <div className="pl-6 border-l border-slate-200 ml-4 my-1 space-y-1">
                      {/* 1. Topics under this domain */}
                      {domain.topics?.map((topic: any) => {
                        const topicKey = `t_${topic.id}`;
                        const isTopicExpanded = expandedNodes[topicKey] ?? (searchTerm ? true : false);
                        const topicQuestions = domainGroup.topics[topic.id] || [];

                        if (searchTerm && topicQuestions.length === 0) return null;

                        const topicSelectedCount = topicQuestions.filter((q) => selectedSet.has(q.id)).length;
                        const isAllTopicSelected = topicQuestions.length > 0 && topicSelectedCount === topicQuestions.length;
                        const isSomeTopicSelected = topicSelectedCount > 0 && !isAllTopicSelected;

                        return (
                          <div key={topic.id} className="select-none">
                            {/* Topic Row */}
                            <div
                              className={clsx(
                                'flex items-center gap-2 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer group',
                                isTopicExpanded ? 'bg-slate-50 font-medium' : 'text-gray-600'
                              )}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpand(topicKey);
                                }}
                                className="p-0.5 hover:bg-slate-200 rounded text-gray-500"
                              >
                                {isTopicExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-gray-600" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleBatch(topicQuestions);
                                }}
                                className="text-primary-600 hover:text-primary-800"
                              >
                                {isAllTopicSelected ? (
                                  <CheckSquare className="h-3.5 w-3.5 text-emerald-600" />
                                ) : isSomeTopicSelected ? (
                                  <MinusSquare className="h-3.5 w-3.5 text-amber-600" />
                                ) : (
                                  <Square className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-400" />
                                )}
                              </button>

                              <div
                                onClick={() => toggleExpand(topicKey)}
                                className="flex-1 flex items-center gap-1.5 min-w-0"
                              >
                                {isTopicExpanded ? (
                                  <FolderOpen className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                                ) : (
                                  <Folder className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                                )}
                                <span className="truncate text-gray-700">{topic.name}</span>
                                <span className="text-[10px] text-gray-400 font-normal">
                                  ({topicSelectedCount > 0 ? `${topicSelectedCount}/` : ''}
                                  {topicQuestions.length} câu)
                                </span>
                              </div>
                            </div>

                            {/* Questions in Topic */}
                            {isTopicExpanded && (
                              <div className="pl-6 border-l border-indigo-100 ml-4 my-1 space-y-1">
                                {topicQuestions.length === 0 ? (
                                  <p className="text-[11px] text-gray-400 italic py-1">Chưa có câu hỏi nào trong chủ đề này.</p>
                                ) : (
                                  topicQuestions.map((q) => (
                                    <QuestionTreeItem
                                      key={q.id}
                                      question={q}
                                      isSelected={selectedSet.has(q.id)}
                                      onToggle={() => onToggleSelect(q.id)}
                                    />
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* 2. Direct questions in chapter (not attached to a specific topic) */}
                      {domainGroup.direct.length > 0 && (
                        <div className="space-y-1 pt-1">
                          {domainGroup.direct.map((q) => (
                            <QuestionTreeItem
                              key={q.id}
                              question={q}
                              isSelected={selectedSet.has(q.id)}
                              onToggle={() => onToggleSelect(q.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Uncategorized Questions */}
            {uncategorizedQuestions.length > 0 && (
              <div className="select-none pt-1">
                <div
                  className={clsx(
                    'flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 transition-colors cursor-pointer group',
                    expandedNodes['uncat'] ? 'bg-slate-50 font-semibold' : 'text-gray-700'
                  )}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand('uncat');
                    }}
                    className="p-0.5 hover:bg-slate-200 rounded text-gray-500"
                  >
                    {expandedNodes['uncat'] ? (
                      <ChevronDown className="h-4 w-4 text-gray-600" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleBatch(uncategorizedQuestions);
                    }}
                    className="text-primary-600 hover:text-primary-800"
                  >
                    {uncategorizedQuestions.every((q) => selectedSet.has(q.id)) ? (
                      <CheckSquare className="h-4 w-4 text-emerald-600" />
                    ) : uncategorizedQuestions.some((q) => selectedSet.has(q.id)) ? (
                      <MinusSquare className="h-4 w-4 text-amber-600" />
                    ) : (
                      <Square className="h-4 w-4 text-gray-300 group-hover:text-gray-400" />
                    )}
                  </button>

                  <div
                    onClick={() => toggleExpand('uncat')}
                    className="flex-1 flex items-center gap-1.5 min-w-0"
                  >
                    <Folder className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="truncate text-gray-700">Chưa phân loại</span>
                    <span className="text-[11px] text-gray-400 font-normal">
                      ({uncategorizedQuestions.length} câu)
                    </span>
                  </div>
                </div>

                {expandedNodes['uncat'] && (
                  <div className="pl-6 border-l border-slate-200 ml-4 my-1 space-y-1">
                    {uncategorizedQuestions.map((q) => (
                      <QuestionTreeItem
                        key={q.id}
                        question={q}
                        isSelected={selectedSet.has(q.id)}
                        onToggle={() => onToggleSelect(q.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-component: Individual Question Row inside tree
function QuestionTreeItem({
  question,
  isSelected,
  onToggle,
}: {
  question: QuestionListItem;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const typeInfo = TYPE_LABELS[question.type] || { label: question.type, color: 'bg-gray-50 text-gray-600' };
  const bloomInfo = question.bloom_level ? BLOOM_LABELS[question.bloom_level] : null;
  const diffInfo = question.expected_difficulty ? DIFFICULTY_LABELS[question.expected_difficulty] : null;

  return (
    <div
      onClick={onToggle}
      className={clsx(
        'flex items-start gap-2.5 p-2 rounded-lg border transition-all cursor-pointer select-none',
        isSelected
          ? 'border-emerald-300 bg-emerald-50/50 shadow-2xs'
          : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/70 bg-white'
      )}
    >
      <div className="pt-0.5 shrink-0 pointer-events-none">
        <input
          type="checkbox"
          checked={isSelected}
          readOnly
          className="h-3.5 w-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
        />
      </div>

      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className="font-mono font-bold text-gray-700 bg-gray-100 px-1 py-0.2 rounded">
            {question.item_id || 'Q'}
          </span>
          <span className={clsx('px-1 py-0.2 rounded border font-semibold', typeInfo.color)}>
            {typeInfo.label}
          </span>
          {bloomInfo && (
            <span className={clsx('px-1 py-0.2 rounded font-medium', bloomInfo.color)}>
              {bloomInfo.label}
            </span>
          )}
          {diffInfo && (
            <span className={clsx('px-1 py-0.2 rounded font-medium', diffInfo.color)}>
              {diffInfo.label}
            </span>
          )}
          {question.is_calibrated ? (
            <span className="px-1 py-0.2 rounded font-bold bg-green-50 text-green-700 border border-green-200">
              Đã định cỡ
            </span>
          ) : (
            <span className="px-1 py-0.2 rounded font-medium bg-gray-100 text-gray-500 border border-gray-200">
              Chưa định cỡ
            </span>
          )}
          <span className="text-[9px] text-gray-500 font-mono">
            a:{question.irt_a !== undefined && question.irt_a !== null ? Number(question.irt_a).toFixed(2) : (question.bloom_level === 'remember' ? '0.85' : question.bloom_level === 'understand' ? '1.05' : question.bloom_level === 'apply' ? '1.35' : question.bloom_level === 'analyze' ? '1.65' : '1.05')} b:{question.irt_b !== undefined && question.irt_b !== null ? Number(question.irt_b).toFixed(2) : (question.expected_difficulty === 'easy' ? '-1.20' : question.expected_difficulty === 'hard' ? '1.25' : '0.05')} c:{question.irt_c !== undefined && question.irt_c !== null ? Number(question.irt_c).toFixed(2) : (question.type === 'mcq' ? '0.25' : '0.00')}
          </span>
        </div>

        <p className="text-[11px] text-gray-800 line-clamp-2 leading-relaxed">
          {question.stem_preview || '(Chưa có nội dung)'}
        </p>
      </div>
    </div>
  );
}
