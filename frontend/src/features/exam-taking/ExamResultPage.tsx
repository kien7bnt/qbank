import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  BookOpen,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { assignmentApi } from '@/services/api';
import type { AttemptResult, ResponseDetail } from '@/types';

export function ExamResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['attempt-result', attemptId],
    queryFn: () => assignmentApi.result(attemptId!),
    enabled: !!attemptId,
  });

  const result: AttemptResult | undefined = data?.data;

  if (isLoading || !result) {
    return <PageSpinner />;
  }

  const scorePercentage = Math.round(((result.score || 0) / (result.max_score || 10)) * 100);
  const isPassed = result.is_passed;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Actions */}
        <div className="flex items-center justify-between">
          <Link to="/assignments">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Quay lại danh sách bài tập
            </Button>
          </Link>
        </div>

        {/* Score Summary Card */}
        <div
          className={`rounded-3xl p-8 border text-center relative overflow-hidden shadow-sm ${
            isPassed
              ? 'bg-gradient-to-b from-green-50 to-white border-green-200'
              : 'bg-gradient-to-b from-amber-50 to-white border-amber-200'
          }`}
        >
          <div className="max-w-md mx-auto space-y-3">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                isPassed
                  ? 'bg-green-100 text-green-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {isPassed ? '🎉 Kết Quả: ĐẠT' : '⚠️ Kết Quả: CHƯA ĐẠT'}
            </span>

            <h1 className="text-2xl font-bold text-gray-900">
              {result.assignment_name}
            </h1>

            <div className="py-4">
              <div className="text-6xl font-black text-gray-900 tracking-tight">
                {result.score?.toFixed(2)}
                <span className="text-2xl text-gray-400 font-medium"> / {result.max_score} đ</span>
              </div>
              <p className="text-sm text-gray-500 mt-2 font-medium">
                Đúng {result.correct_answers_count} / {result.total_questions} câu ({scorePercentage}%)
              </p>
            </div>

            <div className="flex items-center justify-center gap-6 text-xs text-gray-500 pt-2 border-t border-gray-100">
              <span>Học sinh: <strong>{result.user_name}</strong></span>
              <span>Trạng thái: <strong className="text-green-600">Đã chấm điểm</strong></span>
            </div>
          </div>
        </div>

        {/* Question by Question Review */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Chi tiết bài làm & Lời giải</h2>

          <div className="space-y-4">
            {result.responses.map((resp: ResponseDetail, idx: number) => {
              const isCorrect = resp.is_correct;

              return (
                <div
                  key={resp.question_id || idx}
                  className={`bg-white border rounded-2xl p-6 shadow-sm space-y-4 transition-all ${
                    isCorrect ? 'border-green-200' : 'border-red-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                          isCorrect ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      >
                        {isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      </span>
                      <span className="font-bold text-gray-900 text-sm">
                        Câu {idx + 1}
                      </span>
                    </div>

                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        isCorrect
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {resp.points_earned} / {resp.points} điểm
                    </span>
                  </div>

                  {/* Stem */}
                  <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap leading-relaxed">
                    {resp.stem}
                  </p>

                  {/* Options */}
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
                              <span className="text-[10px] bg-green-200 text-green-900 font-bold px-1.5 py-0.5 rounded">
                                Đáp án đúng
                              </span>
                            )}
                            {isStudentChoice && (
                              <span className="text-[10px] bg-primary-100 text-primary-800 font-bold px-1.5 py-0.5 rounded">
                                Bạn chọn
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

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
