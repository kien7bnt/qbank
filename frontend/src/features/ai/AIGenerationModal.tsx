import React, { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  Bot,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  HelpCircle,
  Copy,
  Plus,
  Wand2,
  History,
  ChevronDown,
  ChevronUp,
  FileCode2,
  BookMarked,
  Upload,
  FileText,
  Search,
  Tag,
  X,
  Loader2,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { apiClient, domainApi, questionApi, documentApi, getErrorMessage } from '@/services/api';
import { BloomBadge, DifficultyBadge } from '@/components/ui/Badge';
import { RuleEditorModal } from './RuleEditorModal';

interface AIGenerationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (generatedQuestion: any) => void;
}

const BLOOM_LEVELS = [
  { value: 'remember', label: 'Nhận biết (Remember)' },
  { value: 'understand', label: 'Thông hiểu (Understand)' },
  { value: 'apply', label: 'Vận dụng (Apply)' },
  { value: 'analyze', label: 'Vận dụng cao (Analyze)' },
];

const DIFFICULTY_LEVELS = [
  { value: 'easy', label: 'Dễ' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'hard', label: 'Khó' },
];

const QUESTION_TYPES = [
  { value: 'mcq', label: 'Trắc nghiệm (MCQ)' },
  { value: 'essay', label: 'Tự luận (Essay)' },
  { value: 'coding', label: 'Lập trình (Coding)' },
];

type SourceMode = 'prompt' | 'documents' | 'upload';

export function AIGenerationModal({ open, onClose, onSuccess }: AIGenerationModalProps) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Source Mode State ──────────────────────────────────────────────
  const [sourceMode, setSourceMode] = useState<SourceMode>('prompt');
  const [prompt, setPrompt] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [docSearch, setDocSearch] = useState('');
  const [selectedTopicTag, setSelectedTopicTag] = useState<string | null>(null);

  // Quick upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadTopicTag, setUploadTopicTag] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // ── Generation Settings ────────────────────────────────────────────
  const [questionType, setQuestionType] = useState('mcq');
  const [bloomLevel, setBloomLevel] = useState('understand');
  const [expectedDifficulty, setExpectedDifficulty] = useState('medium');
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [numQuestions, setNumQuestions] = useState(1);

  // ── Rule.md Modal State ────────────────────────────────────────────
  const [showRuleModal, setShowRuleModal] = useState(false);

  // ── Result state ───────────────────────────────────────────────────
  const [result, setResult] = useState<any>(null);
  const [multipleResults, setMultipleResults] = useState<any[]>([]);

  // ── Improve feature ────────────────────────────────────────────────
  const [improvementPrompt, setImprovementPrompt] = useState('');
  const [showImprovePanel, setShowImprovePanel] = useState(false);
  const [previousResults, setPreviousResults] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Fetch domains
  const { data: domainsData } = useQuery({
    queryKey: ['domains'],
    queryFn: () => domainApi.list(),
    enabled: open,
  });
  const domains = domainsData?.data ?? [];
  const selectedDomain = domains.find((d: any) => d.id === selectedDomainId);
  const topics = selectedDomain?.topics ?? [];

  // Fetch user documents
  const { data: docsData, isLoading: docsLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentApi.list(),
    enabled: open && (sourceMode === 'documents' || sourceMode === 'upload'),
    select: (res) => res.data,
  });
  const userDocuments: any[] = docsData ?? [];

  // Filtered documents
  const filteredDocuments = userDocuments.filter((doc) => {
    const matchSearch = !docSearch || doc.title.toLowerCase().includes(docSearch.toLowerCase());
    const matchTag = !selectedTopicTag || doc.topic_tag === selectedTopicTag;
    return matchSearch && matchTag;
  });

  const uniqueTopicTags = Array.from(
    new Set(userDocuments.map((d) => d.topic_tag).filter(Boolean))
  ) as string[];

  // ── Quick Upload Handler ───────────────────────────────────────────
  const handleQuickUpload = async () => {
    if (!uploadFile) return;
    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', uploadTitle.trim() || uploadFile.name);
      if (uploadTopicTag.trim()) formData.append('topic_tag', uploadTopicTag.trim());
      const res = await documentApi.upload(formData);
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['document-topics'] });
      // Auto-select uploaded doc
      setSelectedDocIds((prev) => [...prev, res.data.id]);
      setUploadFile(null);
      setUploadTitle('');
      setUploadTopicTag('');
      setSourceMode('documents');
      toast.success('Đã tải tài liệu vào kho và tự động chọn để sinh câu hỏi!');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsUploading(false);
    }
  };

  // ── Multi-Agent Pipeline Mutation ──────────────────────────────────
  const pipelineMutation = useMutation({
    mutationFn: async () => {
      // If multiple questions from documents requested
      if (sourceMode === 'documents' && selectedDocIds.length > 0 && numQuestions > 1) {
        const res = await apiClient.post('/ai/pipeline/from-document', {
          document_ids: selectedDocIds,
          question_type: questionType,
          bloom_level: bloomLevel,
          expected_difficulty: expectedDifficulty,
          num_questions: numQuestions,
          extra_prompt: prompt.trim() || undefined,
          chapter_id: selectedDomainId || undefined,
          topic_id: selectedTopicId || undefined,
          auto_save: false,
        });
        return { isMultiple: true, ...res.data };
      }

      // Standard multi-agent pipeline (1 question with full 5-agent trace & improve support)
      const res = await apiClient.post('/ai/pipeline/multi-agent', {
        prompt: prompt.trim(),
        document_ids: sourceMode === 'documents' ? selectedDocIds : undefined,
        question_type: questionType,
        bloom_level: bloomLevel,
        expected_difficulty: expectedDifficulty,
        chapter_id: selectedDomainId || undefined,
        topic_id: selectedTopicId || undefined,
        auto_save: false,
      });
      return { isMultiple: false, ...res.data };
    },
    onSuccess: (data) => {
      if (data.isMultiple) {
        setMultipleResults(data.questions || []);
        setResult(null);
        toast.success(`Đã sinh ${data.total_generated} câu hỏi từ tài liệu theo quy tắc AI!`);
      } else {
        setResult(data);
        setMultipleResults([]);
        toast.success('Hệ thống Multi-Agent AI đã sinh và thẩm định câu hỏi thành công!');
      }
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Improve Mutation ───────────────────────────────────────────────
  const improveMutation = useMutation({
    mutationFn: async () => {
      if (!result?.question) throw new Error('Không có câu hỏi để cải thiện');
      if (!improvementPrompt.trim()) throw new Error('Vui lòng nhập yêu cầu cải thiện');
      const q = result.question;
      const res = await apiClient.post('/ai/questions/improve', {
        original_stem: q.stem,
        original_options: q.options,
        original_rationale: q.rationale,
        original_bloom_level: q.bloom_level,
        original_difficulty: q.expected_difficulty,
        question_type: q.type,
        improvement_prompt: improvementPrompt.trim(),
      });
      return res.data;
    },
    onSuccess: (data) => {
      setPreviousResults((prev) => [result, ...prev].slice(0, 5));
      setResult({
        ...result,
        question: data.question,
        quality_score: data.quality_score,
        is_publishable: data.is_publishable,
        improvement_applied: data.improvement_applied,
      });
      setImprovementPrompt('');
      setShowImprovePanel(false);
      toast.success('Câu hỏi đã được cải thiện thành công theo quy tắc!');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // ── Save to Question Bank Mutation ─────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const cleanQuestion = (q: any) => {
        let qType = (q.type || 'mcq').toLowerCase();
        if (['single_choice', 'multiple_choice', 'true_false'].includes(qType)) {
          qType = 'mcq';
        }
        return {
          type: qType,
          stem: q.stem || '',
          rationale: q.rationale || undefined,
          bloom_level: q.bloom_level || 'understand',
          expected_difficulty: q.expected_difficulty || 'medium',
          chapter_id: (q.chapter_id && q.chapter_id !== '') ? q.chapter_id : (selectedDomainId || undefined),
          topic_id: (q.topic_id && q.topic_id !== '') ? q.topic_id : (selectedTopicId || undefined),
          options: (q.options || []).map((o: any, idx: number) => ({
            label: o.label || String.fromCharCode(65 + idx),
            text: o.text || '',
            is_correct: Boolean(o.is_correct),
            distractor_reason: o.distractor_reason || undefined,
            order_index: typeof o.order_index === 'number' ? o.order_index : idx,
          })),
          essay_data: qType === 'essay' && q.essay_data ? q.essay_data : undefined,
          coding_data: qType === 'coding' && q.coding_data ? q.coding_data : undefined,
        };
      };

      if (multipleResults.length > 0) {
        // Save batch in a single atomic transaction
        const questionsToSave = multipleResults.map((item) => cleanQuestion(item.question));
        return await questionApi.createBatch({
          chapter_id: selectedDomainId || undefined,
          topic_id: selectedTopicId || undefined,
          questions: questionsToSave,
        });
      }

      if (!result?.question) return;
      const payload = cleanQuestion(result.question);
      return await questionApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions'] });
      qc.invalidateQueries({ queryKey: ['domains'] });
      toast.success('Đã lưu câu hỏi vào Ngân hàng câu hỏi!');
      onSuccess?.(result?.question || multipleResults);
      handleReset();
      onClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const toggleDoc = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const handleReset = () => {
    setPrompt('');
    setSelectedDocIds([]);
    setResult(null);
    setMultipleResults([]);
    setImprovementPrompt('');
    setShowImprovePanel(false);
    setPreviousResults([]);
    setShowHistory(false);
    setSourceMode('prompt');
    setUploadFile(null);
  };

  const handleClose = () => {
    if (result || multipleResults.length > 0) {
      const confirmed = window.confirm(
        'Bạn có câu hỏi AI đang tạo chưa lưu vào Ngân hàng. Bạn có chắc chắn muốn đóng và hủy bỏ kết quả không?'
      );
      if (!confirmed) {
        return;
      }
    }
    handleReset();
    onClose();
  };

  const restoreVersion = (old: any) => {
    setResult(old);
    setPreviousResults((prev) => prev.filter((p) => p !== old));
    setShowHistory(false);
  };

  const isFormValid = () => {
    if (sourceMode === 'prompt') return prompt.trim().length > 0;
    if (sourceMode === 'documents') return selectedDocIds.length > 0;
    if (sourceMode === 'upload') return !!uploadFile;
    return false;
  };

  return (
    <>
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
          <div className="flex items-center justify-between w-full pr-6">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-gray-900 flex items-center gap-2">
                  Multi-Agent AI Question Studio
                  <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-mono font-semibold uppercase">
                    5 Agents Co-Pilot
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-normal">
                  Sinh câu hỏi từ Prompt hoặc Kho tài liệu cá nhân · Tuân thủ quy tắc sư phạm
                </p>
              </div>
            </div>

            {/* Rule.md Trigger Button */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowRuleModal(true)}
              className="gap-1.5 border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 text-xs shrink-0"
              title="Xem và chỉnh sửa các quy tắc sư phạm AI bắt buộc tuân theo"
            >
              <FileCode2 className="h-3.5 w-3.5 text-amber-700" />
              Quy tắc AI (rule.md)
            </Button>
          </div>
        }
        size="xl"
        footer={
          result || multipleResults.length > 0 ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setResult(null);
                  setMultipleResults([]);
                }}
              >
                Tùy chỉnh & Tạo lại
              </Button>
              <Button
                loading={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Lưu vào Ngân hàng câu hỏi {multipleResults.length > 0 ? `(${multipleResults.length} câu)` : ''}
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={handleClose}>
                Hủy
              </Button>
              <Button
                loading={pipelineMutation.isPending || isUploading}
                onClick={async () => {
                  if (sourceMode === 'upload' && uploadFile) {
                    await handleQuickUpload();
                    return;
                  }
                  if (!isFormValid()) {
                    toast.error(
                      sourceMode === 'documents'
                        ? 'Vui lòng chọn ít nhất 1 tài liệu'
                        : 'Vui lòng nhập yêu cầu nội dung'
                    );
                    return;
                  }
                  pipelineMutation.mutate();
                }}
                disabled={!isFormValid() && !uploadFile}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Zap className="h-4 w-4 mr-1.5" />
                Kích hoạt Multi-Agent AI
              </Button>
            </>
          )
        }
      >
        {!result && multipleResults.length === 0 ? (
          <div className="space-y-4">
            {/* Source Mode Tabs */}
            <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setSourceMode('prompt')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  sourceMode === 'prompt'
                    ? 'bg-white text-purple-900 shadow-xs border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                1. Nhập yêu cầu / Prompt
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('documents')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  sourceMode === 'documents'
                    ? 'bg-white text-purple-900 shadow-xs border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <BookMarked className="h-3.5 w-3.5 text-blue-600" />
                2. Chọn từ Kho tài liệu ({selectedDocIds.length} đã chọn)
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('upload')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  sourceMode === 'upload'
                    ? 'bg-white text-purple-900 shadow-xs border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Upload className="h-3.5 w-3.5 text-emerald-600" />
                3. Tải lên tài liệu mới
              </button>
            </div>

            {/* TAB 1: Prompt Mode */}
            {sourceMode === 'prompt' && (
              <div>
                <label className="block text-xs font-semibold text-gray-800 mb-1">
                  Yêu cầu nội dung / Kiến thức cần tạo <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ví dụ: Tạo câu hỏi trắc nghiệm về đạo hàm của hàm số lượng giác y = sin(2x), có bẫy về hệ số 2 và dấu của đạo hàm..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            )}

            {/* TAB 2: Document Library Selection Mode */}
            {sourceMode === 'documents' && (
              <div className="space-y-3 bg-blue-50/40 p-3.5 rounded-xl border border-blue-200/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <BookMarked className="h-4 w-4 text-blue-600" />
                    Chọn tài liệu làm ngữ cảnh sinh câu hỏi:
                  </span>
                  {selectedDocIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedDocIds([])}
                      className="text-[11px] text-red-600 hover:underline"
                    >
                      Bỏ chọn tất cả ({selectedDocIds.length})
                    </button>
                  )}
                </div>

                {/* Search & Topic filter */}
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={docSearch}
                      onChange={(e) => setDocSearch(e.target.value)}
                      placeholder="Tìm tài liệu theo tên..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  {uniqueTopicTags.length > 0 && (
                    <select
                      value={selectedTopicTag || ''}
                      onChange={(e) => setSelectedTopicTag(e.target.value || null)}
                      className="text-xs bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="">Tất cả chủ đề</option>
                      {uniqueTopicTags.map((tag) => (
                        <option key={tag} value={tag}>
                          {tag}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Documents List */}
                {docsLoading ? (
                  <div className="py-6 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> Đang tải kho tài liệu...
                  </div>
                ) : filteredDocuments.length === 0 ? (
                  <div className="py-6 text-center text-xs text-gray-500 bg-white rounded-lg border border-dashed border-gray-300 p-4">
                    <BookMarked className="h-6 w-6 mx-auto text-gray-300 mb-1" />
                    {userDocuments.length === 0
                      ? 'Kho tài liệu của bạn đang trống. Hãy chọn tab "3. Tải lên tài liệu mới" để nạp tài liệu.'
                      : 'Không tìm thấy tài liệu phù hợp với từ khóa.'}
                  </div>
                ) : (
                  <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                    {filteredDocuments.map((doc) => {
                      const isChecked = selectedDocIds.includes(doc.id);
                      return (
                        <label
                          key={doc.id}
                          className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-blue-50 border-blue-300 text-blue-950 font-medium'
                              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleDoc(doc.id)}
                            className="rounded text-blue-600"
                          />
                          <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="truncate block font-semibold">{doc.title}</span>
                            <span className="text-[10px] text-gray-400">
                              {doc.topic_tag && (
                                <span className="text-blue-600 font-medium mr-1.5">
                                  #{doc.topic_tag}
                                </span>
                              )}
                              {doc.file_type?.toUpperCase()} · {doc.chunk_count} đoạn
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Extra Prompt when using documents */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Yêu cầu bổ sung khi sinh từ tài liệu (tùy chọn):
                  </label>
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ví dụ: Tập trung vào phần định lý, Tạo câu hỏi dạng thực hành..."
                    className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* TAB 3: Quick Upload Mode */}
            {sourceMode === 'upload' && (
              <div className="space-y-3 bg-emerald-50/40 p-3.5 rounded-xl border border-emerald-200/80">
                <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <Upload className="h-4 w-4 text-emerald-600" />
                  Tải tài liệu mới và nạp vào kho để sinh câu hỏi ngay:
                </span>

                <div
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                    uploadFile
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-300 hover:border-emerald-400 bg-white'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadFile ? (
                    <div className="flex items-center justify-center gap-2 text-emerald-800 font-semibold text-xs">
                      <FileText className="h-5 w-5 text-emerald-600" />
                      <span>{uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadFile(null);
                        }}
                        className="text-gray-400 hover:text-red-500 ml-2"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="h-5 w-5 text-gray-400 mx-auto" />
                      <p className="text-xs font-medium text-gray-700">Nhấn hoặc kéo thả file vào đây</p>
                      <p className="text-[10px] text-gray-400">PDF, DOCX, TXT, MD (Tối đa 20MB)</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.txt,.md"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setUploadFile(f);
                      if (!uploadTitle) setUploadTitle(f.name.replace(/\.[^.]+$/, ''));
                    }
                  }}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Tên tài liệu..."
                    className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={uploadTopicTag}
                    onChange={(e) => setUploadTopicTag(e.target.value)}
                    placeholder="Chủ đề (ví dụ: Toán 12, Python...)"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    loading={isUploading}
                    onClick={handleQuickUpload}
                    disabled={!uploadFile}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Nạp vào kho & chọn tài liệu
                  </Button>
                </div>
              </div>
            )}

            {/* Grid Settings */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Loại câu hỏi
                </label>
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Mức độ Bloom
                </label>
                <select
                  value={bloomLevel}
                  onChange={(e) => setBloomLevel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  {BLOOM_LEVELS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Độ khó dự kiến
                </label>
                <select
                  value={expectedDifficulty}
                  onChange={(e) => setExpectedDifficulty(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  {DIFFICULTY_LEVELS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Số lượng câu hỏi
                </label>
                <select
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} câu {n > 1 ? '(Multi-Batch)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Domain & Topic Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Lĩnh vực kiến thức
                </label>
                <select
                  value={selectedDomainId}
                  onChange={(e) => {
                    setSelectedDomainId(e.target.value);
                    setSelectedTopicId('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  <option value="">— Tự động phân loại —</option>
                  {domains.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Chủ đề con
                </label>
                <select
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  disabled={!selectedDomainId}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">— Tự động phân loại —</option>
                  {topics.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Multi-Agent Architecture Notice */}
            <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl flex items-center justify-between text-xs text-purple-900">
              <span className="flex items-center gap-1.5 font-medium">
                <Bot className="h-4 w-4 text-purple-600 shrink-0" />
                Hệ thống 5 AI Agents tự động phối hợp sinh stem, 3 bẫy tư duy, Bloom & thẩm định chất lượng theo <code>rule.md</code>.
              </span>
              <button
                type="button"
                onClick={() => setShowRuleModal(true)}
                className="text-amber-800 hover:text-amber-950 font-bold underline shrink-0 text-[11px]"
              >
                Chỉnh quy tắc
              </button>
            </div>
          </div>
        ) : (
          /* Multi-Agent Results View */
          <div className="space-y-4">
            {/* Multiple Results Mode */}
            {multipleResults.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Đã sinh {multipleResults.length} câu hỏi theo quy tắc sư phạm
                </div>
                <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                  {multipleResults.map((item, idx) => (
                    <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded uppercase">
                          Câu {idx + 1} · {item.question?.type}
                        </span>
                        <BloomBadge level={item.question?.bloom_level} />
                        <DifficultyBadge level={item.question?.expected_difficulty} />
                        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                          Chất lượng: {item.quality_score}%
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 whitespace-pre-wrap">
                        {item.question?.stem}
                      </p>
                      {item.question?.options?.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {item.question.options.map((opt: any, oi: number) => (
                            <div
                              key={oi}
                              className={`p-2 rounded-lg text-xs border ${
                                opt.is_correct
                                  ? 'bg-green-50 border-green-300 text-green-900 font-semibold'
                                  : 'bg-gray-50 border-gray-200 text-gray-700'
                              }`}
                            >
                              <span className="font-bold">{opt.label || String.fromCharCode(65 + oi)}.</span> {opt.text}
                            </div>
                          ))}
                        </div>
                      )}
                      {item.question?.rationale && (
                        <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-950">
                          <span className="font-bold text-blue-800">Lời giải chi tiết:</span> {item.question.rationale}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Single Result Mode (with Trace & Improve Panel) */}
            {result && (
              <>
                {/* Agent Execution Traces Bar */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Tiến trình thực thi Multi-Agent (5 Agents hoàn tất)
                      {result.improvement_applied && (
                        <span className="ml-2 text-[10px] font-normal text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                          ✨ Đã cải thiện
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Chất lượng: {result.quality_score}%
                      </span>
                      {result.duplicate_score !== undefined && (
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          Trùng lặp: {result.duplicate_score}%
                        </span>
                      )}
                    </div>
                  </div>

                  {result.traces && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                      {result.traces?.map((trace: any, idx: number) => (
                        <div
                          key={idx}
                          className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs space-y-1"
                        >
                          <div className="flex items-center justify-between font-semibold text-gray-900 text-[11px]">
                            <span>{trace.role}</span>
                            <span className="text-gray-400 font-mono">{trace.time_ms}ms</span>
                          </div>
                          <p className="text-[11px] text-gray-500 line-clamp-1">{trace.output_summary}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Question Preview Card */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-gray-100">
                    <span className="text-xs font-bold text-purple-700 uppercase bg-purple-50 px-2 py-0.5 rounded">
                      {result.question?.type?.toUpperCase()}
                    </span>
                    <BloomBadge level={result.question?.bloom_level} />
                    <DifficultyBadge level={result.question?.expected_difficulty} />
                    {result.is_publishable && (
                      <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full border border-emerald-200 ml-auto flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" /> Đạt chuẩn xuất bản
                      </span>
                    )}
                  </div>

                  {/* Applied improvement badge */}
                  {result.improvement_applied && (
                    <div className="text-[11px] text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                      <Wand2 className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        <strong>Đã áp dụng yêu cầu cải thiện:</strong> {result.improvement_applied}
                      </span>
                    </div>
                  )}

                  {/* Stem */}
                  <div>
                    <p className="text-sm font-semibold text-gray-900 whitespace-pre-wrap">
                      {result.question?.stem}
                    </p>
                  </div>

                  {/* Options */}
                  {result.question?.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {result.question.options.map((opt: any, idx: number) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-lg border text-xs transition-colors ${
                            opt.is_correct
                              ? 'bg-green-50/80 border-green-300 text-green-900 font-semibold'
                              : 'bg-gray-50 border-gray-200 text-gray-700'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="font-bold shrink-0">
                              {opt.label || String.fromCharCode(65 + idx)}.
                            </span>
                            <div>
                              <span>{opt.text}</span>
                              {opt.distractor_reason && (
                                <p className="text-[10px] text-gray-400 font-normal mt-0.5">
                                  Bẫy tư duy: {opt.distractor_reason}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Rationale */}
                  {result.question?.rationale && (
                    <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg text-xs text-blue-950 space-y-1">
                      <span className="font-bold flex items-center gap-1 text-blue-800">
                        <HelpCircle className="h-3.5 w-3.5" /> Lời giải chi tiết:
                      </span>
                      <p className="text-blue-900 whitespace-pre-wrap">{result.question.rationale}</p>
                    </div>
                  )}
                </div>

                {/* ── Improve Question Panel ── */}
                <div className="border border-purple-200 rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 hover:bg-purple-100 transition-colors text-sm font-semibold text-purple-800"
                    onClick={() => setShowImprovePanel((p) => !p)}
                  >
                    <span className="flex items-center gap-2">
                      <Wand2 className="h-4 w-4" />
                      Cải thiện câu hỏi theo yêu cầu của bạn
                    </span>
                    {showImprovePanel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>

                  {showImprovePanel && (
                    <div className="p-4 bg-white space-y-3">
                      <p className="text-xs text-gray-500">
                        Nhập yêu cầu cải thiện, ví dụ: <em>"Làm câu hỏi khó hơn"</em>, <em>"Thêm tình huống thực tế"</em>, <em>"Viết lại ngắn gọn hơn"</em>...
                      </p>
                      <textarea
                        value={improvementPrompt}
                        onChange={(e) => setImprovementPrompt(e.target.value)}
                        placeholder="Nhập yêu cầu cải thiện câu hỏi..."
                        rows={2}
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                      />
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex flex-wrap gap-1.5">
                          {['Làm câu hỏi khó hơn', 'Thêm ngữ cảnh thực tế', 'Viết lại ngắn gọn hơn', 'Tăng tính bẫy'].map((s) => (
                            <button
                              key={s}
                              onClick={() => setImprovementPrompt(s)}
                              className="text-[11px] px-2 py-1 border border-purple-200 text-purple-700 bg-purple-50 rounded-full hover:bg-purple-100 transition-colors"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          loading={improveMutation.isPending}
                          onClick={() => {
                            if (!improvementPrompt.trim()) {
                              toast.error('Vui lòng nhập yêu cầu cải thiện');
                              return;
                            }
                            improveMutation.mutate();
                          }}
                          className="bg-purple-600 hover:bg-purple-700 text-white shrink-0"
                        >
                          <Wand2 className="h-3.5 w-3.5 mr-1.5" />
                          Cải thiện
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Version History */}
                {previousResults.length > 0 && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors text-xs font-semibold text-gray-700"
                      onClick={() => setShowHistory((p) => !p)}
                    >
                      <span className="flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5" />
                        Lịch sử phiên bản ({previousResults.length})
                      </span>
                      {showHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    {showHistory && (
                      <div className="divide-y divide-gray-100">
                        {previousResults.map((old, idx) => (
                          <div key={idx} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50">
                            <span className="text-[10px] text-gray-400 font-mono shrink-0 mt-0.5">
                              v{previousResults.length - idx}
                            </span>
                            <p className="text-xs text-gray-600 flex-1 line-clamp-2">{old.question?.stem}</p>
                            <button
                              onClick={() => restoreVersion(old)}
                              className="text-[11px] text-blue-600 hover:underline shrink-0"
                            >
                              Khôi phục
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Rule.md Editor Modal */}
      <RuleEditorModal
        open={showRuleModal}
        onClose={() => setShowRuleModal(false)}
      />
    </>
  );
}
