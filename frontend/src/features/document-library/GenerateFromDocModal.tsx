import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles, BookOpen, Layers, ChevronDown, ChevronUp, Plus, Loader2,
  HelpCircle, CheckCircle2, ShieldCheck, ArrowRight, Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { documentApi, apiClient, domainApi, getErrorMessage } from '@/services/api';
import { BloomBadge, DifficultyBadge } from '@/components/ui/Badge';

interface GenerateFromDocModalProps {
  open: boolean;
  onClose: () => void;
  preselectedDocIds?: string[];
  onSuccess?: (questions: any[]) => void;
}

const BLOOM_LEVELS = [
  { value: 'remember', label: 'Nhận biết' },
  { value: 'understand', label: 'Thông hiểu' },
  { value: 'apply', label: 'Vận dụng' },
  { value: 'analyze', label: 'Vận dụng cao' },
];
const DIFFICULTY_LEVELS = [
  { value: 'easy', label: 'Dễ' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'hard', label: 'Khó' },
];
const QUESTION_TYPES = [
  { value: 'mcq', label: 'Trắc nghiệm (MCQ)' },
  { value: 'essay', label: 'Tự luận' },
];

export function GenerateFromDocModal({
  open, onClose, preselectedDocIds = [], onSuccess,
}: GenerateFromDocModalProps) {
  const qc = useQueryClient();

  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(preselectedDocIds);
  const [questionType, setQuestionType] = useState('mcq');
  const [bloomLevel, setBloomLevel] = useState('understand');
  const [difficulty, setDifficulty] = useState('medium');
  const [numQuestions, setNumQuestions] = useState(1);
  const [extraPrompt, setExtraPrompt] = useState('');
  const [autoSave, setAutoSave] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  // Fetch user documents
  const { data: docsData, isLoading: docsLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentApi.list(),
    enabled: open,
    select: (res) => res.data,
  });
  const docs = docsData ?? [];

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDocIds.length) throw new Error('Chưa chọn tài liệu');
      const res = await apiClient.post('/ai/pipeline/from-document', {
        document_ids: selectedDocIds,
        question_type: questionType,
        bloom_level: bloomLevel,
        expected_difficulty: difficulty,
        num_questions: numQuestions,
        extra_prompt: extraPrompt.trim() || undefined,
        auto_save: autoSave,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setResults(data.questions || []);
      toast.success(`Đã sinh ${data.total_generated} câu hỏi từ tài liệu!`);
      onSuccess?.(data.questions || []);
      if (autoSave) {
        qc.invalidateQueries({ queryKey: ['questions'] });
      }
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const toggleDoc = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const handleClose = () => {
    if (results.length > 0) {
      const confirmed = window.confirm(
        'Bạn có câu hỏi vừa sinh từ tài liệu chưa hoàn tất. Bạn có chắc chắn muốn đóng không?'
      );
      if (!confirmed) return;
    }
    setResults([]);
    setSelectedDocIds(preselectedDocIds);
    setExtraPrompt('');
    onClose();
  };

  const getFileTypeIcon = (fileType?: string) => {
    const icons: Record<string, string> = { pdf: '📄', docx: '📝', txt: '📃', md: '📑' };
    return icons[fileType || ''] || '📄';
  };

  return (
    <Modal
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          handleClose();
        }
      }}
      closeOnOutsideClick={false}
      closeOnEscape={false}
      title={
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-gray-900">Sinh câu hỏi từ Kho tài liệu</div>
            <p className="text-xs text-gray-500 font-normal">AI đọc nội dung tài liệu → sinh câu hỏi theo yêu cầu</p>
          </div>
        </div>
      }
      size="xl"
      footer={
        results.length > 0 ? (
          <>
            <Button variant="secondary" onClick={() => setResults([])}>← Tùy chỉnh lại</Button>
            <Button
              onClick={() => {
                qc.invalidateQueries({ queryKey: ['questions'] });
                handleClose();
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Hoàn tất
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={handleClose}>Hủy</Button>
            <Button
              loading={generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
              disabled={!selectedDocIds.length}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Zap className="h-4 w-4 mr-1.5" />
              Kích hoạt AI sinh câu hỏi
            </Button>
          </>
        )
      }
    >
      {results.length === 0 ? (
        <div className="space-y-4">
          {/* Document Selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-2">
              Chọn tài liệu nguồn <span className="text-red-500">*</span>
              <span className="text-xs font-normal text-gray-500 ml-2">({selectedDocIds.length} đã chọn)</span>
            </label>
            {docsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-4 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Đang tải tài liệu...
              </div>
            ) : docs.length === 0 ? (
              <div className="text-center py-6 text-sm text-gray-500 border border-dashed border-gray-300 rounded-xl">
                <BookOpen className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                Kho tài liệu trống. Hãy upload tài liệu trước.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                {docs.map((doc: any) => (
                  <label
                    key={doc.id}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedDocIds.includes(doc.id) ? 'bg-purple-50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedDocIds.includes(doc.id)}
                      onChange={() => toggleDoc(doc.id)}
                      className="rounded text-purple-600"
                    />
                    <span className="text-lg shrink-0">{getFileTypeIcon(doc.file_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                      <p className="text-xs text-gray-400">
                        {doc.topic_tag && <span className="text-purple-600 font-medium">{doc.topic_tag} · </span>}
                        {doc.chunk_count} đoạn · {doc.file_size_kb} KB
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Settings Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Loại câu hỏi</label>
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Mức Bloom</label>
              <select
                value={bloomLevel}
                onChange={(e) => setBloomLevel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                {BLOOM_LEVELS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Độ khó</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                {DIFFICULTY_LEVELS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Số câu hỏi</label>
              <select
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
              >
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} câu</option>)}
              </select>
            </div>
          </div>

          {/* Extra Prompt */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Yêu cầu bổ sung (tùy chọn)
            </label>
            <textarea
              value={extraPrompt}
              onChange={(e) => setExtraPrompt(e.target.value)}
              placeholder="Ví dụ: Tập trung vào phần định nghĩa, Tạo câu hỏi có tình huống thực tế..."
              rows={2}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>

          {/* Auto save toggle */}
          <label className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoSave}
              onChange={(e) => setAutoSave(e.target.checked)}
              className="rounded text-purple-600"
            />
            <span>Tự động lưu câu hỏi đạt chuẩn vào Ngân hàng câu hỏi</span>
          </label>
        </div>
      ) : (
        /* Results View */
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
            <CheckCircle2 className="h-4 w-4" />
            Đã sinh {results.length} câu hỏi từ tài liệu
            {autoSave && <span className="ml-auto text-xs font-normal text-green-600">Đã tự động lưu vào NCHQ</span>}
          </div>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {results.map((item: any, idx: number) => (
              <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded uppercase">
                    {item.question?.type}
                  </span>
                  <BloomBadge level={item.question?.bloom_level} />
                  <DifficultyBadge level={item.question?.expected_difficulty} />
                  <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    item.is_publishable
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {item.is_publishable ? '✓ Đạt chuẩn' : '⚠ Cần xem xét'} · {item.quality_score}%
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-900 whitespace-pre-wrap">{item.question?.stem}</p>
                {item.question?.options?.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {item.question.options.map((opt: any, oi: number) => (
                      <div
                        key={oi}
                        className={`p-2 rounded-lg text-xs border ${
                          opt.is_correct
                            ? 'bg-green-50 border-green-300 text-green-800 font-semibold'
                            : 'bg-gray-50 border-gray-200 text-gray-700'
                        }`}
                      >
                        <span className="font-bold">{opt.label || String.fromCharCode(65 + oi)}.</span> {opt.text}
                      </div>
                    ))}
                  </div>
                )}
                {item.question?.rationale && (
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                    <span className="font-bold flex items-center gap-1"><HelpCircle className="h-3 w-3" /> Giải thích:</span>
                    <p className="mt-0.5 whitespace-pre-wrap">{item.question.rationale}</p>
                  </div>
                )}
                {item.saved_question_id && (
                  <p className="text-xs text-emerald-600 font-medium">✓ Đã lưu vào ngân hàng câu hỏi</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
