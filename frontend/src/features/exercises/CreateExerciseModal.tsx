import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  FolderTree,
  PlusCircle,
  CheckCircle2,
  Send,
  Plus,
  Trash2,
  Bold,
  Italic,
  Code,
  List,
  Sparkles,
  HelpCircle,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { exerciseApi, questionApi, domainApi, getErrorMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { FolderQuestionTreePicker } from './FolderQuestionTreePicker';
import type { QuestionType, BloomLevel, DifficultyLevel } from '@/types';

interface CreateExerciseModalProps {
  open: boolean;
  onClose: () => void;
  selectedQuestionIds?: string[];
  onSuccess?: () => void;
  onAssignToClass?: (exerciseId: string, exerciseName: string) => void;
}

interface OptionForm {
  label: string;
  text: string;
  is_correct: boolean;
  distractor_reason: string;
}

const INITIAL_OPTIONS: OptionForm[] = [
  { label: 'A', text: '', is_correct: true, distractor_reason: '' },
  { label: 'B', text: '', is_correct: false, distractor_reason: '' },
  { label: 'C', text: '', is_correct: false, distractor_reason: '' },
  { label: 'D', text: '', is_correct: false, distractor_reason: '' },
];

export function CreateExerciseModal({
  open,
  onClose,
  selectedQuestionIds = [],
  onSuccess,
  onAssignToClass,
}: CreateExerciseModalProps) {
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<'picker' | 'create'>('picker');
  const [name, setName] = useState('');
  const [questionIds, setQuestionIds] = useState<string[]>(selectedQuestionIds);

  // Tab b state: New Question Form
  const [newType, setNewType] = useState<QuestionType>('mcq');
  const [newStem, setNewStem] = useState('');
  const [newRationale, setNewRationale] = useState('');
  const [newBloom, setNewBloom] = useState<BloomLevel | ''>('understand');
  const [newDifficulty, setNewDifficulty] = useState<DifficultyLevel | ''>('medium');
  const [newOptions, setNewOptions] = useState<OptionForm[]>(INITIAL_OPTIONS);
  const [newSampleAnswer, setNewSampleAnswer] = useState('');
  const [newChapterId, setNewChapterId] = useState('');
  const [newTopicId, setNewTopicId] = useState('');

  useEffect(() => {
    if (open) {
      setQuestionIds(selectedQuestionIds);
      setName('');
      setActiveTab('picker');
    }
  }, [open, selectedQuestionIds]);

  // Fetch domains & topics for folder selection in Tab b
  const { data: domainsData } = useQuery({
    queryKey: ['curriculum-domains-tree'],
    queryFn: () => domainApi.list(),
    enabled: open,
  });
  const domains = domainsData?.data || [];

  const selectedDomain = domains.find((d: any) => d.id === newChapterId);
  const availableTopics = selectedDomain?.topics || [];

  // 1. Create Exercise Mutation
  const createExerciseMutation = useMutation({
    mutationFn: async (shouldAssignImmediately: boolean) => {
      const res = await exerciseApi.create({
        name: name.trim(),
        question_ids: questionIds,
        duration_minutes: 45,
        practice_mode: 'free',
        allow_retry: true,
        show_hints: true,
      });
      return { exercise: res.data, shouldAssignImmediately };
    },
    onSuccess: ({ exercise, shouldAssignImmediately }) => {
      qc.invalidateQueries({ queryKey: ['exercises'] });
      qc.invalidateQueries({ queryKey: ['questions'] });
      toast.success('✨ Đã lưu bài tập vào Kho Bài Tập thành công!');
      onSuccess?.();
      onClose();

      if (shouldAssignImmediately && onAssignToClass) {
        onAssignToClass(exercise.id, exercise.name);
      }
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // 2. Create Question Mutation (Tab b)
  const createQuestionMutation = useMutation({
    mutationFn: async () => {
      if (!newStem.trim()) {
        throw new Error('Vui lòng nhập nội dung câu hỏi');
      }
      if (!newChapterId) {
        throw new Error('Vui lòng chọn thư mục trong Ngân hàng câu hỏi để lưu câu hỏi');
      }

      const payload: any = {
        type: newType,
        stem: newStem.trim(),
        rationale: newRationale.trim() || undefined,
        bloom_level: newBloom || undefined,
        expected_difficulty: newDifficulty || undefined,
        chapter_id: newChapterId,
        topic_id: newTopicId || undefined,
        in_exercise_bank: true,
      };

      if (newType === 'mcq') {
        const correctCount = newOptions.filter((o) => o.is_correct).length;
        if (correctCount === 0) {
          throw new Error('Vui lòng đánh dấu ít nhất một đáp án đúng cho câu hỏi trắc nghiệm');
        }
        payload.options = newOptions.map((o, idx) => ({
          label: o.label,
          text: o.text.trim() || `Lựa chọn ${o.label}`,
          is_correct: o.is_correct,
          distractor_reason: o.distractor_reason || undefined,
          order_index: idx,
        }));
      } else if (newType === 'essay') {
        payload.essay_data = {
          sample_answer: newSampleAnswer.trim() || undefined,
          max_points: 10,
        };
      }

      return questionApi.create(payload);
    },
    onSuccess: (res) => {
      const createdQ = res.data;
      qc.invalidateQueries({ queryKey: ['questions'] });
      qc.invalidateQueries({ queryKey: ['curriculum-domains-tree'] });

      // Automatically add this new question to current exercise question list
      setQuestionIds((prev) => [...prev, createdQ.id]);

      toast.success('✨ Đã lưu câu hỏi vào Ngân hàng và thêm vào bài tập!');

      // Reset form
      setNewStem('');
      setNewRationale('');
      setNewSampleAnswer('');
      setNewOptions(INITIAL_OPTIONS);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleToggleQuestion = (id: string) => {
    setQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleInsertMarkup = (prefix: string, suffix: string = '') => {
    setNewStem((prev) => `${prev} ${prefix}nội dung${suffix} `);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-gray-900 text-base">Tạo Bài Tập Mới</div>
            <p className="text-xs text-gray-500 font-normal">
              Đã chọn <strong className="text-emerald-700 font-bold">{questionIds.length}</strong> câu hỏi cho bài tập
            </p>
          </div>
        </div>
      }
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-gray-500">
            Tổng cộng: <strong className="text-emerald-700 font-bold">{questionIds.length}</strong> câu hỏi được chọn
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              Hủy
            </Button>
            <Button
              variant="secondary"
              loading={createExerciseMutation.isPending}
              onClick={() => {
                if (!name.trim()) {
                  toast.error('Vui lòng nhập tên bài tập');
                  return;
                }
                if (questionIds.length === 0) {
                  toast.error('Vui lòng chọn hoặc soạn ít nhất 1 câu hỏi cho bài tập');
                  return;
                }
                createExerciseMutation.mutate(false);
              }}
              className="border-emerald-200 text-emerald-800 hover:bg-emerald-50"
            >
              Lưu Bài Tập
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              loading={createExerciseMutation.isPending}
              leftIcon={<Send className="h-4 w-4" />}
              onClick={() => {
                if (!name.trim()) {
                  toast.error('Vui lòng nhập tên bài tập');
                  return;
                }
                if (questionIds.length === 0) {
                  toast.error('Vui lòng chọn hoặc soạn ít nhất 1 câu hỏi cho bài tập');
                  return;
                }
                createExerciseMutation.mutate(true);
              }}
            >
              Lưu & Giao Cho Lớp
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 py-1">
        {/* A. Tên bài tập */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
            A. Tên bài tập <span className="text-rose-500">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Bài tập tuần 3 - Phương trình lượng giác và đồ thị hàm số..."
            className="text-sm font-medium"
            autoFocus
          />
        </div>

        {/* B. Hai Tab chọn câu hỏi */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              B. Nội dung câu hỏi trong bài tập *
            </label>

            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('picker')}
                className={clsx(
                  'px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5',
                  activeTab === 'picker'
                    ? 'bg-white text-emerald-800 shadow-xs font-semibold'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <FolderTree className="h-3.5 w-3.5 text-emerald-600" />
                Chọn từ kho câu hỏi ({questionIds.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className={clsx(
                  'px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5',
                  activeTab === 'create'
                    ? 'bg-white text-emerald-800 shadow-xs font-semibold'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <PlusCircle className="h-3.5 w-3.5 text-emerald-600" />
                Soạn câu hỏi mới
              </button>
            </div>
          </div>

          {/* TAB A: Sổ ra câu hỏi dạng cây Windows Explorer */}
          {activeTab === 'picker' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                Click vào từng thư mục để mở rộng và tích chọn các câu hỏi muốn đưa vào bài tập:
              </p>
              <FolderQuestionTreePicker
                selectedIds={questionIds}
                onToggleSelect={handleToggleQuestion}
                onSelectAll={(ids) => setQuestionIds(ids)}
                onClearAll={() => setQuestionIds([])}
                maxHeightClass="max-h-[380px]"
              />
            </div>
          )}

          {/* TAB B: Màn hình RichText soạn câu hỏi mới lưu vào Ngân hàng */}
          {activeTab === 'create' && (
            <div className="space-y-3 bg-slate-50/60 border border-slate-200 rounded-xl p-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-800 text-sm flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  Soạn nội dung câu hỏi mới
                </span>
                <span className="text-[11px] text-gray-500">
                  Câu hỏi sẽ được lưu vào Ngân hàng câu hỏi và tự động gán vào bài tập này
                </span>
              </div>

              {/* Loại câu hỏi */}
              <div className="flex items-center gap-4">
                <span className="font-medium text-gray-700">Loại câu hỏi:</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="newType"
                    checked={newType === 'mcq'}
                    onChange={() => setNewType('mcq')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Trắc nghiệm (4 lựa chọn)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="newType"
                    checked={newType === 'essay'}
                    onChange={() => setNewType('essay')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Tự luận</span>
                </label>
              </div>

              {/* RichText Toolbar for Stem */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-gray-700">
                    Nội dung câu hỏi (Stem) <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-md p-0.5">
                    <button
                      type="button"
                      onClick={() => handleInsertMarkup('**', '**')}
                      className="p-1 hover:bg-gray-100 rounded text-gray-600"
                      title="In đậm"
                    >
                      <Bold className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertMarkup('*', '*')}
                      className="p-1 hover:bg-gray-100 rounded text-gray-600"
                      title="In nghiêng"
                    >
                      <Italic className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertMarkup('$', '$')}
                      className="px-1 py-0.5 hover:bg-gray-100 rounded font-mono text-[10px] text-gray-700"
                      title="Công thức toán LaTeX: $x^2 + y^2 = 1$"
                    >
                      $f(x)$
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertMarkup('`', '`')}
                      className="p-1 hover:bg-gray-100 rounded text-gray-600"
                      title="Mã nguồn (Inline code)"
                    >
                      <Code className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertMarkup('- ')}
                      className="p-1 hover:bg-gray-100 rounded text-gray-600"
                      title="Danh sách gạch đầu dòng"
                    >
                      <List className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <Textarea
                  value={newStem}
                  onChange={(e) => setNewStem(e.target.value)}
                  placeholder="Nhập nội dung đề bài (hỗ trợ công thức toán $...$, in đậm, in nghiêng...)"
                  rows={3}
                  className="text-xs bg-white"
                />
              </div>

              {/* MCQ Options */}
              {newType === 'mcq' && (
                <div className="space-y-2 pt-1">
                  <label className="font-medium text-gray-700 block">
                    Các phương án trả lời (Tích chọn nút tròn để đánh dấu đáp án đúng):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {newOptions.map((opt, idx) => (
                      <div
                        key={opt.label}
                        className={clsx(
                          'flex items-center gap-2 p-2 rounded-lg border bg-white transition-all',
                          opt.is_correct ? 'border-emerald-400 bg-emerald-50/40 ring-1 ring-emerald-400' : 'border-gray-200'
                        )}
                      >
                        <input
                          type="radio"
                          name="correctOption"
                          checked={opt.is_correct}
                          onChange={() =>
                            setNewOptions((prev) =>
                              prev.map((o, i) => ({ ...o, is_correct: i === idx }))
                            )
                          }
                          className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span className="font-bold text-gray-700 text-xs w-4">{opt.label}.</span>
                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewOptions((prev) =>
                              prev.map((o, i) => (i === idx ? { ...o, text: val } : o))
                            );
                          }}
                          placeholder={`Nội dung lựa chọn ${opt.label}...`}
                          className="flex-1 text-xs border-0 focus:ring-0 p-0 text-gray-800 placeholder:text-gray-400"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Essay Sample Answer */}
              {newType === 'essay' && (
                <div className="space-y-1">
                  <label className="font-medium text-gray-700 block">Lời giải mẫu / Hướng dẫn chấm (Tùy chọn):</label>
                  <Textarea
                    value={newSampleAnswer}
                    onChange={(e) => setNewSampleAnswer(e.target.value)}
                    placeholder="Ghi chú các bước giải hoặc dàn ý chấm điểm..."
                    rows={2}
                    className="text-xs bg-white"
                  />
                </div>
              )}

              {/* Thư mục lưu vào Ngân hàng câu hỏi (BẮT BUỘC theo yêu cầu) */}
              <div className="border-t border-slate-200 pt-2.5 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-medium text-gray-700 block mb-1">
                      Lưu vào Thư mục / Môn học trong Ngân hàng <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={newChapterId}
                      onChange={(e) => {
                        setNewChapterId(e.target.value);
                        setNewTopicId('');
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 text-gray-800"
                    >
                      <option value="">-- Chọn thư mục trong ngân hàng --</option>
                      {domains.map((d: any) => (
                        <option key={d.id} value={d.id}>
                          📁 {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-medium text-gray-700 block mb-1">Chủ đề chi tiết (Tùy chọn):</label>
                    <select
                      value={newTopicId}
                      onChange={(e) => setNewTopicId(e.target.value)}
                      disabled={!newChapterId || availableTopics.length === 0}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 text-gray-800 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <option value="">-- Chọn chủ đề trong thư mục --</option>
                      {availableTopics.map((t: any) => (
                        <option key={t.id} value={t.id}>
                          📂 {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Metadata: Bloom & Difficulty */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="font-medium text-gray-700 block mb-1">Mức độ nhận thức (Bloom):</label>
                    <select
                      value={newBloom}
                      onChange={(e) => setNewBloom(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-800"
                    >
                      <option value="remember">Nhận biết</option>
                      <option value="understand">Thông hiểu</option>
                      <option value="apply">Vận dụng</option>
                      <option value="analyze">Vận dụng cao</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-medium text-gray-700 block mb-1">Độ khó dự kiến:</label>
                    <select
                      value={newDifficulty}
                      onChange={(e) => setNewDifficulty(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-800"
                    >
                      <option value="easy">Dễ</option>
                      <option value="medium">Trung bình</option>
                      <option value="hard">Khó</option>
                    </select>
                  </div>
                </div>

                {/* Action button to save question into Bank & add to exercise */}
                <div className="pt-2 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    loading={createQuestionMutation.isPending}
                    onClick={() => createQuestionMutation.mutate()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                    leftIcon={<Plus className="h-3.5 w-3.5" />}
                  >
                    Lưu Vào Ngân Hàng & Thêm Vào Bài Tập
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
