import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Sparkles, BookOpen, FileText, CheckCircle2, Sliders, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import { questionApi, domainApi, getErrorMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

interface AutoGenerateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AutoGenerateModal({ open, onClose, onSuccess }: AutoGenerateModalProps) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [targetType, setTargetType] = useState<'exercise' | 'exam'>('exercise');
  const [name, setName] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [durationMinutes, setDurationMinutes] = useState(45);

  // Bloom mix counts
  const [bloomRemember, setBloomRemember] = useState(3);
  const [bloomUnderstand, setBloomUnderstand] = useState(4);
  const [bloomApply, setBloomApply] = useState(2);
  const [bloomAnalyze, setBloomAnalyze] = useState(1);

  // Difficulty mix counts
  const [diffEasy, setDiffEasy] = useState(4);
  const [diffMedium, setDiffMedium] = useState(4);
  const [diffHard, setDiffHard] = useState(2);

  // Fetch chapters for scope selection
  const { data: domainsData } = useQuery({
    queryKey: ['domains'],
    queryFn: () => domainApi.list(),
    enabled: open,
  });

  const domains = domainsData?.data || [];

  const autoGenerateMutation = useMutation({
    mutationFn: () =>
      questionApi.autoGenerate({
        target_type: targetType,
        name: name.trim(),
        chapter_id: chapterId || undefined,
        total_questions: Number(totalQuestions) || 10,
        duration_minutes: Number(durationMinutes) || 45,
        bloom_mix: {
          remember: Number(bloomRemember) || 0,
          understand: Number(bloomUnderstand) || 0,
          apply: Number(bloomApply) || 0,
          analyze: Number(bloomAnalyze) || 0,
        },
        difficulty_mix: {
          easy: Number(diffEasy) || 0,
          medium: Number(diffMedium) || 0,
          hard: Number(diffHard) || 0,
        },
        question_types: ['mcq'],
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['exercises'] });
      qc.invalidateQueries({ queryKey: ['exams'] });
      qc.invalidateQueries({ queryKey: ['questions'] });
      toast.success(res.data.message || 'Sinh tự động thành công!');
      onSuccess?.();
      onClose();
      if (targetType === 'exercise') {
        navigate('/exercises');
      } else {
        navigate('/exams');
      }
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleGenerate = () => {
    if (!name.trim()) {
      toast.error(`Vui lòng nhập tên ${targetType === 'exercise' ? 'bộ bài tập' : 'đề thi'}`);
      return;
    }
    autoGenerateMutation.mutate();
  };

  return (
    <Modal
      open={open}
      onOpenChange={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-gray-900">Sinh Bài Tập / Đề Thi Tự Động Từ Ngân Hàng</div>
            <p className="text-xs text-gray-500 font-normal">
              AI tự động bốc câu hỏi từ Ngân hàng câu hỏi gốc theo đúng ma trận Bloom & Độ khó
            </p>
          </div>
        </div>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            loading={autoGenerateMutation.isPending}
            onClick={handleGenerate}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            Sinh & Đóng Gói Ngay
          </Button>
        </>
      }
    >
      <div className="space-y-4 py-2">
        {/* Chọn loại đích */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            Loại hình đóng gói
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setTargetType('exercise');
                if (!name || name.includes('Đề thi')) setName('Bài tập luyện tập ma trận Bloom');
              }}
              className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                targetType === 'exercise'
                  ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <BookOpen className={`h-4 w-4 mt-0.5 ${targetType === 'exercise' ? 'text-emerald-600' : 'text-gray-400'}`} />
              <div>
                <div className="font-semibold text-xs text-gray-900">Kho Bài Tập</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Sinh bộ bài tập ôn luyện (học sinh được làm lại).</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setTargetType('exam');
                if (!name || name.includes('Bài tập')) setName('Đề kiểm tra chuẩn hóa ma trận Bloom');
              }}
              className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                targetType === 'exam'
                  ? 'border-purple-500 bg-purple-50/40 ring-1 ring-purple-500'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <FileText className={`h-4 w-4 mt-0.5 ${targetType === 'exam' ? 'text-purple-600' : 'text-gray-400'}`} />
              <div>
                <div className="font-semibold text-xs text-gray-900">Kho Đề Kiểm Tra</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Sinh đề thi chính thức chuẩn hóa (giới hạn thời gian).</div>
              </div>
            </button>
          </div>
        </div>

        {/* Tên & Số lượng */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Tên bài tập / đề thi <span className="text-rose-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ví dụ: Bài tập tự động - Chương 1..."
              className="text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Tổng số câu hỏi
            </label>
            <Input
              type="number"
              min={1}
              max={100}
              value={totalQuestions}
              onChange={(e) => setTotalQuestions(Number(e.target.value))}
              className="text-sm font-semibold"
            />
          </div>
        </div>

        {/* Phạm vi Thư mục / Chương */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Phạm vi thư mục / chủ đề (Tùy chọn)
          </label>
          <select
            value={chapterId}
            onChange={(e) => setChapterId(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-gray-800"
          >
            <option value="">-- Toàn bộ Ngân hàng câu hỏi --</option>
            {domains.map((d: any) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Ma trận Bloom */}
        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-blue-600" />
              Cơ cấu Bloom (Nhận thức)
            </span>
            <span className="text-[11px] text-blue-700">
              Tổng: {Number(bloomRemember) + Number(bloomUnderstand) + Number(bloomApply) + Number(bloomAnalyze)} câu
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="block text-[11px] text-gray-600 mb-0.5">Nhớ</label>
              <Input
                type="number"
                min={0}
                value={bloomRemember}
                onChange={(e) => setBloomRemember(Number(e.target.value))}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-600 mb-0.5">Hiểu</label>
              <Input
                type="number"
                min={0}
                value={bloomUnderstand}
                onChange={(e) => setBloomUnderstand(Number(e.target.value))}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-600 mb-0.5">Vận dụng</label>
              <Input
                type="number"
                min={0}
                value={bloomApply}
                onChange={(e) => setBloomApply(Number(e.target.value))}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-600 mb-0.5">Vận dụng cao</label>
              <Input
                type="number"
                min={0}
                value={bloomAnalyze}
                onChange={(e) => setBloomAnalyze(Number(e.target.value))}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Ma trận Độ khó */}
        <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-emerald-600" />
              Cơ cấu Mức độ khó
            </span>
            <span className="text-[11px] text-emerald-700">
              Tổng: {Number(diffEasy) + Number(diffMedium) + Number(diffHard)} câu
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] text-gray-600 mb-0.5">Dễ</label>
              <Input
                type="number"
                min={0}
                value={diffEasy}
                onChange={(e) => setDiffEasy(Number(e.target.value))}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-600 mb-0.5">Trung bình</label>
              <Input
                type="number"
                min={0}
                value={diffMedium}
                onChange={(e) => setDiffMedium(Number(e.target.value))}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] text-gray-600 mb-0.5">Khó</label>
              <Input
                type="number"
                min={0}
                value={diffHard}
                onChange={(e) => setDiffHard(Number(e.target.value))}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
