import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, GraduationCap, FileText, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { assignmentApi, examApi, classApi, getErrorMessage } from '@/services/api';

interface CreateAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAssignmentModal({ open, onOpenChange }: CreateAssignmentModalProps) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [examId, setExamId] = useState('');
  const [classId, setClassId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [passScore, setPassScore] = useState(5.0);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);

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

  const createMutation = useMutation({
    mutationFn: () =>
      assignmentApi.create({
        name,
        exam_id: examId,
        class_id: classId,
        duration_minutes: Number(durationMinutes),
        pass_score: Number(passScore),
        shuffle_questions: shuffleQuestions,
        shuffle_options: shuffleOptions,
        show_results: 'immediately',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Đã giao bài kiểm tra cho lớp thành công!');
      handleReset();
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleReset = () => {
    setName('');
    setExamId('');
    setClassId('');
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
          <ClipboardList className="h-5 w-5 text-primary-600" />
          <span>Giao Bài Kiểm Tra Mới</span>
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
        <Input
          label="Tên bài kiểm tra *"
          placeholder="Ví dụ: Kiểm tra 45 phút - Đại số 12"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chọn đề thi *
            </label>
            <select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
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
              onChange={(e) => setClassId(e.target.value)}
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
