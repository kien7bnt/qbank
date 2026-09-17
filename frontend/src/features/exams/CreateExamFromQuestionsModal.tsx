import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FileCheck, Clock, Layers, Users, CheckCircle2, Shuffle, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { examApi, classApi, getErrorMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

interface CreateExamFromQuestionsModalProps {
  open: boolean;
  onClose: () => void;
  selectedQuestionIds: string[];
  onSuccess?: () => void;
}

export function CreateExamFromQuestionsModal({
  open,
  onClose,
  selectedQuestionIds,
  onSuccess,
}: CreateExamFromQuestionsModalProps) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [classId, setClassId] = useState('');
  const [generationMode, setGenerationMode] = useState<'fixed' | 'random_student'>('fixed');
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [pointsPerQuestion, setPointsPerQuestion] = useState<number | undefined>(undefined);
  const [isRandomFixed, setIsRandomFixed] = useState(false);
  const [randomFixedCount, setRandomFixedCount] = useState<number>(() => Math.min(30, selectedQuestionIds.length || 1));
  const [questionsPerInstance, setQuestionsPerInstance] = useState<number>(() => Math.min(30, selectedQuestionIds.length || 1));
  const [antiCollision, setAntiCollision] = useState(true);
  const [maxOverlap, setMaxOverlap] = useState<number>(50);

  // Fetch classes
  const { data: classesData } = useQuery({
    queryKey: ['classes-select'],
    queryFn: () => classApi.list({ page: 1, page_size: 100 }),
    enabled: open,
  });

  const classes = classesData?.data?.items ?? [];

  const effectiveCount = generationMode === 'random_student'
    ? Math.max(1, Math.min(questionsPerInstance, selectedQuestionIds.length))
    : isRandomFixed
    ? Math.max(1, Math.min(randomFixedCount, selectedQuestionIds.length))
    : selectedQuestionIds.length;

  const defaultPoints = effectiveCount > 0
    ? Number((10.0 / effectiveCount).toFixed(2))
    : 1.0;

  const createMutation = useMutation({
    mutationFn: () =>
      examApi.createFromQuestions({
        name: name.trim(),
        question_ids: selectedQuestionIds,
        class_id: classId || undefined,
        duration_minutes: Number(durationMinutes) || 45,
        points_per_question: pointsPerQuestion ?? defaultPoints,
        shuffle_questions: shuffleQuestions,
        shuffle_options: shuffleOptions,
        random_count: generationMode === 'fixed' && isRandomFixed ? effectiveCount : undefined,
        is_random_per_student: generationMode === 'random_student',
        questions_per_instance: generationMode === 'random_student' ? effectiveCount : undefined,
        anti_collision_enabled: antiCollision,
        max_question_overlap: maxOverlap / 100.0,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['exams'] });
      toast.success('Đã tạo đề thi thành công!');
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
            <CheckSquare className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-gray-900">Tạo Đề Thi Từ Ngân Hàng Câu Hỏi</div>
            <p className="text-xs text-gray-500 font-normal">
              Đã chọn <strong>{selectedQuestionIds.length}</strong> câu hỏi từ ngân hàng
            </p>
          </div>
        </div>
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            loading={createMutation.isPending}
            onClick={() => {
              if (!name.trim()) {
                toast.error('Vui lòng nhập tên đề thi');
                return;
              }
              createMutation.mutate();
            }}
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            Tạo đề thi ({effectiveCount} câu)
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Tên đề thi <span className="text-red-500">*</span>
          </label>
          <Input
            placeholder="Ví dụ: Đề kiểm tra 1 tiết - Đại số & Giải tích"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Thời gian làm bài (Phút)
            </label>
            <Input
              type="number"
              min={5}
              max={300}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Lớp học áp dụng (Tùy chọn)
            </label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
            >
              <option value="">— Chung cho tất cả lớp —</option>
              {classes.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Phương thức tạo đề: Cố định vs Ngẫu nhiên theo từng học sinh */}
        <div className="space-y-3 p-4 rounded-xl border border-purple-200 bg-purple-50/40">
          <label className="block text-xs font-bold uppercase tracking-wider text-purple-950">
            Phương thức tạo đề thi
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                generationMode === 'fixed'
                  ? 'bg-white border-purple-600 shadow-sm ring-1 ring-purple-600'
                  : 'bg-white/60 border-gray-200 hover:bg-white'
              }`}
            >
              <input
                type="radio"
                name="genMode"
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
              className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                generationMode === 'random_student'
                  ? 'bg-white border-purple-600 shadow-sm ring-1 ring-purple-600'
                  : 'bg-white/60 border-gray-200 hover:bg-white'
              }`}
            >
              <input
                type="radio"
                name="genMode"
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
            <div className="pt-3 border-t border-purple-200/80 space-y-3.5">
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
                    max={selectedQuestionIds.length}
                    value={questionsPerInstance}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setQuestionsPerInstance(val > 0 ? Math.min(selectedQuestionIds.length, val) : 1);
                    }}
                    className="bg-white font-bold text-purple-900 border-purple-300"
                  />
                </div>
              </div>

              {/* Anti-collision and overlap config */}
              <div className="p-3 bg-white rounded-xl border border-purple-200 space-y-2.5">
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
                        className="w-20 text-center font-bold text-purple-900"
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
                      setRandomFixedCount(Math.min(30, selectedQuestionIds.length));
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
                    max={selectedQuestionIds.length}
                    value={randomFixedCount}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setRandomFixedCount(val > 0 ? Math.min(selectedQuestionIds.length, val) : 1);
                    }}
                    className="w-24 font-bold"
                  />
                  <span className="text-xs text-gray-600">
                    / {selectedQuestionIds.length} câu (cả lớp làm chung bộ này)
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Điểm mỗi câu hỏi
            </label>
            <Input
              type="number"
              step="0.1"
              min="0.1"
              value={pointsPerQuestion ?? defaultPoints}
              onChange={(e) => setPointsPerQuestion(Number(e.target.value))}
            />
            <span className="text-[11px] text-gray-400">
              Tổng điểm: {((pointsPerQuestion ?? defaultPoints) * effectiveCount).toFixed(1)} điểm
            </span>
          </div>

          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
              />
              <span className="flex items-center gap-1">
                <Shuffle className="h-3.5 w-3.5 text-gray-400" /> Tự động xáo trộn thứ tự câu hỏi
              </span>
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={shuffleOptions}
                onChange={(e) => setShuffleOptions(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
              />
              <span className="flex items-center gap-1">
                <Shuffle className="h-3.5 w-3.5 text-gray-400" /> Tự động xáo trộn thứ tự phương án A, B, C, D
              </span>
            </label>
          </div>
        </div>
      </div>
    </Modal>
  );
}
