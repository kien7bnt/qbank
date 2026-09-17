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
  const [generationMode, setGenerationMode] = useState<'fixed' | 'random_student'>('fixed');
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [aiGrading, setAiGrading] = useState(true);
  const [isRandomFixed, setIsRandomFixed] = useState(false);
  const [randomFixedCount, setRandomFixedCount] = useState(30);
  const [questionsPerInstance, setQuestionsPerInstance] = useState(30);
  const [antiCollision, setAntiCollision] = useState(true);
  const [maxOverlap, setMaxOverlap] = useState<number>(50);

  // Filter state for questions
  const [search, setSearch] = useState('');
  const [domainId, setDomainId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [bloomLevel, setBloomLevel] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  const effectiveCount = generationMode === 'random_student'
    ? Math.max(1, Math.min(questionsPerInstance, selectedQuestionIds.length || 1))
    : isRandomFixed
    ? Math.max(1, Math.min(randomFixedCount, selectedQuestionIds.length || 1))
    : selectedQuestionIds.length;

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
        ai_grading: aiGrading,
        random_count: generationMode === 'fixed' && isRandomFixed ? effectiveCount : undefined,
        is_random_per_student: generationMode === 'random_student',
        questions_per_instance: generationMode === 'random_student' ? effectiveCount : undefined,
        anti_collision_enabled: antiCollision,
        max_question_overlap: maxOverlap / 100.0,
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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
          <div className="text-xs text-gray-500 font-medium text-center sm:text-left">
            Đã chọn: <strong className="text-primary-700 text-sm">{selectedQuestionIds.length}</strong> câu hỏi
            {(generationMode === 'random_student' || isRandomFixed) && (
              <span className="ml-2 text-purple-700 font-bold bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                {generationMode === 'random_student' ? `(Mỗi HS: ${effectiveCount} câu)` : `(Lấy ngẫu nhiên: ${effectiveCount} câu)`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button variant="secondary" onClick={onClose} size="sm" className="flex-1 sm:flex-none">
              Hủy
            </Button>
            <Button
              loading={createMutation.isPending}
              disabled={selectedQuestionIds.length === 0}
              size="sm"
              className="flex-1 sm:flex-none"
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
              Tạo đề thi ({effectiveCount} câu)
            </Button>
          </div>
        </div>
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

            <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-medium text-gray-700 pt-5">
              <div className="flex items-center gap-4">
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

              {/* AI Grading Switch */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-700">
                  Chấm bài tự động bằng AI:
                </span>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={aiGrading}
                    onChange={(e) => setAiGrading(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    aiGrading ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {aiGrading ? 'BẬT' : 'TẮT'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Phương thức tạo đề: Cố định vs Ngẫu nhiên theo từng học sinh */}
        <div className="space-y-3 p-3.5 rounded-xl border border-purple-200 bg-purple-50/40">
          <label className="block text-xs font-bold uppercase tracking-wider text-purple-950">
            Phương thức tạo đề thi
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                generationMode === 'fixed'
                  ? 'bg-white border-purple-600 shadow-sm ring-1 ring-purple-600'
                  : 'bg-white/60 border-gray-200 hover:bg-white'
              }`}
            >
              <input
                type="radio"
                name="bankGenMode"
                checked={generationMode === 'fixed'}
                onChange={() => setGenerationMode('fixed')}
                className="mt-0.5 text-purple-600 focus:ring-purple-500"
              />
              <div>
                <div className="text-xs font-bold text-gray-900">Một đề cố định</div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Tất cả học sinh làm chung một tập câu hỏi (hoặc bốc cố định 1 lần).
                </p>
              </div>
            </label>

            <label
              className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                generationMode === 'random_student'
                  ? 'bg-white border-purple-600 shadow-sm ring-1 ring-purple-600'
                  : 'bg-white/60 border-gray-200 hover:bg-white'
              }`}
            >
              <input
                type="radio"
                name="bankGenMode"
                checked={generationMode === 'random_student'}
                onChange={() => setGenerationMode('random_student')}
                className="mt-0.5 text-purple-600 focus:ring-purple-500"
              />
              <div>
                <div className="text-xs font-bold text-purple-900 flex items-center gap-1">
                  <Shuffle className="h-3.5 w-3.5 text-purple-600" />
                  Sinh đề ngẫu nhiên theo từng HS
                </div>
                <p className="text-[11px] text-purple-700 mt-0.5">
                  Mỗi học sinh nhận một tổ hợp câu hỏi riêng biệt từ Question Pool.
                </p>
              </div>
            </label>
          </div>

          {/* Configuration when Random Per Student is selected */}
          {generationMode === 'random_student' ? (
            <div className="pt-2.5 border-t border-purple-200/80 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-2.5 bg-white rounded-lg border border-purple-200 text-xs">
                  <span className="text-gray-500">Tập câu hỏi nguồn (Question Pool):</span>
                  <p className="text-sm font-bold text-purple-900 mt-0.5">
                    {selectedQuestionIds.length} câu hỏi đã chọn
                  </p>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-purple-200 text-xs">
                  <label className="block text-gray-700 font-semibold mb-1">
                    Số câu hỏi cho mỗi đề học sinh:
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={selectedQuestionIds.length || 1000}
                    value={questionsPerInstance}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const maxVal = selectedQuestionIds.length > 0 ? selectedQuestionIds.length : 1000;
                      setQuestionsPerInstance(val > 0 ? Math.min(maxVal, val) : 1);
                    }}
                    className="bg-white font-bold text-purple-900 border-purple-300 text-xs py-1"
                  />
                </div>
              </div>

              {/* Anti-collision and overlap config */}
              <div className="p-3 bg-white rounded-xl border border-purple-200 space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={antiCollision}
                    onChange={(e) => setAntiCollision(e.target.checked)}
                    className="rounded border-purple-300 text-purple-600 focus:ring-purple-500 h-4 w-4"
                  />
                  <span>Hạn chế trùng câu giữa các đề (Cơ chế chống trùng đề)</span>
                </label>

                {antiCollision && (
                  <div className="flex items-center gap-3 pl-6">
                    <span className="text-xs text-gray-600">Tỷ lệ trùng tối đa cho phép:</span>
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={10}
                        max={100}
                        value={maxOverlap}
                        onChange={(e) => setMaxOverlap(Math.min(100, Math.max(10, Number(e.target.value))))}
                        className="w-20 text-center font-bold text-purple-900 text-xs py-1"
                      />
                      <span className="text-xs font-semibold text-gray-700">%</span>
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-gray-500 pl-6 italic">
                  Nếu 2 học sinh có trên {maxOverlap}% số câu giống nhau, hệ thống sẽ tự động bốc lại tổ hợp khác (tối đa 100 lần thử).
                </p>
              </div>

              {/* Preview Box */}
              <div className="p-2.5 bg-purple-100/60 rounded-lg text-center text-xs text-purple-900 font-medium">
                {selectedQuestionIds.length} câu nguồn &rarr; {effectiveCount} câu / học sinh &rarr; Tự động sinh đề thi riêng biệt cho từng em khi vào thi
              </div>
            </div>
          ) : (
            /* Configuration when Fixed Mode is selected */
            <div className="pt-2 border-t border-purple-100 space-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRandomFixed}
                  onChange={(e) => {
                    setIsRandomFixed(e.target.checked);
                    if (e.target.checked && (!randomFixedCount || randomFixedCount > selectedQuestionIds.length)) {
                      setRandomFixedCount(Math.min(30, selectedQuestionIds.length || 30));
                    }
                  }}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                />
                <span className="flex items-center gap-1">
                  <Shuffle className="h-3.5 w-3.5 text-gray-500" />
                  Bốc ngẫu nhiên một số lượng câu hỏi cho đề này
                </span>
              </label>

              {isRandomFixed && (
                <div className="flex items-center gap-2 pl-6">
                  <span className="text-xs text-gray-600">Lấy ngẫu nhiên:</span>
                  <Input
                    type="number"
                    min={1}
                    max={selectedQuestionIds.length || 1000}
                    value={randomFixedCount}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      const maxVal = selectedQuestionIds.length > 0 ? selectedQuestionIds.length : 1000;
                      setRandomFixedCount(val > 0 ? Math.min(maxVal, val) : 1);
                    }}
                    className="w-24 font-bold text-xs py-1"
                  />
                  <span className="text-xs text-gray-600">
                    / {selectedQuestionIds.length} câu (cả lớp làm chung bộ này)
                  </span>
                </div>
              )}
            </div>
          )}
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
