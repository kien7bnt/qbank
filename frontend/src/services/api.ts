import axios, { AxiosError } from 'axios';
import type {
  TokenResponse,
  User,
  Class,
  ClassCreate,
  ClassMember,
  ClassSession,
  ClassSessionCreate,
  SessionMaterial,
  Question,
  QuestionListItem,
  QuestionFilter,
  PaginatedResponse,
  Subject,
  CurriculumTree,
  Rubric,
  RubricCreate,
  EssayGrading,
  EssayGradingReview,
  MatrixGridValidateRequest,
  MatrixGridValidateResult,
  ExamVariant,
  GenerateVariantsRequest,
  ExamAnalyticsOverview,
  ExamStudentResult,
  ExamQuestionPsychometrics,
} from '@/types';

const API_HOST = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const defaultBaseUrl = `http://${API_HOST}:8000/api/v1`;
const BASE_URL = import.meta.env.VITE_API_URL ?? defaultBaseUrl;

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach JWT ──────────────────────────────────────────
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: handle 401 ─────────────────────────────────────────
apiClient.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<TokenResponse>('/auth/login', { email, password }),

  loginGoogle: (credential: string) =>
    apiClient.post<TokenResponse>('/auth/google', { credential }),

  register: (data: { email: string; full_name: string; password: string; role?: string }) =>
    apiClient.post<User>('/auth/register', data),

  me: () => apiClient.get<User>('/auth/me'),

  refresh: (refresh_token: string) =>
    apiClient.post<TokenResponse>('/auth/refresh', { refresh_token }),
};


// ─── Classes API ──────────────────────────────────────────────────────────────
export const classApi = {
  list: (params: {
    view?: 'mine' | 'joined';
    page?: number;
    page_size?: number;
    subject_id?: string;
    status?: string;
    search?: string;
  } = {}) => apiClient.get<PaginatedResponse<Class>>('/classes', { params }),

  get: (id: string) => apiClient.get<Class>(`/classes/${id}`),

  create: (data: ClassCreate) => apiClient.post<Class>('/classes', data),

  update: (id: string, data: Partial<ClassCreate & { status: string }>) =>
    apiClient.patch<Class>(`/classes/${id}`, data),

  join: (code: string) => apiClient.post<{ message: string; class_id: string }>('/classes/join', { code }),

  members: (id: string) => apiClient.get<ClassMember[]>(`/classes/${id}/members`),

  updateMember: (classId: string, userId: string, status: string) =>
    apiClient.patch(`/classes/${classId}/members/${userId}`, { status }),

  addMember: (classId: string, email: string) =>
    apiClient.post(`/classes/${classId}/members`, { email }),

  removeMember: (classId: string, userId: string) =>
    apiClient.delete(`/classes/${classId}/members/${userId}`),

  delete: (id: string) => apiClient.delete(`/classes/${id}`),
};

// ─── Class Sessions & Materials API ───────────────────────────────────────────
export const sessionApi = {
  list: (classId: string) => apiClient.get<ClassSession[]>(`/classes/${classId}/sessions`),

  create: (classId: string, data: ClassSessionCreate) =>
    apiClient.post<ClassSession>(`/classes/${classId}/sessions`, data),

  get: (sessionId: string) => apiClient.get<ClassSession>(`/sessions/${sessionId}`),

  update: (sessionId: string, data: Partial<ClassSessionCreate>) =>
    apiClient.patch<ClassSession>(`/sessions/${sessionId}`, data),

  delete: (sessionId: string) => apiClient.delete(`/sessions/${sessionId}`),

  reorder: (classId: string, sessionIds: string[]) =>
    apiClient.post<{ message: string }>(`/classes/${classId}/sessions/reorder`, { session_ids: sessionIds }),

  uploadMaterial: (sessionId: string, formData: FormData) =>
    apiClient.post<SessionMaterial>(`/sessions/${sessionId}/materials`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  deleteMaterial: (materialId: string) => apiClient.delete(`/materials/${materialId}`),

  toggleMaterialVisibility: (materialId: string, isPublic: boolean) =>
    apiClient.patch<SessionMaterial>(`/materials/${materialId}/visibility?is_public=${isPublic}`),
};

// ─── Questions API ────────────────────────────────────────────────────────────
export const questionApi = {
  list: (filters: QuestionFilter) =>
    apiClient.get<PaginatedResponse<QuestionListItem>>('/questions', { params: filters }),

  get: (id: string) => apiClient.get<Question>(`/questions/${id}`),

  create: (data: object) => apiClient.post<Question>('/questions', data),

  createBatch: (data: { chapter_id?: string; topic_id?: string; questions: any[] }) =>
    apiClient.post<{ total_created: number; created_ids: string[]; message: string }>('/questions/batch', data),

  parseFile: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post<{ raw_text: string; questions: any[]; total: number }>('/questions/parse-file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  update: (id: string, data: object) => apiClient.patch<Question>(`/questions/${id}`, data),

  delete: (id: string) => apiClient.delete(`/questions/${id}`),

  bulkAction: (question_ids: string[], action: string, payload: object = {}) =>
    apiClient.post('/questions/bulk-action', { question_ids, action, payload }),

  versions: (id: string) => apiClient.get(`/questions/${id}/versions`),
};

// ─── Curriculum / Domains & Interactive Tree API ──────────────────────────────
export const domainApi = {
  list: () => apiClient.get('/curriculum/domains'),

  createDomain: (data: { name: string; description?: string }) =>
    apiClient.post('/curriculum/domains', data),

  updateDomain: (id: string, data: { name: string; description?: string }) =>
    apiClient.put(`/curriculum/domains/${id}`, data),

  deleteDomain: (id: string) => apiClient.delete(`/curriculum/domains/${id}`),

  createTopic: (domainId: string, data: { name: string }) =>
    apiClient.post(`/curriculum/domains/${domainId}/topics`, data),

  updateTopic: (id: string, data: { name: string }) =>
    apiClient.put(`/curriculum/topics/${id}`, data),

  deleteTopic: (id: string) => apiClient.delete(`/curriculum/topics/${id}`),
};

export const curriculumApi = {
  subjects: () => apiClient.get<Subject[]>('/curriculum/subjects'),

  tree: (subjectId: string) =>
    apiClient.get<CurriculumTree>(`/curriculum/subjects/${subjectId}/tree`),

  getTreeWithCounts: (subjectId: string) =>
    apiClient.get<any>(`/curriculum/tree?subject_id=${subjectId}`),

  createNode: (data: { type: 'subject' | 'chapter' | 'topic' | 'lesson'; name: string; parent_id?: string; subject_id?: string; order_index?: number }) =>
    apiClient.post<any>('/curriculum/nodes', data),

  updateNode: (nodeId: string, data: { type: 'subject' | 'chapter' | 'topic' | 'lesson'; name: string; order_index?: number }) =>
    apiClient.patch<any>(`/curriculum/nodes/${nodeId}`, data),

  deleteNode: (type: 'subject' | 'chapter' | 'topic' | 'lesson', nodeId: string) =>
    apiClient.delete<any>(`/curriculum/nodes/${type}/${nodeId}`),

};

// ─── Rubrics & AI Essay Grading API ───────────────────────────────────────────
export const rubricApi = {
  list: (params?: { subject_id?: string }) =>
    apiClient.get<Rubric[]>('/rubrics', { params }),

  get: (id: string) => apiClient.get<Rubric>(`/rubrics/${id}`),

  create: (data: RubricCreate) => apiClient.post<Rubric>('/rubrics', data),

  update: (id: string, data: Partial<RubricCreate>) => apiClient.patch<Rubric>(`/rubrics/${id}`, data),

  delete: (id: string) => apiClient.delete(`/rubrics/${id}`),

  gradeEssay: (responseId: string, rubricId?: string) =>
    apiClient.post<EssayGrading>(`/essay-grading/${responseId}/grade`, { rubric_id: rubricId }),

  getEssayGrading: (responseId: string) =>
    apiClient.get<EssayGrading>(`/essay-grading/${responseId}`),

  reviewEssay: (gradingId: string, data: { new_score: number; comment?: string; action?: 'override' | 'confirm' }) =>
    apiClient.post<EssayGradingReview>(`/essay-grading/${gradingId}/review`, data),
};

// ─── Exam Matrix API ─────────────────────────────────────────────────────────
export const examMatrixApi = {
  list: (params?: { subject_id?: string; class_id?: string }) =>
    apiClient.get('/exam-matrices', { params }),

  get: (id: string) => apiClient.get(`/exam-matrices/${id}`),

  create: (data: any) => apiClient.post('/exam-matrices', data),

  delete: (id: string) => apiClient.delete(`/exam-matrices/${id}`),

  autoSelect: (id: string) => apiClient.post(`/exam-matrices/${id}/auto-select`),

  generateExam: (id: string, data: { name: string; class_id?: string }) =>
    apiClient.post(`/exam-matrices/${id}/generate-exam`, data),

  validateGrid: (data: MatrixGridValidateRequest) =>
    apiClient.post<MatrixGridValidateResult>('/exam-matrices/validate', data),
};

// ─── Exam API ────────────────────────────────────────────────────────────────
export const examApi = {
  list: (params?: { class_id?: string }) => apiClient.get('/exams', { params }),

  get: (id: string) => apiClient.get(`/exams/${id}`),

  create: (data: any) => apiClient.post('/exams', data),

  createFromQuestions: (data: {
    name: string;
    question_ids: string[];
    class_id?: string;
    duration_minutes?: number;
    points_per_question?: number;
    shuffle_questions?: boolean;
    shuffle_options?: boolean;
  }) => apiClient.post('/exams/from-questions', data),

  delete: (id: string) => apiClient.delete(`/exams/${id}`),

  generateVariants: (examId: string, data: GenerateVariantsRequest) =>
    apiClient.post<ExamVariant[]>(`/exams/${examId}/variants`, data),

  getVariants: (examId: string) =>
    apiClient.get<ExamVariant[]>(`/exams/${examId}/variants`),
};

// ─── Exam Analytics API ───────────────────────────────────────────────────────
export const examAnalyticsApi = {
  getOverview: (examId: string) =>
    apiClient.get<ExamAnalyticsOverview>(`/analytics/exams/${examId}/overview`),

  getStudents: (examId: string) =>
    apiClient.get<ExamStudentResult[]>(`/analytics/exams/${examId}/students`),

  getQuestions: (examId: string) =>
    apiClient.get<ExamQuestionPsychometrics[]>(`/analytics/exams/${examId}/questions`),
};


// ─── Assignment API ──────────────────────────────────────────────────────────
export const assignmentApi = {
  list: (params?: { class_id?: string; session_id?: string }) => apiClient.get('/assignments', { params }),

  get: (id: string) => apiClient.get(`/assignments/${id}`),

  create: (data: any) => apiClient.post('/assignments', data),

  update: (id: string, data: any) => apiClient.patch(`/assignments/${id}`, data),

  delete: (id: string) => apiClient.delete(`/assignments/${id}`),

  submissions: (id: string) => apiClient.get(`/assignments/${id}/submissions`),

  start: (assignmentId: string) => apiClient.post(`/assignments/${assignmentId}/start`),

  retry: (assignmentId: string) => apiClient.post(`/assignments/${assignmentId}/retry`),

  saveResponse: (attemptId: string, data: { question_id: string; selected_option_id?: string; text_response?: string }) =>
    apiClient.post(`/attempts/${attemptId}/responses`, data),

  submit: (attemptId: string) => apiClient.post(`/attempts/${attemptId}/submit`),

  result: (attemptId: string) => apiClient.get(`/attempts/${attemptId}/result`),

  getState: (attemptId: string) => apiClient.get(`/attempts/${attemptId}/state`),

  history: () => apiClient.get('/student/history'),
};

// ─── Analytics & Psychometrics API ───────────────────────────────────────────
export const analyticsApi = {
  overview: () => apiClient.get('/analytics/overview'),
  psychometrics: (questionId: string) => apiClient.get(`/analytics/questions/${questionId}/psychometrics`),
  calibrate: () => apiClient.post('/analytics/calibrate'),
};

// ─── AI Settings API ─────────────────────────────────────────────────────────
export const aiApi = {
  getConfig: () => apiClient.get('/ai/config'),
  updateConfig: (data: { provider: string; api_key?: string; model?: string; ollama_base_url?: string }) =>
    apiClient.post('/ai/config', data),
  healthCheck: () => apiClient.post('/ai/health'),
  getRules: () => apiClient.get<{ content: string }>('/ai/rules'),
  updateRules: (content: string) => apiClient.put<{ message: string; content: string }>('/ai/rules', { content }),
  resetRules: () => apiClient.post<{ message: string; content: string }>('/ai/rules/reset'),
  improveQuestion: (data: {
    original_stem: string;
    original_options?: any[];
    original_rationale?: string;
    original_bloom_level?: string;
    original_difficulty?: string;
    question_type: string;
    improvement_prompt: string;
    rules?: string;
  }) => apiClient.post('/ai/questions/improve', data),
};

// ─── Document Library API ─────────────────────────────────────────────────────
export const documentApi = {
  list: (params?: { topic_tag?: string; search?: string }) =>
    apiClient.get('/documents', { params }),

  upload: (formData: FormData) =>
    apiClient.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  get: (id: string) => apiClient.get(`/documents/${id}`),

  delete: (id: string) => apiClient.delete(`/documents/${id}`),

  topics: () => apiClient.get('/documents/topics'),

  generateQuestions: (data: {
    document_ids: string[];
    question_type?: string;
    bloom_level?: string;
    expected_difficulty?: string;
    num_questions?: number;
    extra_prompt?: string;
    topic_id?: string;
    chapter_id?: string;
    auto_save?: boolean;
  }) => apiClient.post('/ai/pipeline/from-document', data),
};


// ─── Error helper ─────────────────────────────────────────────────────────────
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      return 'Không thể kết nối đến máy chủ Backend. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau vài giây!';
    }
    return error.response?.data?.detail ?? error.message ?? 'Đã xảy ra lỗi';
  }
  if (error instanceof Error) return error.message;
  return 'Đã xảy ra lỗi không xác định';
}
