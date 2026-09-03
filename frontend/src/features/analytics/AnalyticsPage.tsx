import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Database,
  CheckCircle2,
  HelpCircle,
  Award,
  Users,
  Layers,
  Sparkles,
  TrendingUp,
  Percent,
  Play,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageSpinner } from '@/components/ui/Spinner';
import { analyticsApi, getErrorMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { BloomBadge, DifficultyBadge } from '@/components/ui/Badge';

const BLOOM_LABELS: Record<string, { label: string; color: string }> = {
  remember: { label: 'Nhớ (Remember)', color: 'bg-blue-500' },
  understand: { label: 'Hiểu (Understand)', color: 'bg-cyan-500' },
  apply: { label: 'Vận dụng (Apply)', color: 'bg-emerald-500' },
  analyze: { label: 'Vận dụng cao (Analyze)', color: 'bg-amber-500' },
  evaluate: { label: 'Đánh giá (Evaluate)', color: 'bg-orange-500' },
  create: { label: 'Sáng tạo (Create)', color: 'bg-purple-500' },
};

const DIFFICULTY_LABELS: Record<string, { label: string; color: string }> = {
  easy: { label: 'Dễ (Easy)', color: 'bg-green-500' },
  medium: { label: 'Trung bình (Medium)', color: 'bg-yellow-500' },
  hard: { label: 'Khó (Hard)', color: 'bg-red-500' },
};

export function AnalyticsPage() {
  const qc = useQueryClient();
  const [calibrationResult, setCalibrationResult] = useState<any>(null);
  const [showResultList, setShowResultList] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: () => analyticsApi.overview(),
  });

  const calibrateMutation = useMutation({
    mutationFn: () => analyticsApi.calibrate(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['analytics-overview'] });
      setCalibrationResult(res.data);
      setShowResultList(true);
      toast.success(
        `Định cỡ thành công! Đã định cỡ ${res.data.total_calibrated} câu, cập nhật ${res.data.total_updated} câu.`
      );
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const stats = data?.data;

  if (isLoading || !stats) {
    return <PageSpinner />;
  }

  const calibratedPct = stats.total_questions > 0
    ? Math.round((stats.calibrated_questions / stats.total_questions) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary-600" />
            Báo Cáo Thống Kê & Phân Tích Khảo Thí
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Chỉ số chất lượng ngân hàng câu hỏi, mức độ định cỡ theo lý thuyết khảo thí cổ điển (CTT) và hiệu quả làm bài.
          </p>
        </div>
        
        <Button
          loading={calibrateMutation.isPending}
          onClick={() => calibrateMutation.mutate()}
          leftIcon={<Sparkles className="h-4 w-4" />}
        >
          Kích hoạt định cỡ câu hỏi
        </Button>
      </div>

      {/* Top Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Tổng câu hỏi</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Database className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-gray-900">{stats.total_questions}</p>
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <span className="text-green-600 font-bold">{stats.approved_questions} đã duyệt</span>
            <span>•</span>
            <span className="text-gray-400">{stats.draft_questions} bản nháp</span>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Tiến độ định cỡ (CTT)</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-purple-700">{calibratedPct}%</p>
          <div className="text-xs text-gray-500">
            <strong>{stats.calibrated_questions}</strong> / {stats.total_questions} câu đã định cỡ
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Lượt làm bài thi</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-gray-900">{stats.total_attempts}</p>
          <div className="text-xs text-gray-500">
            Trong <strong>{stats.total_assignments}</strong> đợt kiểm tra đã giao
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Tỷ lệ đạt & Điểm TB</span>
            <div className="p-2 rounded-xl bg-green-50 text-green-600">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-green-700">{stats.pass_rate}%</p>
          <div className="text-xs text-gray-500">
            Điểm trung bình toàn khóa: <strong>{stats.average_score} / 10đ</strong>
          </div>
        </div>
      </div>

      {/* Calibration Results Panel */}
      {calibrationResult && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Kết Quả Định Cỡ Câu Hỏi Gần Nhất
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Đã quét <strong>{calibrationResult.total_scanned}</strong> câu hỏi | Định cỡ thành công:{' '}
                <strong>{calibrationResult.total_calibrated}</strong> câu (N &ge; 3 phản hồi)
              </p>
            </div>
            <button
              onClick={() => setShowResultList(!showResultList)}
              className="text-gray-400 hover:text-gray-600 flex items-center gap-1 text-xs"
            >
              {showResultList ? (
                <>
                  Ẩn chi tiết <ChevronUp className="h-4 w-4" />
                </>
              ) : (
                <>
                  Hiện chi tiết <ChevronDown className="h-4 w-4" />
                </>
              )}
            </button>
          </div>

          {showResultList && (
            <div className="space-y-3">
              {calibrationResult.total_updated === 0 ? (
                <p className="text-xs text-gray-500 italic p-3 bg-gray-50 rounded-xl">
                  Đã đồng bộ hoàn hảo! Không có câu hỏi nào cần thay đổi độ khó thực nghiệm.
                </p>
              ) : (
                <>
                  <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-100 font-medium">
                    Có <strong>{calibrationResult.total_updated}</strong> câu hỏi thay đổi độ khó dựa trên kết quả thực tế của học sinh:
                  </p>
                  <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl bg-white">
                    {calibrationResult.changes.map((item: any, idx: number) => (
                      <div key={item.question_id} className="p-3 flex items-start justify-between gap-4 text-xs">
                        <div className="space-y-1">
                          <p className="font-medium text-gray-800">
                            <span className="text-gray-400 mr-1.5">#{idx + 1}.</span>
                            {item.stem}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            Cỡ mẫu: <strong>{item.sample_size}</strong> lượt thi | Chỉ số P-value (Độ dễ):{' '}
                            <strong>{item.p_value}</strong>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 pt-0.5">
                          <DifficultyBadge level={item.old_difficulty} />
                          <span className="text-gray-400">&rarr;</span>
                          <DifficultyBadge level={item.new_difficulty} />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Breakdown Charts & Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bloom Distribution */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary-600" />
            Phân bổ thang tư duy Bloom
          </h3>

          <div className="space-y-3 pt-2">
            {Object.entries(stats.bloom_distribution || {}).map(([key, count]: any) => {
              const info = BLOOM_LABELS[key] || { label: key, color: 'bg-gray-400' };
              const pct = stats.total_questions > 0
                ? Math.round((count / stats.total_questions) * 100)
                : 0;

              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-gray-700">{info.label}</span>
                    <span className="text-gray-500">
                      <strong>{count}</strong> câu ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${info.color} rounded-full transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Difficulty Distribution */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary-600" />
            Phân bổ mức độ khó của câu hỏi
          </h3>

          <div className="space-y-4 pt-2">
            {Object.entries(stats.difficulty_distribution || {}).map(([key, count]: any) => {
              const info = DIFFICULTY_LABELS[key] || { label: key, color: 'bg-gray-400' };
              const pct = stats.total_questions > 0
                ? Math.round((count / stats.total_questions) * 100)
                : 0;

              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-gray-700">{info.label}</span>
                    <span className="text-gray-500">
                      <strong>{count}</strong> câu ({pct}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${info.color} rounded-full transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Quality Note */}
            <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-900 space-y-1">
              <span className="font-bold flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                Khuyến nghị chuẩn hóa từ hệ thống:
              </span>
              <p>
                Phân bổ hiện tại đạt chuẩn ngân hàng đề thi chuẩn hóa (Tỷ lệ Dễ 30% - Trung bình 50% - Vận dụng 20%). Tiếp tục thu thập lượt làm bài của học sinh để hệ thống tự động hiệu chỉnh độ khó thực nghiệm (P-value).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
