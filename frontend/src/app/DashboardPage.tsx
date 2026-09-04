import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  ClipboardList,
  Database,
  CheckSquare,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Award,
  Layers,
  GraduationCap,
  History,
  FileText,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { questionApi, classApi, assignmentApi, analyticsApi, domainApi } from '@/services/api';
import { Button } from '@/components/ui/Button';

export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isTeacher = user?.roles.includes('teacher') || user?.roles.includes('admin');
  const isStudent = user?.roles.includes('student') && !isTeacher;

  // Live queries
  const { data: questionsData } = useQuery({
    queryKey: ['dashboard-questions'],
    queryFn: () => questionApi.list({ page: 1, page_size: 1 }),
    enabled: isTeacher,
  });

  const { data: classesData } = useQuery({
    queryKey: ['dashboard-classes'],
    queryFn: () => classApi.list({ page: 1, page_size: 100 }),
  });

  const { data: assignmentsData } = useQuery({
    queryKey: ['dashboard-assignments'],
    queryFn: () => assignmentApi.list(),
  });

  const { data: analyticsData } = useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: () => analyticsApi.overview(),
    enabled: isTeacher,
  });

  const { data: domainsData } = useQuery({
    queryKey: ['dashboard-domains'],
    queryFn: () => domainApi.list(),
    enabled: isTeacher,
  });

  const { data: studentHistoryData } = useQuery({
    queryKey: ['dashboard-student-history'],
    queryFn: () => assignmentApi.history(),
    enabled: isStudent,
  });

  const totalQuestions = questionsData?.data?.total ?? 0;
  const classesList = classesData?.data?.items ?? [];
  const assignmentsList = assignmentsData?.data ?? [];
  const domainsList = domainsData?.data ?? [];
  const studentHistory = studentHistoryData?.data ?? [];
  const analytics = analyticsData?.data;

  // Student specific stats
  const completedAttempts = studentHistory.length;
  const passedAttempts = studentHistory.filter((h: any) => h.is_passed).length;
  const pendingAssignments = assignmentsList.filter(
    (a: any) => !a.my_attempt || a.my_attempt.status === 'in_progress'
  ).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary-700 via-primary-600 to-indigo-700 p-7 text-white shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-xs font-semibold text-white/90">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Hệ thống Quản lý Khảo thí & Ngân hàng đề thông minh</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Xin chào, {user?.full_name || 'Người dùng'} 👋
            </h1>
            <p className="text-sm text-white/80 max-w-xl leading-relaxed">
              {isTeacher
                ? 'Theo dõi ngân hàng câu hỏi, ma trận đề thi chuẩn hóa và tiến độ học tập của các lớp học.'
                : 'Xem các bài kiểm tra được giao, tiến độ làm bài và theo dõi kết quả thi của bạn.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 shrink-0">
            {isTeacher ? (
              <>
                <Button
                  variant="white"
                  onClick={() => navigate('/question-bank')}
                >
                  <Database className="h-4 w-4 mr-1.5" />
                  Ngân hàng câu hỏi
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/assignments')}
                  className="border-white/40 text-white hover:bg-white/15"
                >
                  <ClipboardList className="h-4 w-4 mr-1.5" />
                  Giao bài kiểm tra
                </Button>
              </>
            ) : (
              <Button
                variant="white"
                onClick={() => navigate('/assignments')}
              >
                <ClipboardList className="h-4 w-4 mr-1.5" />
                Làm bài kiểm tra ({pendingAssignments})
              </Button>
            )}
          </div>
        </div>

        {/* Decorative Circles */}
        <div className="absolute -top-12 -right-12 h-64 w-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 h-64 w-64 rounded-full bg-indigo-500/20 blur-2xl pointer-events-none" />
      </div>

      {/* KPI Stats Grid */}
      {isTeacher ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div
            onClick={() => navigate('/question-bank')}
            className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:border-primary-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl">
                <Database className="h-5 w-5" />
              </div>
              <span className="text-xs text-primary-600 font-semibold flex items-center gap-0.5">
                Xem &rarr;
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-gray-900">{totalQuestions}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">Tổng số câu hỏi</p>
          </div>

          <div
            onClick={() => navigate('/domains')}
            className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-purple-50 text-purple-700 rounded-xl">
                <Layers className="h-5 w-5" />
              </div>
              <span className="text-xs text-purple-600 font-semibold flex items-center gap-0.5">
                Xem &rarr;
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-gray-900">{domainsList.length}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">Lĩnh vực kiến thức</p>
          </div>

          <div
            onClick={() => navigate('/classes')}
            className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
                <GraduationCap className="h-5 w-5" />
              </div>
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-0.5">
                Xem &rarr;
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-gray-900">{classesList.length}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">Lớp học phụ trách</p>
          </div>

          <div
            onClick={() => navigate('/assignments')}
            className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:border-amber-300 hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl">
                <ClipboardList className="h-5 w-5" />
              </div>
              <span className="text-xs text-amber-600 font-semibold flex items-center gap-0.5">
                Xem &rarr;
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-gray-900">{assignmentsList.length}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">Đợt kiểm tra đã giao</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            onClick={() => navigate('/assignments')}
            className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:border-primary-300 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-purple-50 text-purple-700 rounded-xl">
                <ClipboardList className="h-5 w-5" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-gray-900">{assignmentsList.length}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">Bài kiểm tra được giao</p>
          </div>

          <div
            onClick={() => navigate('/student-history')}
            className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:border-emerald-300 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
                <Award className="h-5 w-5" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-gray-900">{passedAttempts} / {completedAttempts}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">Bài thi đạt yêu cầu</p>
          </div>

          <div
            onClick={() => navigate('/classes')}
            className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:border-blue-300 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl">
                <GraduationCap className="h-5 w-5" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-gray-900">{classesList.length}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">Lớp học đã tham gia</p>
          </div>
        </div>
      )}

      {/* Quick Action Navigation Cards */}
      <div>
        <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span>Truy cập nhanh các phân hệ</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {isTeacher ? (
            <>
              <div
                onClick={() => navigate('/question-bank')}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:border-primary-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 bg-purple-50 text-purple-700 rounded-xl">
                      <Sparkles className="h-5 w-5" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-primary-600 transition-colors" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-base">Multi-Agent AI Studio</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Tạo câu hỏi tự động với 5 AI Agents, sinh phương án gây nhiễu và thẩm định sư phạm.
                  </p>
                </div>
              </div>

              <div
                onClick={() => navigate('/exam-matrices')}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:border-primary-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                      <CheckSquare className="h-5 w-5" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-primary-600 transition-colors" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-base">Ma trận & Sinh đề thi</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Xây dựng cấu trúc đề thi chuẩn hóa, tự động chọn câu hỏi theo ma trận và in đề thi.
                  </p>
                </div>
              </div>

              <div
                onClick={() => navigate('/analytics')}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:border-primary-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                      <TrendingUp className="h-5 w-5" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-primary-600 transition-colors" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-base">Phân tích & Khảo thí CTT</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Theo dõi chỉ số độ khó P-value, độ phân biệt D-value và tiến độ định cỡ ngân hàng câu hỏi.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div
                onClick={() => navigate('/assignments')}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:border-primary-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 bg-purple-50 text-purple-700 rounded-xl">
                      <ClipboardList className="h-5 w-5" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-primary-600 transition-colors" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-base">Phòng thi trực tuyến</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Làm bài thi trắc nghiệm & tự luận trực tiếp trên hệ thống với đồng hồ đếm ngược.
                  </p>
                </div>
              </div>

              <div
                onClick={() => navigate('/student-history')}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:border-primary-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                      <History className="h-5 w-5" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-primary-600 transition-colors" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-base">Lịch sử & Lời giải</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Xem lại bảng điểm các lần thi và lời giải chi tiết từng câu hỏi.
                  </p>
                </div>
              </div>

              <div
                onClick={() => navigate('/classes')}
                className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:border-primary-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                      <GraduationCap className="h-5 w-5" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-primary-600 transition-colors" />
                  </div>
                  <h3 className="font-bold text-gray-900 text-base">Lớp học của tôi</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Xem danh sách lớp học đã tham gia hoặc nhập mã mời để vào lớp mới.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
