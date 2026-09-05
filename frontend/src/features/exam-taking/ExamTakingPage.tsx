import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertTriangle,
  HelpCircle,
  LayoutGrid,
  FileCode,
  FileText,
  X,
  Code2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { assignmentApi, getErrorMessage } from '@/services/api';
import type { ExamTakingState, QuestionTaking } from '@/types';
import { CodingQuestionEditor } from './CodingQuestionEditor';

export function ExamTakingPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // question_id -> selected_option_id
  const [codeAnswers, setCodeAnswers] = useState<Record<string, string>>({}); // question_id -> code_response
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({}); // question_id -> text_response
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch initial exam state
  const { data, isLoading, error } = useQuery({
    queryKey: ['exam-taking', attemptId],
    queryFn: async () => {
      const res = await assignmentApi.getState(attemptId!);
      return res.data as ExamTakingState;
    },
    enabled: !!attemptId,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const examState: ExamTakingState | undefined = data;

  // Initialize answers from existing responses
  useEffect(() => {
    if (examState) {
      const initialOptions: Record<string, string> = {};
      const initialCodes: Record<string, string> = {};
      const initialTexts: Record<string, string> = {};

      examState.questions.forEach((q) => {
        if (q.selected_option_id) {
          initialOptions[q.id] = q.selected_option_id;
        }
        if (q.code_response) {
          initialCodes[q.id] = q.code_response;
        }
        if (q.text_response) {
          initialTexts[q.id] = q.text_response;
        }
      });

      setAnswers(initialOptions);
      setCodeAnswers(initialCodes);
      setTextAnswers(initialTexts);
      setTimeLeft(examState.remaining_seconds);
    }
  }, [examState]);

  // Live Timer Countdown
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft]);

  // Save Response Mutation (Live Draft)
  const saveMutation = useMutation({
    mutationFn: (payload: {
      question_id: string;
      selected_option_id?: string;
      code_response?: string;
      text_response?: string;
    }) => assignmentApi.saveResponse(examState!.attempt_id, payload),
    onError: () => toast.error('Lỗi khi tự động lưu bài làm!'),
  });

  // Handle MCQ option selection
  const handleSelectOption = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    saveMutation.mutate({ question_id: questionId, selected_option_id: optionId });
  };

  // Handle Code change with debounce
  const handleCodeChange = (questionId: string, newCode: string) => {
    setCodeAnswers((prev) => ({ ...prev, [questionId]: newCode }));
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      saveMutation.mutate({ question_id: questionId, code_response: newCode });
    }, 1000);
  };

  // Handle Essay text change with debounce
  const handleTextChange = (questionId: string, newText: string) => {
    setTextAnswers((prev) => ({ ...prev, [questionId]: newText }));
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      saveMutation.mutate({ question_id: questionId, text_response: newText });
    }, 1000);
  };

  // Submit Attempt Mutation
  const submitMutation = useMutation({
    mutationFn: () => assignmentApi.submit(examState!.attempt_id),
    onSuccess: () => {
      toast.success('Đã nộp bài thành công!');
      navigate(`/exam-result/${examState!.attempt_id}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleAutoSubmit = () => {
    toast.error('Hết giờ làm bài! Hệ thống đang tự động nộp bài.');
    submitMutation.mutate();
  };

  const questions = examState?.questions || [];
  const currentQuestion: QuestionTaking | undefined = questions[currentIndex];
  const totalQuestions = questions.length;

  const isQuestionAnswered = (q: QuestionTaking): boolean => {
    if (q.type === 'coding') {
      return !!codeAnswers[q.id]?.trim();
    }
    if (q.type === 'essay') {
      return !!textAnswers[q.id]?.trim();
    }
    return !!answers[q.id];
  };

  const answeredCount = useMemo(() => {
    return questions.filter(isQuestionAnswered).length;
  }, [questions, answers, codeAnswers, textAnswers]);

  if (isLoading) {
    return <PageSpinner />;
  }

  if (error || !examState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4 bg-gray-50">
        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200">
          <AlertTriangle className="h-10 w-10 text-amber-600 mx-auto" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Không tìm thấy bài thi hoặc bài thi đã nộp</h2>
        <p className="text-sm text-gray-500 max-w-md">
          {getErrorMessage(error) || 'Lượt làm bài không tồn tại hoặc đã được nộp chấm điểm.'}
        </p>
        <Button onClick={() => navigate('/assignments')}>
          Quay lại danh sách bài kiểm tra
        </Button>
      </div>
    );
  }

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isTimerCritical = (timeLeft || 0) < 300; // < 5 mins

  // Question Palette Grid element for reuse in sidebar and mobile sheet
  const renderPaletteGrid = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900 text-sm">Danh sách câu hỏi</h3>
        <span className="text-xs text-gray-500">
          Đã làm: <strong className="text-primary-600">{answeredCount}</strong>/{totalQuestions}
        </span>
      </div>

      <div className="grid grid-cols-5 gap-2 max-h-[360px] overflow-y-auto p-1">
        {questions.map((q, idx) => {
          const answered = isQuestionAnswered(q);
          const isCurrent = currentIndex === idx;

          return (
            <button
              key={q.id}
              type="button"
              onClick={() => {
                setCurrentIndex(idx);
                setMobilePaletteOpen(false);
              }}
              className={`h-10 rounded-xl font-bold text-xs transition-all flex items-center justify-center relative ${
                isCurrent
                  ? 'ring-2 ring-primary-600 ring-offset-2 bg-primary-600 text-white shadow-md'
                  : answered
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              {idx + 1}
              {q.type === 'coding' && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="pt-3 border-t border-gray-100 space-y-1.5 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-emerald-100 border border-emerald-300 inline-block" />
          <span>Đã làm ({answeredCount})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-gray-100 border border-gray-200 inline-block" />
          <span>Chưa làm ({totalQuestions - answeredCount})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-primary-600 inline-block" />
          <span>Đang làm</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-indigo-600 inline-block ml-0.5" />
          <span className="ml-0.5">Câu hỏi lập trình</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20 lg:pb-0">
      {/* Top Responsive Header */}
      <header className="bg-white border-b border-gray-200 px-3 sm:px-6 py-2.5 sm:py-3 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Left Info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 sm:p-2 bg-primary-50 rounded-lg text-primary-600 font-bold text-xs sm:text-sm shrink-0">
              Edumate
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-gray-900 text-xs sm:text-base leading-tight truncate max-w-[140px] xs:max-w-[200px] sm:max-w-xs md:max-w-md">
                  {examState.assignment_name}
                </h1>
                {examState.assignment_type === 'homework' ? (
                  <span className="hidden xs:inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                    Bài tập (Lần {examState.attempt_number || 1})
                  </span>
                ) : (
                  <span className="hidden xs:inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                    Kiểm tra
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">
                Đã làm: <strong className="text-primary-700">{answeredCount}</strong> / {totalQuestions} câu
              </p>
            </div>
          </div>

          {/* Right Timer & Actions */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Countdown timer badge */}
            <div
              title={
                examState.assignment_type === 'homework'
                  ? 'Thời gian bài tập - Bạn có thể nộp và làm lại nhiều lần'
                  : 'Thời gian đếm lui chính thức - Tự động nộp bài khi hết giờ'
              }
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full font-mono text-xs sm:text-sm font-bold border transition-colors ${
                isTimerCritical
                  ? 'bg-red-50 text-red-600 border-red-200 animate-pulse'
                  : examState.assignment_type === 'homework'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span>{formatTimer(timeLeft || 0)}</span>
            </div>

            {/* Mobile Question Palette Toggle Button */}
            <button
              type="button"
              onClick={() => setMobilePaletteOpen(true)}
              className="lg:hidden p-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 flex items-center gap-1 text-xs font-semibold"
              title="Danh sách câu hỏi"
            >
              <LayoutGrid className="h-4 w-4 text-primary-600" />
              <span className="hidden xs:inline">{answeredCount}/{totalQuestions}</span>
            </button>

            {/* Submit Button */}
            <Button
              className="bg-green-600 hover:bg-green-700 text-white font-semibold text-xs sm:text-sm px-2.5 sm:px-4 py-1 sm:py-2 h-auto"
              size="sm"
              onClick={() => setSubmitModalOpen(true)}
            >
              <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
              <span>Nộp bài</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Taking Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left / Center: Question Panel */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          {currentQuestion ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-xs flex-1 flex flex-col justify-between">
              <div className="space-y-4 sm:space-y-6">
                {/* Header of current question */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 sm:pb-4 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-primary-700 text-sm sm:text-base">
                      Câu {currentIndex + 1} / {totalQuestions}
                    </span>
                    {currentQuestion.type === 'coding' ? (
                      <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Code2 className="h-3 w-3" />
                        Lập trình
                      </span>
                    ) : currentQuestion.type === 'essay' ? (
                      <span className="text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Tự luận
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                        Trắc nghiệm
                      </span>
                    )}
                  </div>

                  <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
                    {currentQuestion.points} điểm • {currentQuestion.bloom_level || 'Hiểu'}
                  </span>
                </div>

                {/* Question Stem */}
                <div className="text-sm sm:text-base text-gray-900 leading-relaxed font-medium whitespace-pre-wrap">
                  {currentQuestion.stem}
                </div>

                {/* Question Type 1: Multiple Choice Questions */}
                {currentQuestion.type === 'mcq' && (
                  <div className="space-y-2.5 sm:space-y-3 pt-2">
                    {currentQuestion.options.map((opt) => {
                      const isSelected = answers[currentQuestion.id] === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelectOption(currentQuestion.id, opt.id)}
                          className={`w-full text-left p-3.5 sm:p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                            isSelected
                              ? 'border-primary-600 bg-primary-50/80 shadow-xs'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/50'
                          }`}
                        >
                          <div
                            className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 text-gray-600 border border-gray-200'
                            }`}
                          >
                            {opt.label}
                          </div>
                          <span
                            className={`text-xs sm:text-sm leading-relaxed ${
                              isSelected ? 'font-semibold text-primary-950' : 'text-gray-800'
                            }`}
                          >
                            {opt.text}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Question Type 2: Coding Question (Online Judge Compiler) */}
                {currentQuestion.type === 'coding' && (
                  <CodingQuestionEditor
                    question={currentQuestion}
                    initialCode={codeAnswers[currentQuestion.id]}
                    onCodeChange={(newCode) => handleCodeChange(currentQuestion.id, newCode)}
                  />
                )}

                {/* Question Type 3: Essay Question */}
                {currentQuestion.type === 'essay' && (
                  <div className="space-y-3 pt-2">
                    <label className="block text-xs font-semibold text-gray-700">
                      Nội dung câu trả lời tự luận:
                    </label>
                    <textarea
                      rows={8}
                      value={textAnswers[currentQuestion.id] || ''}
                      onChange={(e) => handleTextChange(currentQuestion.id, e.target.value)}
                      placeholder="Nhập câu trả lời hoặc lời giải chi tiết của bạn tại đây..."
                      className="w-full p-4 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm leading-relaxed"
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Hệ thống tự động lưu sau khi nhập</span>
                      <span>{(textAnswers[currentQuestion.id] || '').length} ký tự</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Desktop Navigation Arrows */}
              <div className="hidden lg:flex pt-6 mt-6 border-t border-gray-100 items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Câu trước
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentIndex === totalQuestions - 1}
                  onClick={() =>
                    setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))
                  }
                >
                  Câu tiếp theo
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-white rounded-xl border border-gray-200">
              Không có câu hỏi nào.
            </div>
          )}
        </div>

        {/* Right Sidebar: Question Grid Navigation Palette (Desktop) */}
        <div className="hidden lg:block lg:col-span-4 space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs sticky top-20">
            {renderPaletteGrid()}
          </div>
        </div>
      </main>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2.5 px-4 flex items-center justify-between z-20 shadow-lg">
        <Button
          variant="outline"
          size="sm"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
          className="text-xs h-9 px-3"
        >
          <ChevronLeft className="h-4 w-4 mr-0.5" />
          Trước
        </Button>

        <button
          type="button"
          onClick={() => setMobilePaletteOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-800 text-xs font-bold active:bg-gray-200"
        >
          <LayoutGrid className="h-3.5 w-3.5 text-primary-600" />
          <span>Câu {currentIndex + 1} / {totalQuestions}</span>
        </button>

        <Button
          variant="outline"
          size="sm"
          disabled={currentIndex === totalQuestions - 1}
          onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
          className="text-xs h-9 px-3"
        >
          Tiếp
          <ChevronRight className="h-4 w-4 ml-0.5" />
        </Button>
      </div>

      {/* Mobile Bottom Sheet / Modal for Question Palette */}
      {mobilePaletteOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-t-3xl p-5 max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-3">
              <span className="font-bold text-gray-900 text-sm">Danh mục câu hỏi</span>
              <button
                type="button"
                onClick={() => setMobilePaletteOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pb-4">
              {renderPaletteGrid()}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Submit Modal */}
      <Modal
        open={submitModalOpen}
        onOpenChange={setSubmitModalOpen}
        title={examState?.assignment_type === 'homework' ? 'Xác nhận nộp bài tập' : 'Xác nhận nộp bài thi'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSubmitModalOpen(false)}>
              Làm tiếp
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              loading={submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
            >
              Nộp bài ngay
            </Button>
          </>
        }
      >
        <div className="space-y-3 py-2 text-sm text-gray-600">
          <p>
            Bạn đã hoàn thành <strong>{answeredCount}</strong> trên tổng số{' '}
            <strong>{totalQuestions}</strong> câu hỏi.
          </p>
          {answeredCount < totalQuestions && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg text-amber-800 text-xs border border-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                Bạn vẫn còn <strong>{totalQuestions - answeredCount}</strong> câu chưa chọn đáp án hoặc chưa nộp code!
              </span>
            </div>
          )}
          {examState?.assignment_type === 'homework' ? (
            <p className="text-xs text-indigo-700 bg-indigo-50 p-2.5 rounded-lg border border-indigo-100">
              💡 <strong>Bài tập:</strong> Sau khi nộp bài và xem kết quả, bạn có thể làm lại bài bất cứ lúc nào để ôn tập và nâng cao điểm số.
            </p>
          ) : (
            <p className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-100">
              ⚠️ <strong>Bài kiểm tra chính thức:</strong> Bạn chỉ được nộp 1 lần duy nhất để chốt điểm và <strong>không thể làm lại</strong> sau khi nộp.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
