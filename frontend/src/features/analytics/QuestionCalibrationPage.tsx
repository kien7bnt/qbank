import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Scale,
  Cpu,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  Activity,
  Layers,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { questionApi, analyticsApi, getErrorMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import type { QuestionListItem, BloomLevel, DifficultyLevel, QuestionType } from '@/types';

type CalibrationTab = 'all' | 'calibrated' | 'uncalibrated';

export function QuestionCalibrationPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<CalibrationTab>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [bloomFilter, setBloomFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Fetch Questions
  const { data: questionData, isLoading } = useQuery({
    queryKey: ['questions-calibration', page, pageSize, searchTerm, typeFilter, bloomFilter, difficultyFilter],
    queryFn: async () => {
      const res = await questionApi.list({
        page,
        page_size: pageSize,
        search: searchTerm || undefined,
        type: typeFilter !== 'all' ? (typeFilter as QuestionType) : undefined,
        bloom_level: bloomFilter !== 'all' ? (bloomFilter as BloomLevel) : undefined,
        difficulty: difficultyFilter !== 'all' ? (difficultyFilter as DifficultyLevel) : undefined,
      });
      return res.data;
    },
  });

  const allQuestions: QuestionListItem[] = questionData?.items || [];
  const totalCount = questionData?.total || 0;
  const totalPages = questionData?.total_pages || 1;

  // Overview stats for quick dashboard metrics
  const { data: overviewStats } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: async () => {
      try {
        const res = await analyticsApi.overview();
        return res.data;
      } catch {
        return null;
      }
    },
  });

  // Run Calibration Mutation
  const calibrateMutation = useMutation({
    mutationFn: () => analyticsApi.calibrate(),
    onSuccess: (data: any) => {
      const scanned = data?.data?.total_scanned ?? 0;
      const calibrated = data?.data?.total_calibrated ?? 0;
      const updated = data?.data?.total_updated ?? 0;
      toast.success(
        `Định cỡ hoàn tất! Đã quét ${scanned} câu hỏi, xác thực ${calibrated} câu chuẩn hóa IRT, cập nhật ${updated} câu.`
      );
      qc.invalidateQueries({ queryKey: ['questions-calibration'] });
      qc.invalidateQueries({ queryKey: ['analytics-overview'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Filter questions based on calibration status tab
  const displayedQuestions = allQuestions.filter((q) => {
    const isCalibrated = q.is_calibrated ?? ((q.response_count || 0) >= 10);
    if (activeTab === 'calibrated') return isCalibrated;
    if (activeTab === 'uncalibrated') return !isCalibrated;
    return true;
  });

  // Calculate local stats if server overview is loading
  const localCalibratedCount = allQuestions.filter(
    (q) => q.is_calibrated ?? ((q.response_count || 0) >= 10)
  ).length;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                  Định Cỡ Câu Hỏi (Item Calibration & IRT)
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Chuẩn hóa
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Phân loại câu hỏi đã định cỡ và chưa định cỡ từ dữ liệu làm bài thực tế để ma trận đề thi đạt độ tin cậy và phân loại tối ưu.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => calibrateMutation.mutate()}
            loading={calibrateMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
          >
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Chạy Định Cỡ Hệ Thống
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Tổng số câu hỏi</span>
            <Layers className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-black text-gray-900 mt-1 font-mono">{totalCount}</p>
          <span className="text-[11px] text-gray-400">Trong ngân hàng câu hỏi</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 uppercase">Đã Định Cỡ (IRT)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700 mt-1 font-mono">
            {overviewStats?.calibrated_count ?? localCalibratedCount}
          </p>
          <span className="text-[11px] text-emerald-600">Đạt chuẩn N ≥ 10 bài nộp</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800 uppercase">Chưa Định Cỡ</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-700 mt-1 font-mono">
            {Math.max(0, totalCount - (overviewStats?.calibrated_count ?? localCalibratedCount))}
          </p>
          <span className="text-[11px] text-amber-600">Cần tích lũy thêm bài làm</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-indigo-200 bg-indigo-50/20 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-800 uppercase">Tỷ Lệ Chuẩn Hóa</span>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-black text-indigo-700 mt-1 font-mono">
            {totalCount > 0
              ? `${Math.round(((overviewStats?.calibrated_count ?? localCalibratedCount) / totalCount) * 100)}%`
              : '0%'}
          </p>
          <span className="text-[11px] text-indigo-600">Sẵn sàng xuất đề thi chuẩn</span>
        </div>
      </div>

      {/* Explanatory Guide Box */}
      <div className="bg-gradient-to-r from-indigo-50/90 to-blue-50/70 border border-indigo-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5">
        <Cpu className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs text-indigo-950 leading-relaxed">
          <p className="font-bold text-sm text-indigo-900">
            Nguyên lý Định Cỡ & Lợi Ích Trong Tạo Đề Thi:
          </p>
          <p className="text-indigo-800">
            • <strong>Câu đã định cỡ (Calibrated):</strong> Đã có từ 10 lượt học sinh làm bài trở lên, hệ thống tự động xác định tham số thực tế gồm <em>Độ phân biệt (a)</em>, <em>Độ khó thực nghiệm (b)</em> và <em>Đoán mò ngẫu nhiên (c)</em>. Giúp thuật toán sinh đề tự động cân bằng năng lực và đảm bảo đề thi có độ tin cậy cao.
          </p>
          <p className="text-indigo-800">
            • <strong>Câu chưa định cỡ:</strong> Sử dụng độ khó và Bloom ước lượng ban đầu của giáo viên. Sau khi học sinh thi hoặc nộp bài tập đủ 10 lần, hệ thống sẽ tự động chuyển trạng thái sang <em>Đã chuẩn hóa</em>.
          </p>
        </div>
      </div>

      {/* Tab Selectors & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-gray-100 pb-3 overflow-x-auto">
          <button
            onClick={() => {
              setActiveTab('all');
              setPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Tất cả câu hỏi
          </button>

          <button
            onClick={() => {
              setActiveTab('calibrated');
              setPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'calibrated'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Đã Định Cỡ (IRT Chuẩn Hóa)
          </button>

          <button
            onClick={() => {
              setActiveTab('uncalibrated');
              setPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
              activeTab === 'uncalibrated'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Chưa Định Cỡ (&lt; 10 lượt làm)
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo nội dung, mã câu..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 outline-hidden focus:border-indigo-500 transition"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs rounded-xl border border-gray-200 px-3 py-2 outline-hidden focus:border-indigo-500 bg-white"
          >
            <option value="all">Mọi loại câu hỏi</option>
            <option value="mcq">Trắc nghiệm (MCQ)</option>
            <option value="essay">Tự luận (Essay)</option>
            <option value="coding">Lập trình (Coding)</option>
          </select>

          <select
            value={bloomFilter}
            onChange={(e) => {
              setBloomFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs rounded-xl border border-gray-200 px-3 py-2 outline-hidden focus:border-indigo-500 bg-white"
          >
            <option value="all">Mọi cấp độ Bloom</option>
            <option value="remember">Nhận biết (Remember)</option>
            <option value="understand">Thông hiểu (Understand)</option>
            <option value="apply">Vận dụng (Apply)</option>
            <option value="analyze">Vận dụng cao (Analyze)</option>
          </select>

          <select
            value={difficultyFilter}
            onChange={(e) => {
              setDifficultyFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs rounded-xl border border-gray-200 px-3 py-2 outline-hidden focus:border-indigo-500 bg-white"
          >
            <option value="all">Mọi độ khó</option>
            <option value="easy">Dễ</option>
            <option value="medium">Trung bình</option>
            <option value="hard">Khó</option>
          </select>
        </div>
      </div>

      {/* Table of Questions with IRT Parameters */}
      {isLoading ? (
        <PageSpinner />
      ) : displayedQuestions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <EmptyState
            title="Không tìm thấy câu hỏi phù hợp"
            description="Hãy thử thay đổi điều kiện lọc hoặc từ khóa tìm kiếm."
          />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Mã & Đề bài</th>
                  <th className="py-3 px-4">Phân loại</th>
                  <th className="py-3 px-4 text-center">Trạng thái Định cỡ</th>
                  <th className="py-3 px-4 text-center">Lượt làm bài (N)</th>
                  <th className="py-3 px-4 text-center">Chỉ số CTT (P, D)</th>
                  <th className="py-3 px-4 text-center">Tham số IRT 3PL (a, b, c)</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedQuestions.map((q) => {
                  const isCalibrated = q.is_calibrated ?? ((q.response_count || 0) >= 10);
                  const responses = q.response_count || 0;
                  const pVal = q.actual_difficulty != null ? Number(q.actual_difficulty).toFixed(2) : '-';
                  const dVal = q.discrimination_index != null ? Number(q.discrimination_index).toFixed(2) : '-';
                  const irtA = q.irt_a != null ? Number(q.irt_a).toFixed(2) : '1.05';
                  const irtB = q.irt_b != null ? Number(q.irt_b).toFixed(2) : '0.00';
                  const irtC = q.irt_c != null ? Number(q.irt_c).toFixed(2) : (q.type === 'mcq' ? '0.25' : '0.00');

                  return (
                    <tr key={q.id} className="hover:bg-gray-50/60 transition">
                      <td className="py-3 px-4 max-w-xs">
                        <span className="font-mono text-[11px] font-bold text-gray-500 block">
                          {q.item_id}
                        </span>
                        <p className="text-gray-900 font-medium line-clamp-2 mt-0.5">
                          {q.stem_preview}
                        </p>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-700">
                            {q.type}
                          </span>
                          <div className="text-[11px] text-gray-500">
                            {q.bloom_level || 'N/A'} • {q.expected_difficulty || 'N/A'}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isCalibrated ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Đã chuẩn hóa
                          </span>
                        ) : (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              Chưa định cỡ
                            </span>
                            <span className="text-[10px] text-amber-600 mt-0.5">
                              Cần thêm {Math.max(0, 10 - responses)} bài nộp
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap font-mono">
                        <div className="font-bold text-gray-900">{responses} / 10</div>
                        <div className="w-16 mx-auto bg-gray-200 rounded-full h-1.5 mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isCalibrated ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(100, (responses / 10) * 100)}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap font-mono">
                        <div className="text-gray-900 font-semibold">
                          P: <span className="text-indigo-600">{pVal}</span> | D:{' '}
                          <span className="text-purple-600">{dVal}</span>
                        </div>
                        <span className="text-[10px] text-gray-400">Độ dễ & Độ phân biệt</span>
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap font-mono">
                        <div className="flex items-center justify-center gap-1.5 font-bold">
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100" title="Phân biệt (a)">
                            a: {irtA}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100" title="Độ khó (b)">
                            b: {irtB}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100" title="Đoán mò (c)">
                            c: {irtC}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400">Mô hình IRT 3PL</span>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => navigate(`/question-bank`)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
                        >
                          Ngân hàng
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>
                Hiển thị trang {page} trên tổng {totalPages} trang
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
