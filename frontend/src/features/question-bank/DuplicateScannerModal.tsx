import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, AlertTriangle, CheckCircle2, Sparkles, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { apiClient, questionApi, getErrorMessage } from '@/services/api';

interface DuplicateScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DuplicateScannerModal({ open, onOpenChange }: DuplicateScannerModalProps) {
  const qc = useQueryClient();
  const [stem, setStem] = useState('');
  const [result, setResult] = useState<any>(null);

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/ai/questions/detect-duplicates', null, {
        params: { stem },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setResult(data);
      if (data.has_duplicates) {
        toast.error('Phát hiện câu hỏi có độ tương đồng cao trong ngân hàng!');
      } else {
        toast.success('Câu hỏi có tính độc bản tốt, không trùng lặp!');
      }
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const archiveDuplicateMutation = useMutation({
    mutationFn: (id: string) => questionApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions'] });
      toast.success('Đã lưu trữ câu hỏi trùng lặp');
      // remove from result matches
      if (result) {
        setResult({
          ...result,
          matches: result.matches.filter((m: any) => m.matched_question_id !== archiveDuplicateMutation.variables),
        });
      }
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stem.trim()) {
      toast.error('Vui lòng nhập nội dung câu hỏi cần kiểm tra');
      return;
    }
    scanMutation.mutate();
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-2">
          <Copy className="h-5 w-5 text-purple-600" />
          <span>AI Quét Trùng Lặp Câu Hỏi (Duplicate Detector)</span>
        </div>
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button
            loading={scanMutation.isPending}
            onClick={handleScan}
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            Kiểm tra trùng lặp
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <form onSubmit={handleScan}>
          <Textarea
            label="Nội dung câu hỏi cần kiểm tra *"
            placeholder="Nhập hoặc dán nội dung câu hỏi muốn đối chiếu với toàn bộ kho ngân hàng..."
            value={stem}
            onChange={(e) => setStem(e.target.value)}
            rows={3}
            required
          />
        </form>

        {/* Results */}
        {result && (
          <div className="space-y-4 pt-2 border-t border-gray-100">
            <div
              className={`p-4 rounded-xl border text-sm flex items-start gap-3 ${
                result.has_duplicates
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-green-50 border-green-200 text-green-900'
              }`}
            >
              {result.has_duplicates ? (
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold">{result.recommendation}</p>
                <p className="text-xs mt-1 opacity-90">
                  Tìm thấy <strong>{result.matches.length}</strong> câu hỏi có độ tương đồng từ 65% trở lên.
                </p>
              </div>
            </div>

            {/* Match List */}
            {result.matches.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Danh sách câu hỏi tương đồng trong ngân hàng:
                </p>
                {result.matches.map((m: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/70 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-bold px-2 py-0.5 rounded-full ${
                          m.similarity_percentage >= 85
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        Độ tương đồng: {m.similarity_percentage}% ({m.verdict})
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50 text-xs h-7 px-2"
                        loading={
                          archiveDuplicateMutation.isPending &&
                          archiveDuplicateMutation.variables === m.matched_question_id
                        }
                        onClick={() => archiveDuplicateMutation.mutate(m.matched_question_id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Lưu trữ câu này
                      </Button>
                    </div>

                    <p className="text-gray-800 font-medium whitespace-pre-wrap">
                      {m.matched_stem}
                    </p>

                    <p className="text-gray-500 italic">
                      💡 {m.explanation}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
