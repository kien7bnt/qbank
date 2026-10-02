import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Minus, CheckCircle, Award, Code2, Terminal, Trash2, Eye, EyeOff, Copy, Clock, Cpu, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { questionApi, curriculumApi, rubricApi, getErrorMessage } from '@/services/api';
import type { QuestionType } from '@/types';

const AVAILABLE_LANGUAGES = [
  { id: 'python', label: 'Python 3' },
  { id: 'cpp', label: 'C++' },
  { id: 'c', label: 'C' },
  { id: 'java', label: 'Java' },
  { id: 'javascript', label: 'JavaScript' },
];

interface CreateQuestionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultChapterId?: string;
  defaultTopicId?: string;
}

interface OptionForm {
  label: string;
  text: string;
  is_correct: boolean;
  distractor_reason: string;
}

const INITIAL_OPTIONS: OptionForm[] = [
  { label: 'A', text: '', is_correct: false, distractor_reason: '' },
  { label: 'B', text: '', is_correct: false, distractor_reason: '' },
  { label: 'C', text: '', is_correct: false, distractor_reason: '' },
  { label: 'D', text: '', is_correct: false, distractor_reason: '' },
];

const BLOOM_OPTIONS = [
  { value: '', label: '— Chọn Bloom —' },
  { value: 'remember', label: 'Nhớ' },
  { value: 'understand', label: 'Hiểu' },
  { value: 'apply', label: 'Vận dụng' },
  { value: 'analyze', label: 'Vận dụng cao' },
];

const DIFFICULTY_OPTIONS = [
  { value: '', label: '— Chọn độ khó —' },
  { value: 'easy', label: 'Dễ' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'hard', label: 'Khó' },
];

export function CreateQuestionModal({
  open,
  onOpenChange,
  defaultChapterId,
  defaultTopicId,
}: CreateQuestionModalProps) {
  const qc = useQueryClient();
  const [step, setStep] = useState<'type' | 'form'>('type');
  const [type, setType] = useState<QuestionType>('mcq');
  const [showMetadata, setShowMetadata] = useState(false);

  // Form state
  const [stem, setStem] = useState('');
  const [rationale, setRationale] = useState('');
  const [options, setOptions] = useState<OptionForm[]>(INITIAL_OPTIONS);
  const [bloom, setBloom] = useState('');
  const [difficulty, setDifficulty] = useState('');
  // Essay
  const [sampleAnswer, setSampleAnswer] = useState('');
  const [maxPoints, setMaxPoints] = useState('10');
  const [rubricId, setRubricId] = useState('');

  // Coding
  const [inputFormat, setInputFormat] = useState('');
  const [outputFormat, setOutputFormat] = useState('');
  const [constraints, setConstraints] = useState('');
  const [sampleInput, setSampleInput] = useState('');
  const [sampleOutput, setSampleOutput] = useState('');
  const [timeLimitMs, setTimeLimitMs] = useState('1000');
  const [memoryLimitMb, setMemoryLimitMb] = useState('256');
  const [allowedLanguages, setAllowedLanguages] = useState<string[]>(['python', 'cpp', 'c', 'java', 'javascript']);
  const [starterCode, setStarterCode] = useState('');
  const [testCases, setTestCases] = useState<Array<{ input: string; output: string; is_hidden: boolean }>>([
    { input: '', output: '', is_hidden: false },
  ]);

  // Fetch rubrics for essay selection
  const { data: rubricsList } = useQuery({
    queryKey: ['rubrics'],
    queryFn: async () => {
      const res = await rubricApi.list();
      return res.data;
    },
    enabled: open && type === 'essay',
  });

  const mutation = useMutation({
    mutationFn: () => {
      const payload: any = {
        type,
        stem,
        rationale: rationale || undefined,
        bloom_level: bloom || undefined,
        expected_difficulty: difficulty || undefined,
        chapter_id: defaultChapterId || undefined,
        topic_id: defaultTopicId || undefined,
      };

      if (type === 'mcq') {
        payload.options = options.map((o, i) => ({
          label: o.label,
          text: o.text,
          is_correct: o.is_correct,
          distractor_reason: o.distractor_reason || undefined,
          order_index: i,
        }));
      }

      if (type === 'essay') {
        payload.essay_data = {
          sample_answer: sampleAnswer || undefined,
          max_points: Number(maxPoints) || 10,
          rubric_id: rubricId || undefined,
        };
      }

      if (type === 'coding') {
        const validTestCases = testCases
          .filter((tc) => tc.input.trim() || tc.output.trim())
          .map((tc) => ({
            input: tc.input,
            output: tc.output,
            is_hidden: tc.is_hidden,
          }));

        // If no test cases added explicitly, but sample input/output is provided, auto-add as first test case
        if (validTestCases.length === 0 && (sampleInput.trim() || sampleOutput.trim())) {
          validTestCases.push({
            input: sampleInput.trim(),
            output: sampleOutput.trim(),
            is_hidden: false,
          });
        }

        payload.coding_data = {
          problem_statement: stem,
          input_format: inputFormat || undefined,
          output_format: outputFormat || undefined,
          constraints: constraints || undefined,
          sample_input: sampleInput || undefined,
          sample_output: sampleOutput || undefined,
          time_limit_ms: Number(timeLimitMs) || 1000,
          memory_limit_mb: Number(memoryLimitMb) || 256,
          allowed_languages: allowedLanguages.length > 0 ? allowedLanguages : ['python', 'cpp', 'c', 'java', 'javascript'],
          starter_code: starterCode || undefined,
          test_cases: validTestCases,
        };
      }

      return questionApi.create(payload);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['questions'] });
      toast.success(`Đã tạo câu hỏi ${res.data.item_id}`);
      handleReset();
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleReset = () => {
    setStep('type');
    setStem('');
    setRationale('');
    setOptions(INITIAL_OPTIONS);
    setBloom('');
    setDifficulty('');
    setSampleAnswer('');
    setMaxPoints('10');
    setRubricId('');
    setInputFormat('');
    setOutputFormat('');
    setConstraints('');
    setSampleInput('');
    setSampleOutput('');
    setTimeLimitMs('1000');
    setMemoryLimitMb('256');
    setAllowedLanguages(['python', 'cpp', 'c', 'java', 'javascript']);
    setStarterCode('');
    setTestCases([{ input: '', output: '', is_hidden: false }]);
    setShowMetadata(false);
  };

  const updateOption = (idx: number, field: keyof OptionForm, value: string | boolean) => {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, [field]: value } : o)));
  };

  const setCorrect = (idx: number) => {
    setOptions((prev) => prev.map((o, i) => ({ ...o, is_correct: i === idx })));
  };

  const isValid =
    stem.trim().length > 0 &&
    (type !== 'mcq' || (options.some((o) => o.is_correct) && options.filter((o) => o.text).length >= 2));

  return (
    <Modal
      open={open}
      onOpenChange={(v) => { if (!v) handleReset(); onOpenChange(v); }}
      title={step === 'type' ? 'Chọn loại câu hỏi' : 'Tạo câu hỏi mới'}
      size="lg"
      footer={
        step === 'form' ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => setStep('type')}>
              ← Quay lại
            </Button>
            <Button variant="secondary" onClick={() => { handleReset(); onOpenChange(false); }}>
              Hủy
            </Button>
            <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!isValid}>
              Lưu câu hỏi
            </Button>
          </>
        ) : undefined
      }
    >
      {step === 'type' ? (
        /* Step 1: Type selection */
        <div className="grid grid-cols-3 gap-3">
          {[
            { type: 'mcq' as QuestionType, label: 'Trắc nghiệm', desc: 'Nhiều lựa chọn', icon: '☑️' },
            { type: 'essay' as QuestionType, label: 'Tự luận', desc: 'Câu trả lời tự do', icon: '✍️' },
            { type: 'coding' as QuestionType, label: 'Lập trình', desc: 'Bài tập code', icon: '💻' },
          ].map((t) => (
            <button
              key={t.type}
              onClick={() => { setType(t.type); setStep('form'); }}
              className="flex flex-col items-center rounded-xl border-2 border-gray-200 p-5 text-center hover:border-primary-400 hover:bg-primary-50 transition-all"
            >
              <span className="text-3xl mb-2">{t.icon}</span>
              <span className="font-semibold text-gray-900">{t.label}</span>
              <span className="text-xs text-gray-500 mt-0.5">{t.desc}</span>
            </button>
          ))}
        </div>
      ) : (
        /* Step 2: Form */
        <div className="space-y-4">
          <Textarea
            label="Nội dung câu hỏi"
            placeholder="Nhập nội dung câu hỏi..."
            value={stem}
            onChange={(e) => setStem(e.target.value)}
            rows={3}
            required
          />

          {/* MCQ Options */}
          {type === 'mcq' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Đáp án <span className="text-gray-400 font-normal">(click ✓ để chọn đáp án đúng)</span>
              </label>
              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCorrect(idx)}
                      className={`shrink-0 h-7 w-7 rounded-full border-2 flex items-center justify-center transition-colors ${
                        opt.is_correct
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-gray-300 text-gray-300 hover:border-green-400'
                      }`}
                    >
                      {opt.is_correct ? <CheckCircle className="h-4 w-4" /> : <span className="text-xs font-bold text-gray-400">{opt.label}</span>}
                    </button>
                    <input
                      type="text"
                      placeholder={`Đáp án ${opt.label}`}
                      value={opt.text}
                      onChange={(e) => updateOption(idx, 'text', e.target.value)}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Essay */}
          {type === 'essay' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rubric chấm tự luận bằng AI
                </label>
                <select
                  value={rubricId}
                  onChange={(e) => {
                    const selId = e.target.value;
                    setRubricId(selId);
                    if (selId && rubricsList) {
                      const found = rubricsList.find((r) => r.id === selId);
                      if (found) {
                        const total = found.criteria.reduce((sum, c) => sum + (c.max_score || 0), 0);
                        if (total > 0) setMaxPoints(String(total));
                      }
                    }
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="">— Tự động (Áp dụng Rubric mặc định) —</option>
                  {rubricsList?.map((r) => {
                    const total = r.criteria?.reduce((sum, c) => sum + (c.max_score || 0), 0) || 10;
                    return (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.criteria?.length || 0} tiêu chí - {total}đ)
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Chọn bảng tiêu chí Rubric riêng cho câu hỏi này để AI đối chiếu và chấm điểm.
                </p>
              </div>

              <Textarea
                label="Đáp án mẫu hoặc gợi ý trả lời"
                placeholder="Nội dung đáp án mẫu chi tiết để AI đối chiếu bài làm học sinh..."
                value={sampleAnswer}
                onChange={(e) => setSampleAnswer(e.target.value)}
                rows={3}
              />
              <Input
                label="Điểm tối đa"
                type="number"
                value={maxPoints}
                onChange={(e) => setMaxPoints(e.target.value)}
                min={1}
                max={100}
              />
            </div>
          )}

          {/* Coding Configuration */}
          {type === 'coding' && (
            <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/30 p-4">
              <div className="flex items-center gap-2 border-b border-blue-200/80 pb-2">
                <Code2 className="h-5 w-5 text-blue-600" />
                <h4 className="text-sm font-bold text-gray-900">
                  Cấu hình bài tập lập trình (Đầu vào, Đầu ra & Bộ kiểm thử)
                </h4>
              </div>

              {/* Ngôn ngữ cho phép */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Ngôn ngữ lập trình cho phép học sinh nộp bài:
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_LANGUAGES.map((lang) => {
                    const isSelected = allowedLanguages.includes(lang.id);
                    return (
                      <button
                        key={lang.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            if (allowedLanguages.length > 1) {
                              setAllowedLanguages(allowedLanguages.filter((l) => l !== lang.id));
                            } else {
                              toast.error('Phải cho phép ít nhất một ngôn ngữ');
                            }
                          } else {
                            setAllowedLanguages([...allowedLanguages, lang.id]);
                          }
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <CheckSquare className={`h-3.5 w-3.5 ${isSelected ? 'opacity-100' : 'opacity-30'}`} />
                        {lang.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Input Format, Output Format, Constraints */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Textarea
                  label="Định dạng đầu vào (Input Format)"
                  placeholder="Ví dụ: Dòng đầu tiên chứa số nguyên N. Dòng tiếp theo chứa N số nguyên cách nhau..."
                  value={inputFormat}
                  onChange={(e) => setInputFormat(e.target.value)}
                  rows={2}
                />
                <Textarea
                  label="Định dạng đầu ra (Output Format)"
                  placeholder="Ví dụ: In ra một số nguyên duy nhất là tổng các phần tử..."
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value)}
                  rows={2}
                />
              </div>

              <Textarea
                label="Ràng buộc dữ liệu (Constraints)"
                placeholder="Ví dụ: 1 <= N <= 10^5, |A[i]| <= 10^9..."
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                rows={2}
              />

              {/* Sample Input / Output */}
              <div className="rounded-lg border border-gray-200 bg-white p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Terminal className="h-4 w-4 text-gray-600" />
                    <span className="text-xs font-bold text-gray-800">Ví dụ mẫu (Sample I/O)</span>
                    <span className="text-[11px] text-gray-500 font-normal">
                      (Hiển thị trực tiếp trong đề bài cho học sinh)
                    </span>
                  </div>
                  {(sampleInput || sampleOutput) && (
                    <button
                      type="button"
                      onClick={() => {
                        setTestCases((prev) => [
                          { input: sampleInput, output: sampleOutput, is_hidden: false },
                          ...prev.filter((tc) => tc.input || tc.output),
                        ]);
                        toast.success('Đã thêm ví dụ vào Test Case #1');
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      <Copy className="h-3 w-3" />
                      Sao chép vào Test Case #1
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Ví dụ đầu vào (Sample Input)
                    </label>
                    <textarea
                      placeholder="Dán hoặc nhập dữ liệu đầu vào mẫu..."
                      value={sampleInput}
                      onChange={(e) => setSampleInput(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 p-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Ví dụ đầu ra (Sample Output)
                    </label>
                    <textarea
                      placeholder="Dán hoặc nhập kết quả đầu ra mẫu..."
                      value={sampleOutput}
                      onChange={(e) => setSampleOutput(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 p-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
                    />
                  </div>
                </div>
              </div>

              {/* Test Cases List */}
              <div className="rounded-lg border border-gray-200 bg-white p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Terminal className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs font-bold text-gray-800">Bộ kiểm thử chấm điểm (Test Cases)</span>
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {testCases.length} test
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Trình chấm tự động (Judge) sẽ chạy mã của học sinh qua từng test case để so khớp kết quả.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setTestCases([...testCases, { input: '', output: '', is_hidden: false }])
                    }
                    className="text-xs h-7 gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Thêm Test Case
                  </Button>
                </div>

                <div className="space-y-3">
                  {testCases.map((tc, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 space-y-2.5 transition-all hover:border-gray-300"
                    >
                      <div className="flex items-center justify-between border-b border-gray-200/70 pb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-700">
                            Test Case #{idx + 1}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              tc.is_hidden
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {tc.is_hidden ? '🔒 Test ẩn (Chấm bảo mật)' : '👁️ Test công khai'}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={tc.is_hidden}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setTestCases((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, is_hidden: checked } : item
                                  )
                                );
                              }}
                              className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                            />
                            <span>Ẩn test với học sinh</span>
                          </label>

                          {testCases.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setTestCases((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="text-gray-400 hover:text-red-600 transition-colors p-1"
                              title="Xóa test case này"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-medium text-gray-500 mb-0.5">
                            Đầu vào (stdin)
                          </label>
                          <textarea
                            placeholder="Dữ liệu đầu vào..."
                            value={tc.input}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTestCases((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, input: val } : item
                                )
                              );
                            }}
                            rows={3}
                            className="w-full rounded border border-gray-300 p-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-gray-500 mb-0.5">
                            Đầu ra mong đợi (expected stdout)
                          </label>
                          <textarea
                            placeholder="Kết quả đầu ra kỳ vọng..."
                            value={tc.output}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTestCases((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, output: val } : item
                                )
                              );
                            }}
                            rows={3}
                            className="w-full rounded border border-gray-300 p-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Starter Code */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Mã khởi tạo mẫu (Starter Code / Template) — Tùy chọn
                </label>
                <textarea
                  placeholder="# Cung cấp code mẫu hoặc khung hàm có sẵn cho học sinh..."
                  value={starterCode}
                  onChange={(e) => setStarterCode(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 p-2.5 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>

              {/* Limits: Time limit & Memory limit */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    Thời gian chạy tối đa (ms)
                  </label>
                  <Input
                    type="number"
                    value={timeLimitMs}
                    onChange={(e) => setTimeLimitMs(e.target.value)}
                    min={100}
                    max={10000}
                    step={100}
                  />
                  <span className="text-[10px] text-gray-400">Mặc định: 1000 ms (1 giây)</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                    <Cpu className="h-3.5 w-3.5 text-gray-400" />
                    Giới hạn bộ nhớ (MB)
                  </label>
                  <Input
                    type="number"
                    value={memoryLimitMb}
                    onChange={(e) => setMemoryLimitMb(e.target.value)}
                    min={16}
                    max={1024}
                    step={16}
                  />
                  <span className="text-[10px] text-gray-400">Mặc định: 256 MB</span>
                </div>
              </div>
            </div>
          )}

          {/* Rationale */}
          <Textarea
            label="Giải thích (tùy chọn)"
            placeholder="Giải thích tại sao đây là đáp án đúng..."
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={2}
          />

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Bloom</label>
              <select
                value={bloom}
                onChange={(e) => setBloom(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {BLOOM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Độ khó</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {DIFFICULTY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
