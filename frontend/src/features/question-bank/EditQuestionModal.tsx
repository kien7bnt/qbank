import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit3, CheckCircle, Plus, Trash2, Award } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { questionApi, curriculumApi, rubricApi, getErrorMessage } from '@/services/api';
import type { Question } from '@/types';

interface EditQuestionModalProps {
  question: Question | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface OptionForm {
  id?: string;
  label: string;
  text: string;
  is_correct: boolean;
  distractor_reason?: string;
}

const BLOOM_OPTIONS = [
  { value: 'remember', label: 'Nhớ' },
  { value: 'understand', label: 'Hiểu' },
  { value: 'apply', label: 'Vận dụng' },
  { value: 'analyze', label: 'Vận dụng cao' },
  { value: 'evaluate', label: 'Đánh giá' },
  { value: 'create', label: 'Sáng tạo' },
];

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Dễ' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'hard', label: 'Khó' },
];

export function EditQuestionModal({ question, open, onOpenChange }: EditQuestionModalProps) {
  const qc = useQueryClient();

  const [stem, setStem] = useState('');
  const [rationale, setRationale] = useState('');
  const [bloom, setBloom] = useState('understand');
  const [difficulty, setDifficulty] = useState('medium');
  const [options, setOptions] = useState<OptionForm[]>([]);
  // Essay
  const [sampleAnswer, setSampleAnswer] = useState('');
  const [maxPoints, setMaxPoints] = useState('10');
  const [rubricId, setRubricId] = useState('');

  // Fetch rubrics
  const { data: rubricsList } = useQuery({
    queryKey: ['rubrics'],
    queryFn: async () => {
      const res = await rubricApi.list();
      return res.data;
    },
    enabled: open && question?.type === 'essay',
  });

  useEffect(() => {
    if (question) {
      setStem(question.stem || '');
      setRationale(question.rationale || '');
      setBloom(question.bloom_level || 'understand');
      setDifficulty(question.expected_difficulty || 'medium');
      setOptions(
        question.options?.map((o) => ({
          id: o.id,
          label: o.label,
          text: o.text,
          is_correct: o.is_correct,
          distractor_reason: o.distractor_reason || '',
        })) || []
      );
      if (question.essay_data) {
        setSampleAnswer(question.essay_data.sample_answer || '');
        setMaxPoints(String(question.essay_data.max_points || 10));
        setRubricId(question.essay_data.rubric_id || '');
      } else {
        setSampleAnswer('');
        setMaxPoints('10');
        setRubricId('');
      }
    }
  }, [question, open]);

  const updateMutation = useMutation({
    mutationFn: () => {
      const payload: any = {
        stem,
        rationale: rationale || undefined,
        bloom_level: bloom,
        expected_difficulty: difficulty,
      };

      if (question?.type === 'mcq') {
        payload.options = options.map((o, i) => ({
          label: o.label,
          text: o.text,
          is_correct: o.is_correct,
          distractor_reason: o.distractor_reason || undefined,
          order_index: i,
        }));
      }

      if (question?.type === 'essay') {
        payload.essay_data = {
          sample_answer: sampleAnswer || undefined,
          max_points: Number(maxPoints) || 10,
          rubric_id: rubricId || undefined,
        };
      }

      return questionApi.update(question!.id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions'] });
      qc.invalidateQueries({ queryKey: ['question', question?.id] });
      toast.success('Đã cập nhật câu hỏi thành công (tạo phiên bản mới)!');
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const updateOption = (idx: number, field: keyof OptionForm, value: string | boolean) => {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, [field]: value } : o)));
  };

  const setCorrect = (idx: number) => {
    setOptions((prev) => prev.map((o, i) => ({ ...o, is_correct: i === idx })));
  };

  if (!question) return null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-2">
          <Edit3 className="h-5 w-5 text-primary-600" />
          <span>Chỉnh sửa câu hỏi ({question.item_id})</span>
        </div>
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            loading={updateMutation.isPending}
            onClick={() => updateMutation.mutate()}
          >
            Lưu thay đổi (v{question.version + 1})
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Textarea
          label="Nội dung câu hỏi *"
          value={stem}
          onChange={(e) => setStem(e.target.value)}
          rows={3}
          required
        />

        {/* Options */}
        {question.type === 'mcq' && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Đáp án <span className="text-gray-400 font-normal">(nhấp ✓ để đánh dấu đáp án đúng)</span>
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
                        : 'border-gray-300 text-gray-400 hover:border-green-400'
                    }`}
                  >
                    {opt.is_correct ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <span className="text-xs font-bold">{opt.label}</span>
                    )}
                  </button>
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => updateOption(idx, 'text', e.target.value)}
                    placeholder={`Nội dung đáp án ${opt.label}`}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Essay Fields */}
        {question.type === 'essay' && (
          <div className="space-y-3 bg-amber-50/40 border border-amber-200/80 rounded-xl p-3.5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rubric chấm tự luận bằng AI
              </label>
              <select
                value={rubricId}
                onChange={(e) => {
                  const selId = e.target.value;
                  setRubricId(selId);
                  if (selId && rubricsList) {
                    const found = rubricsList.find((r) => r.id === selId);
                    if (found) {
                      const total = found.criteria.reduce((sum, c) => sum + (c.max_score || 0), 0);
                      if (total > 0) setMaxPoints(String(total));
                    }
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">— Tự động (Áp dụng Rubric mặc định) —</option>
                {rubricsList?.map((r) => {
                  const total = r.criteria?.reduce((sum, c) => sum + (c.max_score || 0), 0) || 10;
                  return (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.criteria?.length || 0} tiêu chí - {total}đ)
                    </option>
                  );
                })}
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                Bộ tiêu chí Rubric này sẽ được AI áp dụng riêng khi tự động chấm câu hỏi này.
              </p>
            </div>

            <Textarea
              label="Đáp án mẫu / Gợi ý trả lời"
              value={sampleAnswer}
              onChange={(e) => setSampleAnswer(e.target.value)}
              rows={3}
              placeholder="Đáp án mẫu hoặc hướng dẫn chấm chi tiết..."
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

        <Textarea
          label="Giải thích / Lời giải chi tiết"
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          rows={2}
          placeholder="Giải thích vì sao đây là đáp án chính xác..."
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mức độ Bloom
            </label>
            <select
              value={bloom}
              onChange={(e) => setBloom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              {BLOOM_OPTIONS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Độ khó
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              {DIFFICULTY_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </Modal>
  );
}
