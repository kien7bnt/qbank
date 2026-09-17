import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FileCheck, Clock, Layers, Users, CheckCircle2, Shuffle, CheckSquare, Plus, Minus } from 'lucide-react';
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
  const [durationMinutes, setDurationMinutes] = useState<number | string>(45);
  const [classId, setClassId] = useState('');
  const [generationMode, setGenerationMode] = useState<'fixed' | 'random_student'>('fixed');
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [pointsPerQuestion, setPointsPerQuestion] = useState<number | string | undefined>(undefined);
  const [isRandomFixed, setIsRandomFixed] = useState(false);
  const [randomFixedCount, setRandomFixedCount] = useState<number | string>(() => Math.min(10, selectedQuestionIds.length || 10));
  const [questionsPerInstance, setQuestionsPerInstance] = useState<number | string>(() => Math.min(10, selectedQuestionIds.length || 10));
  const [antiCollision, setAntiCollision] = useState(true);
  const [maxOverlap, setMaxOverlap] = useState<number | string>(50);
  const [aiGrading, setAiGrading] = useState(false);

  // Fetch classes
  const { data: classesData } = useQuery({
    queryKey: ['classes-select'],
    queryFn: () => classApi.list({ page: 1, page_size: 100 }),
    enabled: open,
  });

  const classes = classesData?.data?.items ?? [];

  const numQuestionsPerInstance = Number(questionsPerInstance) || 1;
  const numRandomFixedCount = Number(randomFixedCount) || 1;
  const effectiveCount = generationMode === 'random_student'
    ? Math.max(1, Math.min(numQuestionsPerInstance, selectedQuestionIds.length || 1))
    : isRandomFixed
    ? Math.max(1, Math.min(numRandomFixedCount, selectedQuestionIds.length || 1))
    : selectedQuestionIds.length;

  const numPointsPerQ = pointsPerQuestion !== undefined && pointsPerQuestion !== '' ? Number(pointsPerQuestion) : undefined;
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
        points_per_question: numPointsPerQ ?? defaultPoints,
        shuffle_questions: shuffleQuestions,
        shuffle_options: shuffleOptions,
        ai_grading: aiGrading,
        random_count: generationMode === 'fixed' && isRandomFixed ? effectiveCount : undefined,
        is_random_per_student: generationMode === 'random_student',
        questions_per_instance: generationMode === 'random_student' ? effectiveCount : undefined,
        anti_collision_enabled: antiCollision,
        max_question_overlap: (Number(maxOverlap) || 50) / 100.0,
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
            {generationMode === 'random_student'
              ? `Tạo đề thi (${effectiveCount} câu / học sinh)`
              : `Tạo đề thi (${effectiveCount} câu)`}
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
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const cur = Number(durationMinutes) || 45;
                  setDurationMinutes(Math.max(5, cur - 5));
                }}
                className="w-8 h-8 rounded-lg border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold flex items-center justify-center transition-colors cursor-pointer active:scale-95"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={durationMinutes}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setDurationMinutes(e.target.value.replace(/[^0-9]/g, ''))}
                onBlur={() => {
                  const val = Number(durationMinutes);
                  if (!durationMinutes || isNaN(val) || val < 5) setDurationMinutes(45);
                  else if (val > 360) setDurationMinutes(360);
                }}
                className="w-20 text-center font-bold text-sm text-gray-900 border border-gray-300 rounded-lg py-1.5 bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const cur = Number(durationMinutes) || 45;
                  setDurationMinutes(Math.min(360, cur + 5));
                }}
                className="w-8 h-8 rounded-lg border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold flex items-center justify-center transition-colors cursor-pointer active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <span className="text-xs text-gray-500">phút</span>
            </div>
            <div className="flex items-center gap-1 pt-1.5 flex-wrap">
              <span className="text-[11px] text-gray-400">Gợi ý:</span>
              {[15, 30, 45, 60, 90, 120].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDurationMinutes(preset)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                    Number(durationMinutes) === preset
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white hover:bg-primary-50 text-gray-700 border-gray-200'
                  }`}
                >
                  {preset}'
                </button>
              ))}
            </div>
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
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const cur = Number(questionsPerInstance) || 1;
                        setQuestionsPerInstance(Math.max(1, cur - 1));
                      }}
                      className="w-8 h-8 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={questionsPerInstance}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setQuestionsPerInstance(e.target.value.replace(/[^0-9]/g, ''))}
                      onBlur={() => {
                        const val = Number(questionsPerInstance);
                        const maxVal = selectedQuestionIds.length > 0 ? selectedQuestionIds.length : 1000;
                        if (!questionsPerInstance || isNaN(val) || val < 1) {
                          setQuestionsPerInstance(Math.min(10, maxVal));
                        } else if (val > maxVal) {
                          setQuestionsPerInstance(maxVal);
                        }
                      }}
                      className="w-20 text-center font-black text-sm text-purple-900 border border-purple-300 rounded-lg py-1.5 bg-white shadow-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const cur = Number(questionsPerInstance) || 0;
                        const maxVal = selectedQuestionIds.length > 0 ? selectedQuestionIds.length : 1000;
                        setQuestionsPerInstance(Math.min(maxVal, cur + 1));
                      }}
                      className="w-8 h-8 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs text-gray-500 font-medium">câu / HS</span>
                  </div>

                  {/* Quick presets */}
                  <div className="flex flex-wrap items-center gap-1 pt-1.5">
                    <span className="text-[11px] text-gray-400">Chọn nhanh:</span>
                    {[5, 10, 15, 20, 25, 30, 40].filter(n => selectedQuestionIds.length === 0 || n <= selectedQuestionIds.length).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setQuestionsPerInstance(preset)}
                        className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                          Number(questionsPerInstance) === preset
                            ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                            : 'bg-white hover:bg-purple-50 text-purple-700 border-purple-200'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                    {selectedQuestionIds.length > 0 && (
                      <button
                        key="all"
                        type="button"
                        onClick={() => setQuestionsPerInstance(selectedQuestionIds.length)}
                        className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                          Number(questionsPerInstance) === selectedQuestionIds.length
                            ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                            : 'bg-white hover:bg-purple-50 text-purple-800 border-purple-300'
                        }`}
                      >
                        Tất cả ({selectedQuestionIds.length})
                      </button>
                    )}
                  </div>
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
                  <div className="flex flex-wrap items-center gap-3 pl-6">
                    <span className="text-xs text-gray-600">Tỷ lệ trùng tối đa:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const cur = Number(maxOverlap) || 50;
                          setMaxOverlap(Math.max(10, cur - 5));
                        }}
                        className="w-7 h-7 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={maxOverlap}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setMaxOverlap(e.target.value.replace(/[^0-9]/g, ''))}
                        onBlur={() => {
                          const val = Number(maxOverlap);
                          if (!maxOverlap || isNaN(val) || val < 10) setMaxOverlap(10);
                          else if (val > 100) setMaxOverlap(100);
                        }}
                        className="w-14 text-center font-bold text-xs text-purple-900 border border-purple-300 rounded-lg py-1 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const cur = Number(maxOverlap) || 50;
                          setMaxOverlap(Math.min(100, cur + 5));
                        }}
                        className="w-7 h-7 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold flex items-center justify-center transition-all cursor-pointer active:scale-95"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <span className="text-xs font-semibold text-gray-700">%</span>
                    </div>

                    <div className="flex items-center gap-1">
                      {[30, 40, 50, 60, 70, 80].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setMaxOverlap(pct)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
                            Number(maxOverlap) === pct
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-gray-500 pl-6 italic">
                  Nếu 2 học sinh có trên {maxOverlap}% số câu giống nhau, hệ thống sẽ tự động bốc lại tổ hợp khác (tối đa 100 lần thử).
                </p>
              </div>

              {/* Preview Box */}
              <div className="p-2.5 bg-purple-100/60 rounded-lg text-center text-xs text-purple-900 font-medium">
                Nguồn: {selectedQuestionIds.length} câu đã chọn &rarr; Mỗi đề HS: <strong>{effectiveCount} câu ngẫu nhiên</strong> &rarr; Tự động sinh đề riêng biệt cho từng em khi vào thi
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
                    if (e.target.checked && (!randomFixedCount || Number(randomFixedCount) > selectedQuestionIds.length)) {
                      setRandomFixedCount(Math.min(10, selectedQuestionIds.length));
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
                <div className="flex flex-wrap items-center gap-2 pl-6">
                  <span className="text-xs text-gray-600">Lấy ngẫu nhiên:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const cur = Number(randomFixedCount) || 1;
                        setRandomFixedCount(Math.max(1, cur - 1));
                      }}
                      className="w-7 h-7 rounded-lg border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold flex items-center justify-center cursor-pointer active:scale-95"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={randomFixedCount}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setRandomFixedCount(e.target.value.replace(/[^0-9]/g, ''))}
                      onBlur={() => {
                        const val = Number(randomFixedCount);
                        const maxVal = selectedQuestionIds.length > 0 ? selectedQuestionIds.length : 1000;
                        if (!randomFixedCount || isNaN(val) || val < 1) setRandomFixedCount(Math.min(10, maxVal));
                        else if (val > maxVal) setRandomFixedCount(maxVal);
                      }}
                      className="w-16 text-center font-bold text-xs text-gray-900 border border-gray-300 rounded-lg py-1 bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const cur = Number(randomFixedCount) || 0;
                        const maxVal = selectedQuestionIds.length > 0 ? selectedQuestionIds.length : 1000;
                        setRandomFixedCount(Math.min(maxVal, cur + 1));
                      }}
                      className="w-7 h-7 rounded-lg border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold flex items-center justify-center cursor-pointer active:scale-95"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
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
            <input
              type="text"
              inputMode="decimal"
              value={pointsPerQuestion !== undefined ? pointsPerQuestion : defaultPoints}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setPointsPerQuestion(e.target.value)}
              onBlur={() => {
                const val = Number(pointsPerQuestion);
                if (isNaN(val) || val <= 0) setPointsPerQuestion(defaultPoints);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
            <span className="text-[11px] text-gray-400">
              Tổng điểm: {((numPointsPerQ ?? defaultPoints) * effectiveCount).toFixed(1)} điểm
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

            {/* AI Grading Switch */}
            <div 
              onClick={() => setAiGrading(prev => !prev)}
              className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors select-none"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-700">
                  Chấm bài tự động bằng AI:
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    aiGrading ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {aiGrading ? 'ĐANG BẬT' : 'ĐANG TẮT'}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={aiGrading}
                onClick={(e) => {
                  e.stopPropagation();
                  setAiGrading(prev => !prev);
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  aiGrading ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    aiGrading ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
