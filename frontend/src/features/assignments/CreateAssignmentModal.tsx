import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, GraduationCap, FileText, CheckCircle2, Clock, BookOpen, Layers, CheckSquare, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { assignmentApi, examApi, exerciseApi, classApi, sessionApi, getErrorMessage } from '@/services/api';
import { QuestionPicker } from '@/features/question-bank/QuestionPicker';

interface CreateAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialClassId?: string;
  initialSessionId?: string;
  initialType?: 'exam' | 'homework';
  initialExamId?: string;
  initialQuestionIds?: string[];
}

export function CreateAssignmentModal({
  open,
  onOpenChange,
  initialClassId,
  initialSessionId,
  initialType,
  initialExamId,
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
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [passScore, setPassScore] = useState(5.0);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);

  // For Homework / Bài tập: picked questions
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>(initialQuestionIds || []);

  useEffect(() => {
    if (open) {
      if (initialClassId) setClassId(initialClassId);
      if (initialSessionId) setSessionId(initialSessionId);
      if (initialType) setAssignmentType(initialType);
      if (initialExamId) setExamId(initialExamId);
      if (initialQuestionIds && initialQuestionIds.length > 0) {
        setSelectedQuestionIds(initialQuestionIds);
        setAssignmentType('homework');
      }
    }
  }, [open, initialClassId, initialSessionId, initialType, initialExamId, initialQuestionIds]);

  // Fetch Exams (Kho Kiểm Tra)
  const { data: examsData } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examApi.list(),
    enabled: open,
  });

  // Filter exams (exclude exercises)
  const examList = (examsData?.data || []).filter((e: any) => e.type !== 'exercise');

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classApi.list(),
    enabled: open,
  });

  const { data: sessionsData } = useQuery({
    queryKey: ['class-sessions', classId],
    queryFn: () => sessionApi.list(classId),
    enabled: !!classId && open,
  });
  const sessions = sessionsData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: async () => {
      let finalExamId = examId;

      // If assigning homework directly from Kho Bài Tập
      if (assignmentType === 'homework') {
        if (selectedQuestionIds.length === 0) {
          throw new Error('Vui lòng chọn ít nhất 1 câu hỏi từ Kho bài tập');
        }
        // Auto-create exercise first in Kho Bài Tập
        const createdExercise = await exerciseApi.create({
          name: name.trim(),
          question_ids: selectedQuestionIds,
          class_id: classId || undefined,
          duration_minutes: Number(durationMinutes) || 45,
          practice_mode: 'free',
          allow_retry: true,
          show_hints: true,
        });
        finalExamId = createdExercise.data.id;
      }

      if (!finalExamId) {
        throw new Error(
          assignmentType === 'homework'
            ? 'Vui lòng chọn câu hỏi từ Kho bài tập'
            : 'Vui lòng chọn đề thi'
        );
      }

      return assignmentApi.create({
        name: name.trim(),
        assignment_type: assignmentType,
        max_attempts: assignmentType === 'homework' ? 999 : 1,
        exam_id: finalExamId,
        class_id: classId,
        session_id: sessionId || undefined,
        start_time: startTime ? new Date(startTime).toISOString() : undefined,
        end_time: endTime ? new Date(endTime).toISOString() : undefined,
        duration_minutes: Number(durationMinutes),
        pass_score: assignmentType === 'homework' ? 0.0 : Number(passScore),
        shuffle_questions: shuffleQuestions,
        shuffle_options: shuffleOptions,
        show_results: 'immediately',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      qc.invalidateQueries({ queryKey: ['class-sessions'] });
      qc.invalidateQueries({ queryKey: ['exercises'] });
      qc.invalidateQueries({ queryKey: ['questions'] });
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
    setSelectedQuestionIds([]);
  };

  const handleToggleQuestion = (id: string) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
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
    if (assignmentType === 'homework' && selectedQuestionIds.length === 0) {
      toast.error('Vui lòng tích chọn ít nhất 1 câu hỏi từ Kho bài tập');
      return;
    }

    createMutation.mutate();
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-2">
          {assignmentType === 'homework' ? (
            <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
              <BookOpen className="h-5 w-5" />
            </div>
          ) : (
            <div className="p-1.5 bg-primary-100 text-primary-700 rounded-lg">
              <ClipboardList className="h-5 w-5" />
            </div>
          )}
          <div>
            <span className="font-bold text-gray-900">
              {assignmentType === 'homework' ? 'Giao Bài Tập Cho Lớp' : 'Giao Bài Kiểm Tra Cho Lớp'}
            </span>
            <p className="text-xs text-gray-500 font-normal">
              {assignmentType === 'homework'
                ? 'Luyện tập tự do củng cố kiến thức • Không giới hạn lượt làm • Không tính điểm đạt/trượt'
                : 'Khảo thí chính thức • Có tính giờ đếm lui • Đánh giá điểm chuẩn'}
            </p>
          </div>
        </div>
      }
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            onClick={handleSubmit}
            loading={createMutation.isPending}
            className={assignmentType === 'homework' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}
          >
            {assignmentType === 'homework' ? 'Giao bài tập cho lớp' : 'Giao bài kiểm tra cho lớp'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Hình thức giao bài */}
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
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-600/20'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-indigo-600" />
                  Bài tập (Tự luyện)
                </span>
                {assignmentType === 'homework' && (
                  <span className="h-2 w-2 rounded-full bg-indigo-600" />
                )}
              </div>
              <p className="text-xs text-gray-500 leading-snug">
                Sổ câu hỏi chọn ngay. Làm nhiều lần để củng cố kiến thức, <strong>không có điểm đạt</strong>.
              </p>
            </button>
          </div>
        </div>

        {/* Tên bài */}
        <Input
          label={assignmentType === 'homework' ? 'Tên bài tập *' : 'Tên bài kiểm tra *'}
          placeholder={
            assignmentType === 'homework'
              ? 'Ví dụ: Bài tập ôn luyện tuần 3 - Hàm số'
              : 'Ví dụ: Kiểm tra 45 phút - Đại số 12'
          }
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        {/* PHẦN CHỌN NỘI DUNG CÂU HỎI / ĐỀ THI */}
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
                const selectedExam = examList.find((x: any) => x.id === selectedId);
                if (selectedExam) {
                  if (selectedExam.duration_minutes) {
                    setDurationMinutes(selectedExam.duration_minutes);
                  }
                  if (!name) {
                    setName(`Kiểm tra: ${selectedExam.name}`);
                  }
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            >
              <option value="">— Chọn đề thi có sẵn —</option>
              {examList.map((ex: any) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name} ({ex.duration_minutes} phút, {ex.total_questions || 0} câu)
                </option>
              ))}
            </select>
          </div>
        ) : (
          // CHO BÀI TẬP: Chọn câu hỏi trực tiếp từ Kho Bài Tập
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                2. Chọn câu hỏi cho bài tập (từ Kho bài tập) *
              </label>
              <span className="text-xs text-gray-500">
                Chỉ hiển thị câu hỏi thuộc Kho bài tập
              </span>
            </div>

            <div className="space-y-1">
              <QuestionPicker
                selectedIds={selectedQuestionIds}
                onToggleSelect={handleToggleQuestion}
                onSelectAll={(ids) => setSelectedQuestionIds(ids)}
                onClearAll={() => setSelectedQuestionIds([])}
                maxHeightClass="max-h-64"
                inExerciseBankOnly={true}
              />
            </div>
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

        {/* Start and End Date Time Picker */}
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

        {/* Thời gian làm bài & Điểm đạt (Pass score) */}
        <div className={assignmentType === 'exam' ? 'grid grid-cols-2 gap-4' : ''}>
          <Input
            label="Thời gian làm bài (Phút) *"
            type="number"
            min={5}
            max={300}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            required
          />

          {/* CHỈ HIỆN ĐIỂM ĐẠT CHO BÀI KIỂM TRA - BÀI TẬP HOÀN TOÀN KHÔNG CÓ ĐIỂM ĐẠT */}
          {assignmentType === 'exam' && (
            <Input
              label="Điểm đạt (Pass score) *"
              type="number"
              step="0.5"
              min={0}
              max={10}
              value={passScore}
              onChange={(e) => setPassScore(Number(e.target.value))}
              required
            />
          )}
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
      </form>
    </Modal>
  );
}
