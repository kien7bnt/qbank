import React from 'react';
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
  GraduationCap,
  History,
  FileText,
  Clock,
  Calendar,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { questionApi, classApi, assignmentApi, examApi, exerciseApi } from '@/services/api';
import { Button } from '@/components/ui/Button';

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, activeRole } = useAuthStore();
  const isTeacher = activeRole === 'teacher';
  const isStudent = activeRole === 'student';

  // Live queries
  const { data: questionsData } = useQuery({
    queryKey: ['dashboard-questions'],
    queryFn: () => questionApi.list({ page: 1, page_size: 1 }),
    enabled: isTeacher,
  });

  const { data: examsData } = useQuery({
    queryKey: ['dashboard-exams'],
    queryFn: () => examApi.list(),
    enabled: isTeacher,
  });

  const { data: exercisesData } = useQuery({
    queryKey: ['dashboard-exercises'],
    queryFn: () => exerciseApi.list(),
    enabled: isTeacher,
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
    enabled: isStudent,
  });

  const totalQuestions = questionsData?.data?.total ?? 0;
  const examsList = examsData?.data ?? [];
  const exercisesList = exercisesData?.data ?? [];
  const classesList = classesData?.data?.items ?? [];
  const assignmentsList = assignmentsData?.data ?? [];
  const studentHistory = studentHistoryData?.data ?? [];

  // Computed teacher stats
  const totalSubmissions = assignmentsList.reduce(
    (acc: number, a: any) => acc + (a.total_submissions || 0),
    0
  );
  const totalStudents = classesList.reduce(
    (acc: number, c: any) => acc + (c.member_count || 0),
    0
  );

  // Computed student stats
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
              <span>
                {isTeacher
                  ? 'Hệ thống Quản lý Khảo thí & Ngân hàng đề thông minh'
                  : 'Cổng Học Viên Edumate - Học tập & Đánh giá năng lực'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Xin chào, {user?.full_name || 'Người dùng'} 👋
            </h1>
            <p className="text-sm text-white/80 max-w-xl leading-relaxed">
              {isTeacher
                ? 'Theo dõi ngân hàng câu hỏi, kho đề thi, quản lý các lớp học và các đợt kiểm tra đánh giá năng lực.'
                : 'Theo dõi bài tập, tham gia phòng thi trực tuyến và tra cứu lịch sử kết quả bài làm của bạn.'}
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
                  Quản lý đợt thi
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="white"
                  onClick={() => navigate('/assignments')}
                >
                  <ClipboardList className="h-4 w-4 mr-1.5" />
                  Làm bài kiểm tra ({pendingAssignments})
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/classes')}
                  className="border-white/40 text-white hover:bg-white/15"
                >
                  <GraduationCap className="h-4 w-4 mr-1.5" />
                  Lớp học của tôi
                </Button>
              </>
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
          {/* Card 1: Câu hỏi */}
          <div
            onClick={() => navigate('/question-bank')}
            className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-100 transition-colors">
                <Database className="h-5 w-5" />
              </div>
              <span className="text-xs text-blue-600 font-semibold flex items-center gap-0.5">
                Xem &rarr;
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-gray-900">{totalQuestions}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">Tổng số câu hỏi</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Trong ngân hàng khảo thí</p>
          </div>

          {/* Card 2: Kho đề & bài tập */}
          <div
            onClick={() => navigate('/exams')}
            className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-100 transition-colors">
                <FileText className="h-5 w-5" />
              </div>
              <span className="text-xs text-purple-600 font-semibold flex items-center gap-0.5">
                Xem &rarr;
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              {examsList.length + exercisesList.length}
            </p>
            <p className="text-xs text-gray-500 font-medium mt-1">Kho đề & Bài tập</p>
            <p className="text-[11px] text-purple-600 font-medium mt-0.5">
              {examsList.length} đề thi · {exercisesList.length} bài tập
            </p>
          </div>

          {/* Card 3: Lớp học phụ trách */}
          <div
            onClick={() => navigate('/classes')}
            className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-100 transition-colors">
                <GraduationCap className="h-5 w-5" />
              </div>
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-0.5">
                Xem &rarr;
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-gray-900">{classesList.length}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">Lớp học phụ trách</p>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
              {totalStudents} học viên theo học
            </p>
          </div>

          {/* Card 4: Đợt kiểm tra đã giao */}
          <div
            onClick={() => navigate('/assignments')}
            className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:border-amber-300 hover:shadow-sm transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-100 transition-colors">
                <ClipboardList className="h-5 w-5" />
              </div>
              <span className="text-xs text-amber-600 font-semibold flex items-center gap-0.5">
                Xem &rarr;
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-gray-900">{assignmentsList.length}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">Đợt thi & Đã giao</p>
            <p className="text-[11px] text-amber-600 font-medium mt-0.5">
              {totalSubmissions} bài nộp của học viên
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            onClick={() => navigate('/assignments')}
            className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:border-purple-300 hover:shadow-sm transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-purple-50 text-purple-700 rounded-xl group-hover:bg-purple-100 transition-colors">
                <ClipboardList className="h-5 w-5" />
              </div>
              <span className="text-xs text-purple-600 font-semibold flex items-center gap-0.5">
                Làm bài &rarr;
              </span>
            </div>
            <p className="text-3xl font-extrabold text-gray-900">{assignmentsList.length}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">Bài tập & Bài thi được giao</p>
            <p className="text-[11px] text-purple-600 font-medium mt-0.5">
              {pendingAssignments > 0 ? `${pendingAssignments} bài cần hoàn thành` : 'Đã làm xong tất cả'}
            </p>
          </div>

          <div
            onClick={() => navigate('/student-history')}
            className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl group-hover:bg-emerald-100 transition-colors">
                <Award className="h-5 w-5" />
              </div>
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-0.5">
                Bảng điểm &rarr;
              </span>
            </div>
            <p className="text-3xl font-extrabold text-gray-900">
              {passedAttempts} / {completedAttempts}
            </p>
            <p className="text-xs text-gray-500 font-medium mt-1">Bài thi đạt yêu cầu</p>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
              Tỷ lệ đạt: {completedAttempts > 0 ? Math.round((passedAttempts / completedAttempts) * 100) : 0}%
            </p>
          </div>

          <div
            onClick={() => navigate('/classes')}
            className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl group-hover:bg-blue-100 transition-colors">
                <GraduationCap className="h-5 w-5" />
              </div>
              <span className="text-xs text-blue-600 font-semibold flex items-center gap-0.5">
                Chi tiết &rarr;
              </span>
            </div>
            <p className="text-3xl font-extrabold text-gray-900">{classesList.length}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">Lớp học của tôi</p>
            <p className="text-[11px] text-blue-600 font-medium mt-0.5">Đang theo học tích cực</p>
          </div>
        </div>
      )}

      {/* Recent Assignments / Activities Section */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary-50 text-primary-600">
              <Calendar className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-gray-900">
              {isTeacher ? 'Đợt kiểm tra & Bài tập mới nhất' : 'Bài tập & Bài kiểm tra cần làm'}
            </h2>
          </div>
          <button
            onClick={() => navigate('/assignments')}
            className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1 cursor-pointer"
          >
            <span>Xem tất cả</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {assignmentsList.length === 0 ? (
          <div className="py-8 text-center text-gray-400">
            <ClipboardList className="h-10 w-10 mx-auto mb-2 text-gray-300 stroke-1" />
            <p className="text-sm font-medium text-gray-500">
              {isTeacher
                ? 'Chưa có đợt kiểm tra nào được tạo.'
                : 'Hiện tại bạn không có bài kiểm tra hoặc bài tập nào cần làm.'}
            </p>
            {isTeacher && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => navigate('/assignments')}
              >
                Tạo đợt kiểm tra mới
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {assignmentsList.slice(0, 6).map((a: any) => {
              const isHw = a.assignment_type === 'homework' || a.assignment_type === 'assignment';
              const isClosed = a.status === 'closed';

              return (
                <div
                  key={a.id}
                  onClick={() => navigate('/assignments')}
                  className="border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-primary-200 hover:shadow-xs rounded-xl p-4 transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isHw
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-purple-50 text-purple-700 border border-purple-100'
                        }`}
                      >
                        {isHw ? 'Bài tập' : 'Đợt kiểm tra'}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isClosed
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-green-50 text-green-700 border border-green-100'
                        }`}
                      >
                        {isClosed ? 'Đã kết thúc' : 'Đang mở'}
                      </span>
                    </div>

                    <h4 className="font-bold text-gray-900 text-sm line-clamp-1" title={a.name}>
                      {a.name}
                    </h4>

                    <p className="text-xs text-gray-500 line-clamp-1">
                      Lớp: <span className="font-medium text-gray-700">{a.class_name || 'Toàn trường'}</span>
                    </p>
                  </div>

                  <div className="pt-3 mt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-gray-400" />
                      <span>{a.duration_minutes || 45} phút</span>
                    </div>
                    {isTeacher ? (
                      <span className="font-semibold text-primary-600">
                        {a.total_submissions || 0} bài nộp
                      </span>
                    ) : (
                      <span className="font-semibold text-emerald-600">
                        Điểm đạt: {a.pass_score || 5}/10
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
