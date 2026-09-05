import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, GraduationCap, FileText, CheckCircle2, Clock, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { assignmentApi, examApi, classApi, sessionApi, getErrorMessage } from '@/services/api';

interface CreateAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialClassId?: string;
  initialSessionId?: string;
  initialType?: 'exam' | 'homework';
}

export function CreateAssignmentModal({
  open,
  onOpenChange,
  initialClassId,
  initialSessionId,
  initialType,
}: CreateAssignmentModalProps) {
  const qc = useQueryClient();
  const [assignmentType, setAssignmentType] = useState<'exam' | 'homework'>(initialType || 'exam');
  const [name, setName] = useState('');
  const [examId, setExamId] = useState('');
  const [classId, setClassId] = useState(initialClassId || '');
  const [sessionId, setSessionId] = useState(initialSessionId || '');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [passScore, setPassScore] = useState(5.0);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialClassId) setClassId(initialClassId);
      if (initialSessionId) setSessionId(initialSessionId);
      if (initialType) setAssignmentType(initialType);
    }
  }, [open, initialClassId, initialSessionId, initialType]);

  const { data: exams } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examApi.list(),
    enabled: open,
  });

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
    mutationFn: () =>
      assignmentApi.create({
        name,
        assignment_type: assignmentType,
        max_attempts: assignmentType === 'homework' ? 999 : 1,
        exam_id: examId,
        class_id: classId,
        session_id: sessionId || undefined,
        start_time: startTime ? new Date(startTime).toISOString() : undefined,
        end_time: endTime ? new Date(endTime).toISOString() : undefined,
        duration_minutes: Number(durationMinutes),
        pass_score: Number(passScore),
        shuffle_questions: shuffleQuestions,
        shuffle_options: shuffleOptions,
        show_results: 'immediately',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      qc.invalidateQueries({ queryKey: ['class-sessions'] });
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
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !examId || !classId) {
      toast.error('Vui lòng điền đầy đủ tên bài, chọn đề thi và lớp học');
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
            <BookOpen className="h-5 w-5 text-indigo-600" />
          ) : (
            <ClipboardList className="h-5 w-5 text-primary-600" />
          )}
          <span>{assignmentType === 'homework' ? 'Giao Bài Tập Mới' : 'Giao Bài Kiểm Tra Mới'}</span>
        </div>
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} loading={createMutation.isPending}>
            Giao bài cho lớp
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Hình thức khảo thí */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Hình thức giao bài *
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
                  ? 'border-primary-600 bg-primary-50/50 shadow-xs'
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
                Thời gian đếm lui. Chỉ làm <strong>1 lần duy nhất</strong>, chốt điểm là xong.
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
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-indigo-600" />
                  Bài tập
                </span>
                {assignmentType === 'homework' && (
                  <span className="h-2 w-2 rounded-full bg-indigo-600" />
                )}
              </div>
              <p className="text-xs text-gray-500 leading-snug">
                Có thời gian làm bài. Được <strong>làm đi làm lại</strong> và nộp nhiều lần để cải thiện điểm.
              </p>
            </button>
          </div>
        </div>

        <Input
          label={assignmentType === 'homework' ? 'Tên bài tập *' : 'Tên bài kiểm tra *'}
          placeholder={assignmentType === 'homework' ? 'Ví dụ: Bài tập ôn luyện tuần 3 - Hàm số' : 'Ví dụ: Kiểm tra 45 phút - Đại số 12'}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chọn đề thi *
            </label>
            <select
              value={examId}
              onChange={(e) => {
                const selectedId = e.target.value;
                setExamId(selectedId);
                const selectedExam = exams?.data?.find((x: any) => x.id === selectedId);
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
              <option value="">— Chọn đề thi —</option>
              {exams?.data?.map((ex: any) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name} ({ex.duration_minutes}p)
                </option>
              ))}
            </select>
          </div>

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
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Gán vào buổi học cụ thể trong lớp (Tùy chọn)
          </label>
          <select
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            disabled={!classId}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="">— Không gán vào buổi cụ thể (Giao cho toàn lớp) —</option>
            {sessions.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.title || s.name} {s.session_date ? `(${s.session_date})` : ''}
              </option>
            ))}
          </select>
          {sessionId && (
            <p className="text-xs text-primary-600 mt-1">
              ✓ Bài kiểm tra này sẽ hiển thị trực tiếp trong danh mục Buổi học đã chọn.
            </p>
          )}
        </div>

        {/* Start and End Date Time Picker */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-gray-50/80 rounded-xl border border-gray-200">
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

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Thời gian làm bài (Phút) *"
            type="number"
            min={5}
            max={180}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            required
          />
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
        </div>

        {/* Anti-cheat & Randomization */}
        <div className="pt-2 border-t border-gray-100 space-y-2">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
            Tùy chọn xáo trộn đề thi
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
