import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from './Layout';
import { PageSpinner } from '@/components/ui/Spinner';

// Direct imports for essential shell components
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from './DashboardPage';

// Lazy-loaded route components with safe fallbacks
const safeLazy = (importFn: () => Promise<any>, exportName: string, title: string) =>
  lazy(() =>
    importFn()
      .then((m) => ({ default: m[exportName] || m.default }))
      .catch((err) => {
        console.error(`Failed to load ${title}:`, err);
        return {
          default: () => (
            <div className="flex h-full items-center justify-center p-8">
              <div className="text-center max-w-md">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Đang đồng bộ hoặc cập nhật tính năng. Vui lòng tải lại trang sau giây lát.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition"
                >
                  Tải lại trang
                </button>
              </div>
            </div>
          ),
        };
      })
  );

const ClassesPage = safeLazy(() => import('@/features/classes/ClassesPage'), 'ClassesPage', 'Lớp học');
const ClassDetailPage = safeLazy(() => import('@/features/classes/ClassDetailPage'), 'ClassDetailPage', 'Chi tiết lớp học');
const QuestionBankPage = safeLazy(() => import('@/features/question-bank/QuestionBankPage'), 'QuestionBankPage', 'Ngân hàng câu hỏi');
const ExamMatricesPage = safeLazy(() => import('@/features/exams/ExamMatricesPage'), 'ExamMatricesPage', 'Ma trận đề thi');
const ExamsListPage = safeLazy(() => import('@/features/exams/ExamsListPage'), 'ExamsListPage', 'Kho bài kiểm tra');
const ExercisesListPage = safeLazy(() => import('@/features/exercises/ExercisesListPage'), 'ExercisesListPage', 'Kho bài tập');
const AssignmentsPage = safeLazy(() => import('@/features/assignments/AssignmentsPage'), 'AssignmentsPage', 'Tạo đề thi');
const ExamTakingPage = safeLazy(() => import('@/features/exam-taking/ExamTakingPage'), 'ExamTakingPage', 'Làm bài thi');
const ExamResultPage = safeLazy(() => import('@/features/exam-taking/ExamResultPage'), 'ExamResultPage', 'Kết quả bài thi');
const AnalyticsPage = safeLazy(() => import('@/features/analytics/AnalyticsPage'), 'AnalyticsPage', 'Thống kê & Báo cáo');
const StudentHistoryPage = safeLazy(() => import('@/features/student/StudentHistoryPage'), 'StudentHistoryPage', 'Lịch sử học sinh');
const DomainsPage = safeLazy(() => import('@/features/domains/DomainsPage'), 'DomainsPage', 'Danh mục kiến thức');
const SettingsPage = safeLazy(() => import('@/features/settings/SettingsPage'), 'SettingsPage', 'Cài đặt hệ thống');
const DocumentLibraryPage = safeLazy(() => import('@/features/document-library'), 'DocumentLibraryPage', 'Kho tài liệu');
const AIRulesPage = safeLazy(() => import('@/features/ai'), 'AIRulesPage', 'Trợ lý AI');
const RubricsPage = safeLazy(() => import('@/features/rubrics/RubricsPage'), 'RubricsPage', 'Tiêu chí chấm Rubric');
const QuestionCalibrationPage = safeLazy(() => import('@/features/analytics/QuestionCalibrationPage'), 'QuestionCalibrationPage', 'Định cỡ câu hỏi');

const withSuspense = (Component: React.ComponentType) => (
  <Suspense fallback={<PageSpinner />}>
    <Component />
  </Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/exam-taking/:attemptId',
    element: withSuspense(ExamTakingPage),
  },
  {
    path: '/exam-result/:attemptId',
    element: withSuspense(ExamResultPage),
  },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'classes', element: withSuspense(ClassesPage) },
      { path: 'classes/:id', element: withSuspense(ClassDetailPage) },
      { path: 'question-bank', element: withSuspense(QuestionBankPage) },
      { path: 'domains', element: withSuspense(DomainsPage) },
      { path: 'document-library', element: withSuspense(DocumentLibraryPage) },
      { path: 'exam-matrices', element: withSuspense(ExamMatricesPage) },
      { path: 'exams', element: withSuspense(ExamsListPage) },
      { path: 'exercises', element: withSuspense(ExercisesListPage) },
      { path: 'assignments', element: withSuspense(AssignmentsPage) },
      { path: 'rubrics', element: withSuspense(RubricsPage) },
      { path: 'calibration', element: withSuspense(QuestionCalibrationPage) },
      { path: 'ai-rules', element: withSuspense(AIRulesPage) },
      { path: 'student-history', element: withSuspense(StudentHistoryPage) },
      { path: 'analytics', element: withSuspense(AnalyticsPage) },
      { path: 'settings', element: withSuspense(SettingsPage) },
      { path: 'setting', element: <Navigate to="/settings" replace /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);

