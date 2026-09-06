import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from './Layout';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from './DashboardPage';
import { ClassesPage } from '@/features/classes/ClassesPage';
import { ClassDetailPage } from '@/features/classes/ClassDetailPage';
import { QuestionBankPage } from '@/features/question-bank/QuestionBankPage';
import { ExamMatricesPage } from '@/features/exams/ExamMatricesPage';
import { ExamsListPage } from '@/features/exams/ExamsListPage';
import { ExercisesListPage } from '@/features/exercises/ExercisesListPage';
import { AssignmentsPage } from '@/features/assignments/AssignmentsPage';
import { ExamTakingPage } from '@/features/exam-taking/ExamTakingPage';
import { ExamResultPage } from '@/features/exam-taking/ExamResultPage';
import { AnalyticsPage } from '@/features/analytics/AnalyticsPage';
import { StudentHistoryPage } from '@/features/student/StudentHistoryPage';
import { DomainsPage } from '@/features/domains/DomainsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { DocumentLibraryPage } from '@/features/document-library';

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        <p className="mt-2 text-sm text-gray-500">Tính năng đang được phát triển</p>
      </div>
    </div>
  );
}

import { AIRulesPage } from '@/features/ai';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/exam-taking/:attemptId',
    element: <ExamTakingPage />,
  },
  {
    path: '/exam-result/:attemptId',
    element: <ExamResultPage />,
  },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'classes', element: <ClassesPage /> },
      { path: 'classes/:id', element: <ClassDetailPage /> },
      { path: 'question-bank', element: <QuestionBankPage /> },
      { path: 'domains', element: <DomainsPage /> },
      { path: 'document-library', element: <DocumentLibraryPage /> },
      { path: 'exam-matrices', element: <ExamMatricesPage /> },
      { path: 'exams', element: <ExamsListPage /> },
      { path: 'exercises', element: <ExercisesListPage /> },
      { path: 'assignments', element: <AssignmentsPage /> },
      { path: 'ai-rules', element: <AIRulesPage /> },
      { path: 'student-history', element: <StudentHistoryPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'setting', element: <Navigate to="/settings" replace /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);
