import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, CheckCircle, BarChart2, Sparkles, Edit3, Trash2, BookOpen, FileText, Layers, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { questionApi, apiClient, analyticsApi, getErrorMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import {
  QuestionStatusBadge, QuestionTypeBadge, BloomBadge, DifficultyBadge
} from '@/components/ui/Badge';
import { EditQuestionModal } from './EditQuestionModal';

interface QuestionDetailDrawerProps {
  questionId: string | null;
  onClose: () => void;
}

export function QuestionDetailDrawer({ questionId, onClose }: QuestionDetailDrawerProps) {
  const qc = useQueryClient();
  const [reviewData, setReviewData] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['question', questionId],
    queryFn: () => questionApi.get(questionId!),
    enabled: !!questionId,
  });

  const { data: psychometricsData } = useQuery({
    queryKey: ['question-psychometrics', questionId],
    queryFn: () => analyticsApi.psychometrics(questionId!),
    enabled: !!questionId,
  });

  const { data: usageData } = useQuery({
    queryKey: ['question-usage', questionId],
    queryFn: () => questionApi.getUsage(questionId!),
    enabled: !!questionId,
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/ai/questions/${questionId}/review`);
      return res.data;
    },
    onSuccess: (data) => {
      setReviewData(data);
      toast.success('Đã nhận được đánh giá từ AI');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => questionApi.delete(questionId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions'] });
      toast.success('Đã xóa câu hỏi khỏi ngân hàng');
      onClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const q = data?.data;
  const psycho = psychometricsData?.data;
  const usage = usageData?.data;

  if (!questionId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/20"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-40 w-[480px] flex flex-col bg-white shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            {q && (
              <>
                <span className="font-mono text-sm text-gray-500">{q.item_id}</span>
                <QuestionTypeBadge type={q.type} />
                <QuestionStatusBadge status={q.status} />
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <PageSpinner />
          ) : q ? (
            <div className="p-5 space-y-5">
              {/* Stem */}
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Nội dung câu hỏi</p>
                <p className="text-gray-900 whitespace-pre-wrap">{q.stem}</p>
              </div>

              {/* MCQ Options */}
              {q.type === 'mcq' && q.options.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Đáp án</p>
                  <div className="space-y-2">
                    {q.options.map((opt: any) => (
                      <div
                        key={opt.id}
                        className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
                          opt.is_correct
                            ? 'border-green-200 bg-green-50'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className={`shrink-0 mt-0.5 ${opt.is_correct ? 'text-green-600' : 'text-gray-400'}`}>
                          {opt.is_correct ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-xs font-medium text-gray-500">
                              {opt.label}
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm ${opt.is_correct ? 'font-medium text-green-800' : 'text-gray-700'}`}>
                            {opt.text}
                          </p>
                          {opt.distractor_reason && (
                            <p className="mt-0.5 text-xs text-gray-400 italic">
                              Lý do nhiễu: {opt.distractor_reason}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Essay */}
              {q.type === 'essay' && q.essay_data && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Đáp án mẫu</p>
                  <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm text-gray-700 whitespace-pre-wrap">
                    {q.essay_data.sample_answer ?? 'Chưa có đáp án mẫu'}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Điểm tối đa: {q.essay_data.max_points}</p>
                </div>
              )}

              {/* Rationale */}
              {q.rationale && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Giải thích</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{q.rationale}</p>
                </div>
              )}

              <hr className="border-gray-100" />

              {/* Metadata */}
              <div>
                <p className="text-sm font-medium text-gray-500 mb-2">Phân loại</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {q.chapter_name && (
                    <>
                      <span className="text-gray-500">Chương</span>
                      <span className="text-gray-900">{q.chapter_name}</span>
                    </>
                  )}
                  {q.topic_name && (
                    <>
                      <span className="text-gray-500">Chủ đề</span>
                      <span className="text-gray-900">{q.topic_name}</span>
                    </>
                  )}
                  {q.bloom_level && (
                    <>
                      <span className="text-gray-500">Bloom</span>
                      <BloomBadge level={q.bloom_level} />
                    </>
                  )}
                  {q.expected_difficulty && (
                    <>
                      <span className="text-gray-500">Độ khó (dự kiến)</span>
                      <DifficultyBadge level={q.expected_difficulty} />
                    </>
                  )}
                  <>
                    <span className="text-gray-500">Phiên bản</span>
                    <span className="text-gray-900">v{q.version}</span>
                  </>
                  <>
                    <span className="text-gray-500">Ngày tạo</span>
                    <span className="text-gray-900">
                      {format(new Date(q.created_at), 'dd/MM/yyyy', { locale: vi })}
                    </span>
                  </>
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Psychometrics Engine */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-primary-600" />
                    <p className="text-sm font-semibold text-gray-900">Chỉ số Khảo thí (Psychometrics)</p>
                  </div>
                  {psycho?.is_calibrated && (
                    <span className="text-xs bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded-full border border-green-200">
                      Đã định cỡ ({psycho.sample_size} lượt thi)
                    </span>
                  )}
                </div>

                {psycho && psycho.is_calibrated ? (
                  <div className="bg-primary-50/60 border border-primary-100 rounded-xl p-4 space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white p-2.5 rounded-lg border border-primary-100">
                        <span className="text-gray-500">Độ khó thực tế (P)</span>
                        <p className="text-base font-bold text-primary-900">{psycho.facility_index_p} ({psycho.real_difficulty_label})</p>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-primary-100">
                        <span className="text-gray-500">Độ phân biệt (D)</span>
                        <p className="text-base font-bold text-primary-900">{psycho.discrimination_index_d}</p>
                      </div>
                    </div>
                    <p className="text-primary-800 font-medium italic">
                      💡 {psycho.quality_evaluation}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 p-4 text-center">
                    <p className="text-sm font-medium text-gray-600">Chưa định cỡ</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {psycho?.status_text || 'Câu hỏi chưa có đủ dữ liệu thi thực tế.'}
                    </p>
                  </div>
                )}
              </div>

              <hr className="border-gray-100" />

              {/* Lịch sử sử dụng trong Kho Bài Tập & Kho Kiểm Tra */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-emerald-600" />
                    <p className="text-sm font-semibold text-gray-900">
                      Lịch sử Sử dụng ({usage?.usage_count ?? q.usage_count ?? 0} lần)
                    </p>
                  </div>
                  {(usage?.usage_count || q.usage_count) ? (
                    <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                      Đang tham chiếu
                    </span>
                  ) : null}
                </div>

                {usage && usage.assessments && usage.assessments.length > 0 ? (
                  <div className="space-y-2">
                    {usage.assessments.map((a) => (
                      <div
                        key={a.id}
                        className="p-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50/70 transition-colors flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`p-1.5 rounded-lg shrink-0 ${
                              a.type === 'exercise'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}
                          >
                            {a.type === 'exercise' ? (
                              <BookOpen className="h-3.5 w-3.5" />
                            ) : (
                              <FileText className="h-3.5 w-3.5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 truncate">
                              {a.name}
                            </div>
                            <div className="text-[11px] text-gray-400 mt-0.5">
                              {a.type === 'exercise' ? 'Kho Bài Tập' : 'Kho Đề Thi'} • {a.question_count} câu
                            </div>
                          </div>
                        </div>

                        <div className="text-[11px] text-gray-500 shrink-0">
                          {format(new Date(a.created_at), 'dd/MM/yyyy', { locale: vi })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl bg-gray-50 border border-dashed border-gray-200 p-3.5 text-center text-xs text-gray-500">
                    Câu hỏi này chưa được đưa vào bài tập hay đề thi nào.
                  </div>
                )}
              </div>

              {/* Thông số IRT (Item Response Theory) */}
              <div className="bg-gradient-to-br from-blue-50/60 to-indigo-50/40 border border-blue-100 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs font-bold text-indigo-900">
                    Mô hình Trắc lượng IRT (Item Response Theory)
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white p-2 rounded-lg border border-indigo-100">
                    <span className="text-[10px] text-gray-500 block">Độ phân biệt (a)</span>
                    <span className="text-xs font-bold text-indigo-900">
                      {q.irt_a !== null && q.irt_a !== undefined ? q.irt_a.toFixed(2) : '—'}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-indigo-100">
                    <span className="text-[10px] text-gray-500 block">Độ khó (b)</span>
                    <span className="text-xs font-bold text-indigo-900">
                      {q.irt_b !== null && q.irt_b !== undefined ? q.irt_b.toFixed(2) : '—'}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-indigo-100">
                    <span className="text-[10px] text-gray-500 block">Đoán mò (c)</span>
                    <span className="text-xs font-bold text-indigo-900">
                      {q.irt_c !== null && q.irt_c !== undefined ? q.irt_c.toFixed(2) : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* AI Review Result */}
              {reviewData && (
                <div className="rounded-lg bg-purple-50 border border-purple-200 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    <p className="text-sm font-semibold text-purple-900">AI Đánh giá chất lượng (Điểm: {Math.round(reviewData.overall_score * 100)}/100)</p>
                  </div>
                  
                  {reviewData.issues && reviewData.issues.length > 0 ? (
                    <div className="space-y-2">
                      {reviewData.issues.map((issue: any, idx: number) => (
                        <div key={idx} className="bg-white rounded p-2 text-sm border border-purple-100">
                          <span className={`font-semibold mr-1 ${issue.severity === 'high' ? 'text-red-600' : 'text-orange-600'}`}>
                            [{issue.category.toUpperCase()}]
                          </span>
                          {issue.description}
                          {issue.suggestion && (
                            <p className="text-gray-500 mt-1 italic">💡 {issue.suggestion}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-green-700 font-medium">✨ Câu hỏi đạt chất lượng tốt, không phát hiện lỗi.</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-5 text-sm text-gray-500">Không tìm thấy câu hỏi</div>
          )}
        </div>

        {/* Footer */}
        {q && (
          <div className="border-t border-gray-100 px-5 py-3 flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="secondary"
              className="flex-1"
              onClick={() => setEditOpen(true)}
            >
              <Edit3 className="h-4 w-4 mr-1" />
              Chỉnh sửa
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 hover:bg-red-50 hover:border-red-200"
              loading={deleteMutation.isPending}
              onClick={() => {
                if (confirm(`Bạn có chắc muốn xóa câu hỏi ${q.item_id}?`)) {
                  deleteMutation.mutate();
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Xóa
            </Button>
            <Button 
              size="sm" 
              className="w-full bg-purple-600 hover:bg-purple-700 text-white mt-2"
              loading={reviewMutation.isPending}
              onClick={() => reviewMutation.mutate()}
            >
              <Sparkles className="h-4 w-4 mr-1.5" />
              AI Đánh giá
            </Button>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <EditQuestionModal
        question={q ?? null}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}

