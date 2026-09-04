import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Minus, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { questionApi, curriculumApi, getErrorMessage } from '@/services/api';
import type { QuestionType } from '@/types';

interface CreateQuestionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultChapterId?: string;
  defaultTopicId?: string;
}

interface OptionForm {
  label: string;
  text: string;
  is_correct: boolean;
  distractor_reason: string;
}

const INITIAL_OPTIONS: OptionForm[] = [
  { label: 'A', text: '', is_correct: false, distractor_reason: '' },
  { label: 'B', text: '', is_correct: false, distractor_reason: '' },
  { label: 'C', text: '', is_correct: false, distractor_reason: '' },
  { label: 'D', text: '', is_correct: false, distractor_reason: '' },
];

const BLOOM_OPTIONS = [
  { value: '', label: '— Chọn Bloom —' },
  { value: 'remember', label: 'Nhớ' },
  { value: 'understand', label: 'Hiểu' },
  { value: 'apply', label: 'Vận dụng' },
  { value: 'analyze', label: 'Vận dụng cao' },
];

const DIFFICULTY_OPTIONS = [
  { value: '', label: '— Chọn độ khó —' },
  { value: 'easy', label: 'Dễ' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'hard', label: 'Khó' },
];

export function CreateQuestionModal({
  open,
  onOpenChange,
  defaultChapterId,
  defaultTopicId,
}: CreateQuestionModalProps) {
  const qc = useQueryClient();
  const [step, setStep] = useState<'type' | 'form'>('type');
  const [type, setType] = useState<QuestionType>('mcq');
  const [showMetadata, setShowMetadata] = useState(false);

  // Form state
  const [stem, setStem] = useState('');
  const [rationale, setRationale] = useState('');
  const [options, setOptions] = useState<OptionForm[]>(INITIAL_OPTIONS);
  const [bloom, setBloom] = useState('');
  const [difficulty, setDifficulty] = useState('');
  // Essay
  const [sampleAnswer, setSampleAnswer] = useState('');
  const [maxPoints, setMaxPoints] = useState('10');

  const mutation = useMutation({
    mutationFn: () => {
      const payload: any = {
        type,
        stem,
        rationale: rationale || undefined,
        bloom_level: bloom || undefined,
        expected_difficulty: difficulty || undefined,
        chapter_id: defaultChapterId || undefined,
        topic_id: defaultTopicId || undefined,
      };

      if (type === 'mcq') {
        payload.options = options.map((o, i) => ({
          label: o.label,
          text: o.text,
          is_correct: o.is_correct,
          distractor_reason: o.distractor_reason || undefined,
          order_index: i,
        }));
      }

      if (type === 'essay') {
        payload.essay_data = {
          sample_answer: sampleAnswer || undefined,
          max_points: Number(maxPoints) || 10,
        };
      }

      return questionApi.create(payload);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['questions'] });
      toast.success(`Đã tạo câu hỏi ${res.data.item_id}`);
      handleReset();
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleReset = () => {
    setStep('type');
    setStem('');
    setRationale('');
    setOptions(INITIAL_OPTIONS);
    setBloom('');
    setDifficulty('');
    setSampleAnswer('');
    setMaxPoints('10');
    setShowMetadata(false);
  };

  const updateOption = (idx: number, field: keyof OptionForm, value: string | boolean) => {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, [field]: value } : o)));
  };

  const setCorrect = (idx: number) => {
    setOptions((prev) => prev.map((o, i) => ({ ...o, is_correct: i === idx })));
  };

  const isValid =
    stem.trim().length > 0 &&
    (type !== 'mcq' || (options.some((o) => o.is_correct) && options.filter((o) => o.text).length >= 2));

  return (
    <Modal
      open={open}
      onOpenChange={(v) => { if (!v) handleReset(); onOpenChange(v); }}
      title={step === 'type' ? 'Chọn loại câu hỏi' : 'Tạo câu hỏi mới'}
      size="lg"
      footer={
        step === 'form' ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => setStep('type')}>
              ← Quay lại
            </Button>
            <Button variant="secondary" onClick={() => { handleReset(); onOpenChange(false); }}>
              Hủy
            </Button>
            <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!isValid}>
              Lưu câu hỏi
            </Button>
          </>
        ) : undefined
      }
    >
      {step === 'type' ? (
        /* Step 1: Type selection */
        <div className="grid grid-cols-3 gap-3">
          {[
            { type: 'mcq' as QuestionType, label: 'Trắc nghiệm', desc: 'Nhiều lựa chọn', icon: '☑️' },
            { type: 'essay' as QuestionType, label: 'Tự luận', desc: 'Câu trả lời tự do', icon: '✍️' },
            { type: 'coding' as QuestionType, label: 'Lập trình', desc: 'Bài tập code', icon: '💻' },
          ].map((t) => (
            <button
              key={t.type}
              onClick={() => { setType(t.type); setStep('form'); }}
              className="flex flex-col items-center rounded-xl border-2 border-gray-200 p-5 text-center hover:border-primary-400 hover:bg-primary-50 transition-all"
            >
              <span className="text-3xl mb-2">{t.icon}</span>
              <span className="font-semibold text-gray-900">{t.label}</span>
              <span className="text-xs text-gray-500 mt-0.5">{t.desc}</span>
            </button>
          ))}
        </div>
      ) : (
        /* Step 2: Form */
        <div className="space-y-4">
          <Textarea
            label="Nội dung câu hỏi"
            placeholder="Nhập nội dung câu hỏi..."
            value={stem}
            onChange={(e) => setStem(e.target.value)}
            rows={3}
            required
          />

          {/* MCQ Options */}
          {type === 'mcq' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Đáp án <span className="text-gray-400 font-normal">(click ✓ để chọn đáp án đúng)</span>
              </label>
              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCorrect(idx)}
                      className={`shrink-0 h-7 w-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                        opt.is_correct
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-gray-300 text-gray-300 hover:border-green-400'
                      }`}
                    >
                      {opt.is_correct ? <CheckCircle className="h-4 w-4" /> : <span className="text-xs font-bold text-gray-400">{opt.label}</span>}
                    </button>
                    <input
                      type="text"
                      placeholder={`Đáp án ${opt.label}`}
                      value={opt.text}
                      onChange={(e) => updateOption(idx, 'text', e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Essay */}
          {type === 'essay' && (
            <div className="space-y-3">
              <Textarea
                label="Đáp án mẫu"
                placeholder="Đáp án mẫu hoặc hướng dẫn chấm..."
                value={sampleAnswer}
                onChange={(e) => setSampleAnswer(e.target.value)}
                rows={3}
              />
              <Input
                label="Điểm tối đa"
                type="number"
                value={maxPoints}
                onChange={(e) => setMaxPoints(e.target.value)}
                min={1}
                max={100}
              />
            </div>
          )}

          {/* Coding placeholder */}
          {type === 'coding' && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
              Câu hỏi lập trình đang được hỗ trợ đầy đủ trong Phase 3.
            </div>
          )}

          {/* Rationale */}
          <Textarea
            label="Giải thích (tùy chọn)"
            placeholder="Giải thích tại sao đây là đáp án đúng..."
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={2}
          />

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Bloom</label>
              <select
                value={bloom}
                onChange={(e) => setBloom(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {BLOOM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Độ khó</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {DIFFICULTY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
