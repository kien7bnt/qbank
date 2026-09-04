import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shuffle, Layers, CheckCircle2, Copy, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { examApi, getErrorMessage } from '@/services/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageSpinner } from '@/components/ui/Spinner';
import type { ExamVariant } from '@/types';

interface GenerateVariantsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string;
  examName: string;
}

export function GenerateVariantsModal({
  open,
  onOpenChange,
  examId,
  examName,
}: GenerateVariantsModalProps) {
  const qc = useQueryClient();
  const [variantCount, setVariantCount] = useState(4);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [codePrefix, setCodePrefix] = useState('10');

  // Fetch existing variants
  const { data: variantsData, isLoading } = useQuery({
    queryKey: ['exam-variants', examId],
    queryFn: () => examApi.getVariants(examId),
    enabled: open && !!examId,
  });

  const variants = variantsData?.data || [];

  // Generate Mutation
  const generateMutation = useMutation({
    mutationFn: () =>
      examApi.generateVariants(examId, {
        variant_count: variantCount,
        shuffle_questions: shuffleQuestions,
        shuffle_options: shuffleOptions,
        code_prefix: codePrefix,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['exam-variants', examId] });
      toast.success(`Đã sinh thành công ${res.data.length} mã đề thi!`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-2">
          <Shuffle className="h-5 w-5 text-primary-600" />
          <span>Sinh nhiều Mã đề thi từ Đề gốc</span>
        </div>
      }
      size="lg"
      footer={
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Đóng
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm">
          <p className="text-gray-500 text-xs uppercase tracking-wider font-semibold">Đề thi gốc</p>
          <p className="text-gray-900 font-bold mt-0.5">{examName}</p>
        </div>

        {/* Form Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Số lượng mã đề cần tạo"
            type="number"
            min={1}
            max={20}
            value={variantCount}
            onChange={(e) => setVariantCount(Number(e.target.value))}
          />

          <Input
            label="Tiền tố mã đề (Prefix)"
            placeholder="Ví dụ: 10, 00, M"
            value={codePrefix}
            onChange={(e) => setCodePrefix(e.target.value)}
          />
        </div>

        <div className="space-y-3 p-4 rounded-xl border border-gray-200 bg-white">
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Tùy chọn xáo trộn</label>
          <div className="flex flex-col gap-2.5">
            <label className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span>Đảo thứ tự câu hỏi giữa các mã đề</span>
            </label>

            <label className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={shuffleOptions}
                onChange={(e) => setShuffleOptions(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span>Đảo thứ tự các phương án lựa chọn (A, B, C, D)</span>
            </label>
          </div>
        </div>

        <Button
          onClick={() => generateMutation.mutate()}
          loading={generateMutation.isPending}
          className="w-full"
        >
          <Shuffle className="h-4 w-4 mr-1.5" />
          Bắt đầu sinh mã đề
        </Button>

        {/* Existing Generated Variants List */}
        <div className="space-y-3 pt-3 border-t border-gray-200">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Danh sách mã đề đã tạo ({variants.length})
          </h4>

          {isLoading ? (
            <PageSpinner />
          ) : variants.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Chưa có mã đề nào được tạo cho đề thi này.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {variants.map((v) => (
                <div
                  key={v.id}
                  className="p-3 rounded-xl border border-primary-100 bg-primary-50/50 flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] text-primary-600 font-semibold uppercase">Mã đề</span>
                    <p className="text-base font-black text-primary-900 font-mono">{v.variant_code}</p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {v.question_order?.length || 0} câu
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
