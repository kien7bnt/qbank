import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Calendar,
  FileText,
  FileDown,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  Upload,
  CheckCircle2,
  Clock,
  Paperclip,
  FolderOpen,
  ClipboardList,
  ClipboardCheck,
  Award,
  Users,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { sessionApi, assignmentApi, getErrorMessage, getBackendOrigin } from '@/services/api';
import type { ClassSession, SessionMaterial } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageSpinner } from '@/components/ui/Spinner';
import { CreateAssignmentModal } from '@/features/assignments/CreateAssignmentModal';
import { AssignmentSubmissionsModal } from '@/features/assignments/AssignmentSubmissionsModal';

interface ClassSessionsTabProps {
  classId: string;
  isTeacher: boolean;
}

export function ClassSessionsTab({ classId, isTeacher }: ClassSessionsTabProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals state
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ClassSession | null>(null);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionDesc, setSessionDesc] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [sessionStatus, setSessionStatus] = useState<'planned' | 'completed' | 'cancelled'>('planned');

  // Assignment modal state
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [targetSessionForExam, setTargetSessionForExam] = useState<string | undefined>(undefined);
  const [targetAssignmentType, setTargetAssignmentType] = useState<'exam' | 'homework' | undefined>(undefined);
  const [selectedSubmissionAssignment, setSelectedSubmissionAssignment] = useState<{ id: string; name: string } | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // Tab dropdown state per session: 'content' | 'materials' | 'homework' | 'exam' | null
  type SessionTab = 'content' | 'materials' | 'homework' | 'exam';
  const [activeSessionTabs, setActiveSessionTabs] = useState<Record<string, SessionTab | null>>({});

  const toggleSessionTab = (sessionId: string, tab: SessionTab) => {
    setActiveSessionTabs((prev) => ({
      ...prev,
      [sessionId]: prev[sessionId] === tab ? null : tab,
    }));
  };

  // Material upload state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [targetSessionId, setTargetSessionId] = useState<string | null>(null);
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialDesc, setMaterialDesc] = useState('');
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [materialIsPublic, setMaterialIsPublic] = useState(true);

  // Fetch sessions
  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ['class-sessions', classId],
    queryFn: () => sessionApi.list(classId),
    enabled: !!classId,
  });

  const sessions = sessionsData?.data ?? [];

  useEffect(() => {
    const openId =
      searchParams.get('openSubmissions') ||
      location.state?.openSubmissionsAssignmentId ||
      sessionStorage.getItem('reopen_submissions_assignment_id');

    if (openId && isTeacher) {
      let foundName =
        location.state?.openSubmissionsAssignmentName ||
        sessionStorage.getItem('reopen_submissions_assignment_name');

      if (!foundName && sessions && sessions.length > 0) {
        for (const s of sessions) {
          const found = s.assignments?.find((a) => a.id === openId);
          if (found) {
            foundName = found.name;
            break;
          }
        }
      }

      setSelectedSubmissionAssignment({ id: openId, name: foundName || 'Bài kiểm tra' });

      // Clean up flags
      sessionStorage.removeItem('reopen_submissions_assignment_id');
      sessionStorage.removeItem('reopen_submissions_assignment_name');

      if (searchParams.get('openSubmissions')) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('openSubmissions');
        setSearchParams(nextParams, { replace: true });
      }
    }
  }, [sessions, searchParams, location.state, isTeacher]);

  // Create / Update Session Mutation
  const saveSessionMutation = useMutation({
    mutationFn: () => {
      const payload: any = {
        name: sessionTitle.trim(),
        title: sessionTitle.trim(),
        description: sessionDesc.trim() || undefined,
        session_date: sessionDate || undefined,
        status: sessionStatus,
      };
      if (editingSession) {
        return sessionApi.update(editingSession.id, payload);
      }
      return sessionApi.create(classId, {
        ...payload,
        order_index: sessions.length + 1,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['class-sessions', classId] });
      toast.success(editingSession ? 'Đã cập nhật buổi học!' : 'Đã tạo buổi học mới thành công!');
      closeSessionModal();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Delete Session Mutation
  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: string) => sessionApi.delete(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['class-sessions', classId] });
      toast.success('Đã xóa buổi học');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Delete Assignment Mutation
  const deleteAssignmentMutation = useMutation({
    mutationFn: (assignmentId: string) => assignmentApi.delete(assignmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['class-sessions', classId] });
      qc.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Đã xóa bài kiểm tra khỏi buổi học!');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const openAddExamModal = (sessionId: string, type: 'exam' | 'homework' = 'exam') => {
    setTargetSessionForExam(sessionId);
    setTargetAssignmentType(type);
    setAssignmentModalOpen(true);
  };

  // Upload Material Mutation
  const uploadMaterialMutation = useMutation({
    mutationFn: () => {
      if (!targetSessionId || !materialFile) {
        throw new Error('Chưa chọn file tài liệu');
      }
      const formData = new FormData();
      formData.append('file', materialFile);
      formData.append('title', materialTitle.trim() || materialFile.name);
      formData.append('description', materialDesc.trim());
      formData.append('is_public', String(materialIsPublic));

      return sessionApi.uploadMaterial(targetSessionId, formData);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['class-sessions', classId] });
      toast.success('Đã tải lên tài liệu thành công!');
      closeUploadModal();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Delete Material Mutation
  const deleteMaterialMutation = useMutation({
    mutationFn: (materialId: string) => sessionApi.deleteMaterial(materialId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['class-sessions', classId] });
      toast.success('Đã xóa tài liệu');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Toggle Visibility Mutation
  const toggleVisibilityMutation = useMutation({
    mutationFn: ({ materialId, isPublic }: { materialId: string; isPublic: boolean }) =>
      sessionApi.toggleMaterialVisibility(materialId, isPublic),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['class-sessions', classId] });
      toast.success('Đã cập nhật quyền hiển thị tài liệu');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const openCreateSessionModal = () => {
    setEditingSession(null);
    setSessionTitle(`Buổi ${sessions.length + 1}: `);
    setSessionDesc('');
    setSessionDate('');
    setSessionStatus('planned');
    setSessionModalOpen(true);
  };

  const openEditSessionModal = (s: ClassSession) => {
    setEditingSession(s);
    setSessionTitle(s.title || (s as any).name || '');
    setSessionDesc(s.description || '');
    setSessionDate(s.session_date ? s.session_date.slice(0, 10) : '');
    setSessionStatus(s.status);
    setSessionModalOpen(true);
  };

  const closeSessionModal = () => {
    setSessionModalOpen(false);
    setEditingSession(null);
    setSessionTitle('');
    setSessionDesc('');
    setSessionDate('');
  };

  const openUploadModal = (sessionId: string) => {
    setTargetSessionId(sessionId);
    setMaterialTitle('');
    setMaterialDesc('');
    setMaterialFile(null);
    setMaterialIsPublic(true);
    setUploadModalOpen(true);
  };

  const closeUploadModal = () => {
    setUploadModalOpen(false);
    setTargetSessionId(null);
    setMaterialTitle('');
    setMaterialDesc('');
    setMaterialFile(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Lộ trình Buổi học & Tài liệu giảng dạy</h2>
          <p className="text-sm text-gray-500">
            Quản lý kế hoạch từng buổi học, đính kèm bài giảng, tài liệu PDF, bài tập và đề kiểm tra
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sessions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const anyOpen = Object.values(activeSessionTabs).some(Boolean);
                if (anyOpen) {
                  setActiveSessionTabs({});
                } else {
                  const next: Record<string, SessionTab | null> = {};
                  sessions.forEach((s) => {
                    next[s.id] = s.materials?.length ? 'materials' : 'content';
                  });
                  setActiveSessionTabs(next);
                }
              }}
              className="text-xs"
            >
              {Object.values(activeSessionTabs).some(Boolean) ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}
            </Button>
          )}
          {isTeacher && (
            <Button onClick={openCreateSessionModal} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Thêm buổi học
            </Button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <FolderOpen className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-3 text-base font-semibold text-gray-900">Chưa có buổi học nào</h3>
          <p className="mt-1 text-sm text-gray-500">
            {isTeacher
              ? 'Tạo buổi học đầu tiên để chia sẻ tài liệu và quản lý tiến độ học tập cho sinh viên.'
              : 'Giáo viên chưa cập nhật lịch học và tài liệu cho lớp này.'}
          </p>
          {isTeacher && (
            <Button onClick={openCreateSessionModal} className="mt-4" size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Thêm buổi học đầu tiên
            </Button>
          )}
        </div>
      ) : (
        /* Sessions Compact List */
        <div className="space-y-3">
          {sessions.map((session, index) => {
            const activeTab = activeSessionTabs[session.id] || null;
            const contentCount = session.description?.trim() ? 1 : (session.session_date ? 1 : 0);
            const matCount = session.materials?.length || 0;
            const homeworks = session.assignments?.filter(
              (a) => a.assignment_type === 'homework' || a.assignment_type === 'assignment'
            ) || [];
            const exams = session.assignments?.filter(
              (a) => a.assignment_type !== 'homework' && a.assignment_type !== 'assignment'
            ) || [];
            const hwCount = homeworks.length;
            const examCount = exams.length;

            const rawTitle = session.title?.trim() || (session as any).name?.trim() || '';
            const displayTitle = rawTitle.toLowerCase().startsWith('buổi')
              ? rawTitle
              : `Buổi ${index + 1}: ${rawTitle}`;

            return (
              <div
                key={session.id}
                className="rounded-2xl border border-gray-200 bg-white shadow-xs hover:border-gray-300 transition-all overflow-hidden"
              >
                {/* Header Row */}
                <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
                  <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                      {index + 1}
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-gray-900 truncate" title={displayTitle}>
                      {displayTitle}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        session.status === 'completed'
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : session.status === 'cancelled'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {session.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
                      {session.status === 'planned' && <Clock className="h-3 w-3" />}
                      {session.status === 'completed'
                        ? 'Đã học'
                        : session.status === 'cancelled'
                        ? 'Đã hủy'
                        : 'Kế hoạch'}
                    </span>
                  </div>

                  {/* Actions for teacher */}
                  {isTeacher && (
                    <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                      <button
                        title="Chỉnh sửa buổi học"
                        onClick={() => openEditSessionModal(session)}
                        className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        title="Xóa buổi học"
                        onClick={() => {
                          if (confirm(`Bạn có chắc muốn xóa buổi học "${session.title || (session as any).name}"?`)) {
                            deleteSessionMutation.mutate(session.id);
                          }
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* The Bar: Nội dung | Tài liệu | Bài tập | Kiểm tra */}
                <div className="flex items-center flex-wrap gap-1 px-3 py-1.5 bg-gray-50/90 border-t border-gray-100 text-xs">
                  {/* Tab Nội dung */}
                  <button
                    type="button"
                    onClick={() => toggleSessionTab(session.id, 'content')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      activeTab === 'content'
                        ? 'bg-white text-blue-700 font-semibold shadow-2xs border border-blue-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/80'
                    }`}
                  >
                    <FileText className={`h-3.5 w-3.5 ${activeTab === 'content' ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span>Nội dung</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[11px] font-semibold ${
                        contentCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      ({contentCount})
                    </span>
                    {activeTab === 'content' ? (
                      <ChevronUp className="h-3 w-3 text-blue-600" />
                    ) : (
                      <ChevronDown className="h-3 w-3 text-gray-400" />
                    )}
                  </button>

                  <span className="text-gray-300 select-none font-light">|</span>

                  {/* Tab Tài liệu */}
                  <button
                    type="button"
                    onClick={() => toggleSessionTab(session.id, 'materials')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      activeTab === 'materials'
                        ? 'bg-white text-amber-700 font-semibold shadow-2xs border border-amber-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/80'
                    }`}
                  >
                    <Paperclip className={`h-3.5 w-3.5 ${activeTab === 'materials' ? 'text-amber-600' : 'text-gray-400'}`} />
                    <span>Tài liệu</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[11px] font-semibold ${
                        matCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      ({matCount})
                    </span>
                    {activeTab === 'materials' ? (
                      <ChevronUp className="h-3 w-3 text-amber-600" />
                    ) : (
                      <ChevronDown className="h-3 w-3 text-gray-400" />
                    )}
                  </button>

                  <span className="text-gray-300 select-none font-light">|</span>

                  {/* Tab Bài tập */}
                  <button
                    type="button"
                    onClick={() => toggleSessionTab(session.id, 'homework')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      activeTab === 'homework'
                        ? 'bg-white text-emerald-700 font-semibold shadow-2xs border border-emerald-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/80'
                    }`}
                  >
                    <ClipboardCheck className={`h-3.5 w-3.5 ${activeTab === 'homework' ? 'text-emerald-600' : 'text-gray-400'}`} />
                    <span>Bài tập</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[11px] font-semibold ${
                        hwCount > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      ({hwCount})
                    </span>
                    {activeTab === 'homework' ? (
                      <ChevronUp className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <ChevronDown className="h-3 w-3 text-gray-400" />
                    )}
                  </button>

                  <span className="text-gray-300 select-none font-light">|</span>

                  {/* Tab Kiểm tra */}
                  <button
                    type="button"
                    onClick={() => toggleSessionTab(session.id, 'exam')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      activeTab === 'exam'
                        ? 'bg-white text-purple-700 font-semibold shadow-2xs border border-purple-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/80'
                    }`}
                  >
                    <Award className={`h-3.5 w-3.5 ${activeTab === 'exam' ? 'text-purple-600' : 'text-gray-400'}`} />
                    <span>Kiểm tra</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[11px] font-semibold ${
                        examCount > 0 ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      ({examCount})
                    </span>
                    {activeTab === 'exam' ? (
                      <ChevronUp className="h-3 w-3 text-purple-600" />
                    ) : (
                      <ChevronDown className="h-3 w-3 text-gray-400" />
                    )}
                  </button>
                </div>

                {/* Dropdown Details Container */}
                {activeTab && (
                  <div className="p-4 sm:p-5 border-t border-gray-100 bg-white">
                    {/* Content Panel */}
                    {activeTab === 'content' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-blue-600" />
                            Nội dung chi tiết buổi học
                          </h4>
                          {isTeacher && (
                            <button
                              onClick={() => openEditSessionModal(session)}
                              className="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1 hover:underline"
                            >
                              <Edit2 className="h-3 w-3" />
                              Chỉnh sửa
                            </button>
                          )}
                        </div>

                        {session.description ? (
                          <div className="text-sm text-gray-700 bg-gray-50/80 p-3.5 rounded-xl border border-gray-100 whitespace-pre-wrap leading-relaxed">
                            {session.description}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 italic">Chưa có nội dung mô tả cho buổi học này.</p>
                        )}

                        {session.session_date && (
                          <div className="flex items-center gap-2 text-xs text-gray-500 pt-1">
                            <Calendar className="h-4 w-4 text-primary-600" />
                            <span>
                              Thời gian buổi học:{' '}
                              <strong>{format(new Date(session.session_date), 'EEEE, dd/MM/yyyy', { locale: vi })}</strong>
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Materials Panel */}
                    {activeTab === 'materials' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Paperclip className="h-3.5 w-3.5 text-amber-600" />
                            Tài liệu đính kèm ({matCount})
                          </h4>
                          {isTeacher && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openUploadModal(session.id)}
                              className="h-7 text-xs border-amber-200 text-amber-800 hover:bg-amber-50"
                            >
                              <Upload className="h-3 w-3 mr-1 text-amber-600" />
                              Tải tài liệu mới
                            </Button>
                          )}
                        </div>

                        {matCount === 0 ? (
                          <div className="text-center py-5 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                            <Paperclip className="h-8 w-8 text-gray-300 mx-auto mb-1.5" />
                            <p className="text-xs text-gray-500">Chưa có tài liệu đính kèm cho buổi này.</p>
                            {isTeacher && (
                              <button
                                onClick={() => openUploadModal(session.id)}
                                className="mt-2 inline-flex items-center gap-1 text-xs text-primary-600 font-medium hover:underline"
                              >
                                <Upload className="h-3 w-3" /> Tải tài liệu ngay
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {session.materials.map((mat) => {
                              const isPdf = mat.file_type.includes('pdf');
                              const isWord = mat.file_type.includes('word') || mat.file_type.includes('officedocument');
                              return (
                                <div
                                  key={mat.id}
                                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-gray-200 bg-gray-50/70 hover:bg-gray-100/80 transition-all text-sm"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                      className={`p-2 rounded-lg ${
                                        isPdf ? 'bg-red-100 text-red-600' : isWord ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'
                                      }`}
                                    >
                                      <FileText className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-medium text-gray-900 truncate text-xs" title={mat.title || mat.file_name}>
                                        {mat.title || mat.file_name}
                                      </p>
                                      <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                        <span>{formatFileSize(mat.file_size)}</span>
                                        {!mat.is_public && (
                                          <span className="text-amber-600 bg-amber-50 px-1 rounded">Chỉ GV</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <a
                                      href={
                                        mat.id
                                          ? `${getBackendOrigin()}/api/v1/materials/${mat.id}/download`
                                          : mat.file_path.startsWith('http')
                                          ? mat.file_path
                                          : `${getBackendOrigin()}${mat.file_path.startsWith('/') ? '' : '/'}${mat.file_path}`
                                      }
                                      target="_blank"
                                      rel="noreferrer"
                                      download={mat.file_name}
                                      className="p-1.5 text-primary-600 hover:text-primary-800 hover:bg-white rounded-lg transition-colors"
                                      title="Tải xuống tài liệu"
                                    >
                                      <FileDown className="h-4 w-4" />
                                    </a>
                                    {isTeacher && (
                                      <>
                                        <button
                                          onClick={() =>
                                            toggleVisibilityMutation.mutate({
                                              materialId: mat.id,
                                              isPublic: !mat.is_public,
                                            })
                                          }
                                          title={mat.is_public ? 'Đang hiện (Bấm để ẩn với HS)' : 'Đang ẩn (Bấm để hiện với HS)'}
                                          className={`p-1.5 rounded-lg hover:bg-white transition-colors ${
                                            mat.is_public ? 'text-gray-400 hover:text-gray-600' : 'text-amber-600'
                                          }`}
                                        >
                                          {mat.is_public ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (confirm(`Bạn có chắc muốn xóa tài liệu "${mat.title || mat.file_name}"?`)) {
                                              deleteMaterialMutation.mutate(mat.id);
                                            }
                                          }}
                                          title="Xóa tài liệu"
                                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Homework Panel */}
                    {activeTab === 'homework' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                            <ClipboardCheck className="h-3.5 w-3.5 text-emerald-600" />
                            Bài tập về nhà ({hwCount})
                          </h4>
                          {isTeacher && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAddExamModal(session.id, 'homework')}
                              className="h-7 text-xs border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                            >
                              <Plus className="h-3 w-3 mr-1 text-emerald-600" />
                              Giao bài tập
                            </Button>
                          )}
                        </div>

                        {hwCount === 0 ? (
                          <div className="text-center py-5 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                            <ClipboardCheck className="h-8 w-8 text-gray-300 mx-auto mb-1.5" />
                            <p className="text-xs text-gray-500">Chưa có bài tập nào cho buổi học này.</p>
                            {isTeacher && (
                              <button
                                onClick={() => openAddExamModal(session.id, 'homework')}
                                className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-600 font-medium hover:underline"
                              >
                                <Plus className="h-3 w-3" /> Giao bài tập ngay
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {homeworks.map((asgn) => (
                              <div
                                key={asgn.id}
                                className="flex items-center justify-between gap-2 p-3 rounded-xl border border-emerald-100 bg-emerald-50/30 hover:bg-emerald-50/60 transition-all text-sm"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                                    <ClipboardCheck className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700">
                                        Bài tập
                                      </span>
                                      <p className="font-semibold text-gray-900 truncate text-xs" title={asgn.name}>
                                        {asgn.name}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                                      <span>{asgn.duration_minutes} phút</span>
                                      <span>•</span>
                                      <span className="text-emerald-700 font-medium">
                                        {asgn.total_submissions ?? 0} bài nộp
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {isTeacher ? (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-xs text-emerald-700 hover:bg-white"
                                        title="Xem danh sách bài nộp của học sinh"
                                        onClick={() => setSelectedSubmissionAssignment({ id: asgn.id, name: asgn.name })}
                                      >
                                        <Users className="h-3.5 w-3.5 mr-1" />
                                        Bài nộp ({asgn.total_submissions ?? 0})
                                      </Button>
                                      <button
                                        title="Xóa bài tập này"
                                        onClick={() => {
                                          if (confirm(`Bạn có chắc muốn xóa bài tập "${asgn.name}" khỏi buổi học?`)) {
                                            deleteAssignmentMutation.mutate(asgn.id);
                                          }
                                        }}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <Button
                                      size="sm"
                                      className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700"
                                      onClick={() => navigate('/assignments')}
                                    >
                                      Làm bài
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Exam Panel */}
                    {activeTab === 'exam' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Award className="h-3.5 w-3.5 text-purple-600" />
                            Bài kiểm tra ({examCount})
                          </h4>
                          {isTeacher && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openAddExamModal(session.id, 'exam')}
                              className="h-7 text-xs border-purple-200 text-purple-800 hover:bg-purple-50"
                            >
                              <Plus className="h-3 w-3 mr-1 text-purple-600" />
                              Giao bài kiểm tra
                            </Button>
                          )}
                        </div>

                        {examCount === 0 ? (
                          <div className="text-center py-5 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                            <Award className="h-8 w-8 text-gray-300 mx-auto mb-1.5" />
                            <p className="text-xs text-gray-500">Chưa có bài kiểm tra nào trong buổi học này.</p>
                            {isTeacher && (
                              <button
                                onClick={() => openAddExamModal(session.id, 'exam')}
                                className="mt-2 inline-flex items-center gap-1 text-xs text-purple-600 font-medium hover:underline"
                              >
                                <Plus className="h-3 w-3" /> Giao bài kiểm tra ngay
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {exams.map((asgn) => (
                              <div
                                key={asgn.id}
                                className="flex items-center justify-between gap-2 p-3 rounded-xl border border-purple-100 bg-purple-50/30 hover:bg-purple-50/60 transition-all text-sm"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="p-2 rounded-lg bg-purple-100 text-purple-700 shrink-0">
                                    <Award className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-700">
                                        Kiểm tra
                                      </span>
                                      <p className="font-semibold text-gray-900 truncate text-xs" title={asgn.name}>
                                        {asgn.name}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                                      <span>{asgn.duration_minutes} phút</span>
                                      {asgn.pass_score ? (
                                        <>
                                          <span>•</span>
                                          <span>Đạt: &ge; {asgn.pass_score} đ</span>
                                        </>
                                      ) : null}
                                      <span>•</span>
                                      <span className="text-purple-700 font-medium">
                                        {asgn.total_submissions ?? 0} bài nộp
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {isTeacher ? (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-xs text-purple-700 hover:bg-white"
                                        title="Xem danh sách bài nộp của học sinh"
                                        onClick={() => setSelectedSubmissionAssignment({ id: asgn.id, name: asgn.name })}
                                      >
                                        <Users className="h-3.5 w-3.5 mr-1" />
                                        Bài nộp ({asgn.total_submissions ?? 0})
                                      </Button>
                                      <button
                                        title="Xóa bài kiểm tra này"
                                        onClick={() => {
                                          if (confirm(`Bạn có chắc muốn xóa bài kiểm tra "${asgn.name}" khỏi buổi học? Mọi bài nộp của học sinh cũng sẽ bị xóa.`)) {
                                            deleteAssignmentMutation.mutate(asgn.id);
                                          }
                                        }}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <Button
                                      size="sm"
                                      className="h-7 px-2.5 text-xs bg-purple-600 hover:bg-purple-700"
                                      onClick={() => navigate('/assignments')}
                                    >
                                      Làm bài thi
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Session Create / Edit Modal */}
      <Modal
        open={sessionModalOpen}
        onOpenChange={setSessionModalOpen}
        title={
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary-600" />
            <span>{editingSession ? 'Chỉnh sửa buổi học' : 'Thêm buổi học mới'}</span>
          </div>
        }
        footer={
          <>
            <Button variant="secondary" onClick={closeSessionModal}>
              Hủy
            </Button>
            <Button
              loading={saveSessionMutation.isPending}
              onClick={() => {
                if (!sessionTitle.trim()) {
                  toast.error('Vui lòng nhập tên buổi học');
                  return;
                }
                saveSessionMutation.mutate();
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              {editingSession ? 'Lưu thay đổi' : 'Tạo buổi học'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Tiêu đề buổi học *"
            placeholder="Ví dụ: Buổi 1: Giới thiệu kiến trúc hệ thống"
            value={sessionTitle}
            onChange={(e) => setSessionTitle(e.target.value)}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả / Nội dung trọng tâm</label>
            <textarea
              rows={3}
              placeholder="Tóm tắt nội dung chính sẽ giảng dạy trong buổi học..."
              value={sessionDesc}
              onChange={(e) => setSessionDesc(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Ngày diễn ra"
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
              <select
                value={sessionStatus}
                onChange={(e) => setSessionStatus(e.target.value as any)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="planned">Đang lên kế hoạch</option>
                <option value="completed">Đã hoàn thành</option>
                <option value="cancelled">Đã hủy</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>

      {/* Upload Material Modal */}
      <Modal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        title={
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary-600" />
            <span>Tải lên tài liệu học tập</span>
          </div>
        }
        footer={
          <>
            <Button variant="secondary" onClick={closeUploadModal}>
              Hủy
            </Button>
            <Button
              loading={uploadMaterialMutation.isPending}
              onClick={() => {
                if (!materialFile) {
                  toast.error('Vui lòng chọn tệp tin cần tải lên');
                  return;
                }
                uploadMaterialMutation.mutate();
              }}
            >
              <Upload className="h-4 w-4 mr-1.5" />
              Bắt đầu tải lên
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Tên tài liệu / Tiêu đề"
            placeholder="Ví dụ: Bài giảng Slide Chương 1 (PDF)"
            value={materialTitle}
            onChange={(e) => setMaterialTitle(e.target.value)}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả ngắn</label>
            <textarea
              rows={2}
              placeholder="Ghi chú thêm về tài liệu này..."
              value={materialDesc}
              onChange={(e) => setMaterialDesc(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chọn tệp tin (PDF, Word, Slide, Zip...)</label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  const file = e.target.files[0];
                  setMaterialFile(file);
                  if (!materialTitle) {
                    setMaterialTitle(file.name);
                  }
                }
              }}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="mat-public"
              checked={materialIsPublic}
              onChange={(e) => setMaterialIsPublic(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="mat-public" className="text-sm font-medium text-gray-700 cursor-pointer">
              Công khai cho học sinh xem và tải về ngay
            </label>
          </div>
        </div>
      </Modal>

      {/* Create / Assign Exam to Session Modal */}
      <CreateAssignmentModal
        open={assignmentModalOpen}
        onOpenChange={(open) => {
          setAssignmentModalOpen(open);
          if (!open) {
            setTargetSessionForExam(undefined);
            setTargetAssignmentType(undefined);
          }
        }}
        initialClassId={classId}
        initialSessionId={targetSessionForExam}
        initialType={targetAssignmentType}
      />

      {/* View Submissions Modal */}
      <AssignmentSubmissionsModal
        assignmentId={selectedSubmissionAssignment?.id || null}
        assignmentName={selectedSubmissionAssignment?.name}
        open={!!selectedSubmissionAssignment}
        onOpenChange={(open) => {
          if (!open) setSelectedSubmissionAssignment(null);
        }}
      />
    </div>
  );
}

