import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList,
  Clock,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Shuffle,
  Plus,
  Minus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  assignmentApi,
  examApi,
  exerciseApi,
  classApi,
  sessionApi,
  getErrorMessage,
} from '@/services/api';

interface CreateAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialClassId?: string;
  initialSessionId?: string;
  initialType?: 'exam' | 'homework';
  initialExamId?: string;
  initialExamName?: string;
  initialQuestionIds?: string[];
}

export function CreateAssignmentModal({
  open,
  onOpenChange,
  initialClassId,
  initialSessionId,
  initialType,
  initialExamId,
  initialExamName,
  initialQuestionIds,
}: CreateAssignmentModalProps) {
  const qc = useQueryClient();
  const [assignmentType, setAssignmentType] = useState<'exam' | 'homework'>(initialType || 'exam');
  const [name, setName] = useState('');
  const [examId, setExamId] = useState(initialExamId || '');
  const [classId, setClassId] = useState(initialClassId || '');
  const [sessionId, setSessionId] = useState(initialSessionId || '');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number | string>(45);
  const [passScore, setPassScore] = useState<number | string>(5.0);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [aiGrading, setAiGrading] = useState(false);

  // Fetch Exams (Kho Kiểm Tra)
  const { data: examsData } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examApi.list(),
    enabled: open,
  });
  const examList = (examsData?.data || []).filter((e: any) => e.type !== 'exercise');

  // Fetch Exercises (Kho Bài Tập)
  const { data: exercisesData } = useQuery({
    queryKey: ['exercises'],
    queryFn: () => exerciseApi.list(),
    enabled: open,
  });
  const exerciseList = exercisesData?.data || [];

  // Fetch Classes
  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classApi.list(),
    enabled: open,
  });

  // Fetch Sessions for selected Class
  const { data: sessionsData } = useQuery({
    queryKey: ['class-sessions', classId],
    queryFn: () => sessionApi.list(classId),
    enabled: !!classId && open,
  });
  const sessions = sessionsData?.data ?? [];

  useEffect(() => {
    if (open) {
      if (initialClassId) setClassId(initialClassId);
      if (initialSessionId) setSessionId(initialSessionId);
      if (initialType) setAssignmentType(initialType);
      if (initialExamId) {
        setExamId(initialExamId);
      }
      if (initialExamName && !name) {
        setName(initialType === 'homework' ? initialExamName : `Kiểm tra: ${initialExamName}`);
      }
    }
  }, [open, initialClassId, initialSessionId, initialType, initialExamId, initialExamName]);

  // Find selected exercise metadata if any
  const selectedExercise = exerciseList.find((ex: any) => ex.id === examId);

  const createMutation = useMutation({
    mutationFn: async () => {
      const finalExamId = examId;

      if (!finalExamId) {
        throw new Error(
          assignmentType === 'homework'
            ? 'Vui lòng chọn một bộ bài tập từ Kho bài tập'
            : 'Vui lòng chọn đề thi từ Kho Kiểm Tra'
        );
      }

      const isHomework = assignmentType === 'homework';

      return assignmentApi.create({
        name: name.trim(),
        assignment_type: assignmentType,
        max_attempts: isHomework ? 999 : 1,
        exam_id: finalExamId,
        class_id: classId,
        session_id: sessionId || undefined,
        // For homework: NO start_time requirement, only end_time
        start_time: !isHomework && startTime ? new Date(startTime).toISOString() : undefined,
        end_time: endTime ? new Date(endTime).toISOString() : undefined,
        // For homework: no duration constraint (default 1440 mins to satisfy schema)
        duration_minutes: isHomework ? 1440 : Number(durationMinutes) || 45,
        // For homework: no pass score required (0.0)
        pass_score: isHomework ? 0.0 : Number(passScore),
        // For homework: no shuffling
        shuffle_questions: isHomework ? false : shuffleQuestions,
        shuffle_options: isHomework ? false : shuffleOptions,
        show_results: 'immediately',
        show_correct_answer: isHomework,
        show_explanation: isHomework,
        ai_grading: aiGrading,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      qc.invalidateQueries({ queryKey: ['class-sessions'] });
      qc.invalidateQueries({ queryKey: ['exercises'] });
      toast.success(
        assignmentType === 'homework'
          ? '✨ Đã giao bài tập cho lớp thành công!'
          : '✨ Đã giao bài kiểm tra cho lớp thành công!'
      );
      handleReset();
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleReset = () => {
    setAssignmentType(initialType || 'exam');
    setName('');
    setExamId('');
    setClassId(initialClassId || '');
    setSessionId(initialSessionId || '');
    setStartTime('');
    setEndTime('');
    setDurationMinutes(45);
    setPassScore(5.0);
    setAiGrading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên bài');
      return;
    }
    if (!classId) {
      toast.error('Vui lòng chọn lớp học');
      return;
    }
    if (assignmentType === 'exam' && !examId) {
      toast.error('Vui lòng chọn đề thi từ Kho Kiểm Tra');
      return;
    }
    if (assignmentType === 'homework' && !examId) {
      toast.error('Vui lòng chọn bộ bài tập từ Kho Bài Tập');
      return;
    }

    createMutation.mutate();
  };

  const isHomeworkMode = assignmentType === 'homework';

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-2">
          {isHomeworkMode ? (
            <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
              <BookOpen className="h-5 w-5" />
            </div>
          ) : (
            <div className="p-1.5 bg-primary-100 text-primary-700 rounded-lg">
              <ClipboardList className="h-5 w-5" />
            </div>
          )}
          <div>
            <span className="font-bold text-gray-900">
              {isHomeworkMode ? 'Giao Bài Tập Cho Lớp' : 'Tạo Đề Thi Cho Lớp'}
            </span>
            <p className="text-xs text-gray-500 font-normal">
              {isHomeworkMode
                ? 'Luyện tập tự do củng cố kiến thức • Không giới hạn lượt làm • Không tính điểm đạt/trượt'
                : 'Tạo đề thi chính thức • Có tính giờ đếm lui • Đánh giá điểm chuẩn'}
            </p>
          </div>
        </div>
      }
      size="lg"
      footer={
        <div className="flex items-center gap-2 justify-end w-full">
          <Button variant="secondary" onClick={() => onOpenChange(false)} size="sm" className="flex-1 sm:flex-none">
            Hủy
          </Button>
          <Button
            onClick={handleSubmit}
            loading={createMutation.isPending}
            size="sm"
            className={`flex-1 sm:flex-none ${isHomeworkMode ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
          >
            {isHomeworkMode ? 'Giao bài tập cho lớp' : 'Tạo đề thi cho lớp'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Hình thức giao bài: Ẩn nếu đã chỉ định initialType === 'homework' */}
        {initialType !== 'homework' && (
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              1. Hình thức giao bài *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setAssignmentType('exam');
                  if (name.startsWith('Bài tập:')) {
                    setName(name.replace(/^Bài tập:\s*/, 'Kiểm tra: '));
                  }
                }}
                className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col gap-1 cursor-pointer ${
                  assignmentType === 'exam'
                    ? 'border-primary-600 bg-primary-50/50 shadow-xs ring-1 ring-primary-600/20'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-primary-600" />
                    Bài kiểm tra
                  </span>
                  {assignmentType === 'exam' && (
                    <span className="h-2 w-2 rounded-full bg-primary-600" />
                  )}
                </div>
                <p className="text-xs text-gray-500 leading-snug">
                  Thời gian đếm lui, có điểm đạt (pass score), chốt điểm đánh giá năng lực.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAssignmentType('homework');
                  if (name.startsWith('Kiểm tra:')) {
                    setName(name.replace(/^Kiểm tra:\s*/, 'Bài tập: '));
                  }
                }}
                className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col gap-1 cursor-pointer ${
                  assignmentType === 'homework'
                    ? 'border-emerald-600 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-600/20'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-emerald-600" />
                    Bài tập (Tự luyện)
                  </span>
                  {assignmentType === 'homework' && (
                    <span className="h-2 w-2 rounded-full bg-emerald-600" />
                  )}
                </div>
                <p className="text-xs text-gray-500 leading-snug">
                  Làm nhiều lần để củng cố kiến thức, <strong>không tính giờ làm bài & không có điểm đạt</strong>.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Tên bài */}
        <Input
          label={isHomeworkMode ? 'Tên bài tập *' : 'Tên bài kiểm tra *'}
          placeholder={
            isHomeworkMode
              ? 'Ví dụ: Bài tập ôn luyện tuần 3 - Hàm số'
              : 'Ví dụ: Kiểm tra 45 phút - Đại số 12'
          }
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        {/* CHỌN NỘI DUNG */}
        {assignmentType === 'exam' ? (
          // CHO BÀI KIỂM TRA: Chọn đề thi từ Kho Kiểm Tra
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chọn đề thi từ Kho Kiểm Tra *
            </label>
            <select
              value={examId}
              onChange={(e) => {
                const selectedId = e.target.value;
                setExamId(selectedId);
                const ex = examList.find((x: any) => x.id === selectedId);
                if (ex) {
                  if (ex.duration_minutes) setDurationMinutes(ex.duration_minutes);
                  if (!name) setName(`Kiểm tra: ${ex.name}`);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            >
              <option value="">— Chọn đề thi có sẵn —</option>
              {examList.map((ex: any) => {
                const poolCount = ex.pool_question_count || ex.sections?.reduce((acc: number, s: any) => acc + (s.questions?.length || s.question_count || 0), 0) || 0;
                const countText = ex.is_random_per_student && ex.questions_per_instance
                  ? `${ex.questions_per_instance} câu ngẫu nhiên (từ nguồn ${poolCount || 34} câu)`
                  : `${ex.total_questions || ex.question_count || 0} câu`;
                return (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} ({ex.duration_minutes} phút, {countText})
                  </option>
                );
              })}
            </select>

            {(() => {
              const selectedEx = examList.find((x: any) => x.id === examId);
              if (selectedEx?.is_random_per_student) {
                const qCount = selectedEx.questions_per_instance || selectedEx.total_questions || 10;
                const poolCount = selectedEx.pool_question_count || selectedEx.sections?.reduce((acc: number, s: any) => acc + (s.questions?.length || 0), 0) || 0;
                return (
                  <div className="mt-2.5 p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-start gap-2.5 text-xs text-purple-900">
                    <Shuffle className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-purple-950">
                        Đề thi ngẫu nhiên theo từng học sinh ({qCount} câu / đề)
                      </p>
                      <p className="text-[11px] text-purple-700 mt-0.5">
                        Mỗi học sinh khi vào thi sẽ nhận <strong>{qCount} câu hỏi</strong> được lấy ngẫu nhiên từ tập nguồn <strong>{poolCount} câu</strong>, kèm theo cơ chế chống trùng đề và xáo trộn độc lập.
                      </p>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        ) : (
          // CHO BÀI TẬP: Chọn bộ bài tập từ Kho Bài Tập
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chọn bộ bài tập từ Kho bài tập *
            </label>
            {initialExamId && selectedExercise ? (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">
                      {selectedExercise.name}
                    </p>
                    <p className="text-xs text-emerald-700">
                      {selectedExercise.total_questions || selectedExercise.question_count || 0} câu hỏi trong bộ bài tập
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setExamId('')}
                  className="text-xs text-emerald-700 hover:text-emerald-900 underline font-medium"
                >
                  Đổi bài khác
                </button>
              </div>
            ) : (
              <select
                value={examId}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  setExamId(selectedId);
                  const found = exerciseList.find((x: any) => x.id === selectedId);
                  if (found && !name) {
                    setName(`Bài tập: ${found.name}`);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              >
                <option value="">— Chọn bộ bài tập từ Kho bài tập —</option>
                {exerciseList.map((ex: any) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} ({ex.total_questions || ex.question_count || 0} câu hỏi)
                  </option>
                ))}
              </select>
            )}

            {exerciseList.length === 0 && !initialExamId && (
              <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Chưa có bộ bài tập nào. Vui lòng tạo bài tập trong Kho Bài Tập trước.
              </p>
            )}
          </div>
        )}

        {/* Lớp học & Buổi học */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Giao cho lớp *
            </label>
            <select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setSessionId('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            >
              <option value="">— Chọn lớp học —</option>
              {classes?.data?.items?.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gán vào buổi học trong lớp (Tùy chọn)
            </label>
            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              disabled={!classId}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">— Không gán vào buổi cụ thể —</option>
              {sessions.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.title || s.name} {s.session_date ? `(${s.session_date})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* THỜI GIAN VÀ CẤU HÌNH: PHÂN BIỆT RÕ RÀNG BÀI TẬP VÀ BÀI KIỂM TRA */}
        {isHomeworkMode ? (
          // CHO BÀI TẬP: CHỈ CẦN THỜI GIAN KẾT THÚC, KHÔNG CÓ THỜI GIAN LÀM BÀI, KHÔNG CÓ XÁO TRỘN ĐỀ, KHÔNG CÓ ĐIỂM ĐẠT
          <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-1.5">
            <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
              Thời hạn nộp bài (Thời gian kết thúc)
            </label>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-600 shrink-0" />
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <p className="text-[11px] text-gray-500 leading-snug">
              Học sinh có thể vào làm và nộp bài bất cứ lúc nào cho đến thời hạn này. Để trống nếu không giới hạn hạn nộp.
            </p>
          </div>
        ) : (
          // CHO BÀI KIỂM TRA: ĐẦY ĐỦ THỜI GIAN BẮT ĐẦU, KẾT THÚC, THỜI GIAN LÀM BÀI, ĐIỂM ĐẠT VÀ XÁO TRỘN ĐỀ
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-gray-50/80 rounded-xl border border-gray-200">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Thời gian mở bài (Bắt đầu)
                </label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-[11px] text-gray-400 mt-1">Học sinh chỉ có thể làm bài sau mốc này.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Thời hạn nộp bài (Kết thúc)
                </label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-[11px] text-gray-400 mt-1">Hệ thống sẽ khóa bài khi quá thời hạn này.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Thời gian làm bài (Phút) *
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
                  Điểm đạt (Pass score) *
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const cur = Number(passScore) || 5;
                      setPassScore(Math.max(0, Math.round((cur - 0.5) * 10) / 10));
                    }}
                    className="w-8 h-8 rounded-lg border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={passScore}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setPassScore(e.target.value)}
                    onBlur={() => {
                      const val = Number(passScore);
                      if (isNaN(val) || val < 0) setPassScore(5);
                      else if (val > 10) setPassScore(10);
                    }}
                    className="w-20 text-center font-bold text-sm text-gray-900 border border-gray-300 rounded-lg py-1.5 bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const cur = Number(passScore) || 5;
                      setPassScore(Math.min(10, Math.round((cur + 0.5) * 10) / 10));
                    }}
                    className="w-8 h-8 rounded-lg border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-xs text-gray-500">/ 10 điểm</span>
                </div>
                <div className="flex items-center gap-1 pt-1.5 flex-wrap">
                  {[5, 6, 6.5, 7, 8, 8.5].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPassScore(preset)}
                      className={`px-1.5 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                        Number(passScore) === preset
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white hover:bg-primary-50 text-gray-700 border-gray-200'
                      }`}
                    >
                      {preset}đ
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Anti-cheat & Randomization */}
            <div className="pt-2 border-t border-gray-100 space-y-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Tùy chọn xáo trộn đề
              </p>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shuffleQuestions}
                    onChange={(e) => setShuffleQuestions(e.target.checked)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                  />
                  <span>Xáo trộn thứ tự câu hỏi</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shuffleOptions}
                    onChange={(e) => setShuffleOptions(e.target.checked)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                  />
                  <span>Xáo trộn thứ tự đáp án (A, B, C, D)</span>
                </label>
              </div>
            </div>
          </>
        )}

        {/* AI Grading Mode Toggle */}
        <div
          onClick={() => setAiGrading((prev) => !prev)}
          className={`p-3.5 rounded-xl border flex items-center justify-between mt-3 cursor-pointer transition-colors select-none ${
            aiGrading ? 'bg-violet-50/70 border-violet-300' : 'bg-gray-50/80 border-gray-200 hover:bg-gray-100/70'
          }`}
        >
          <div className="pr-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                Chế độ chấm bài tự động bằng AI
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                  aiGrading ? 'bg-violet-100 text-violet-700' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {aiGrading ? 'ĐANG BẬT' : 'ĐANG TẮT'}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-1 leading-snug">
              {aiGrading
                ? 'AI sẽ tự động đọc bài tự luận, đối chiếu Rubric & gợi ý đáp án để chấm điểm ngay sau khi nộp.'
                : 'Tắt chấm bằng AI: Bài làm tự luận sẽ được chuyển cho giáo viên xem và cho điểm thủ công.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={aiGrading}
            onClick={(e) => {
              e.stopPropagation();
              setAiGrading((prev) => !prev);
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              aiGrading ? 'bg-violet-600' : 'bg-gray-300'
            }`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                aiGrading ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </form>
    </Modal>
  );
}
