import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileCode2,
  Save,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Plus,
  BookOpen,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { aiApi, getErrorMessage } from '@/services/api';

interface RuleEditorModalProps {
  open: boolean;
  onClose: () => void;
  onRulesUpdated?: (rules: string) => void;
}

const PRESET_RULES = [
  {
    label: 'Số từ 15-40 từ',
    snippet: '\n- Độ dài câu hỏi (stem): Tối đa 40 từ, tối thiểu 15 từ, ngắn gọn và trực diện.',
  },
  {
    label: 'Bắt đầu bằng tình huống',
    snippet: '\n- Mở đầu câu hỏi: Đưa ra tình huống thực tế hoặc dữ liệu cụ thể trước khi hỏi.',
  },
  {
    label: 'Cấm "Tất cả ý trên"',
    snippet: '\n- Phương án trắc nghiệm: Tuyệt đối KHÔNG dùng "Tất cả các ý trên đều đúng" hoặc "Cả A và B".',
  },
  {
    label: 'Công thức LaTeX chuẩn',
    snippet: '\n- Định dạng công thức: Mọi ký hiệu toán/lý/hóa phải kẹp trong dấu $...$ theo chuẩn LaTeX.',
  },
  {
    label: 'Tăng bẫy tư duy',
    snippet: '\n- Bẫy tư duy: 3 phương án sai phải phản ánh đúng các lỗi ngộ nhận phổ biến nhất của học sinh.',
  },
];

export function RuleEditorModal({ open, onClose, onRulesUpdated }: RuleEditorModalProps) {
  const qc = useQueryClient();
  const [content, setContent] = useState('');

  // Fetch active rules
  const { data: rulesData, isLoading } = useQuery({
    queryKey: ['ai-rules'],
    queryFn: () => aiApi.getRules(),
    enabled: open,
  });

  useEffect(() => {
    if (rulesData?.data?.content) {
      setContent(rulesData.data.content);
    }
  }, [rulesData]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (newContent: string) => aiApi.updateRules(newContent),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['ai-rules'] });
      toast.success('Đã lưu bộ quy tắc AI (rule.md) thành công!');
      onRulesUpdated?.(res.data.content);
      onClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: () => aiApi.resetRules(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['ai-rules'] });
      setContent(res.data.content);
      toast.success('Đã khôi phục quy tắc về mặc định chuẩn');
      onRulesUpdated?.(res.data.content);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleAppendSnippet = (snippet: string) => {
    setContent((prev) => prev.trim() + '\n' + snippet.trim() + '\n');
    toast.success('Đã thêm quy tắc mẫu');
  };

  return (
    <Modal
      open={open}
      onOpenChange={onClose}
      title={
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
            <FileCode2 className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-gray-900 flex items-center gap-2">
              Bộ quy tắc Sư phạm AI (rule.md)
              <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-mono font-semibold uppercase">
                Custom Constraints
              </span>
            </div>
            <p className="text-xs text-gray-500 font-normal">
              Định nghĩa các tiêu chuẩn và ràng buộc sư phạm mà AI bắt buộc phải tuân thủ khi sinh câu hỏi
            </p>
          </div>
        </div>
      }
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="ghost"
            size="sm"
            loading={resetMutation.isPending}
            onClick={() => {
              if (confirm('Bạn có chắc muốn khôi phục về bộ quy tắc mặc định ban đầu?')) {
                resetMutation.mutate();
              }
            }}
            className="text-gray-500 hover:text-red-600 gap-1.5"
          >
            <RotateCcw className="h-4 w-4" />
            Khôi phục mặc định
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Hủy
            </Button>
            <Button
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate(content)}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            >
              <Save className="h-4 w-4" />
              Lưu quy tắc
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Preset quick buttons */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            Chèn nhanh quy tắc sư phạm mẫu:
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_RULES.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleAppendSnippet(preset.snippet)}
                className="text-xs px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-lg transition-colors flex items-center gap-1"
              >
                <Plus className="h-3 w-3 text-amber-600" />
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Nội dung file <code className="font-mono text-amber-700">rule.md</code> (Định dạng Markdown):
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isLoading}
            rows={14}
            placeholder="Nhập các quy tắc sư phạm cần AI tuân thủ..."
            className="w-full font-mono text-xs px-3.5 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-gray-50/50 leading-relaxed resize-none"
          />
        </div>

        {/* Info box */}
        <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <strong>Cách hoạt động:</strong> Mọi quy tắc trong <code>rule.md</code> sẽ được nạp tự động vào hệ thống Multi-Agent AI khi bạn bấm <em>"Kích hoạt Multi-Agent AI"</em> hoặc <em>"Cải thiện câu hỏi"</em>. Giáo viên có kinh nghiệm có thể tinh chỉnh các quy tắc riêng biệt để AI tạo ra câu hỏi chuẩn xác nhất theo ý đồ bài giảng.
          </div>
        </div>
      </div>
    </Modal>
  );
}
