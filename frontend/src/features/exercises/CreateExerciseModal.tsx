import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Clock, Layers, Users, CheckCircle2, RotateCcw, HelpCircle, CheckSquare, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { exerciseApi, classApi, getErrorMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { QuestionPicker } from '@/features/question-bank/QuestionPicker';

interface CreateExerciseModalProps {
  open: boolean;
  onClose: () => void;
  selectedQuestionIds: string[];
  onSuccess?: () => void;
}

export function CreateExerciseModal({
  open,
  onClose,
  selectedQuestionIds,
  onSuccess,
}: CreateExerciseModalProps) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [questionIds, setQuestionIds] = useState<string[]>(selectedQuestionIds || []);
  const [name, setName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [classId, setClassId] = useState('');
  const [practiceMode, setPracticeMode] = useState<'free' | 'linear'>('free');
  const [allowRetry, setAllowRetry] = useState(true);
  const [showHints, setShowHints] = useState(true);

  useEffect(() => {
    if (open) {
      setQuestionIds(selectedQuestionIds || []);
    }
  }, [open, selectedQuestionIds]);

  // Fetch classes
  const { data: classesData } = useQuery({
    queryKey: ['classes-select'],
    queryFn: () => classApi.list({ page: 1, page_size: 100 }),
    enabled: open,
  });

  const classes = classesData?.data?.items ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      exerciseApi.create({
        name: name.trim(),
        question_ids: questionIds,
        class_id: classId || undefined,
        duration_minutes: Number(durationMinutes) || 45,
        practice_mode: practiceMode,
        allow_retry: allowRetry,
        show_hints: showHints,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exercises'] });
      qc.invalidateQueries({ queryKey: ['questions'] });
      toast.success('Đã lưu bộ bài tập vào Kho Bài Tập thành công!');
      onSuccess?.();
      onClose();
      navigate('/exercises');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleToggleQuestion = (id: string) => {
    setQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
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
            <div className="font-bold text-gray-900">Tạo Bộ Bài Tập Mới</div>
            <p className="text-xs text-gray-500 font-normal">
              Đã chọn <strong className="text-emerald-700 font-semibold">{questionIds.length}</strong> câu hỏi từ Ngân hàng (tham chiếu gốc)
            </p>
          </div>
        </div>
      }
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            loading={createMutation.isPending}
            onClick={() => {
              if (!name.trim()) {
                toast.error('Vui lòng nhập tên bộ bài tập');
                return;
              }
              if (questionIds.length === 0) {
                toast.error('Vui lòng tích chọn ít nhất 1 câu hỏi từ danh sách bên dưới');
                return;
              }
              createMutation.mutate();
            }}
          >
            Lưu Vào Kho Bài Tập ({questionIds.length} câu)
          </Button>
        </>
      }
    >
      <div className="space-y-4 py-1">
        {/* Banner nguyên tắc SSOT */}
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 text-xs text-emerald-800 flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-emerald-900">Nguyên tắc tham chiếu câu hỏi (Single Source of Truth):</div>
            Bộ bài tập chỉ lưu liên kết tham chiếu tới các câu hỏi trong ngân hàng, không sao chép dữ liệu, đảm bảo nội dung luôn đồng bộ và cập nhật phiên bản chuẩn xác.
          </div>
        </div>

        {/* Thông tin cơ bản */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Tên bộ bài tập <span className="text-rose-500">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Bài tập ôn luyện tuần 3 - Phương trình lượng giác..."
            className="text-sm"
          />
        </div>

        {/* Danh sách câu hỏi để lựa chọn */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
            Chọn câu hỏi từ Ngân hàng câu hỏi *
          </label>
          <QuestionPicker
            selectedIds={questionIds}
            onToggleSelect={handleToggleQuestion}
            onSelectAll={(ids) => setQuestionIds(ids)}
            onClearAll={() => setQuestionIds([])}
            maxHeightClass="max-h-60"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Thời lượng gợi ý (Phút)
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="number"
                min={5}
                max={300}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="pl-9 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Gắn với Lớp học (Tùy chọn)
            </label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-gray-800"
              >
                <option value="">-- Dùng chung cho mọi lớp --</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Chế độ làm bài */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Chế độ làm bài
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPracticeMode('free')}
              className={`p-3 rounded-xl border text-left transition-all ${
                practiceMode === 'free'
                  ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="font-semibold text-xs text-gray-900 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Tự do duyệt câu
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                Học sinh có thể xem trước và nhảy tới bất kỳ câu hỏi nào.
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPracticeMode('linear')}
              className={`p-3 rounded-xl border text-left transition-all ${
                practiceMode === 'linear'
                  ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="font-semibold text-xs text-gray-900 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Làm tuần tự
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                Học sinh hoàn thành từng câu theo đúng thứ tự sắp xếp.
              </div>
            </button>
          </div>
        </div>

        {/* Tùy chọn sư phạm bài tập */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2.5">
          <div className="text-xs font-semibold text-gray-700">Chính sách luyện tập (Không tính điểm đạt/trượt):</div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allowRetry}
              onChange={(e) => setAllowRetry(e.target.checked)}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
            />
            <div className="text-xs text-gray-800">
              <span className="font-medium">Cho phép học sinh làm lại nhiều lần</span>
              <span className="block text-[11px] text-gray-500">Giúp học sinh rèn luyện kỹ năng cho đến khi nắm vững bài</span>
            </div>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showHints}
              onChange={(e) => setShowHints(e.target.checked)}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
            />
            <div className="text-xs text-gray-800">
              <span className="font-medium">Hiển thị gợi ý & lời giải chi tiết</span>
              <span className="block text-[11px] text-gray-500">Hiển thị rationale/giải thích sau khi học sinh trả lời</span>
            </div>
          </label>
        </div>
      </div>
    </Modal>
  );
}
