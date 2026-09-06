import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Clock, CheckCircle2, X, HelpCircle, Layers, Award } from 'lucide-react';
import { exerciseApi } from '@/services/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import type { Exam } from '@/types';

interface ExercisePreviewModalProps {
  exerciseId: string | null;
  open: boolean;
  onClose: () => void;
  onAssign?: (exercise: Exam) => void;
}

export function ExercisePreviewModal({
  exerciseId,
  open,
  onClose,
  onAssign,
}: ExercisePreviewModalProps) {
  const { data: exerciseRes, isLoading } = useQuery({
    queryKey: ['exercise-detail', exerciseId],
    queryFn: () => exerciseApi.get(exerciseId!),
    enabled: open && !!exerciseId,
  });

  const exercise = exerciseRes?.data;
  const sections = exercise?.sections ?? [];
  const allQuestions = sections.flatMap((s) => s.questions ?? []);

  return (
    <Modal
      open={open}
      onOpenChange={onClose}
      size="xl"
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-gray-900 text-base">
              {exercise?.name || 'Chi Tiết Bộ Bài Tập'}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 font-normal mt-0.5">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-gray-400" />
                {exercise?.duration_minutes || 45} phút
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Layers className="h-3.5 w-3.5 text-gray-400" />
                {allQuestions.length} câu hỏi
              </span>
              <span>•</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                {exercise?.practice_mode === 'linear' ? 'Làm tuần tự' : 'Tự do duyệt câu'}
              </span>
            </div>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-gray-500">
            Nguồn: Tham chiếu từ Ngân hàng câu hỏi
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              Đóng
            </Button>
            {onAssign && exercise && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  onClose();
                  onAssign(exercise);
                }}
              >
                Giao Bài Tập Cho Lớp
              </Button>
            )}
          </div>
        </div>
      }
    >
      {isLoading ? (
        <div className="py-12">
          <PageSpinner />
        </div>
      ) : !exercise ? (
        <div className="py-8 text-center text-sm text-gray-500">
          Không tìm thấy thông tin bộ bài tập.
        </div>
      ) : (
        <div className="space-y-4 py-1 max-h-[70vh] overflow-y-auto pr-1">
          {allQuestions.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              Bộ bài tập này chưa có câu hỏi nào.
            </div>
          ) : (
            allQuestions.map((q, idx) => (
              <div
                key={q.id || idx}
                className="p-4 rounded-xl border border-gray-200/90 bg-white shadow-2xs space-y-3"
              >
                {/* Header câu hỏi */}
                <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-6 min-w-6 px-1.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center">
                      Câu {idx + 1}
                    </span>
                    {q.bloom_level && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        {q.bloom_level}
                      </span>
                    )}
                    {q.difficulty && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
                        Mức: {q.difficulty}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">
                    {q.points || 1} điểm
                  </div>
                </div>

                {/* Nội dung câu hỏi (stem) */}
                <div className="text-sm font-medium text-gray-900 leading-relaxed whitespace-pre-wrap">
                  {q.stem}
                </div>

                {/* Phương án trắc nghiệm */}
                {q.options && q.options.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {q.options.map((opt) => (
                      <div
                        key={opt.id}
                        className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                          opt.is_correct
                            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900 font-semibold'
                            : 'bg-gray-50/70 border-gray-200 text-gray-700'
                        }`}
                      >
                        <span
                          className={`h-5 w-5 rounded-full flex items-center justify-center text-[11px] shrink-0 font-bold ${
                            opt.is_correct
                              ? 'bg-emerald-600 text-white'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {opt.label}
                        </span>
                        <span className="pt-0.5 leading-normal flex-1">{opt.text}</span>
                        {opt.is_correct && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Lời giải / Rationale */}
                {q.rationale && (
                  <div className="mt-2.5 p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                    <HelpCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Hướng dẫn giải: </span>
                      <span>{q.rationale}</span>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </Modal>
  );
}
