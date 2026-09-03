import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Archive,
  Tag,
  CheckCircle2,
  CheckSquare,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { questionApi, domainApi, getErrorMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageSpinner } from '@/components/ui/Spinner';
import {
  BloomBadge,
  DifficultyBadge,
  QuestionStatusBadge,
  QuestionTypeBadge,
} from '@/components/ui/Badge';
import type { QuestionFilter, QuestionListItem } from '@/types';
import { AssignTopicModal } from './AssignTopicModal';
import { CreateExamFromQuestionsModal } from '@/features/exams/CreateExamFromQuestionsModal';

const BLOOM_OPTIONS = [
  { value: '', label: 'Tất cả Bloom' },
  { value: 'remember', label: 'Nhớ' },
  { value: 'understand', label: 'Hiểu' },
  { value: 'apply', label: 'Vận dụng' },
  { value: 'analyze', label: 'Vận dụng cao' },
];

const DIFFICULTY_OPTIONS = [
  { value: '', label: 'Tất cả độ khó' },
  { value: 'easy', label: 'Dễ' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'hard', label: 'Khó' },
];

const TYPE_OPTIONS = [
  { value: '', label: 'Tất cả loại' },
  { value: 'mcq', label: 'Trắc nghiệm' },
  { value: 'essay', label: 'Tự luận' },
  { value: 'coding', label: 'Lập trình' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'draft', label: 'Nháp' },
  { value: 'review', label: 'Đang duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'archived', label: 'Lưu trữ' },
];

interface QuestionTableProps {
  filter: QuestionFilter;
  onFilterChange: (updates: Partial<QuestionFilter>) => void;
  onSelectQuestion: (id: string) => void;
}

export function QuestionTable({ filter, onFilterChange, onSelectQuestion }: QuestionTableProps) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState(filter.search ?? '');
  const [assignTopicOpen, setAssignTopicOpen] = useState(false);
  const [createExamOpen, setCreateExamOpen] = useState(false);

  const { data: domainsData } = useQuery({
    queryKey: ['domains'],
    queryFn: () => domainApi.list(),
  });

  const domains = domainsData?.data ?? [];
  const selectedDomain = domains.find((d: any) => d.id === filter.chapter_id);
  const selectedDomainTopics = selectedDomain?.topics ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['questions', filter],
    queryFn: () => questionApi.list(filter),
    placeholderData: (prev) => prev,
  });

  const bulkMutation = useMutation({
    mutationFn: ({ action, payload = {} }: { action: string; payload?: object }) =>
      questionApi.bulkAction(Array.from(selected), action, payload),
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ['questions'] });
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

  const items = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const page = filter.page ?? 1;
  const totalPages = data?.data?.total_pages ?? 0;

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onFilterChange({ search: searchInput || undefined });
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

  const handleBulkArchive = () => {
    bulkMutation.mutate({ action: 'archive' });
  };

  const handleBulkApprove = () => {
    bulkMutation.mutate({ action: 'approve' });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 border-b border-gray-100 bg-gray-50 flex-wrap">
        <div className="w-56">
          <Input
            placeholder="Tìm kiếm..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            leftIcon={<Search className="h-3.5 w-3.5" />}
          />
        </div>

        {/* Lĩnh vực Filter */}
        <select
          value={filter.chapter_id ?? ''}
          onChange={(e) =>
            onFilterChange({
              chapter_id: e.target.value || undefined,
              topic_id: undefined,
            })
          }
          className="rounded-lg border border-gray-300 bg-white px-2.5 py-[7px] text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Tất cả lĩnh vực</option>
          {domains.map((d: any) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        {/* Chủ đề Filter (Cascading) */}
        {selectedDomainTopics.length > 0 && (
          <select
            value={filter.topic_id ?? ''}
            onChange={(e) => onFilterChange({ topic_id: e.target.value || undefined })}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-[7px] text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Tất cả chủ đề</option>
            {selectedDomainTopics.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}

        {[
          { key: 'type', options: TYPE_OPTIONS },
          { key: 'bloom_level', options: BLOOM_OPTIONS },
          { key: 'difficulty', options: DIFFICULTY_OPTIONS },
          { key: 'status', options: STATUS_OPTIONS },
        ].map(({ key, options }) => (
          <select
            key={key}
            value={(filter as any)[key] ?? ''}
            onChange={(e) => onFilterChange({ [key]: e.target.value || undefined } as any)}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-[7px] text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ))}
        <span className="ml-auto text-xs text-gray-400">
          {total > 0 && `${total} câu hỏi`}
        </span>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-primary-50 border-b border-primary-100">
          <span className="text-sm font-medium text-primary-700">
            Đã chọn {selected.size} câu
          </span>
          <div className="flex gap-1.5 ml-auto">
            <Button
              size="sm"
              variant="ghost"
              className="text-purple-700 bg-purple-100/70 hover:bg-purple-200/70 font-semibold"
              leftIcon={<CheckSquare className="h-3.5 w-3.5" />}
              onClick={() => setCreateExamOpen(true)}
            >
              Tạo đề thi ({selected.size} câu)
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-primary-700 hover:bg-primary-100/50"
              leftIcon={<Tag className="h-3.5 w-3.5" />}
              onClick={() => setAssignTopicOpen(true)}
            >
              Gắn chủ đề
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-green-700 hover:bg-green-50"
              leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
              loading={bulkMutation.isPending}
              onClick={handleBulkApprove}
            >
              Duyệt
            </Button>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<Archive className="h-3.5 w-3.5" />}
              loading={bulkMutation.isPending}
              onClick={handleBulkArchive}
            >
              Lưu trữ
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              leftIcon={<Trash2 className="h-3.5 w-3.5" />}
              loading={bulkMutation.isPending}
              onClick={handleBulkDelete}
            >
              Xóa
            </Button>
          </div>
        </div>
      )}

      {/* Assign Topic Modal */}
      <AssignTopicModal
        questionIds={Array.from(selected)}
        open={assignTopicOpen}
        onOpenChange={setAssignTopicOpen}
        onSuccess={() => setSelected(new Set())}
      />

      {/* Table */}
      {isLoading ? (
        <PageSpinner />
      ) : items.length === 0 ? (
        <EmptyState
          title="Chưa có câu hỏi nào"
          description="Tạo câu hỏi đầu tiên hoặc import từ Excel/PDF/Word"
        />
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b border-gray-200">
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.size === items.length && items.length > 0}
                    onChange={toggleAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">
                  Mã
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">
                  Loại
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Nội dung
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">
                  Bloom
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">
                  Độ khó
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
                  Trạng thái
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">
                  Ngày tạo
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {items.map((q) => (
                <tr
                  key={q.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onSelectQuestion(q.id)}
                >
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(q.id)}
                      onChange={() => toggleSelect(q.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-xs text-gray-500">{q.item_id}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <QuestionTypeBadge type={q.type} />
                  </td>
                  <td className="px-3 py-2.5 max-w-sm">
                    <div>
                      <p className="truncate text-gray-900 font-medium">{q.stem_preview}</p>
                      {(q.chapter_name || q.topic_name) && (
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-400">
                          {q.chapter_name && (
                            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded">
                              {q.chapter_name}
                            </span>
                          )}
                          {q.topic_name && (
                            <span className="bg-primary-50 text-primary-700 px-1.5 py-0.2 rounded font-medium">
                              • {q.topic_name}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {q.bloom_level && <BloomBadge level={q.bloom_level} />}
                  </td>
                  <td className="px-3 py-2.5">
                    {q.expected_difficulty && <DifficultyBadge level={q.expected_difficulty} />}
                  </td>
                  <td className="px-3 py-2.5">
                    <QuestionStatusBadge status={q.status} />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-400">
                    {format(new Date(q.created_at), 'dd/MM/yy', { locale: vi })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 bg-white shrink-0">
          <span className="text-xs text-gray-500">
            Trang {page} / {totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onFilterChange({ page: page - 1 })}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onFilterChange({ page: page + 1 })}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

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
    </div>
  );
}
