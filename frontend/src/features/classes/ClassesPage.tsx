import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Users, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageSpinner } from '@/components/ui/Spinner';
import { classApi, getErrorMessage } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { ClassCard } from './ClassCard';
import { CreateClassModal } from './CreateClassModal';
import { EditClassModal } from './EditClassModal';
import { JoinClassModal } from './JoinClassModal';
import type { Class, ClassFilter } from '@/types';

export function ClassesPage() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const { activeRole } = useAuthStore();
  const isTeacher = activeRole === 'teacher';
  const defaultView = isTeacher ? 'mine' : 'joined';
  const view = (searchParams.get('view') as 'mine' | 'joined') ?? defaultView;

  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [deletingClass, setDeletingClass] = useState<Class | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['classes', isTeacher ? 'mine' : 'joined', search],
    queryFn: () =>
      classApi.list({ view: isTeacher ? 'mine' : 'joined', search: search || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => classApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classes'] });
      toast.success('Đã xóa lớp học thành công!');
      setDeletingClass(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const classes = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Lớp học</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isTeacher ? 'Lớp bạn đang giảng dạy' : 'Lớp bạn đang tham gia'}
            {total > 0 && ` · ${total} lớp`}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {!isTeacher && (
            <Button
              variant="secondary"
              leftIcon={<LogIn className="h-4 w-4" />}
              onClick={() => setShowJoin(true)}
            >
              Tham gia lớp
            </Button>
          )}
          {isTeacher && (
            <Button
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => setShowCreate(true)}
            >
              Tạo lớp
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 w-full sm:max-w-xs">
        <Input
          placeholder="Tìm kiếm lớp..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="h-4 w-4" />}
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <PageSpinner />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Chưa có lớp học nào"
          description={
            isTeacher
              ? 'Tạo lớp đầu tiên để bắt đầu quản lý học viên.'
              : 'Tham gia lớp bằng mã lớp do giảng viên cung cấp.'
          }
          action={
            isTeacher ? (
              <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
                Tạo lớp
              </Button>
            ) : (
              <Button leftIcon={<LogIn className="h-4 w-4" />} onClick={() => setShowJoin(true)}>
                Tham gia lớp
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {classes.map((c) => (
            <ClassCard
              key={c.id}
              class_={c}
              isTeacher={isTeacher}
              onEdit={(classToEdit) => setEditingClass(classToEdit)}
              onDelete={(classToDelete) => setDeletingClass(classToDelete)}
            />
          ))}
        </div>
      )}

      <CreateClassModal open={showCreate} onOpenChange={setShowCreate} />
      <JoinClassModal open={showJoin} onOpenChange={setShowJoin} />

      {/* Edit Class Modal */}
      {editingClass && (
        <EditClassModal
          class_={editingClass}
          open={!!editingClass}
          onOpenChange={(isOpen) => !isOpen && setEditingClass(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deletingClass}
        onOpenChange={(isOpen) => !isOpen && setDeletingClass(null)}
        title="Xác nhận xóa lớp học"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingClass(null)}>
              Hủy
            </Button>
            <Button
              variant="danger"
              loading={deleteMutation.isPending}
              onClick={() => {
                if (deletingClass) {
                  deleteMutation.mutate(deletingClass.id);
                }
              }}
            >
              Xác nhận xóa
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Bạn có chắc chắn muốn xóa lớp học <strong>{deletingClass?.name}</strong> ({deletingClass?.code}) không? Tất cả buổi học, tài liệu và phân công của lớp này sẽ bị xóa. Hành động này không thể hoàn tác!
        </p>
      </Modal>
    </div>
  );
}
