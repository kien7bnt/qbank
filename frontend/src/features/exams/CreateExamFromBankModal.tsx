import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FilePlus2,
  Search,
  CheckCircle2,
  Filter,
  CheckSquare,
  Square,
  Layers,
  Shuffle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { questionApi, domainApi, classApi, examApi, getErrorMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { BloomBadge, DifficultyBadge } from '@/components/ui/Badge';
import { PageSpinner } from '@/components/ui/Spinner';
import type { BloomLevel, DifficultyLevel } from '@/types';

interface CreateExamFromBankModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateExamFromBankModal({
  open,
  onClose,
  onSuccess,
}: CreateExamFromBankModalProps) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Form state
  const [examName, setExamName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [classId, setClassId] = useState('');
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);

  // Filter state for questions
  const [search, setSearch] = useState('');
  const [domainId, setDomainId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [bloomLevel, setBloomLevel] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  // Fetch Domains
  const { data: domainsData } = useQuery({
    queryKey: ['domains'],
    queryFn: () => domainApi.list(),
    enabled: open,
  });

  // Fetch Classes
  const { data: classesData } = useQuery({
    queryKey: ['classes-select'],
    queryFn: () => classApi.list({ page: 1, page_size: 100 }),
    enabled: open,
  });

  // Fetch Questions
  const { data: questionsData, isLoading: isLoadingQuestions } = useQuery({
    queryKey: ['questions-bank-select', search, domainId, topicId, bloomLevel, difficulty],
    queryFn: () =>
      questionApi.list({
        page: 1,
        page_size: 100,
        search: search || undefined,
        chapter_id: domainId || undefined,
        topic_id: topicId || undefined,
        bloom_level: (bloomLevel as BloomLevel) || undefined,
        difficulty: (difficulty as DifficultyLevel) || undefined,
      }),
    enabled: open,
  });

  const domains = domainsData?.data ?? [];
  const selectedDomain = domains.find((d: any) => d.id === domainId);
  const topics = selectedDomain?.topics ?? [];
  const classes = classesData?.data?.items ?? [];
  const questions = questionsData?.data?.items ?? [];

  const handleToggleQuestion = (id: string) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllVisible = () => {
    const visibleIds = questions.map((q) => q.id);
    const allSelected = visibleIds.every((id) => selectedQuestionIds.includes(id));
    if (allSelected) {
      setSelectedQuestionIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedQuestionIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const createMutation = useMutation({
    mutationFn: () =>
      examApi.createFromQuestions({
        name: examName.trim(),
        question_ids: selectedQuestionIds,
        class_id: classId || undefined,
        duration_minutes: Number(durationMinutes) || 45,
        shuffle_questions: shuffleQuestions,
        shuffle_options: shuffleOptions,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['exams'] });
      toast.success('Đã tạo đề thi từ ngân hàng câu hỏi thành công!');
      onSuccess?.();
      onClose();
      if (res?.data?.id) {
        navigate('/exams');
      }
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Modal
      open={open}
      onOpenChange={onClose}
      title={
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary-100 text-primary-700 rounded-lg">
            <FilePlus2 className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-gray-900">Tạo Đề Thi Trực Tiếp Từ Ngân Hàng Câu Hỏi</div>
            <p className="text-xs text-gray-500 font-normal">
              Tìm kiếm, lọc và chọn các câu hỏi phù hợp để tạo đề thi hoàn chỉnh
            </p>
          </div>
        </div>
      }
      size="xl"
      footer={
        <>
          <div className="mr-auto text-xs text-gray-500 font-medium">
            Đã chọn: <strong className="text-primary-700 text-sm">{selectedQuestionIds.length}</strong> câu hỏi
          </div>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            loading={createMutation.isPending}
            disabled={selectedQuestionIds.length === 0}
            onClick={() => {
              if (!examName.trim()) {
                toast.error('Vui lòng nhập tên đề thi');
                return;
              }
              if (selectedQuestionIds.length === 0) {
                toast.error('Vui lòng chọn ít nhất 1 câu hỏi');
                return;
              }
              createMutation.mutate();
            }}
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            Tạo đề thi ({selectedQuestionIds.length} câu)
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Exam basic info */}
        <div className="bg-gray-50/80 p-4 rounded-xl border border-gray-200 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Tên đề thi <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="Ví dụ: Đề kiểm tra giữa kỳ 1 - Toán 12"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Thời gian (Phút)
              </label>
              <Input
                type="number"
                min={5}
                max={300}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Lớp học áp dụng (Tùy chọn)
              </label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
              >
                <option value="">— Chung cho tất cả lớp —</option>
                {classes.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-4 text-xs font-medium text-gray-700 pt-5">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shuffleQuestions}
                  onChange={(e) => setShuffleQuestions(e.target.checked)}
                  className="rounded text-primary-600 focus:ring-primary-500 h-3.5 w-3.5"
                />
                Đảo thứ tự câu
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shuffleOptions}
                  onChange={(e) => setShuffleOptions(e.target.checked)}
                  className="rounded text-primary-600 focus:ring-primary-500 h-3.5 w-3.5"
                />
                Đảo phương án A,B,C,D
              </label>
            </div>
          </div>
        </div>

        {/* Filter bar for Question Selection */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-gray-500" />
              Chọn câu hỏi từ Ngân hàng ({questions.length} câu khả dụng)
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-primary-600 hover:text-primary-700"
              onClick={handleSelectAllVisible}
            >
              {questions.every((q) => selectedQuestionIds.includes(q.id))
                ? 'Bỏ chọn trang này'
                : 'Chọn tất cả trang này'}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="relative sm:col-span-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm nội dung..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            <select
              value={domainId}
              onChange={(e) => {
                setDomainId(e.target.value);
                setTopicId('');
              }}
              className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
            >
              <option value="">— Lĩnh vực —</option>
              {domains.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              value={bloomLevel}
              onChange={(e) => setBloomLevel(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
            >
              <option value="">— Mức Bloom —</option>
              <option value="remember">Nhận biết</option>
              <option value="understand">Thông hiểu</option>
              <option value="apply">Vận dụng</option>
              <option value="analyze">Vận dụng cao</option>
            </select>

            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
            >
              <option value="">— Độ khó —</option>
              <option value="easy">Dễ</option>
              <option value="medium">Trung bình</option>
              <option value="hard">Khó</option>
            </select>
          </div>
        </div>

        {/* Questions list */}
        <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-white">
          {isLoadingQuestions ? (
            <div className="p-8">
              <PageSpinner />
            </div>
          ) : questions.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">
              Không tìm thấy câu hỏi phù hợp với bộ lọc.
            </div>
          ) : (
            questions.map((q, idx) => {
              const isSelected = selectedQuestionIds.includes(q.id);
              return (
                <div
                  key={q.id}
                  onClick={() => handleToggleQuestion(q.id)}
                  className={`p-3 flex items-start gap-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-primary-50/50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="pt-0.5 shrink-0">
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4 text-primary-600" />
                    ) : (
                      <Square className="h-4 w-4 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs font-medium text-gray-900 line-clamp-2">
                      <span className="font-bold text-gray-500 mr-1.5">#{idx + 1}.</span>
                      {q.stem_preview}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                      <span className="font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded uppercase">
                        {q.type}
                      </span>
                      {q.bloom_level && <BloomBadge level={q.bloom_level} />}
                      {q.expected_difficulty && <DifficultyBadge level={q.expected_difficulty} />}
                      {q.topic_name && (
                        <span className="text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                          {q.topic_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
