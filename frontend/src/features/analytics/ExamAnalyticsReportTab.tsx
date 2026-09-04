import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Award,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  FileSpreadsheet,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { examApi, examAnalyticsApi } from '@/services/api';
import { PageSpinner } from '@/components/ui/Spinner';
import { BloomBadge, DifficultyBadge } from '@/components/ui/Badge';

export function ExamAnalyticsReportTab() {
  const [selectedExamId, setSelectedExamId] = useState<string>('');

  // Fetch all exams
  const { data: examsData, isLoading: isLoadingExams } = useQuery({
    queryKey: ['exams-list'],
    queryFn: () => examApi.list(),
  });

  const exams = examsData?.data || [];

  // Set default selected exam if not set
  if (!selectedExamId && exams.length > 0) {
    setSelectedExamId(exams[0].id);
  }

  // Fetch overview
  const { data: overviewData, isLoading: isLoadingOverview } = useQuery({
    queryKey: ['exam-analytics-overview', selectedExamId],
    queryFn: () => examAnalyticsApi.getOverview(selectedExamId),
    enabled: !!selectedExamId,
  });

  // Fetch student results
  const { data: studentsData, isLoading: isLoadingStudents } = useQuery({
    queryKey: ['exam-analytics-students', selectedExamId],
    queryFn: () => examAnalyticsApi.getStudents(selectedExamId),
    enabled: !!selectedExamId,
  });

  // Fetch question psychometrics
  const { data: questionsData, isLoading: isLoadingQuestions } = useQuery({
    queryKey: ['exam-analytics-questions', selectedExamId],
    queryFn: () => examAnalyticsApi.getQuestions(selectedExamId),
    enabled: !!selectedExamId,
  });

  const overview = overviewData?.data;
  const students = studentsData?.data || [];
  const questions = questionsData?.data || [];

  if (isLoadingExams) return <PageSpinner />;

  return (
    <div className="space-y-6">
      {/* Exam Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-gray-200 bg-white shadow-xs">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
            Chọn đề thi để phân tích
          </label>
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm font-semibold text-gray-900 focus:border-primary-500 focus:outline-none min-w-[280px]"
          >
            {exams.map((ex: any) => (
              <option key={ex.id} value={ex.id}>
                {ex.name} ({ex.duration_minutes || 45} phút)
              </option>
            ))}
          </select>
        </div>

        {overview && (
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Tổng lượt làm: <strong>{overview.total_attempts}</strong></span>
            <span>Đã nộp: <strong>{overview.total_submissions}</strong></span>
          </div>
        )}
      </div>

      {isLoadingOverview ? (
        <PageSpinner />
      ) : !overview ? (
        <div className="p-8 text-center text-gray-400 bg-white rounded-2xl border border-gray-200">
          Chưa có dữ liệu bài làm cho đề thi này.
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Điểm trung bình</span>
              <p className="text-3xl font-black text-primary-600 font-mono">
                {Number(overview?.average_score ?? 0).toFixed(2)} <span className="text-sm font-normal text-gray-400">/ 10đ</span>
              </p>
              <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-100">
                <span>Cao nhất: <strong>{overview.highest_score}đ</strong></span>
                <span>Thấp nhất: <strong>{overview.lowest_score}đ</strong></span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Tỷ lệ Đạt (≥ 5.0đ)</span>
              <p className="text-3xl font-black text-green-600 font-mono">
                {overview.pass_rate}%
              </p>
              <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-100">
                <span className="text-green-700">Đạt: {overview.passed_count}</span>
                <span className="text-red-600">Chưa đạt: {overview.failed_count}</span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Lượt nộp bài</span>
              <p className="text-3xl font-black text-gray-900 font-mono">
                {overview.total_submissions}
              </p>
              <p className="text-xs text-gray-400 pt-1 border-t border-gray-100">
                Tổng thí sinh tham gia: {overview.total_attempts}
              </p>
            </div>

            {/* Score Distribution Bars */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Phổ điểm học sinh</span>
              <div className="grid grid-cols-4 gap-1.5 items-end h-12 pt-2">
                {[
                  { label: '< 5', val: overview.score_distribution?.under_5 || 0, color: 'bg-red-400' },
                  { label: '5-6.5', val: overview.score_distribution?.['5_to_6_5'] || 0, color: 'bg-amber-400' },
                  { label: '6.5-8', val: overview.score_distribution?.['6_5_to_8'] || 0, color: 'bg-blue-400' },
                  { label: '8-10', val: overview.score_distribution?.['8_to_10'] || 0, color: 'bg-green-500' },
                ].map((bar, i) => {
                  const maxH = Math.max(
                    1,
                    overview.score_distribution?.under_5 || 0,
                    overview.score_distribution?.['5_to_6_5'] || 0,
                    overview.score_distribution?.['6_5_to_8'] || 0,
                    overview.score_distribution?.['8_to_10'] || 0
                  );
                  const hPct = Math.max(15, (bar.val / maxH) * 100);
                  return (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className="w-full bg-gray-100 rounded-t h-8 flex items-end">
                        <div
                          className={`w-full rounded-t ${bar.color} transition-all`}
                          style={{ height: `${hPct}%` }}
                          title={`${bar.val} học sinh`}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500">{bar.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Student Rankings Table */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-xs overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm">
                Bảng xếp hạng kết quả học sinh ({students.length})
              </h3>
            </div>

            {isLoadingStudents ? (
              <PageSpinner />
            ) : students.length === 0 ? (
              <p className="p-6 text-center text-xs text-gray-400">Chưa có bài làm của học sinh.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3 text-left">Học sinh</th>
                      <th className="px-4 py-3 text-center">Trắc nghiệm</th>
                      <th className="px-4 py-3 text-center">Tự luận</th>
                      <th className="px-4 py-3 text-center">Tổng điểm</th>
                      <th className="px-4 py-3 text-center">Thời gian làm</th>
                      <th className="px-4 py-3 text-center">Kết quả</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {students.map((st: any, idx: number) => {
                      const mcqPts = st.mcq_points ?? st.mcq_score ?? 0;
                      const essayPts = st.essay_points ?? st.essay_score ?? 0;
                      const totalScore = st.score ?? (mcqPts + essayPts);
                      const maxScore = st.max_score ?? 10;
                      const userName = st.user_name || st.full_name || 'Học sinh';
                      const userEmail = st.user_email || st.email || '';
                      const durationSec = st.duration_seconds ?? (st.duration_minutes ? Math.round(st.duration_minutes * 60) : 0);

                      return (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="px-5 py-3 font-medium text-gray-900">
                            <div>{userName}</div>
                            <div className="text-[10px] text-gray-400">{userEmail}</div>
                          </td>
                          <td className="px-4 py-3 text-center font-mono">{Number(mcqPts).toFixed(2)}đ</td>
                          <td className="px-4 py-3 text-center font-mono">{Number(essayPts).toFixed(2)}đ</td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-primary-700 text-sm">
                            {Number(totalScore).toFixed(2)} / {maxScore}đ
                          </td>
                          <td className="px-4 py-3 text-center text-gray-500">
                            {Math.floor(durationSec / 60)}p {durationSec % 60}s
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                st.is_passed
                                  ? 'bg-green-50 text-green-700 border border-green-200'
                                  : 'bg-red-50 text-red-700 border border-red-200'
                              }`}
                            >
                              {st.is_passed ? 'Đạt' : 'Chưa đạt'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Item Psychometrics Analysis */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-xs overflow-hidden">
            <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">
                  Phân tích Trắc lượng Câu hỏi trong Đề thi (Item Psychometrics)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Chỉ số độ dễ (IF) & độ phân biệt (ID) dựa trên kết quả làm bài thực tế của học sinh
                </p>
              </div>
            </div>

            {isLoadingQuestions ? (
              <PageSpinner />
            ) : questions.length === 0 ? (
              <p className="p-6 text-center text-xs text-gray-400">Chưa có dữ liệu trắc lượng câu hỏi.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-left">Mã & Nội dung câu hỏi</th>
                      <th className="px-3 py-3 text-center">Bloom</th>
                      <th className="px-3 py-3 text-center">Độ dễ (IF)</th>
                      <th className="px-3 py-3 text-center">Độ phân biệt (ID)</th>
                      <th className="px-4 py-3 text-left">Tỷ lệ chọn các phương án</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {questions.map((q: any, idx: number) => {
                      const facility = q.item_facility ?? 0;
                      const discrimination = q.item_discrimination ?? q.discrimination_index ?? 0;
                      const diffCategory = q.difficulty_category || (facility >= 0.7 ? 'Dễ' : facility >= 0.4 ? 'Trung bình' : 'Khó');
                      const discCategory = q.discrimination_category || (discrimination >= 0.3 ? 'Tốt' : discrimination >= 0.2 ? 'Tạm chấp nhận' : 'Cần xem lại');

                      return (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 max-w-[280px]">
                            <span className="font-mono text-[10px] text-gray-400 block">{q.item_id || `#${idx + 1}`}</span>
                            <span className="font-medium text-gray-900 line-clamp-2" title={q.stem}>
                              {q.stem}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <BloomBadge level={q.bloom_level as any} />
                          </td>
                          <td className="px-3 py-3 text-center font-mono">
                            <span className="font-bold">{Number(facility).toFixed(2)}</span>
                            <span className="block text-[10px] text-gray-400">{diffCategory}</span>
                          </td>
                          <td className="px-3 py-3 text-center font-mono">
                            <span className={`font-bold ${discrimination >= 0.3 ? 'text-green-700' : 'text-amber-600'}`}>
                              {Number(discrimination).toFixed(2)}
                            </span>
                            <span className="block text-[10px] text-gray-400">{discCategory}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2 items-center flex-wrap">
                              {q.option_frequencies?.map((opt: any, optIdx: number) => (
                                <div
                                  key={opt.option_id || optIdx}
                                  className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 ${
                                    opt.is_correct
                                      ? 'bg-green-50 text-green-700 border border-green-200 font-bold'
                                      : 'bg-gray-100 text-gray-600'
                                  }`}
                                >
                                  <span>{opt.label}:</span>
                                  <span>{opt.percentage}%</span>
                                </div>
                              ))}
                              {(!q.option_frequencies || q.option_frequencies.length === 0) && (
                                <span className="text-[10px] text-gray-400">Không có dữ liệu</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
