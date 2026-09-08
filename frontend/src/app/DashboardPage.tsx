import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Database,
  FileText,
  Play,
  Clock,
  TrendingUp,
  ChevronDown,
  ArrowRight,
  Plus,
  Inbox,
  GraduationCap,
  Award,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useAuthStore } from '@/stores/auth.store';
import { questionApi, classApi, assignmentApi, examApi, exerciseApi, analyticsApi } from '@/services/api';

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, activeRole } = useAuthStore();
  const isTeacher = activeRole === 'teacher';

  const [chartMetric, setChartMetric] = useState<'score' | 'completion' | 'pass'>('score');
  const [tableTab, setTableTab] = useState<'exam' | 'homework'>('exam');

  // Live queries directly from real backend database
  const { data: overviewData } = useQuery({
    queryKey: ['dashboard-overview', activeRole],
    queryFn: () => analyticsApi.overview(),
  });

  const { data: questionsData } = useQuery({
    queryKey: ['dashboard-questions'],
    queryFn: () => questionApi.list({ page: 1, page_size: 1 }),
  });

  const { data: examsData } = useQuery({
    queryKey: ['dashboard-exams'],
    queryFn: () => examApi.list(),
  });

  const { data: exercisesData } = useQuery({
    queryKey: ['dashboard-exercises'],
    queryFn: () => exerciseApi.list(),
  });

  const { data: classesData } = useQuery({
    queryKey: ['dashboard-classes', activeRole],
    queryFn: () => classApi.list({ page: 1, page_size: 100 }),
  });

  const { data: assignmentsData } = useQuery({
    queryKey: ['dashboard-assignments', activeRole],
    queryFn: () => assignmentApi.list({ role: activeRole }),
  });

  const { data: studentHistoryData } = useQuery({
    queryKey: ['dashboard-student-history'],
    queryFn: () => assignmentApi.history(),
    enabled: !isTeacher,
  });

  // Current formatted date: e.g. "Thứ Ba, 08/09/2026"
  const formattedDate = useMemo(() => {
    try {
      const raw = format(new Date(), "EEEE, dd/MM/yyyy", { locale: vi });
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    } catch {
      return 'Thứ Hai, 08/09/2025';
    }
  }, []);

  const stats = overviewData?.data;
  const totalQuestionsLive = questionsData?.data?.total ?? stats?.total_questions ?? 0;
  const examsList = examsData?.data ?? [];
  const exercisesList = exercisesData?.data ?? [];
  const classesList = classesData?.data?.items ?? [];
  const assignmentsList = assignmentsData?.data ?? [];
  const studentHistory = studentHistoryData?.data ?? [];

  // 1. Real KPI Stats calculated from SQLite database
  const totalQuestionsDisplay = totalQuestionsLive.toLocaleString('vi-VN');

  const totalExamsCount = stats?.total_exams ?? (examsList.length + exercisesList.length);

  const totalSubmissionsLive = assignmentsList.reduce(
    (acc: number, a: any) => acc + (a.total_submissions || 0),
    0
  );
  const totalSubmissionsDisplay = (stats?.total_attempts ?? totalSubmissionsLive ?? 0).toLocaleString('vi-VN');

  const pendingGradingCount = stats?.pending_grading ?? 0;

  // Student stats
  const completedAttempts = studentHistory.length;
  const passedAttempts = studentHistory.filter((h: any) => h.is_passed).length;
  const studentAvgScore = completedAttempts > 0
    ? (studentHistory.reduce((sum: number, h: any) => sum + (h.score || 0), 0) / completedAttempts).toFixed(1)
    : '0.0';

  // 2. Class Performance Chart Data (Real data from classes in database)
  const classPerformance: any[] = stats?.class_performance || [];

  const chartClasses = useMemo(() => {
    if (classPerformance.length > 0) {
      return classPerformance.map((c: any) => {
        let value = 0;
        let displayValue = '0';

        if (chartMetric === 'score') {
          value = c.average_score || 0;
          displayValue = value.toFixed(1);
        } else if (chartMetric === 'completion') {
          value = c.completion_rate || 0;
          displayValue = `${value}%`;
        } else if (chartMetric === 'pass') {
          value = c.pass_rate || 0;
          displayValue = `${value}%`;
        }

        return {
          id: c.id,
          name: c.name || c.code || 'Lớp',
          value,
          displayValue,
        };
      });
    }

    if (classesList.length > 0) {
      return classesList.map((c: any) => ({
        id: c.id,
        name: c.name || c.code || 'Lớp',
        value: 0,
        displayValue: chartMetric === 'score' ? '0.0' : '0%',
      }));
    }

    return [];
  }, [classPerformance, classesList, chartMetric]);

  // 3. Recent Assignments Table Data (Real rows from assignments in database)
  const tableRows = useMemo(() => {
    const isHw = (t?: string) => t === 'homework' || t === 'assignment';
    const liveFiltered = assignmentsList.filter((a: any) => {
      return tableTab === 'homework' ? isHw(a.assignment_type) : !isHw(a.assignment_type);
    });

    return liveFiltered.map((a: any) => {
      const now = new Date();
      let status = 'Đang diễn ra';
      let statusType: 'ongoing' | 'closed' | 'upcoming' = 'ongoing';

      if (a.status === 'closed') {
        status = 'Đã kết thúc';
        statusType = 'closed';
      } else if (a.start_time && new Date(a.start_time) > now) {
        status = 'Sắp diễn ra';
        statusType = 'upcoming';
      } else if (a.end_time && new Date(a.end_time) < now) {
        status = 'Đã kết thúc';
        statusType = 'closed';
      }

      let avg = '-';
      if (a.average_score != null) {
        avg = `${a.average_score}`;
      } else {
        const scored = (a.attempts || []).filter((att: any) => att.score != null);
        if (scored.length > 0) {
          const s = scored.reduce((acc: number, cur: any) => acc + Number(cur.score), 0);
          avg = (s / scored.length).toFixed(1);
        }
      }

      const cls = classesList.find((c: any) => c.id === a.class_id);
      const memberCount = a.class_member_count ?? cls?.member_count ?? 0;
      const subCount = a.total_submissions ?? (a.attempts ? a.attempts.length : 0);

      return {
        id: a.id,
        name: a.name,
        class_name: a.class_name || cls?.name || 'Toàn trường',
        time: a.created_at
          ? format(new Date(a.created_at), 'dd/MM/yyyy')
          : (a.start_time ? format(new Date(a.start_time), 'dd/MM/yyyy') : '-'),
        done_ratio: `${subCount}/${memberCount}`,
        avg_score: avg,
        status,
        statusType,
      };
    });
  }, [assignmentsList, tableTab, classesList]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* 1. Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#4361EE] via-[#4F70F5] to-[#5978F8] p-6 text-white shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Xin chào, {user?.full_name || 'Nguyễn Văn A'} 👋
            </h1>
            <p className="text-sm text-white/90 mt-1 font-normal">
              {isTeacher
                ? 'Chúc bạn có một ngày làm việc hiệu quả!'
                : 'Chúc bạn có một ngày học tập hiệu quả!'}
            </p>
          </div>

          <div className="shrink-0">
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 border border-white/25 text-white text-xs font-medium backdrop-blur-xs shadow-2xs">
              <Calendar className="h-4 w-4 text-white/90" />
              <span>{formattedDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Tổng số câu hỏi */}
        <div
          onClick={() => navigate('/question-bank')}
          className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs hover:border-blue-200 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
              <Database className="h-5 w-5" />
            </div>
            <span className="text-sm font-semibold text-gray-700">Tổng số câu hỏi</span>
          </div>
          <div className="mt-3.5">
            <p className="text-3xl font-extrabold text-gray-900 tracking-tight">
              {totalQuestionsDisplay}
            </p>
            <p className="text-xs text-gray-400 font-normal mt-1">Câu hỏi trong ngân hàng</p>
          </div>
        </div>

        {/* Card 2: Bài kiểm tra */}
        <div
          onClick={() => navigate('/exams')}
          className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs hover:border-purple-200 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:bg-purple-100 transition-colors">
              <FileText className="h-5 w-5" />
            </div>
            <span className="text-sm font-semibold text-gray-700">Bài kiểm tra</span>
          </div>
          <div className="mt-3.5">
            <p className="text-3xl font-extrabold text-gray-900 tracking-tight">
              {totalExamsCount}
            </p>
            <p className="text-xs text-gray-400 font-normal mt-1">Tổng số bài kiểm tra đã tạo</p>
          </div>
        </div>

        {/* Card 3: Lượt làm bài */}
        <div
          onClick={() => navigate('/assignments')}
          className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
              <Play className="h-5 w-5 fill-emerald-600" />
            </div>
            <span className="text-sm font-semibold text-gray-700">Lượt làm bài</span>
          </div>
          <div className="mt-3.5">
            <p className="text-3xl font-extrabold text-gray-900 tracking-tight">
              {totalSubmissionsDisplay}
            </p>
            <p className="text-xs text-gray-400 font-normal mt-1">Tổng lượt học sinh đã làm</p>
          </div>
        </div>

        {/* Card 4: Bài cần chấm */}
        <div
          onClick={() => navigate('/assignments')}
          className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs hover:border-amber-200 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
              <Clock className="h-5 w-5" />
            </div>
            <span className="text-sm font-semibold text-gray-700">Bài cần chấm</span>
          </div>
          <div className="mt-3.5">
            <p className="text-3xl font-extrabold text-gray-900 tracking-tight">
              {pendingGradingCount}
            </p>
            <p className="text-xs text-gray-400 font-normal mt-1">Số bài kiểm tra chờ chấm</p>
          </div>
        </div>
      </div>

      {/* 3. Middle Section: Kết quả học tập theo lớp */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-gray-900">Kết quả học tập theo lớp</h2>
          </div>

          <div className="relative">
            <select
              value={chartMetric}
              onChange={(e) => setChartMetric(e.target.value as any)}
              aria-label="Tiêu chí đánh giá"
              className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-1.5 pr-8 text-xs font-medium text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-2xs"
            >
              <option value="score">Điểm trung bình</option>
              <option value="completion">Tỷ lệ hoàn thành</option>
              <option value="pass">Tỷ lệ đạt chuẩn</option>
            </select>
            <ChevronDown className="h-3.5 w-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Bar Chart Canvas / SVG Area */}
        {chartClasses.length === 0 ? (
          <div className="h-64 sm:h-72 flex flex-col items-center justify-center text-center p-6 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-gray-800 mb-1">Chưa có dữ liệu lớp học</h4>
            <p className="text-xs text-gray-500 max-w-sm mb-4">Tạo lớp học và giao bài để theo dõi thống kê kết quả học tập tại đây.</p>
            <button
              onClick={() => navigate('/classes')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#5470F5] hover:bg-[#4361EE] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm lớp học
            </button>
          </div>
        ) : (
          <div className="h-64 sm:h-72 flex flex-col justify-between pt-4 pb-2">
            <div className="relative flex-1 flex">
              {/* Y Axis Numbers */}
              <div className="w-10 flex flex-col justify-between text-right pr-2.5 text-xs font-medium text-gray-400 select-none pb-6">
                {chartMetric === 'score' ? (
                  <>
                    <span>10</span>
                    <span>8</span>
                    <span>6</span>
                    <span>4</span>
                    <span>2</span>
                    <span>0</span>
                  </>
                ) : (
                  <>
                    <span>100%</span>
                    <span>80%</span>
                    <span>60%</span>
                    <span>40%</span>
                    <span>20%</span>
                    <span>0%</span>
                  </>
                )}
              </div>

              {/* Grid & Bars Container */}
              <div className="relative flex-1 flex flex-col justify-between">
                {/* Horizontal Grid lines */}
                <div className="absolute inset-x-0 top-0 border-b border-gray-100" />
                <div className="absolute inset-x-0 top-[20%] border-b border-gray-100" />
                <div className="absolute inset-x-0 top-[40%] border-b border-gray-100" />
                <div className="absolute inset-x-0 top-[60%] border-b border-gray-100" />
                <div className="absolute inset-x-0 top-[80%] border-b border-gray-100" />
                <div className="absolute inset-x-0 bottom-6 border-b border-gray-200" />

                {/* Bars Row */}
                <div className="absolute inset-x-0 top-0 bottom-6 flex items-end justify-around px-2 sm:px-8">
                  {chartClasses.map((item, idx) => {
                    const heightPct = chartMetric === 'score'
                      ? Math.min(100, Math.max(item.value > 0 ? 8 : 2, (item.value / 10) * 100))
                      : Math.min(100, Math.max(item.value > 0 ? 8 : 2, item.value));

                    return (
                      <div
                        key={item.id || idx}
                        className="flex flex-col items-center justify-end h-full group"
                      >
                        {/* Value label on top of bar */}
                        <span className="text-xs font-bold text-gray-700 mb-1.5 transition-transform group-hover:-translate-y-0.5">
                          {item.displayValue}
                        </span>

                        {/* Bar pillar */}
                        <div
                          style={{ height: `${heightPct}%` }}
                          className="w-16 sm:w-24 bg-[#5470F5] hover:bg-[#4361EE] rounded-t-sm transition-all duration-300 shadow-2xs"
                        />
                      </div>
                    );
                  })}
                </div>

                {/* X Axis Labels */}
                <div className="absolute inset-x-0 bottom-0 h-6 flex items-center justify-around px-2 sm:px-8">
                  {chartClasses.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="w-16 sm:w-24 text-center text-xs font-semibold text-gray-800 truncate"
                      title={item.name}
                    >
                      {item.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Bottom Section: Đợt kiểm tra & Bài tập mới nhất */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <FileText className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-gray-900">
              Đợt kiểm tra & Bài tập mới nhất
            </h2>
          </div>

          <button
            onClick={() => navigate('/assignments')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>Xem tất cả</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 pt-1 pb-2">
          <button
            onClick={() => setTableTab('exam')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              tableTab === 'exam'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Đợt kiểm tra
          </button>
          <button
            onClick={() => setTableTab('homework')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              tableTab === 'homework'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Bài tập mới nhất
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-400 font-medium">
                <th className="py-3 px-4">Tên đợt kiểm tra</th>
                <th className="py-3 px-4">Lớp</th>
                <th className="py-3 px-4">Thời gian</th>
                <th className="py-3 px-4">Đã làm</th>
                <th className="py-3 px-4">Điểm TB</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Inbox className="w-8 h-8 text-gray-300" />
                      <p className="text-sm font-medium text-gray-500">
                        {tableTab === 'exam' ? 'Chưa có đợt kiểm tra nào' : 'Chưa có bài tập nào'}
                      </p>
                      <button
                        onClick={() => navigate('/assignments')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold mt-1 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Giao bài mới
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                tableRows.map((row: any) => (
                  <tr
                    key={row.id}
                    onClick={() => navigate('/assignments')}
                    className="hover:bg-gray-50/70 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-semibold text-gray-800 text-sm">
                      {row.name}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-gray-800 text-xs">
                      {row.class_name}
                    </td>
                    <td className="py-3.5 px-4 text-gray-500 text-xs">
                      {row.time}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-gray-700 text-xs">
                      {row.done_ratio}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-gray-800 text-xs">
                      {row.avg_score}
                    </td>
                    <td className="py-3.5 px-4">
                      {row.statusType === 'ongoing' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-100">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {row.status}
                        </span>
                      )}
                      {row.statusType === 'closed' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                          {row.status}
                        </span>
                      )}
                      {row.statusType === 'upcoming' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          {row.status}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

