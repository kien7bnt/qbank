import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  Save,
  RotateCcw,
  Plus,
  CheckCircle2,
  FileCode2,
  BookOpen,
  Info,
  Layers,
  Wand2,
  FileText,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { aiApi, getErrorMessage } from '@/services/api';
import { AIGenerationModal } from './AIGenerationModal';

const PRESET_RULE_SNIPPETS = [
  {
    id: 'length',
    title: 'Độ dài câu hỏi (15 - 40 từ)',
    desc: 'Ngắn gọn, rõ ràng, trực diện',
    snippet: '\n- Độ dài phần dẫn (stem): Tối đa 40 từ, tối thiểu 15 từ, diễn đạt trực diện và gãy gọn.',
  },
  {
    id: 'context',
    title: 'Tình huống thực tế',
    desc: 'Gắn liền bối cảnh đời sống thực tiễn',
    snippet: '\n- Mở đầu câu hỏi: Đưa ra tình huống thực tế hoặc dữ liệu cụ thể từ đời sống trước khi hỏi.',
  },
  {
    id: 'no_all_above',
    title: 'Cấm "Tất cả ý trên đều đúng"',
    desc: 'Tuân thủ chuẩn sư phạm quốc tế',
    snippet: '\n- Phương án trắc nghiệm: Tuyệt đối KHÔNG dùng "Tất cả các ý trên đều đúng" hoặc "Cả A và B".',
  },
  {
    id: 'latex',
    title: 'Chuẩn công thức LaTeX ($...$)',
    desc: 'Toán, Lý, Hóa chuẩn biểu thức',
    snippet: '\n- Định dạng công thức: Mọi ký hiệu toán/lý/hóa phải kẹp trong dấu $...$ theo chuẩn KaTeX/LaTeX.',
  },
  {
    id: 'distractors',
    title: 'Bẫy tư duy ngộ nhận',
    desc: '3 phương án sai đánh trúng ngộ nhận',
    snippet: '\n- Bẫy tư duy: 3 phương án gây nhiễu phải phản ánh đúng các ngộ nhận và lỗi tính toán sai điển hình nhất của học sinh.',
  },
  {
    id: 'bloom',
    title: 'Phân loại thang Bloom chuẩn',
    desc: 'Rõ ràng mức độ nhận thức',
    snippet: '\n- Thang đo nhận thức Bloom: Phân định rõ 4 mức: Nhận biết (remember), Thông hiểu (understand), Vận dụng (apply), Vận dụng cao (analyze/evaluate).',
  },
  {
    id: 'coding_constraints',
    title: 'Ràng buộc câu hỏi Lập trình',
    desc: 'Input/Output format và thời gian chạy',
    snippet: '\n- Câu hỏi lập trình: Phải nêu rõ Định dạng đầu vào (Input), Định dạng đầu ra (Output), Giới hạn thời gian (Time Limit <= 1000ms), Bộ nhớ (<= 256MB) và ít nhất 2 cặp Test cases mẫu.',
  },
];

export function AIRulesPage() {
  const qc = useQueryClient();
  const [content, setContent] = useState('');
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  // Fetch active rules from backend
  const { data: rulesData, isLoading } = useQuery({
    queryKey: ['ai-rules'],
    queryFn: () => aiApi.getRules(),
  });

  useEffect(() => {
    if (rulesData?.data?.content) {
      setContent(rulesData.data.content);
    }
  }, [rulesData]);

  // Save rules mutation
  const saveMutation = useMutation({
    mutationFn: (newContent: string) => aiApi.updateRules(newContent),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-rules'] });
      toast.success('Đã lưu thành công bộ quy tắc AI (rule.md)!');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Reset rules mutation
  const resetMutation = useMutation({
    mutationFn: () => aiApi.resetRules(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['ai-rules'] });
      setContent(res.data.content);
      toast.success('Đã khôi phục quy tắc về chuẩn sư phạm mặc định!');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleAppendSnippet = (snippet: string) => {
    setContent((prev) => prev.trim() + '\n' + snippet.trim() + '\n');
    toast.success('Đã thêm quy tắc vào nội dung');
  };

  if (isLoading) {
    return <PageSpinner />;
  }

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const lineCount = content.split('\n').length;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-tr from-amber-500 to-orange-500 rounded-xl text-white shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                Quy Tắc Sinh Đề AI (AI Prompt Rules)
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Định hình tiêu chuẩn sư phạm, phong cách câu hỏi và ràng buộc kỹ thuật khi trợ lý AI tạo câu hỏi.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm('Khôi phục lại bộ quy tắc chuẩn ban đầu của hệ thống?')) {
                resetMutation.mutate();
              }
            }}
            loading={resetMutation.isPending}
            className="text-xs text-gray-600 hover:text-gray-900"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Khôi phục mặc định
          </Button>

          <Button
            size="sm"
            onClick={() => saveMutation.mutate(content)}
            loading={saveMutation.isPending}
            className="bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs shadow-xs"
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            Lưu quy tắc
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsTestModalOpen(true)}
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-semibold"
          >
            <Wand2 className="h-3.5 w-3.5 mr-1 text-indigo-600" />
            Thử nghiệm sinh câu hỏi
          </Button>
        </div>
      </div>

      {/* Info Alert */}
      <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 text-xs sm:text-sm text-amber-900 flex items-start gap-3 shadow-xs">
        <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-950">
            Quy tắc này được nạp tự động vào System Prompt của mọi mô hình AI (OpenAI, Gemini, Ollama)
          </p>
          <p className="text-amber-800 text-xs leading-relaxed">
            Mỗi khi bạn tạo câu hỏi tự động bằng AI từ văn bản, ma trận hoặc chủ đề, mô hình sẽ nghiêm ngặt tuân thủ các chỉ thị dưới đây. Bạn có thể nhấn vào các mẫu quy tắc gợi ý bên dưới để thêm nhanh.
          </p>
        </div>
      </div>

      {/* Main Grid: Editor & Snippets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 cols: Editor */}
        <div className="lg:col-span-8 bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
          {/* Editor Header */}
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
              <FileCode2 className="h-4 w-4 text-primary-600" />
              <span>Nội dung tập tin quy tắc (rule.md)</span>
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>{lineCount} dòng</span>
              <span>•</span>
              <span>{wordCount} từ</span>
              <span>•</span>
              <span>{content.length} ký tự</span>
            </div>
          </div>

          {/* Textarea */}
          <div className="p-4 bg-slate-900 flex flex-col">
            <textarea
              rows={22}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              placeholder="# Quy tắc sinh câu hỏi kiểm tra..."
              className="w-full bg-transparent text-slate-100 font-mono text-xs sm:text-sm leading-relaxed focus:outline-none resize-y selection:bg-primary-500/40"
            />
          </div>

          {/* Footer of Editor */}
          <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Đang hoạt động trong Studio AI
            </span>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate(content)}
              loading={saveMutation.isPending}
              className="h-8 text-xs font-semibold"
            >
              <Save className="h-3 w-3 mr-1" />
              Lưu thay đổi
            </Button>
          </div>
        </div>

        {/* Right 4 cols: Snippets & Presets */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary-600" />
              <h2 className="font-bold text-gray-900 text-sm">Gợi ý quy tắc sư phạm mẫu</h2>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Nhấn nút <strong>+ Thêm</strong> để chèn ngay quy tắc chuẩn vào cuối nội dung:
            </p>

            <div className="space-y-2.5">
              {PRESET_RULE_SNIPPETS.map((snippet) => (
                <div
                  key={snippet.id}
                  className="p-3 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50/30 transition-all text-xs space-y-1 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900">{snippet.title}</span>
                    <button
                      type="button"
                      onClick={() => handleAppendSnippet(snippet.snippet)}
                      className="text-[11px] font-bold text-primary-600 hover:text-primary-800 bg-primary-50 px-2 py-0.5 rounded-md hover:bg-primary-100 transition-colors flex items-center gap-0.5"
                    >
                      <Plus className="h-3 w-3" />
                      Thêm
                    </button>
                  </div>
                  <p className="text-gray-500 text-[11px]">{snippet.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-950 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-indigo-900">
              <Wand2 className="h-4 w-4 text-indigo-600" />
              Mẹo xây dựng quy tắc hiệu quả
            </div>
            <p className="text-indigo-800/90 leading-relaxed text-[11px]">
              - Dùng định dạng gạch đầu dòng ngắn gọn.<br />
              - Cụ thể hóa các ví dụ "Nên làm" và "Tuyệt đối không làm".<br />
              - Đặt giới hạn rõ ràng về số từ và yêu cầu giải thích chi tiết cho từng phương án.
            </p>
          </div>
        </div>
      </div>

      {/* Test AI Generation Modal */}
      {isTestModalOpen && (
        <AIGenerationModal
          open={isTestModalOpen}
          onClose={() => setIsTestModalOpen(false)}
        />
      )}
    </div>
  );
}
