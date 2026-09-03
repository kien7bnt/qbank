import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { assignmentApi, getErrorMessage } from '@/services/api';
import type { ExamTakingState, QuestionTaking } from '@/types';

export function ExamTakingPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // question_id -> selected_option_id
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);

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
      const initial: Record<string, string> = {};
      examState.questions.forEach((q) => {
        if (q.selected_option_id) {
          initial[q.id] = q.selected_option_id;
        }
      });
      setAnswers(initial);
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
    mutationFn: (payload: { question_id: string; selected_option_id: string }) =>
      assignmentApi.saveResponse(examState!.attempt_id, payload),
    onError: (err) => toast.error('Lỗi khi tự động lưu bài làm!'),
  });

  // Submit Attempt Mutation
  const submitMutation = useMutation({
    mutationFn: () => assignmentApi.submit(examState!.attempt_id),
    onSuccess: (res) => {
      toast.success('Đã nộp bài thành công!');
      navigate(`/exam-result/${examState!.attempt_id}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleSelectOption = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    saveMutation.mutate({ question_id: questionId, selected_option_id: optionId });
  };

  const handleAutoSubmit = () => {
    toast.error('Hết giờ làm bài! Hệ thống đang tự động nộp bài.');
    submitMutation.mutate();
  };

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

  const questions = examState.questions || [];
  const currentQuestion: QuestionTaking | undefined = questions[currentIndex];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isTimerCritical = (timeLeft || 0) < 300; // < 5 mins

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Header */}
      <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-50 rounded-lg text-primary-600 font-bold">
            QBank
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-sm sm:text-base leading-tight">
              {examState.assignment_name}
            </h1>
            <p className="text-xs text-gray-400">
              Đã làm: <strong>{answeredCount}</strong> / {totalQuestions} câu
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Countdown timer badge */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-mono text-sm font-bold border transition-colors ${
              isTimerCritical
                ? 'bg-red-50 text-red-600 border-red-200 animate-pulse'
                : 'bg-primary-50 text-primary-700 border-primary-200'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>{formatTimer(timeLeft || 0)}</span>
          </div>

          <Button
            className="bg-green-600 hover:bg-green-700 text-white font-semibold"
            size="sm"
            onClick={() => setSubmitModalOpen(true)}
          >
            <Send className="h-4 w-4 mr-1.5" />
            Nộp bài
          </Button>
        </div>
      </header>

      {/* Main Taking Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Center: Question Panel */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          {currentQuestion ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex-1 flex flex-col justify-between">
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <span className="font-bold text-primary-700 text-base">
                    Câu {currentIndex + 1} / {totalQuestions}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium capitalize">
                    {currentQuestion.points} điểm • {currentQuestion.bloom_level || 'Hiểu'}
                  </span>
                </div>

                {/* Question Stem */}
                <div className="text-base text-gray-900 leading-relaxed font-medium whitespace-pre-wrap">
                  {currentQuestion.stem}
                </div>

                {/* MCQ Options */}
                {currentQuestion.type === 'mcq' && (
                  <div className="space-y-3 pt-2">
                    {currentQuestion.options.map((opt) => {
                      const isSelected = answers[currentQuestion.id] === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelectOption(currentQuestion.id, opt.id)}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3.5 ${
                            isSelected
                              ? 'border-primary-600 bg-primary-50/70 shadow-sm'
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
                            className={`text-sm leading-relaxed ${
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
              </div>

              {/* Navigation Arrows */}
              <div className="pt-6 mt-6 border-t border-gray-100 flex items-center justify-between">
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

        {/* Right Sidebar: Question Grid Navigation Palette */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900 text-sm">Danh sách câu hỏi</h3>

            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isAnswered = !!answers[q.id];
                const isCurrent = currentIndex === idx;

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-10 rounded-xl font-bold text-xs transition-all flex items-center justify-center relative ${
                      isCurrent
                        ? 'ring-2 ring-primary-600 ring-offset-2 bg-primary-600 text-white shadow-md'
                        : isAnswered
                        ? 'bg-green-100 text-green-800 border border-green-300 font-bold'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="pt-3 border-t border-gray-100 space-y-1.5 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-green-100 border border-green-300 inline-block" />
                <span>Đã trả lời ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-gray-100 border border-gray-200 inline-block" />
                <span>Chưa trả lời ({totalQuestions - answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-primary-600 inline-block" />
                <span>Đang chọn</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Confirm Submit Modal */}
      <Modal
        open={submitModalOpen}
        onOpenChange={setSubmitModalOpen}
        title="Xác nhận nộp bài thi"
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
                Bạn vẫn còn <strong>{totalQuestions - answeredCount}</strong> câu chưa chọn đáp án!
              </span>
            </div>
          )}
          <p className="text-xs text-gray-400">
            Sau khi nộp bài, bạn sẽ không thể chỉnh sửa lại các câu trả lời.
          </p>
        </div>
      </Modal>
    </div>
  );
}
