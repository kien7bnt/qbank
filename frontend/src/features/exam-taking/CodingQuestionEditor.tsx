import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Cpu,
  Code2,
  Terminal,
  FileCode,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { compilerApi, getErrorMessage } from '@/services/api';
import type { QuestionTaking, CodeExecutionResult, TestCaseResult, QuestionTestSummary } from '@/types';

interface CodingQuestionEditorProps {
  question: QuestionTaking;
  initialCode?: string;
  onCodeChange: (code: string) => void;
  disabled?: boolean;
}

const DEFAULT_STARTER_CODES: Record<string, string> = {
  python: '# Viết mã nguồn Python 3 của bạn tại đây\n',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Viết mã nguồn C++ tại đây\n    return 0;\n}\n',
  c: '#include <stdio.h>\n\nint main() {\n    // Viết mã nguồn C tại đây\n    return 0;\n}\n',
  java: 'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Viết mã nguồn Java tại đây\n    }\n}\n',
  javascript: '// Viết mã nguồn JavaScript (Node.js) tại đây\n',
};

export function CodingQuestionEditor({
  question,
  initialCode,
  onCodeChange,
  disabled = false,
}: CodingQuestionEditorProps) {
  const codingData = question.coding_data;
  const allowedLanguages = codingData?.allowed_languages?.length
    ? codingData.allowed_languages
    : ['python', 'cpp', 'c', 'java', 'javascript'];

  const [language, setLanguage] = useState<string>(allowedLanguages[0] || 'python');
  const [code, setCode] = useState<string>(
    initialCode || codingData?.starter_code || DEFAULT_STARTER_CODES[language] || ''
  );
  const [customStdin, setCustomStdin] = useState<string>(codingData?.sample_input || '');
  const [activeTab, setActiveTab] = useState<'sample' | 'custom'>('sample');

  // Execution states
  const [isRunningCustom, setIsRunningCustom] = useState(false);
  const [customResult, setCustomResult] = useState<CodeExecutionResult | null>(null);

  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testSummary, setTestSummary] = useState<QuestionTestSummary | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync when question changes
  useEffect(() => {
    const starter = initialCode || codingData?.starter_code || DEFAULT_STARTER_CODES[language] || '';
    setCode(starter);
    setCustomStdin(codingData?.sample_input || '');
    setCustomResult(null);
    setTestSummary(null);
  }, [question.id]);

  // Handle Tab key in textarea for indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;

      const newCode = code.substring(0, start) + '    ' + code.substring(end);
      setCode(newCode);
      onCodeChange(newCode);

      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 4;
      }, 0);
    }
  };

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    onCodeChange(newCode);
  };

  const handleResetCode = () => {
    if (confirm('Bạn có chắc muốn đặt lại mã nguồn về ban đầu?')) {
      const resetVal = codingData?.starter_code || DEFAULT_STARTER_CODES[language] || '';
      setCode(resetVal);
      onCodeChange(resetVal);
      toast.success('Đã đặt lại mã nguồn ban đầu');
    }
  };

  // Run with custom Stdin
  const handleRunCustom = async () => {
    if (!code.trim()) {
      toast.error('Vui lòng nhập mã nguồn trước khi chạy');
      return;
    }

    setIsRunningCustom(true);
    setCustomResult(null);
    try {
      const res = await compilerApi.runCode({
        source_code: code,
        language,
        stdin: customStdin,
      });
      setCustomResult(res.data);
      if (res.data.status_id === 3) {
        toast.success('Chạy code thành công!');
      } else if (res.data.status_id === 6 || res.data.compile_output) {
        toast.error('Lỗi biên dịch (Compilation Error)');
      } else if (res.data.stderr) {
        toast.error(`Lỗi thực thi: ${res.data.status}`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Không thể kết nối máy chủ compiler.edusoft.vn');
    } finally {
      setIsRunningCustom(false);
    }
  };

  // Run with Question Test Cases
  const handleRunTestCases = async () => {
    if (!code.trim()) {
      toast.error('Vui lòng nhập mã nguồn trước khi chạy kiểm thử');
      return;
    }

    setIsRunningTests(true);
    setTestSummary(null);
    try {
      const res = await compilerApi.testQuestion({
        question_id: question.id,
        source_code: code,
        language,
      });
      setTestSummary(res.data);
      if (res.data.passed_all) {
        toast.success(`Tuyệt vời! Đạt ${res.data.passed_count}/${res.data.total_count} test case`);
      } else {
        toast(`Đạt ${res.data.passed_count}/${res.data.total_count} test case`, { icon: '⚠️' });
      }
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Lỗi khi chấm test case');
    } finally {
      setIsRunningTests(false);
    }
  };

  // Calculate line numbers
  const lineCount = Math.max(code.split('\n').length, 12);
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div className="space-y-4 pt-2">
      {/* Constraints & Problem Info Banner */}
      {(codingData?.constraints || codingData?.input_format || codingData?.output_format) && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 space-y-1.5 leading-relaxed">
          {codingData.input_format && (
            <div>
              <span className="font-semibold text-slate-900">Định dạng đầu vào: </span>
              {codingData.input_format}
            </div>
          )}
          {codingData.output_format && (
            <div>
              <span className="font-semibold text-slate-900">Định dạng đầu ra: </span>
              {codingData.output_format}
            </div>
          )}
          {codingData.constraints && (
            <div>
              <span className="font-semibold text-slate-900">Ràng buộc: </span>
              {codingData.constraints}
            </div>
          )}
        </div>
      )}

      {/* Editor Container */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900 shadow-md overflow-hidden flex flex-col">
        {/* Editor Top Bar */}
        <div className="bg-slate-800/90 border-b border-slate-700/80 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-emerald-400" />
            <select
              value={language}
              disabled={disabled}
              onChange={(e) => {
                const newLang = e.target.value;
                setLanguage(newLang);
                if (!code || Object.values(DEFAULT_STARTER_CODES).includes(code)) {
                  const s = DEFAULT_STARTER_CODES[newLang] || '';
                  setCode(s);
                  onCodeChange(s);
                }
              }}
              className="bg-slate-900 text-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              {allowedLanguages.map((l) => (
                <option key={l} value={l}>
                  {l === 'python' ? 'Python 3 (3.8.1)' : l === 'cpp' ? 'C++ (GCC 9.2)' : l === 'c' ? 'C (GCC 9.2)' : l === 'java' ? 'Java 13' : 'JavaScript (Node.js)'}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetCode}
              disabled={disabled}
              title="Đặt lại code ban đầu"
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded-md hover:bg-slate-700/50 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Đặt lại</span>
            </button>

            <button
              type="button"
              onClick={handleRunCustom}
              disabled={disabled || isRunningCustom}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{isRunningCustom ? 'Đang chạy...' : 'Chạy thử'}</span>
            </button>

            <button
              type="button"
              onClick={handleRunTestCases}
              disabled={disabled || isRunningTests}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{isRunningTests ? 'Đang chấm...' : 'Chạy test case'}</span>
            </button>
          </div>
        </div>

        {/* Code Input & Line Numbers */}
        <div className="flex bg-slate-900 min-h-[220px] max-h-[420px] overflow-y-auto font-mono text-sm relative">
          {/* Line Numbers */}
          <div className="w-10 sm:w-12 py-3 bg-slate-950/50 text-slate-600 text-right pr-2.5 select-none font-mono text-xs border-r border-slate-800">
            {lineNumbers.map((n) => (
              <div key={n} className="leading-6">
                {n}
              </div>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={code}
            disabled={disabled}
            onChange={(e) => handleCodeChange(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            placeholder="Viết code giải bài toán tại đây..."
            className="flex-1 p-3 bg-transparent text-slate-100 placeholder-slate-600 font-mono text-xs sm:text-sm leading-6 resize-none focus:outline-none overflow-x-auto whitespace-pre tab-4 selection:bg-indigo-500/30"
          />
        </div>
      </div>

      {/* Test Execution & Output Panel */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Sub-tabs header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2 bg-gray-50/60">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('sample')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'sample'
                  ? 'bg-white text-indigo-700 shadow-xs border border-gray-200'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Test case ({testSummary ? `${testSummary.passed_count}/${testSummary.total_count}` : 'Mẫu'})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'custom'
                  ? 'bg-white text-emerald-700 shadow-xs border border-gray-200'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>Input tùy chỉnh & Kết quả</span>
            </button>
          </div>

          <div className="text-[11px] text-gray-400 flex items-center gap-2 hidden sm:flex">
            <span>Powered by Judge0</span>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
          </div>
        </div>

        {/* Tab 1: Test Cases */}
        {activeTab === 'sample' && (
          <div className="p-4 space-y-3">
            {testSummary ? (
              <div className="space-y-3">
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                    testSummary.passed_all
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {testSummary.passed_all ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    )}
                    <span>
                      {testSummary.passed_all
                        ? 'Tất cả test case đều chính xác!'
                        : `Vượt qua ${testSummary.passed_count} / ${testSummary.total_count} test case`}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  {testSummary.results.map((r) => (
                    <div
                      key={r.case_number}
                      className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                        r.is_passed
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : 'bg-rose-50/40 border-rose-200'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-gray-700">Test case #{r.case_number}</span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                            r.is_passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {r.status || (r.is_passed ? 'Accepted' : 'Wrong Answer')}
                        </span>
                      </div>

                      {r.input && r.input !== '*** [Ẩn]' && (
                        <div className="font-mono text-[11px] text-gray-600 bg-white p-2 rounded-lg border border-gray-100">
                          <span className="text-gray-400">Đầu vào:</span> {r.input}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]">
                        <div className="bg-white p-2 rounded-lg border border-gray-100">
                          <span className="text-gray-400">Kết quả kỳ vọng:</span>
                          <div className="text-gray-800 whitespace-pre-wrap">{r.expected_output || '(Trống)'}</div>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-gray-100">
                          <span className="text-gray-400">Kết quả thực tế:</span>
                          <div
                            className={`whitespace-pre-wrap ${
                              r.is_passed ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'
                            }`}
                          >
                            {r.actual_output || r.stderr || '(Trống)'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Sample preview before running */
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <span className="font-semibold text-gray-700 block mb-1">Ví dụ Input:</span>
                    <pre className="font-mono text-gray-800 bg-white p-2 rounded-lg border border-gray-100 overflow-x-auto">
                      {codingData?.sample_input || '(Không có đầu vào mẫu)'}
                    </pre>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <span className="font-semibold text-gray-700 block mb-1">Ví dụ Output:</span>
                    <pre className="font-mono text-gray-800 bg-white p-2 rounded-lg border border-gray-100 overflow-x-auto">
                      {codingData?.sample_output || '(Không có đầu ra mẫu)'}
                    </pre>
                  </div>
                </div>

                <div className="text-center py-2">
                  <button
                    type="button"
                    onClick={handleRunTestCases}
                    disabled={isRunningTests}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl border border-indigo-200 transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Chạy kiểm thử với test case của câu hỏi
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Custom Stdin & Result */}
        {activeTab === 'custom' && (
          <div className="p-4 space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Đầu vào tiêu chuẩn (Standard Input / Stdin):
              </label>
              <textarea
                value={customStdin}
                onChange={(e) => setCustomStdin(e.target.value)}
                placeholder="Nhập dữ liệu đầu vào cho chương trình..."
                rows={2}
                className="w-full p-2.5 font-mono text-xs bg-gray-50 rounded-xl border border-gray-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {customResult && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-gray-700">Kết quả chạy:</span>
                  <div className="flex items-center gap-2">
                    {customResult.time && (
                      <span className="flex items-center gap-1 text-[11px] text-gray-500">
                        <Clock className="h-3 w-3" /> {customResult.time}s
                      </span>
                    )}
                    {customResult.memory && (
                      <span className="flex items-center gap-1 text-[11px] text-gray-500">
                        <Cpu className="h-3 w-3" /> {customResult.memory} KB
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        customResult.status_id === 3
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {customResult.status}
                    </span>
                  </div>
                </div>

                {customResult.compile_output && (
                  <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 font-mono text-[11px] whitespace-pre-wrap overflow-x-auto">
                    <div className="font-bold mb-1">Lỗi biên dịch:</div>
                    {customResult.compile_output}
                  </div>
                )}

                {customResult.stderr && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 font-mono text-[11px] whitespace-pre-wrap overflow-x-auto">
                    <div className="font-bold mb-1">Lỗi thực thi (Runtime Error):</div>
                    {customResult.stderr}
                  </div>
                )}

                <div className="p-2.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] whitespace-pre-wrap overflow-x-auto min-h-[50px]">
                  {customResult.stdout || (
                    <span className="text-slate-500 italic">(Không có đầu ra stdout)</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
