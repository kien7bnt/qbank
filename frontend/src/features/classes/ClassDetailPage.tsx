import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Users,
  BookOpen,
  Calendar,
  Copy,
  Plus,
  Trash2,
  CheckCircle2,
  Mail,
  UserCheck,
  FolderKanban,
  FileCheck2,
  Edit,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { classApi, getErrorMessage } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ClassStatusBadge } from '@/components/ui/Badge';
import { PageSpinner } from '@/components/ui/Spinner';
import { ClassSessionsTab } from './ClassSessionsTab';
import { EditClassModal } from './EditClassModal';

export function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isTeacher = user?.roles.includes('teacher') || user?.roles.includes('admin');

  const [activeTab, setActiveTab] = useState<'sessions' | 'members'>('sessions');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');

  const { data: classData, isLoading: isLoadingClass } = useQuery({
    queryKey: ['class', id],
    queryFn: () => classApi.get(id!),
    enabled: !!id,
  });

  const { data: membersData, isLoading: isLoadingMembers } = useQuery({
    queryKey: ['class-members', id],
    queryFn: () => classApi.members(id!),
    enabled: !!id,
  });

  // Add Student Mutation
  const addMemberMutation = useMutation({
    mutationFn: () => classApi.addMember(id!, studentEmail.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['class-members', id] });
      qc.invalidateQueries({ queryKey: ['class', id] });
      toast.success('Đã thêm học sinh vào lớp học thành công!');
      setAddModalOpen(false);
      setStudentEmail('');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Remove Student Mutation
  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => classApi.removeMember(id!, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['class-members', id] });
      qc.invalidateQueries({ queryKey: ['class', id] });
      toast.success('Đã xóa học sinh khỏi lớp học');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Delete Class Mutation
  const deleteClassMutation = useMutation({
    mutationFn: () => classApi.delete(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classes'] });
      toast.success('Đã xóa lớp học thành công!');
      navigate('/classes');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Đã sao chép mã lớp: ${code}`);
  };

  const c = classData?.data;
  const members = membersData?.data ?? [];

  if (isLoadingClass) return <PageSpinner />;
  if (!c) return <div className="p-6 text-gray-500">Không tìm thấy lớp học</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<ArrowLeft className="h-4 w-4" />}
        onClick={() => navigate('/classes')}
      >
        Quay lại danh sách lớp
      </Button>

      {/* Class info banner */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => copyCode(c.code)}
                title="Bấm để sao chép mã lớp"
                className="font-mono text-xs bg-primary-50 text-primary-700 px-2.5 py-1 rounded-md border border-primary-200 font-bold flex items-center gap-1.5 hover:bg-primary-100 transition-colors cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
                Mã lớp: {c.code}
              </button>
              <ClassStatusBadge status={c.status} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{c.name}</h1>
            {c.description && <p className="mt-1 text-sm text-gray-500">{c.description}</p>}
          </div>

          {isTeacher && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditModalOpen(true)}
              >
                <Edit className="h-4 w-4 mr-1.5 text-gray-600" />
                Chỉnh sửa
              </Button>
              <Button
                size="sm"
                onClick={() => setAddModalOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Thêm học sinh
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Xóa lớp
              </Button>
            </div>
          )}
        </div>

        <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap gap-5 text-sm text-gray-600">
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-gray-400" />
            <span>Sĩ số: <strong>{c.member_count || members.length}</strong> học viên</span>
          </div>
          {c.teacher_name && (
            <div className="flex items-center gap-1.5">
              <UserCheck className="h-4 w-4 text-gray-400" />
              <span>Giảng viên: <strong>{c.teacher_name}</strong></span>
            </div>
          )}
          {c.expected_start_date && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span>
                {format(new Date(c.expected_start_date), 'dd/MM/yyyy', { locale: vi })}
                {c.expected_end_date &&
                  ` — ${format(new Date(c.expected_end_date), 'dd/MM/yyyy', { locale: vi })}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-200 gap-6">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'sessions'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <FolderKanban className="h-4 w-4" />
          <span>Buổi học & Tài liệu</span>
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'members'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Danh sách học viên ({members.filter((m: any) => m.role === 'student').length})</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'sessions' && (
        <ClassSessionsTab classId={id!} isTeacher={Boolean(isTeacher)} />
      )}

      {activeTab === 'members' && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-base">
              Danh sách học viên ({members.filter((m: any) => m.role === 'student').length})
            </h2>
            {isTeacher && (
              <Button size="sm" variant="outline" onClick={() => setAddModalOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Thêm học viên
              </Button>
            )}
          </div>


        {isLoadingMembers ? (
          <PageSpinner />
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            Chưa có học sinh nào trong lớp. Bấm "Thêm học sinh" hoặc chia sẻ mã lớp <strong>{c.code}</strong>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 text-left">Họ tên</th>
                  <th className="px-6 py-3 text-left">Email</th>
                  <th className="px-6 py-3 text-left">Vai trò</th>
                  <th className="px-6 py-3 text-left">Trạng thái</th>
                  <th className="px-6 py-3 text-left">Ngày tham gia</th>
                  {isTeacher && <th className="px-6 py-3 text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.map((m: any) => (
                  <tr key={m.user_id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-gray-900">{m.full_name}</td>
                    <td className="px-6 py-3.5 text-gray-500">{m.email}</td>
                    <td className="px-6 py-3.5">
                      <span className="capitalize text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                        {m.role === 'student' ? 'Học sinh' : 'Giáo viên'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          m.status === 'active'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {m.status === 'active' ? 'Đang học' : m.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-gray-400 text-xs">
                      {m.joined_at
                        ? format(new Date(m.joined_at), 'dd/MM/yyyy', { locale: vi })
                        : '—'}
                    </td>
                    {isTeacher && (
                      <td className="px-6 py-3.5 text-right">
                        {m.role === 'student' && (
                          <button
                            title="Xóa khỏi lớp"
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                            onClick={() => {
                              if (confirm(`Bạn có chắc muốn xóa học sinh "${m.full_name}" khỏi lớp?`)) {
                                removeMemberMutation.mutate(m.user_id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* Add Student Modal */}

      <Modal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        title={
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary-600" />
            <span>Thêm học sinh vào lớp {c.name}</span>
          </div>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddModalOpen(false)}>
              Hủy
            </Button>
            <Button
              loading={addMemberMutation.isPending}
              onClick={() => {
                if (!studentEmail.trim()) {
                  toast.error('Vui lòng nhập email học sinh');
                  return;
                }
                addMemberMutation.mutate();
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Thêm vào lớp
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Email học sinh *"
            placeholder="Ví dụ: student@qbank.vn"
            type="email"
            value={studentEmail}
            onChange={(e) => setStudentEmail(e.target.value)}
            required
          />
          <p className="text-xs text-gray-500">
            Học sinh cần có tài khoản trên hệ thống. Hoặc bạn có thể gửi <strong>Mã lớp: {c.code}</strong> để học sinh tự nhập mã tham gia.
          </p>
        </div>
      </Modal>

      {/* Edit Class Modal */}
      {c && (
        <EditClassModal
          class_={c}
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Xác nhận xóa lớp học"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>
              Hủy
            </Button>
            <Button
              variant="danger"
              loading={deleteClassMutation.isPending}
              onClick={() => deleteClassMutation.mutate()}
            >
              Xác nhận xóa
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Bạn có chắc chắn muốn xóa lớp học <strong>{c.name}</strong> ({c.code}) không? Tất cả các buổi học, bài tập và thành viên của lớp này sẽ bị xóa. Hành động này không thể hoàn tác!
        </p>
      </Modal>
    </div>
  );
}
