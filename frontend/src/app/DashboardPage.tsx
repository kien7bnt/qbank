import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
  FolderOpen,
  CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/auth.store';
import {
  questionApi,
  classApi,
  assignmentApi,
  examApi,
  exerciseApi,
  analyticsApi,
  documentApi,
  getErrorMessage,
} from '@/services/api';

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, activeRole } = useAuthStore();
  const isTeacher = activeRole === 'teacher';

  const [chartMetric, setChartMetric] = useState<'score' | 'completion' | 'pass'>('score');
  const [tableTab, setTableTab] = useState<'exam' | 'homework'>('exam');
  const [studentTab, setStudentTab] = useState<'all' | 'pending' | 'completed'>('all');

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

  const { data: docsData } = useQuery({
    queryKey: ['dashboard-documents'],
    queryFn: () => documentApi.list(),
  });

  const { data: studentHistoryData } = useQuery({
    queryKey: ['dashboard-student-history'],
    queryFn: () => assignmentApi.history(),
    enabled: !isTeacher,
  });

  const startExamMutation = useMutation({
    mutationFn: (assignmentId: string) => assignmentApi.start(assignmentId),
    onSuccess: (res) => {
      navigate(`/exam-taking/${res.data.attempt_id}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Current formatted date: e.g. "Thứ Ba, 08/09/2026"
  const formattedDate = useMemo(() => {
    try {
      const raw = format(new Date(), "EEEE, dd/MM/yyyy", { locale: vi });
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    } catch {
      return 'Thứ Ba, 08/09/2026';
    }
  }, []);

  const stats = overviewData?.data;
  const totalQuestionsLive = questionsData?.data?.total ?? stats?.total_questions ?? 0;
  const examsList = examsData?.data ?? [];
  const exercisesList = exercisesData?.data ?? [];
  const classesList = classesData?.data?.items ?? [];
  const assignmentsList = assignmentsData?.data ?? [];
  const studentHistory = studentHistoryData?.data ?? [];
  const docsList = docsData?.data?.items ?? (Array.isArray(docsData?.data) ? docsData.data : []);

  // 1. Teacher KPI Stats
  const totalQuestionsDisplay = totalQuestionsLive.toLocaleString('vi-VN');
  const totalExamsCount = stats?.total_exams ?? (examsList.length + exercisesList.length);
  const totalSubmissionsLive = assignmentsList.reduce(
    (acc: number, a: any) => acc + (a.total_submissions || 0),
    0
  );
  const totalSubmissionsDisplay = (stats?.total_attempts ?? totalSubmissionsLive ?? 0).toLocaleString('vi-VN');
  const totalDocsCount = docsList.length;

  // 2. Student KPI Stats
  const completedAttempts = studentHistory.length;
  const passedAttempts = studentHistory.filter((h: any) => h.is_passed).length;
  const studentAvgScore = completedAttempts > 0
    ? (studentHistory.reduce((sum: number, h: any) => sum + (h.score || 0), 0) / completedAttempts).toFixed(1)
    : '0.0';

  const pendingStudentAssignments = useMemo(() => {
    return assignmentsList.filter((a: any) => !a.my_attempt || a.my_attempt.status === 'in_progress');
  }, [assignmentsList]);

  const completedStudentAssignments = useMemo(() => {
    return assignmentsList.filter((a: any) => a.my_attempt && a.my_attempt.status !== 'in_progress');
  }, [assignmentsList]);

  const studentFilteredAssignments = useMemo(() => {
    if (studentTab === 'pending') return pendingStudentAssignments;
    if (studentTab === 'completed') return completedStudentAssignments;
    return assignmentsList;
  }, [studentTab, pendingStudentAssignments, completedStudentAssignments, assignmentsList]);

  // 3. Class Performance Chart Data (Teacher)
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

  // 4. Recent Assignments Table Data (Teacher)
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
      const subCount = a.total_submissions ?? (a.attempts ? a.attempts.length : 0);

      return {
        id: a.id,
        name: a.name,
        class_name: a.class_name || cls?.name || 'Toàn trường',
        time: a.created_at
          ? format(new Date(a.created_at), 'dd/MM/yyyy')
          : (a.start_time ? format(new Date(a.start_time), 'dd/MM/yyyy') : '-'),
        submissions_count: subCount,
        avg_score: avg,
        status,
        statusType,
      };
    });
  }, [assignmentsList, tableTab, classesList]);

  return (
    <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-5 lg:p-6 space-y-4 sm:space-y-5">
      {/* 1. Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#4361EE] via-[#4F70F5] to-[#5978F8] px-5 py-4 sm:px-6 sm:py-5 text-white shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Xin chào, {user?.full_name || 'Giáo viên'} 👋
            </h1>
            <p className="text-xs sm:text-sm text-white/90 font-normal mt-0.5">
              {isTeacher
                ? 'Chúc bạn có một ngày làm việc hiệu quả!'
                : 'Chúc bạn có một ngày học tập hiệu quả!'}
            </p>
          </div>

          <div className="shrink-0">
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/20 border border-white/25 text-white text-xs sm:text-sm font-medium backdrop-blur-xs shadow-2xs">
              <Calendar className="h-4 w-4 text-white/90" />
              <span>{formattedDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. KPI Cards Grid */}
      {isTeacher ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Tổng số câu hỏi */}
          <div
            onClick={() => navigate('/question-bank')}
            className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-blue-200 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                <Database className="h-5 w-5" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-gray-700">Tổng số câu hỏi</span>
            </div>
            <div className="mt-3">
              <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">
                {totalQuestionsDisplay}
              </p>
              <p className="text-xs text-gray-400 font-normal mt-1 truncate">Câu hỏi trong ngân hàng</p>
            </div>
          </div>

          {/* Card 2: Bài kiểm tra */}
          <div
            onClick={() => navigate('/exams')}
            className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-purple-200 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:bg-purple-100 transition-colors">
                <FileText className="h-5 w-5" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-gray-700">Bài kiểm tra</span>
            </div>
            <div className="mt-3">
              <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">
                {totalExamsCount}
              </p>
              <p className="text-xs text-gray-400 font-normal mt-1 truncate">Đề thi & bài tập đã tạo</p>
            </div>
          </div>

          {/* Card 3: Lượt làm bài */}
          <div
            onClick={() => navigate('/assignments')}
            className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
                <Play className="h-5 w-5 fill-emerald-600" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-gray-700">Lượt làm bài</span>
            </div>
            <div className="mt-3">
              <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">
                {totalSubmissionsDisplay}
              </p>
              <p className="text-xs text-gray-400 font-normal mt-1 truncate">Lượt học sinh đã nộp</p>
            </div>
          </div>

          {/* Card 4: Kho tài liệu */}
          <div
            onClick={() => navigate('/document-library')}
            className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-amber-200 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
                <FolderOpen className="h-5 w-5" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-gray-700">Kho tài liệu</span>
            </div>
            <div className="mt-3">
              <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">
                {totalDocsCount}
              </p>
              <p className="text-xs text-gray-400 font-normal mt-1 truncate">Tài liệu & giáo trình đã lưu</p>
            </div>
          </div>
        </div>
      ) : (
        /* Student KPI Cards */
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Student Card 1: Lớp học của tôi */}
          <div
            onClick={() => navigate('/classes')}
            className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-blue-200 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                <GraduationCap className="h-5 w-5" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-gray-700">Lớp học của tôi</span>
            </div>
            <div className="mt-3">
              <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">
                {classesList.length}
              </p>
              <p className="text-xs text-gray-400 font-normal mt-1 truncate">Lớp đang theo học</p>
            </div>
          </div>

          {/* Student Card 2: Bài cần làm */}
          <div
            onClick={() => navigate('/assignments')}
            className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-amber-200 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
                <Clock className="h-5 w-5" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-gray-700">Bài cần làm</span>
            </div>
            <div className="mt-3">
              <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">
                {pendingStudentAssignments.length}
              </p>
              <p className="text-xs text-gray-400 font-normal mt-1 truncate">Bài tập & đề thi chưa nộp</p>
            </div>
          </div>

          {/* Student Card 3: Đã hoàn thành */}
          <div
            onClick={() => navigate('/student-history')}
            className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-gray-700">Đã hoàn thành</span>
            </div>
            <div className="mt-3">
              <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">
                {completedAttempts > 0 ? completedAttempts : completedStudentAssignments.length}
              </p>
              <p className="text-xs text-gray-400 font-normal mt-1 truncate">Bài đã nộp & có kết quả</p>
            </div>
          </div>

          {/* Student Card 4: Điểm trung bình */}
          <div
            onClick={() => navigate('/student-history')}
            className="bg-white border border-gray-100 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-purple-200 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:bg-purple-100 transition-colors">
                <Award className="h-5 w-5" />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-gray-700">Điểm trung bình</span>
            </div>
            <div className="mt-3">
              <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">
                {studentAvgScore}
              </p>
              <p className="text-xs text-gray-400 font-normal mt-1 truncate">
                {completedAttempts > 0
                  ? `Tỷ lệ đạt: ${Math.round((passedAttempts / completedAttempts) * 100)}%`
                  : 'Thang điểm 10'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Section: Side-by-side with fixed card height so both cards align perfectly */}
      {isTeacher ? (
        /* Teacher: Left = Biểu đồ lớp, Right = Đợt kiểm tra & bài tập */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Left Column: Kết quả học tập theo lớp (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col h-[390px]">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-gray-900">Kết quả học tập theo lớp</h2>
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

            {/* Bar Chart Container */}
            {chartClasses.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                <div className="w-11 h-11 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-2.5">
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
              <div className="flex-1 flex flex-col justify-between pt-4 pb-2 min-h-0">
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
                    <div className="absolute inset-x-0 top-0 bottom-6 flex items-end justify-around px-4 sm:px-8">
                      {chartClasses.map((item, idx) => {
                        const heightPct = chartMetric === 'score'
                          ? Math.min(100, Math.max(item.value > 0 ? 8 : 2, (item.value / 10) * 100))
                          : Math.min(100, Math.max(item.value > 0 ? 8 : 2, item.value));

                        return (
                          <div
                            key={item.id || idx}
                            className="flex flex-col items-center justify-end h-full group"
                          >
                            {/* Value label */}
                            <span className="text-xs font-bold text-gray-700 mb-1.5 transition-transform group-hover:-translate-y-0.5">
                              {item.displayValue}
                            </span>

                            {/* Bar pillar */}
                            <div
                              style={{ height: `${heightPct}%` }}
                              className="w-14 sm:w-20 bg-[#5470F5] hover:bg-[#4361EE] rounded-t-md transition-all duration-300 shadow-2xs"
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* X Axis Labels */}
                    <div className="absolute inset-x-0 bottom-0 h-6 flex items-center justify-around px-4 sm:px-8">
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

          {/* Right Column: Đợt kiểm tra & Bài tập mới nhất (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col h-[390px]">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FileText className="h-4 w-4" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-gray-900">Đợt kiểm tra & Bài tập</h2>
              </div>

              <div className="flex items-center gap-2">
                {/* Tabs switch */}
                <div className="inline-flex rounded-xl bg-gray-100/90 p-1 text-xs font-medium text-gray-600">
                  <button
                    onClick={() => setTableTab('exam')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      tableTab === 'exam'
                        ? 'bg-white text-gray-900 font-semibold shadow-2xs'
                        : 'hover:text-gray-900'
                    }`}
                  >
                    Đợt kiểm tra
                  </button>
                  <button
                    onClick={() => setTableTab('homework')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      tableTab === 'homework'
                        ? 'bg-white text-gray-900 font-semibold shadow-2xs'
                        : 'hover:text-gray-900'
                    }`}
                  >
                    Bài tập
                  </button>
                </div>

                <button
                  onClick={() => navigate('/assignments')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Giao bài
                </button>
              </div>
            </div>

            {/* Table Container (Scrollable) */}
            <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 -mx-5 sm:-mx-6 px-5 sm:px-6">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-gray-100 text-xs text-gray-400 font-medium">
                    <th className="py-2.5 px-3 text-left">Tên</th>
                    <th className="py-2.5 px-3 text-left w-24 whitespace-nowrap">Lớp</th>
                    <th className="py-2.5 px-3 text-left w-28 whitespace-nowrap">Thời gian</th>
                    <th className="py-2.5 px-3 text-center w-24 whitespace-nowrap">Lượt làm</th>
                    <th className="py-2.5 px-3 text-center w-20 whitespace-nowrap">Điểm TB</th>
                    <th className="py-2.5 px-3 text-center w-32 whitespace-nowrap">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-14 text-center text-gray-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Inbox className="w-9 h-9 text-gray-300" />
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
                        <td className="py-3 px-3 font-semibold text-gray-800 text-sm max-w-[180px] truncate" title={row.name}>
                          {row.name}
                        </td>
                        <td className="py-3 px-3 font-medium text-gray-700 text-xs truncate max-w-[110px]" title={row.class_name}>
                          {row.class_name}
                        </td>
                        <td className="py-3 px-3 text-gray-500 text-xs whitespace-nowrap">
                          {row.time}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-gray-900 text-sm whitespace-nowrap">
                          {row.submissions_count}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-gray-800 text-xs whitespace-nowrap">
                          {row.avg_score}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {row.statusType === 'ongoing' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-100 whitespace-nowrap">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              {row.status}
                            </span>
                          )}
                          {row.statusType === 'closed' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 whitespace-nowrap">
                              <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                              {row.status}
                            </span>
                          )}
                          {row.statusType === 'upcoming' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100 whitespace-nowrap">
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                              {row.status}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Student: Left = Lớp học của tôi, Right = Danh sách bài tập & Đợt kiểm tra */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Left Column: Lớp học của tôi (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col h-[390px]">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-gray-900">Lớp học của tôi</h2>
              </div>

              <button
                onClick={() => navigate('/classes')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-semibold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Tham gia lớp
              </button>
            </div>

            {/* Class list container (Scrollable) */}
            <div className="flex-1 overflow-y-auto min-h-0 space-y-2.5 pr-1">
              {classesList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <GraduationCap className="w-11 h-11 text-gray-300 mb-2.5" />
                  <p className="text-sm font-semibold text-gray-700">Chưa tham gia lớp học nào</p>
                  <p className="text-xs text-gray-400 mt-1 mb-4">Nhập mã lớp từ giáo viên để tham gia lớp học</p>
                  <button
                    onClick={() => navigate('/classes')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-medium shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tham gia ngay
                  </button>
                </div>
              ) : (
                classesList.map((c: any) => (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/classes/${c.id}`)}
                    className="p-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/20 transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {(c.name || 'LH').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate group-hover:text-blue-600">
                          {c.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                          <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-medium text-[11px]">
                            {c.code}
                          </span>
                          <span>•</span>
                          <span className="truncate">
                            {c.teacher_name ? `GV: ${c.teacher_name}` : `${c.member_count || 0} học viên`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Danh sách bài tập & Đợt kiểm tra (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-gray-100 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col h-[390px]">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="h-4 w-4" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-gray-900">Bài tập & Đợt kiểm tra</h2>
              </div>

              {/* Student Filter Tabs */}
              <div className="inline-flex rounded-xl bg-gray-100/90 p-1 text-xs font-medium text-gray-600">
                <button
                  onClick={() => setStudentTab('all')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    studentTab === 'all'
                      ? 'bg-white text-gray-900 font-semibold shadow-2xs'
                      : 'hover:text-gray-900'
                  }`}
                >
                  Tất cả ({assignmentsList.length})
                </button>
                <button
                  onClick={() => setStudentTab('pending')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    studentTab === 'pending'
                      ? 'bg-white text-gray-900 font-semibold shadow-2xs'
                      : 'hover:text-gray-900'
                  }`}
                >
                  Cần làm ({pendingStudentAssignments.length})
                </button>
                <button
                  onClick={() => setStudentTab('completed')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    studentTab === 'completed'
                      ? 'bg-white text-gray-900 font-semibold shadow-2xs'
                      : 'hover:text-gray-900'
                  }`}
                >
                  Đã nộp ({completedStudentAssignments.length})
                </button>
              </div>
            </div>

            {/* Assignments List Container (Scrollable) */}
            <div className="flex-1 overflow-y-auto min-h-0 -mx-5 px-5 divide-y divide-gray-50">
              {studentFilteredAssignments.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <Inbox className="w-10 h-10 text-gray-300 mb-2.5" />
                  <p className="text-sm font-semibold text-gray-700">
                    {studentTab === 'pending'
                      ? 'Tuyệt vời! Bạn không có bài tập nào cần làm.'
                      : 'Chưa có bài tập hoặc bài kiểm tra nào.'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Các bài tập và bài kiểm tra do giáo viên giao sẽ xuất hiện tại đây.
                  </p>
                </div>
              ) : (
                studentFilteredAssignments.map((a: any) => {
                  const myAtt = a.my_attempt;
                  const isSubmitted = myAtt && myAtt.status !== 'in_progress';
                  const isInProgress = myAtt && myAtt.status === 'in_progress';

                  return (
                    <div
                      key={a.id}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-gray-50/50 rounded-xl px-2.5 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              a.assignment_type === 'homework'
                                ? 'bg-purple-50 text-purple-700 border border-purple-100'
                                : 'bg-blue-50 text-blue-700 border border-blue-100'
                            }`}
                          >
                            {a.assignment_type === 'homework' ? 'Bài tập' : 'Kiểm tra'}
                          </span>
                          <h4 className="text-sm font-semibold text-gray-800 truncate" title={a.name}>
                            {a.name}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                          <span className="truncate">{a.class_name || 'Lớp học'}</span>
                          <span>•</span>
                          <span>
                            {a.end_time ? `Hạn: ${format(new Date(a.end_time), 'dd/MM/yyyy HH:mm')}` : `${a.duration_minutes || 45} phút`}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isSubmitted ? (
                          <div className="flex items-center gap-2">
                            {myAtt.score != null ? (
                              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {myAtt.score}/10
                              </span>
                            ) : (
                              <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                                Đang chấm
                              </span>
                            )}
                            <button
                              onClick={() => navigate(`/exam-result/${myAtt.id}`)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-xl border border-blue-200 transition-colors"
                            >
                              Xem kết quả
                            </button>
                          </div>
                        ) : isInProgress ? (
                          <button
                            onClick={() => navigate(`/exam-taking/${myAtt.id}`)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-2xs transition-colors"
                          >
                            Tiếp tục làm
                          </button>
                        ) : (
                          <button
                            onClick={() => startExamMutation.mutate(a.id)}
                            disabled={startExamMutation.isPending}
                            className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors"
                          >
                            <Play className="w-3.5 h-3.5 fill-white" /> Làm bài
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
