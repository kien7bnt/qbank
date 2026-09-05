// ─── Auth ───────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  full_name: string;
  status: 'active' | 'locked' | 'pending';
  roles: string[];
  avatar_url?: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

// ─── Classes ─────────────────────────────────────────────────────────────────
export interface Class {
  id: string;
  code: string;
  name: string;
  subject_id?: string;
  subject_name?: string;
  teacher_id: string;
  teacher_name: string;
  status: 'active' | 'archived' | 'pending';
  description?: string;
  expected_start_date?: string;
  expected_end_date?: string;
  max_students?: number;
  member_count: number;
  created_at: string;
}

export interface ClassMember {
  user_id: string;
  full_name: string;
  email: string;
  role: 'teacher' | 'student';
  status: 'active' | 'locked';
  joined_at: string;
}

export interface ClassCreate {
  name: string;
  subject_id?: string;
  description?: string;
  expected_start_date?: string;
  expected_end_date?: string;
  max_students?: number;
}

// ─── Curriculum ───────────────────────────────────────────────────────────────
export interface Subject {
  id: string;
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
}

export interface Chapter {
  id: string;
  subject_id: string;
  name: string;
  order_index: number;
  description?: string;
}

export interface Topic {
  id: string;
  chapter_id: string;
  name: string;
  order_index: number;
}

export interface Lesson {
  id: string;
  topic_id: string;
  name: string;
  order_index: number;
}

export interface LearningObjective {
  id: string;
  lesson_id: string;
  description: string;
  bloom_level: string;
}

export interface LessonNode extends Lesson {
  learning_objectives: LearningObjective[];
}

export interface TopicNode extends Topic {
  lessons: LessonNode[];
}

export interface ChapterNode extends Chapter {
  topics: TopicNode[];
}

export interface CurriculumTree {
  subject: Subject;
  chapters: ChapterNode[];
}

// ─── Questions ────────────────────────────────────────────────────────────────
export type QuestionType = 'mcq' | 'essay' | 'coding';
export type QuestionStatus = 'draft' | 'review' | 'approved' | 'rejected' | 'archived';
export type BloomLevel = 'remember' | 'understand' | 'apply' | 'analyze';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface QuestionOption {
  id: string;
  question_id: string;
  label: string;
  text: string;
  is_correct: boolean;
  distractor_reason?: string;
  order_index: number;
}

export interface EssayData {
  sample_answer?: string;
  rubric?: object;
  max_points: number;
}

export interface CodingData {
  problem_statement: string;
  input_format?: string;
  output_format?: string;
  constraints?: string;
  sample_input?: string;
  sample_output?: string;
  time_limit_ms: number;
  memory_limit_mb: number;
  allowed_languages: string[];
}

export interface Question {
  id: string;
  item_id: string;
  type: QuestionType;
  status: QuestionStatus;
  stem: string;
  rationale?: string;
  subject_id?: string;
  subject_name?: string;
  chapter_id?: string;
  chapter_name?: string;
  topic_id?: string;
  topic_name?: string;
  bloom_level?: BloomLevel;
  expected_difficulty?: DifficultyLevel;
  options: QuestionOption[];
  essay_data?: EssayData;
  coding_data?: CodingData;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface QuestionListItem {
  id: string;
  item_id: string;
  type: QuestionType;
  sub_type?: string;
  status: QuestionStatus;
  stem_preview: string;
  bloom_level?: BloomLevel;
  expected_difficulty?: DifficultyLevel;
  subject_name?: string;
  chapter_name?: string;
  topic_name?: string;
  created_at: string;
}

export interface QuestionVersion {
  id: string;
  version_number: number;
  snapshot: object;
  changed_by: string;
  created_at: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ─── Filters ──────────────────────────────────────────────────────────────────
export interface QuestionFilter {
  type?: QuestionType;
  status?: QuestionStatus;
  subject_id?: string;
  chapter_id?: string;
  topic_id?: string;
  bloom_level?: BloomLevel;
  difficulty?: DifficultyLevel;
  psychometric_status?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface ClassFilter {
  subject_id?: string;
  status?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

// ─── Exam Matrix & Exam ───────────────────────────────────────────────────────
export interface ExamMatrixSection {
  id?: string;
  name: string;
  question_type: 'mcq' | 'essay' | 'coding';
  question_count: number;
  points_per_question: number;
  rules?: {
    bloom_mix?: Record<string, number>;
    difficulty_mix?: Record<string, number>;
    topic_ids?: string[];
  };
}

export interface ExamMatrix {
  id: string;
  name: string;
  subject_id: string;
  subject_name?: string;
  class_id?: string;
  total_questions: number;
  total_points: number;
  status: 'draft' | 'published';
  created_by: string;
  created_at: string;
  updated_at: string;
  sections: ExamMatrixSection[];
}

export interface ExamMatrixCreate {
  name: string;
  subject_id: string;
  class_id?: string;
  total_questions: number;
  total_points: number;
  sections: ExamMatrixSection[];
}

export interface ExamQuestionDetail {
  id: string;
  question_id: string;
  order_index: number;
  points: number;
  stem: string;
  type: string;
  bloom_level?: string;
  difficulty?: string;
  options: {
    id: string;
    label: string;
    text: string;
    is_correct: boolean;
  }[];
}

export interface ExamSectionDetail {
  id: string;
  name: string;
  order_index: number;
  question_type: string;
  instructions?: string;
  questions: ExamQuestionDetail[];
}

export interface Exam {
  id: string;
  name: string;
  matrix_id?: string;
  class_id?: string;
  status: 'draft' | 'published' | 'active' | 'closed';
  duration_minutes: number;
  start_time?: string;
  end_time?: string;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  show_results: string;
  created_at: string;
  sections?: ExamSectionDetail[];
}

// ─── Assignment & Exam Taking ────────────────────────────────────────────────
export interface Assignment {
  id: string;
  name: string;
  assignment_type?: 'exam' | 'homework' | 'assignment';
  exam_id: string;
  exam_name?: string;
  class_id: string;
  class_name?: string;
  session_id?: string;
  session_name?: string;
  start_time?: string;
  end_time?: string;
  duration_minutes: number;
  max_attempts: number;
  pass_score: number;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  show_results?: string;
  status: 'draft' | 'published' | 'closed';
  total_submissions?: number;
  created_at: string;
  my_attempt?: {
    id: string;
    attempt_number?: number;
    status: 'in_progress' | 'submitted' | 'graded';
    score?: number;
    max_score: number;
    is_passed?: boolean;
    submitted_at?: string;
  };
}

export interface QuestionTaking {
  id: string;
  stem: string;
  type: string;
  order_index: number;
  points: number;
  bloom_level?: string;
  options: {
    id: string;
    label: string;
    text: string;
  }[];
  selected_option_id?: string;
  text_response?: string;
  code_response?: string;
  coding_data?: {
    problem_statement?: string;
    input_format?: string;
    output_format?: string;
    constraints?: string;
    sample_input?: string;
    sample_output?: string;
    time_limit_ms?: number;
    allowed_languages?: string[];
    starter_code?: string;
    test_cases?: {
      input: string;
      output: string;
      is_hidden?: boolean;
    }[];
  };
  essay_data?: {
    sample_answer?: string;
    max_points?: number;
  };
}

export interface ExamTakingState {
  attempt_id: string;
  assignment_id: string;
  assignment_name: string;
  assignment_type?: string;
  attempt_number?: number;
  duration_minutes: number;
  start_time: string;
  remaining_seconds: number;
  status: string;
  questions: QuestionTaking[];
}

export interface ResponseDetail {
  question_id: string;
  stem: string;
  type: string;
  points: number;
  points_earned: number;
  is_correct?: boolean;
  selected_option_id?: string;
  correct_option_id?: string;
  text_response?: string;
  code_response?: string;
  coding_data?: any;
  essay_data?: any;
  rationale?: string;
  options: {
    id: string;
    label: string;
    text: string;
    is_correct: boolean;
  }[];
  feedback?: string;
}

export interface AttemptResult {
  attempt_id: string;
  assignment_id?: string;
  assignment_name: string;
  assignment_type?: string;
  attempt_number?: number;
  can_retry?: boolean;
  user_name: string;
  start_time: string;
  submitted_at?: string;
  score?: number;
  max_score: number;
  is_passed?: boolean;
  status: string;
  total_questions: number;
  correct_answers_count: number;
  responses: ResponseDetail[];
}

// ─── Sessions & Class Materials ───────────────────────────────────────────────
export interface SessionMaterial {
  id: string;
  session_id: string;
  title: string;
  description?: string;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  order_index: number;
  is_public: boolean;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface ClassSession {
  id: string;
  class_id: string;
  title: string;
  description?: string;
  order_index: number;
  session_date?: string;
  status: 'planned' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  materials: SessionMaterial[];
  assignments?: {
    id: string;
    name: string;
    assignment_type: string;
    duration_minutes: number;
    max_attempts: number;
    pass_score: number;
    status: string;
    created_at: string;
    exam_id?: string;
    class_id?: string;
    session_id?: string;
    total_submissions?: number;
  }[];
}

export interface ClassSessionCreate {
  title: string;
  description?: string;
  session_date?: string;
  status?: string;
  order_index?: number;
}

// ─── Rubrics & Essay Grading ──────────────────────────────────────────────────
export interface RubricLevel {
  id?: string;
  score: number;
  level_name: string;
  description: string;
  order_index?: number;
}

export interface RubricCriteria {
  id?: string;
  name: string;
  description?: string;
  weight: number;
  max_score: number;
  order_index?: number;
  levels: RubricLevel[];
}

export interface Rubric {
  id: string;
  name: string;
  description?: string;
  subject_id?: string;
  subject_name?: string;
  is_public: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  criteria: RubricCriteria[];
}

export interface RubricCreate {
  name: string;
  description?: string;
  subject_id?: string;
  is_public?: boolean;
  criteria: {
    name: string;
    description?: string;
    weight: number;
    max_score: number;
    levels: {
      score: number;
      level_name: string;
      description: string;
      order_index?: number;
    }[];
  }[];
}

export interface EssayCriterionEvaluation {
  criterion_name: string;
  score: number;
  max_score: number;
  weight?: number;
  level_name?: string;
  reason: string;
  evidence: string;
}

export interface EssayGradingReview {
  id: string;
  grading_id: string;
  reviewer_id: string;
  reviewer_name?: string;
  previous_score: number;
  new_score: number;
  comment?: string;
  action: 'override' | 'confirm';
  reviewed_at: string;
}

export interface EssayGrading {
  id: string;
  response_id: string;
  rubric_id?: string;
  rubric?: Rubric;
  ai_score: number;
  ai_feedback?: string;
  criteria_breakdown: EssayCriterionEvaluation[];
  final_score: number;
  final_feedback?: string;
  status: 'ai_graded' | 'teacher_reviewed';
  graded_at: string;
  updated_at: string;
  reviews?: EssayGradingReview[];
}

// ─── 2D Exam Matrix & Variants ────────────────────────────────────────────────
export interface ExamMatrixRule {
  id?: string;
  topic_id?: string;
  lesson_id?: string;
  bloom_level: BloomLevel;
  difficulty: DifficultyLevel;
  question_type: QuestionType;
  question_count: number;
  points_per_question: number;
}

export interface MatrixGridValidateRequest {
  expected_total_questions?: number;
  expected_total_points?: number;
  rules: {
    topic_id?: string;
    lesson_id?: string;
    bloom_level: string;
    difficulty: string;
    question_type: string;
    question_count: number;
    points_per_question: number;
  }[];
}

export interface MatrixGridValidateResult {
  is_valid: boolean;
  total_questions: number;
  total_points: number;
  bloom_distribution: Record<string, number>;
  difficulty_distribution: Record<string, number>;
  question_type_distribution: Record<string, number>;
  errors: string[];
  warnings: string[];
}

export interface ExamVariant {
  id: string;
  exam_id: string;
  variant_code: string;
  question_order: string[];
  option_shuffles?: Record<string, string[]>;
  created_at: string;
}

export interface GenerateVariantsRequest {
  variant_count: number;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  code_prefix?: string;
}

// ─── Exam Analytics & Reports ─────────────────────────────────────────────────
export interface ExamAnalyticsOverview {
  exam_id: string;
  exam_name: string;
  total_attempts: number;
  total_submissions: number;
  average_score: number;
  highest_score: number;
  lowest_score: number;
  passed_count: number;
  failed_count: number;
  pass_rate: number;
  score_distribution: {
    under_5: number;
    '5_to_6_5': number;
    '6_5_to_8': number;
    '8_to_10': number;
  };
}

export interface ExamStudentResult {
  attempt_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  score: number;
  max_score: number;
  mcq_points: number;
  essay_points: number;
  correct_count: number;
  wrong_count: number;
  skipped_count: number;
  duration_seconds: number;
  is_passed: boolean;
  submitted_at: string;
  status: string;
}

export interface ExamQuestionPsychometrics {
  question_id: string;
  item_id: string;
  stem: string;
  type: string;
  bloom_level?: string;
  expected_difficulty?: string;
  total_answers: number;
  correct_answers: number;
  item_facility: number;
  difficulty_category: string;
  item_discrimination: number;
  discrimination_category: string;
  option_frequencies: {
    option_id: string;
    label: string;
    text: string;
    is_correct: boolean;
    chosen_count: number;
    percentage: number;
  }[];
}

// ─── Online Compiler (Judge0) ────────────────────────────────────────────────
export interface CompilerLanguage {
  id: string;
  name: string;
  judge0_id: number;
  extension: string;
}

export interface CodeExecutionResult {
  success: boolean;
  status: string;
  status_id: number;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  time: string | null;
  memory: number | null;
  is_passed: boolean;
}

export interface TestCaseResult {
  case_number: number;
  is_passed: boolean;
  input: string;
  expected_output: string;
  actual_output: string;
  stderr: string;
  status: string;
  time?: string | null;
  memory?: number | null;
}

export interface QuestionTestSummary {
  passed_count: number;
  total_count: number;
  passed_all: boolean;
  results: TestCaseResult[];
}


