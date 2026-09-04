import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, CheckCircle2, Award, Edit3, MessageSquare, AlertCircle, Quote } from 'lucide-react';
import toast from 'react-hot-toast';
import { rubricApi, getErrorMessage } from '@/services/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageSpinner } from '@/components/ui/Spinner';
import type { EssayGrading } from '@/types';

interface EssayGradingReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  responseId: string;
  studentName?: string;
  questionStem: string;
  sampleAnswer?: string;
  studentAnswer: string;
  maxPoints?: number;
}

export function EssayGradingReviewModal({
  open,
  onOpenChange,
  responseId,
  studentName,
  questionStem,
  sampleAnswer,
  studentAnswer,
  maxPoints = 10.0,
}: EssayGradingReviewModalProps) {
  const qc = useQueryClient();

  // Review Form state
  const [overrideScore, setOverrideScore] = useState<number>(0);
  const [teacherComment, setTeacherComment] = useState('');
  const [isEditingScore, setIsEditingScore] = useState(false);

  // Fetch existing essay grading record
  const { data: gradingData, isLoading, refetch } = useQuery({
    queryKey: ['essay-grading', responseId],
    queryFn: async () => {
      try {
        const res = await rubricApi.getEssayGrading(responseId);
        if (res.data) {
          setOverrideScore(res.data.final_score);
          setTeacherComment(res.data.final_feedback || '');
        }
        return res.data;
      } catch (e) {
        return null;
      }
    },
    enabled: open && !!responseId,
  });

  const grading: EssayGrading | null = gradingData || null;

  // AI Grade Mutation
  const gradeWithAIMutation = useMutation({
    mutationFn: () => rubricApi.gradeEssay(responseId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['essay-grading', responseId] });
      setOverrideScore(res.data.final_score);
      setTeacherComment(res.data.final_feedback || '');
      toast.success('Đã hoàn tất phân tích và chấm điểm bằng AI!');
      refetch();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Teacher Review Mutation
  const reviewMutation = useMutation({
    mutationFn: (action: 'confirm' | 'override') => {
      if (!grading) throw new Error('Chưa có bản chấm điểm để xác nhận');
      return rubricApi.reviewEssay(grading.id, {
        new_score: overrideScore,
        comment: teacherComment.trim(),
        action,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['essay-grading', responseId] });
      qc.invalidateQueries({ queryKey: ['assignment-submissions'] });
      toast.success('Đã lưu đánh giá của giáo viên thành công!');
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
          <Sparkles className="h-5 w-5 text-purple-600" />
          <span>Chấm & Đánh giá Bài Tự Luận {studentName ? `— ${studentName}` : ''}</span>
        </div>
      }
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>

          <div className="flex items-center gap-2">
            {!grading ? (
              <Button
                onClick={() => gradeWithAIMutation.mutate()}
                loading={gradeWithAIMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                Chấm AI theo Rubric
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => gradeWithAIMutation.mutate()}
                  loading={gradeWithAIMutation.isPending}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1 text-purple-600" />
                  Chấm lại bằng AI
                </Button>
                <Button
                  onClick={() => reviewMutation.mutate(overrideScore !== grading.ai_score ? 'override' : 'confirm')}
                  loading={reviewMutation.isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  Lưu điểm số ({overrideScore} / {maxPoints} đ)
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Question & Student Answer */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Đề bài câu hỏi</h4>
            <p className="text-sm font-semibold text-gray-900 leading-relaxed whitespace-pre-line">{questionStem}</p>

            {sampleAnswer && (
              <div className="pt-2 border-t border-gray-200">
                <span className="text-[11px] font-bold text-gray-500 uppercase">Đáp án mẫu / Hướng dẫn:</span>
                <p className="text-xs text-gray-600 italic mt-0.5">{sampleAnswer}</p>
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-800">Bài làm của học sinh</h4>
              <span className="text-xs text-blue-600 font-medium">Thang điểm: {maxPoints}đ</span>
            </div>
            <div className="text-sm text-gray-800 leading-relaxed bg-white p-3 rounded-lg border border-blue-100 min-h-[120px] whitespace-pre-line">
              {studentAnswer ? studentAnswer : <em className="text-gray-400">Học sinh không nhập câu trả lời.</em>}
            </div>
          </div>
        </div>

        {/* AI Evaluation Breakdown */}
        {isLoading ? (
          <PageSpinner />
        ) : !grading ? (
          <div className="p-8 rounded-2xl border border-dashed border-purple-200 bg-purple-50/50 text-center space-y-3">
            <Sparkles className="h-8 w-8 text-purple-600 mx-auto" />
            <h4 className="text-sm font-bold text-gray-900">Chưa có kết quả chấm tự luận</h4>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Bấm nút "Chấm AI theo Rubric" để AI tự động phân tích câu trả lời, trích xuất dẫn chứng và tính điểm tất định.
            </p>
            <Button
              onClick={() => gradeWithAIMutation.mutate()}
              loading={gradeWithAIMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              size="sm"
            >
              <Sparkles className="h-4 w-4 mr-1.5" />
              Bắt đầu chấm AI
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Score Banner */}
            <div className="p-4 rounded-2xl border border-purple-200 bg-purple-50/80 flex items-center justify-between flex-wrap gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-purple-700">Điểm AI đề xuất</span>
                <p className="text-2xl font-black text-purple-900 font-mono mt-0.5">
                  {Number(grading.ai_score ?? 0).toFixed(2)} <span className="text-sm font-normal text-purple-700">/ {maxPoints} đ</span>
                </p>
                <span className="text-xs text-purple-600">
                  Trạng thái: {grading.status === 'teacher_reviewed' ? 'Giáo viên đã duyệt' : 'Đã chấm tự động'}
                </span>
              </div>

              <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-purple-100 shadow-xs">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase">Điểm chính thức</label>
                  <input
                    type="number"
                    step="0.25"
                    min={0}
                    max={maxPoints}
                    value={overrideScore}
                    onChange={(e) => setOverrideScore(Number(e.target.value))}
                    className="w-20 px-2 py-1 border border-gray-300 rounded-lg text-base font-bold text-gray-900 font-mono text-center focus:border-primary-500"
                  />
                </div>
              </div>
            </div>

            {/* Criteria Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600">
                Chi tiết đánh giá theo từng tiêu chí Rubric ({grading.criteria_breakdown?.length || 0})
              </h4>

              <div className="space-y-2.5">
                {grading.criteria_breakdown?.map((crit, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-gray-200 bg-white shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-gray-900 text-sm">{crit.criterion_name}</span>
                        {crit.level_name && (
                          <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium">
                            {crit.level_name}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-mono font-bold text-purple-700">
                        {crit.score} / {crit.max_score} đ
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 pl-7">{crit.reason}</p>

                    {crit.evidence && (
                      <div className="ml-7 p-2 rounded-lg bg-gray-50 border border-gray-100 flex items-start gap-2 text-xs text-gray-700">
                        <Quote className="h-3.5 w-3.5 text-purple-500 shrink-0 mt-0.5" />
                        <span className="italic">Dẫn chứng: "{crit.evidence}"</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Teacher Feedback textarea */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
                Nhận xét & Lời khuyên của Giáo viên gửi học sinh
              </label>
              <textarea
                rows={3}
                value={teacherComment}
                onChange={(e) => setTeacherComment(e.target.value)}
                placeholder="Nhập nhận xét sư phạm dành cho học sinh..."
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
