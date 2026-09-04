import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  Sparkles,
  FileText,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Folder,
  FileUp,
  HelpCircle,
  Eye,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { questionApi, domainApi, getErrorMessage } from '@/services/api';

interface ImportQuestionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultChapterId?: string;
  defaultTopicId?: string;
}

interface ParsedOption {
  label: string;
  text: string;
  is_correct: boolean;
}

interface ParsedQuestion {
  id?: string;
  type: string;
  stem: string;
  options: ParsedOption[];
  rationale?: string;
  bloom_level: string;
  expected_difficulty: string;
}

const SAMPLE_TEXT = `Câu 1: Cho hàm số y = x^4 - 2x^2 + 1. Điểm cực đại của đồ thị hàm số là:
A. (0; 1)
B. (1; 0)
C. (-1; 0)
D. (0; 0)
Đáp án: A
Lời giải: Ta có y' = 4x^3 - 4x = 0 <=> x=0, x=1, x=-1. Tại x=0 là điểm cực đại y(0)=1.

Câu 2: Số nghiệm của phương trình log_2(x - 1) = 3 là:
A. 1
B. 2
C. 3
D. 0
Đáp án: A
Giải thích: Điều kiện x > 1. Phương trình tương đương x - 1 = 2^3 = 8 => x = 9 (nhận).

Câu 3: Nguyên hàm của hàm số f(x) = 2x + 1 là:
A. x^2 + x + C
B. 2x^2 + x + C
C. x^2 + C
D. 2x + C
Đáp án: A`;

export function ImportQuestionsModal({
  open,
  onOpenChange,
  defaultChapterId,
  defaultTopicId,
}: ImportQuestionsModalProps) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [rawText, setRawText] = useState(SAMPLE_TEXT);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDomainId, setSelectedDomainId] = useState(defaultChapterId || '');
  const [selectedTopicId, setSelectedTopicId] = useState(defaultTopicId || '');
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
  const [isParsing, setIsParsing] = useState(false);

  // Load Domains & Topics
  const { data: domainsData } = useQuery({
    queryKey: ['curriculum-domains'],
    queryFn: () => domainApi.list(),
    enabled: open,
  });

  const domains = Array.isArray(domainsData?.data) ? domainsData.data : [];
  const currentDomain = domains.find((d: any) => d.id === selectedDomainId);
  const availableTopics = currentDomain?.topics || [];

  useEffect(() => {
    if (defaultChapterId) setSelectedDomainId(defaultChapterId);
    if (defaultTopicId) setSelectedTopicId(defaultTopicId);
  }, [defaultChapterId, defaultTopicId]);

  // Client-side text parser fallback & live parser
  const parseRawText = (text: string) => {
    const chunks = text.split(/(?=(?:^|\n)\s*(?:Câu\s*\d+|Question\s*\d+|\d+\.)[:\.\s])/i).filter((c) => c.trim().length > 0);
    const questions: ParsedQuestion[] = [];

    for (const chunk of chunks) {
      const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) continue;

      const firstLine = lines[0];
      const stemMatch = firstLine.replace(/^(?:Câu\s*\d+|Question\s*\d+|\d+\.)[:\.\s]*/i, '');
      const stemLines = [stemMatch];
      const options: ParsedOption[] = [];
      let correctLabels: string[] = [];
      let rationale = '';
      let inOptions = false;

      for (const line of lines.slice(1)) {
        const ansMatch = line.match(/(?:Đáp\s*án|Answer|Đ\/A)[:\s]*([A-D,\s]+)/i);
        if (ansMatch) {
          const rawAns = ansMatch[1].toUpperCase();
          ['A', 'B', 'C', 'D'].forEach((char) => {
            if (rawAns.includes(char)) correctLabels.push(char);
          });
          continue;
        }

        const expMatch = line.match(/(?:Giải\s*thích|Lời\s*giải|Explanation)[:\s]*(.*)/i);
        if (expMatch) {
          rationale = expMatch[1].trim();
          continue;
        }

        const optMatch = line.match(/^([A-D])[\.\)\:\-]\s*(.*)/i);
        if (optMatch) {
          inOptions = true;
          options.push({
            label: optMatch[1].toUpperCase(),
            text: optMatch[2].trim(),
            is_correct: false,
          });
        } else {
          if (inOptions) {
            if (rationale) {
              rationale += ' ' + line;
            } else if (options.length > 0) {
              options[options.length - 1].text += ' ' + line;
            }
          } else {
            stemLines.push(line);
          }
        }
      }

      if (correctLabels.length === 0) correctLabels = ['A'];
      options.forEach((opt) => {
        if (correctLabels.includes(opt.label)) {
          opt.is_correct = true;
        }
      });

      if (options.length > 0 && !options.some((o) => o.is_correct)) {
        options[0].is_correct = true;
      }

      const stem = stemLines.join(' ').trim() || chunk.slice(0, 100);

      questions.push({
        type: options.length > 0 ? 'mcq' : 'essay',
        stem,
        options,
        rationale: rationale || undefined,
        bloom_level: 'understand',
        expected_difficulty: 'medium',
      });
    }

    return questions;
  };

  // Initial parse on modal open with sample text
  useEffect(() => {
    if (open && parsedQuestions.length === 0) {
      const initial = parseRawText(rawText);
      setParsedQuestions(initial);
    }
  }, [open]);

  // Handle File Upload & Server-side parsing
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsParsing(true);
    toast.loading('Đang xử lý và bóc tách file...', { id: 'parse-file' });

    try {
      const res = await questionApi.parseFile(file);
      const parsed = res.data.questions || [];
      if (parsed.length > 0) {
        setParsedQuestions(parsed);
        toast.success(`✨ Đã nhận diện thành công ${parsed.length} câu hỏi từ file!`, { id: 'parse-file' });
      } else {
        if (res.data.raw_text) {
          const clientParsed = parseRawText(res.data.raw_text);
          setParsedQuestions(clientParsed);
          toast.success(`✨ Đã nhận diện ${clientParsed.length} câu hỏi từ file!`, { id: 'parse-file' });
        } else {
          toast.error('Không tìm thấy câu hỏi nào trong file!', { id: 'parse-file' });
        }
      }
    } catch (err) {
      toast.error(`Lỗi bóc tách file: ${getErrorMessage(err)}`, { id: 'parse-file' });
    } finally {
      setIsParsing(false);
    }
  };

  // Handle Text parse button click
  const handleParseText = () => {
    if (!rawText.trim()) {
      toast.error('Vui lòng nhập hoặc dán nội dung văn bản');
      return;
    }
    const questions = parseRawText(rawText);
    setParsedQuestions(questions);
    if (questions.length > 0) {
      toast.success(`✨ Đã trích xuất ${questions.length} câu hỏi!`);
    } else {
      toast.error('Không nhận diện được câu hỏi nào theo định dạng Câu 1:... A. B. C. D.');
    }
  };

  // Remove question from preview
  const handleRemoveQuestion = (index: number) => {
    setParsedQuestions((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Batch import mutation
  const batchImportMutation = useMutation({
    mutationFn: () => {
      const payloadQuestions = parsedQuestions.map((q) => ({
        type: q.type,
        stem: q.stem,
        rationale: q.rationale,
        bloom_level: q.bloom_level,
        expected_difficulty: q.expected_difficulty,
        chapter_id: selectedDomainId || undefined,
        topic_id: selectedTopicId || undefined,
        options:
          q.type === 'mcq'
            ? q.options.map((opt, idx) => ({
                label: opt.label || String.fromCharCode(65 + idx),
                text: opt.text,
                is_correct: opt.is_correct,
                order_index: idx,
              }))
            : undefined,
        essay_data:
          q.type === 'essay'
            ? {
                sample_answer: q.rationale || '',
                max_points: 10.0,
              }
            : undefined,
      }));

      return questionApi.createBatch({
        chapter_id: selectedDomainId || undefined,
        topic_id: selectedTopicId || undefined,
        questions: payloadQuestions,
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['questions'] });
      qc.invalidateQueries({ queryKey: ['curriculum-domains'] });
      qc.invalidateQueries({ queryKey: ['curriculum-tree'] });
      toast.success(
        `🎉 ${res.data.message || `Đã nhập thành công ${parsedQuestions.length} câu hỏi vào ngân hàng!`}`
      );
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary-600" />
          <span>Tải Lên Nhiều Câu Hỏi Cùng Lúc</span>
        </div>
      }
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-gray-500">
            {parsedQuestions.length > 0 ? (
              <span className="text-primary-700 font-semibold">
                ✓ Sẵn sàng nhập {parsedQuestions.length} câu hỏi vào hệ thống
              </span>
            ) : (
              <span>Chưa có câu hỏi nào được nhận diện</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button
              disabled={parsedQuestions.length === 0}
              loading={batchImportMutation.isPending || isParsing}
              onClick={() => batchImportMutation.mutate()}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Lưu {parsedQuestions.length} câu vào ngân hàng
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Destination folder selection */}
        <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
            Thư mục lưu trữ câu hỏi
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Lĩnh vực / Chương
              </label>
              <select
                value={selectedDomainId}
                onChange={(e) => {
                  setSelectedDomainId(e.target.value);
                  setSelectedTopicId('');
                }}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="">— Mặc định (Tất cả câu hỏi) —</option>
                {domains.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Chủ đề con (Tùy chọn)
              </label>
              <select
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                disabled={!selectedDomainId || availableTopics.length === 0}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-primary-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">— Chọn chủ đề con —</option>
                {availableTopics.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Source selector tabs */}
        <div className="flex border-b border-gray-200 gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`pb-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'upload'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileUp className="h-4 w-4" />
            Tải lên File (.docx, .txt, .pdf, .json)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`pb-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'paste'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="h-4 w-4" />
            Dán văn bản trực tiếp
          </button>
        </div>

        {/* Tab Content: Upload File */}
        {activeTab === 'upload' && (
          <div className="space-y-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 hover:border-primary-500 bg-gray-50/60 hover:bg-primary-50/20 rounded-2xl p-6 text-center cursor-pointer transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.txt,.pdf,.json,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="mx-auto w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 mb-2">
                <FileUp className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-gray-800">
                {selectedFile ? selectedFile.name : 'Bấm vào đây hoặc kéo thả file đề thi vào'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Hỗ trợ định dạng: Word (.docx), Văn bản (.txt), PDF (.pdf), hoặc JSON
              </p>
            </div>
          </div>
        )}

        {/* Tab Content: Paste Text */}
        {activeTab === 'paste' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-gray-700">
                Dán nội dung các câu hỏi (Định dạng: Câu 1: ... A. ... B. ... C. ... D. ... Đáp án: ...)
              </label>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={handleParseText}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1 text-purple-600" />
                Trích xuất câu hỏi
              </Button>
            </div>
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={6}
              className="font-mono text-xs"
              placeholder="Dán câu hỏi tại đây..."
            />
          </div>
        )}

        {/* Live Preview List of Questions */}
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                Xem trước câu hỏi đã nhận diện ({parsedQuestions.length})
              </h4>
              <span className="text-[11px] bg-green-50 text-green-700 font-semibold px-2 py-0.5 rounded-full border border-green-200">
                ✓ Hợp lệ
              </span>
            </div>
            {parsedQuestions.length > 0 && (
              <button
                type="button"
                onClick={() => setParsedQuestions([])}
                className="text-[11px] text-red-500 hover:text-red-700 hover:underline cursor-pointer"
              >
                Xóa tất cả xem trước
              </button>
            )}
          </div>

          {parsedQuestions.length === 0 ? (
            <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-xs">
              Chưa có câu hỏi nào. Vui lòng tải file hoặc dán văn bản và bấm "Trích xuất câu hỏi".
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1">
              {parsedQuestions.map((q, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-gray-200 rounded-xl p-3 text-xs shadow-2xs hover:border-primary-200 transition-all space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-primary-700 shrink-0">
                        Câu {idx + 1}:
                      </span>
                      <span className="text-gray-900 font-medium truncate">
                        {q.stem}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded uppercase font-semibold">
                        {q.type === 'mcq' ? 'Trắc nghiệm' : 'Tự luận'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(idx)}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                        title="Loại bỏ câu này"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Options preview for MCQ */}
                  {q.type === 'mcq' && q.options && q.options.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                      {q.options.map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className={`px-2 py-1 rounded-md border text-[11px] truncate flex items-center gap-1 ${
                            opt.is_correct
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                              : 'bg-gray-50 border-gray-200 text-gray-600'
                          }`}
                          title={`${opt.label}. ${opt.text}`}
                        >
                          <span className="font-mono shrink-0">{opt.label}.</span>
                          <span className="truncate">{opt.text}</span>
                          {opt.is_correct && (
                            <Check className="h-3 w-3 text-emerald-600 shrink-0 ml-auto" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Rationale preview */}
                  {q.rationale && (
                    <p className="text-[11px] text-gray-500 italic bg-gray-50 px-2 py-1 rounded">
                      💡 <strong>Giải thích:</strong> {q.rationale}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
