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
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [pointsPerQuestion, setPointsPerQuestion] = useState<number | undefined>(undefined);

  // Fetch classes
  const { data: classesData } = useQuery({
    queryKey: ['classes-select'],
    queryFn: () => classApi.list({ page: 1, page_size: 100 }),
    enabled: open,
  });

  const classes = classesData?.data?.items ?? [];

  const defaultPoints = selectedQuestionIds.length > 0
    ? Number((10.0 / selectedQuestionIds.length).toFixed(2))
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
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['exams'] });
      toast.success('Đã tạo đề thi từ câu hỏi thành công!');
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
            Tạo đề thi ({selectedQuestionIds.length} câu)
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
              Tổng điểm: {((pointsPerQuestion ?? defaultPoints) * selectedQuestionIds.length).toFixed(1)} điểm
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
