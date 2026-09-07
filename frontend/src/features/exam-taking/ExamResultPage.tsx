import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  BookOpen,
  HelpCircle,
  RotateCcw,
  Code2,
  FileText,
  Terminal,
  Cpu,
  Paperclip,
  ExternalLink,
  FileSpreadsheet,
  FileImage,
  Loader2,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { assignmentApi, getErrorMessage } from '@/services/api';
import type { AttemptResult, ResponseDetail } from '@/types';
import { parseEssayResponse } from './ExamTakingPage';

export function ExamResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['attempt-result', attemptId],
    queryFn: () => assignmentApi.result(attemptId!),
    enabled: !!attemptId,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      return status === 'submitted' ? 3000 : false;
    },
  });

  const retryMutation = useMutation({
    mutationFn: (assignmentId: string) => assignmentApi.retry(assignmentId),
    onSuccess: (res) => {
      navigate(`/exam-taking/${res.data.attempt_id}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const result: AttemptResult | undefined = data?.data;

  if (isLoading || !result) {
    return <PageSpinner />;
  }

  const isPendingGrading = result.status === 'submitted';
  const scorePercentage = Math.round(((result.score || 0) / (result.max_score || 10)) * 100);
  const isPassed = result.is_passed;

  return (
    <div className="min-h-screen bg-gray-50 py-5 sm:py-8 px-3 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-5 sm:space-y-6">
        {/* Top Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs sm:text-sm"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/exercises');
              }
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Quay lại
          </Button>

          {result.can_retry && result.assignment_id && (
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs text-xs sm:text-sm"
              size="sm"
              loading={retryMutation.isPending}
              onClick={() => retryMutation.mutate(result.assignment_id!)}
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Làm lại bài tập này
            </Button>
          )}
        </div>

        {/* Score Summary Card */}
        <div
          className={`rounded-3xl p-5 sm:p-8 border text-center relative overflow-hidden shadow-xs ${
            isPendingGrading
              ? 'bg-gradient-to-b from-amber-50 via-white to-blue-50/30 border-amber-300'
              : isPassed
              ? 'bg-gradient-to-b from-green-50 to-white border-green-200'
              : 'bg-gradient-to-b from-amber-50 to-white border-amber-200'
          }`}
        >
          <div className="max-w-md mx-auto space-y-3">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {isPendingGrading ? (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200 shadow-xs animate-pulse">
                  <Clock className="h-3.5 w-3.5 text-amber-600 animate-spin" />
                  ĐÃ NỘP BÀI · ĐANG CHỜ AI CHẤM THEO RUBRIC
                </span>
              ) : (
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    isPassed
                      ? 'bg-green-100 text-green-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {isPassed ? '🎉 Kết Quả: ĐẠT' : '⚠️ Kết Quả: CHƯA ĐẠT'}
                </span>
              )}
              {result.assignment_type === 'homework' ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                  📝 Bài tập (Lần {result.attempt_number || 1})
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                  ⏱️ Bài kiểm tra chính thức
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug">
              {result.assignment_name}
            </h1>

            <div className="py-2 sm:py-4">
              {isPendingGrading ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 text-3xl sm:text-5xl font-black text-amber-600 tracking-tight">
                    <Sparkles className="h-7 w-7 sm:h-9 sm:w-9 text-amber-500 animate-pulse" />
                    <span>--</span>
                    <span className="text-xl sm:text-2xl text-gray-400 font-medium"> / {result.max_score} đ</span>
                  </div>
                  <p className="text-xs sm:text-sm text-amber-800 font-medium max-w-sm mx-auto bg-amber-50/80 border border-amber-200 rounded-xl py-2 px-3">
                    Bài làm tự luận đang được AI đối chiếu đáp án gợi ý và tiêu chí Rubric để chấm điểm. Vui lòng đợi trong giây lát, kết quả sẽ tự động hiển thị!
                  </p>
                </div>
              ) : (
                <div>
                  <div className="text-4xl sm:text-6xl font-black text-gray-900 tracking-tight">
                    {result.score?.toFixed(2)}
                    <span className="text-xl sm:text-2xl text-gray-400 font-medium"> / {result.max_score} đ</span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-500 mt-2 font-medium">
                    Đúng {result.correct_answers_count} / {result.total_questions} câu ({scorePercentage}%)
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs text-gray-500 pt-2 border-t border-gray-100">
              <span>Học sinh: <strong>{result.user_name}</strong></span>
              <span>
                Trạng thái:{' '}
                {isPendingGrading ? (
                  <strong className="text-amber-600 inline-flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Đã nộp bài (Đang chấm điểm...)
                  </strong>
                ) : (
                  <strong className="text-green-600">Đã chấm điểm</strong>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Question by Question Review */}
        <div className="space-y-4">
          <h2 className="text-base sm:text-lg font-bold text-gray-900">Chi tiết bài làm & Lời giải</h2>

          <div className="space-y-4">
            {result.responses.map((resp: ResponseDetail, idx: number) => {
              const isCoding = resp.type === 'coding' || !!resp.code_response;
              const isEssay = resp.type === 'essay' || (!!resp.text_response && !isCoding);
              const isPendingItem = resp.is_correct === null || resp.is_correct === undefined;
              const isCorrect = resp.is_correct === true;

              return (
                <div
                  key={resp.question_id || idx}
                  className={`bg-white border rounded-2xl p-4 sm:p-6 shadow-xs space-y-4 transition-all ${
                    isPendingItem
                      ? 'border-amber-200 bg-amber-50/10'
                      : isCorrect
                      ? 'border-green-200'
                      : 'border-red-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                          isPendingItem
                            ? 'bg-amber-500'
                            : isCorrect
                            ? 'bg-green-500'
                            : 'bg-red-500'
                        }`}
                      >
                        {isPendingItem ? (
                          <Clock className="h-3.5 w-3.5 animate-spin" />
                        ) : isCorrect ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                      </span>
                      <span className="font-bold text-gray-900 text-sm">
                        Câu {idx + 1}
                      </span>
                      {isCoding && (
                        <span className="text-[10px] sm:text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Code2 className="h-3 w-3" />
                          Lập trình
                        </span>
                      )}
                      {isEssay && (
                        <span className="text-[10px] sm:text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          Tự luận
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0 ${
                        isPendingItem
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : isCorrect
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {isPendingItem
                        ? `-- / ${resp.points} điểm (Chờ chấm)`
                        : `${resp.points_earned} / ${resp.points} điểm`}
                    </span>
                  </div>

                  {/* Stem */}
                  <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap leading-relaxed">
                    {resp.stem}
                  </p>

                  {/* MCQ Options Display */}
                  {resp.options && resp.options.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {resp.options.map((opt) => {
                        const isStudentChoice = resp.selected_option_id === opt.id;
                        const isAnswerKey = opt.is_correct;

                        let style = 'bg-gray-50 border-gray-200 text-gray-700';
                        if (isAnswerKey) {
                          style = 'bg-green-50 border-green-400 text-green-900 font-semibold';
                        } else if (isStudentChoice && !isAnswerKey) {
                          style = 'bg-red-50 border-red-300 text-red-900 line-through';
                        }

                        return (
                          <div
                            key={opt.id}
                            className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${style}`}
                          >
                            <span className="h-5 w-5 rounded-full bg-white border border-gray-200 flex items-center justify-center font-bold text-[10px] shrink-0">
                              {opt.label}
                            </span>
                            <span className="flex-1">{opt.text}</span>
                            {isAnswerKey && (
                              <span className="text-[10px] bg-green-200 text-green-900 font-bold px-1.5 py-0.5 rounded shrink-0">
                                Đáp án đúng
                              </span>
                            )}
                            {isStudentChoice && (
                              <span className="text-[10px] bg-primary-100 text-primary-800 font-bold px-1.5 py-0.5 rounded shrink-0">
                                Bạn chọn
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Coding Question Submitted Code & Feedback */}
                  {isCoding && (
                    <div className="space-y-2.5 pt-1">
                      {resp.feedback && (
                        <div
                          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                            isCorrect
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-medium'
                              : 'bg-amber-50 border-amber-200 text-amber-800 font-medium'
                          }`}
                        >
                          <Terminal className="h-4 w-4 shrink-0" />
                          <span>{resp.feedback}</span>
                        </div>
                      )}

                      <div className="rounded-xl bg-slate-900 border border-slate-700 overflow-hidden font-mono text-xs shadow-xs">
                        <div className="bg-slate-800/90 px-3.5 py-2 text-slate-300 text-[11px] flex items-center justify-between border-b border-slate-700">
                          <span className="flex items-center gap-1.5 font-sans font-semibold">
                            <Code2 className="h-3.5 w-3.5 text-emerald-400" />
                            Mã nguồn đã nộp
                          </span>
                          <span className="text-slate-400 text-[10px]">Chấm tự động: compiler.edusoft.vn</span>
                        </div>
                        <pre className="p-3.5 text-slate-100 overflow-x-auto whitespace-pre leading-relaxed font-mono">
                          {resp.code_response || '// Không có mã nguồn nào được gửi'}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Essay Response Display */}
                  {isEssay && (() => {
                    const essay = parseEssayResponse(resp.text_response);
                    return (
                      <div className="space-y-2 pt-1">
                        <div className="text-xs font-semibold text-gray-700">Bài làm tự luận:</div>
                        {essay.text && (
                          <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
                            {essay.text}
                          </div>
                        )}
                        {essay.attachment && (
                          <div className="flex items-center justify-between bg-blue-50/60 border border-blue-200 rounded-xl p-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {['xls', 'xlsx'].includes(essay.attachment.type) ? (
                                <FileSpreadsheet className="h-5 w-5 text-emerald-600 shrink-0" />
                              ) : ['jpg', 'jpeg', 'png'].includes(essay.attachment.type) ? (
                                <FileImage className="h-5 w-5 text-amber-600 shrink-0" />
                              ) : (
                                <FileText className="h-5 w-5 text-blue-600 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-900 truncate">
                                  Tệp đính kèm: {essay.attachment.name}
                                </p>
                                <p className="text-[10px] text-gray-500">
                                  {(essay.attachment.size / 1024).toFixed(1)} KB
                                </p>
                              </div>
                            </div>
                            <a
                              href={essay.attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-700 bg-white border border-primary-200 rounded-lg hover:bg-primary-50 transition shrink-0 ml-2"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Mở tệp đính kèm
                            </a>
                          </div>
                        )}
                        {!essay.text && !essay.attachment && (
                          <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-400 italic">
                            (Không có nội dung tự luận)
                          </div>
                        )}

                        {resp.feedback && (
                          <div
                            className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                              isPendingItem
                                ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                                : isCorrect
                                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                                : 'bg-rose-50/80 border-rose-200 text-rose-900'
                            }`}
                          >
                            <div className="font-bold flex items-center gap-1.5">
                              {isPendingItem ? (
                                <Clock className="h-3.5 w-3.5 text-amber-600 animate-spin" />
                              ) : (
                                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                              )}
                              <span>Nhận xét từ hệ thống chấm AI theo Rubric:</span>
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed">{resp.feedback}</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Rationale / Explanation */}
                  {resp.rationale && (
                    <div className="mt-3 p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-900 space-y-1">
                      <span className="font-bold flex items-center gap-1 text-blue-800">
                        <BookOpen className="h-3.5 w-3.5" />
                        Lời giải chi tiết:
                      </span>
                      <p className="whitespace-pre-wrap">{resp.rationale}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
