import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { classApi, curriculumApi, getErrorMessage } from '@/services/api';

interface CreateClassModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateClassModal({ open, onOpenChange }: CreateClassModalProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    subject_id: '',
    description: '',
    expected_start_date: '',
    expected_end_date: '',
    max_students: '',
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => curriculumApi.subjects(),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () =>
      classApi.create({
        name: form.name,
        subject_id: form.subject_id || undefined,
        description: form.description || undefined,
        expected_start_date: form.expected_start_date || undefined,
        expected_end_date: form.expected_end_date || undefined,
        max_students: form.max_students ? Number(form.max_students) : undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['classes'] });
      toast.success(`Đã tạo lớp "${res.data.name}" với mã ${res.data.code}`);
      onOpenChange(false);
      setForm({ name: '', subject_id: '', description: '', expected_start_date: '', expected_end_date: '', max_students: '' });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Tạo lớp học"
      description="Mã lớp sẽ được tạo tự động"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!form.name}>
            Tạo lớp
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Tên lớp"
          placeholder="Ví dụ: Lớp Ôn Thi 12A1"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Môn học / Lĩnh vực</label>
          <select
            value={form.subject_id}
            onChange={(e) => update('subject_id', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">— Chưa gắn môn học —</option>
            {subjects?.data?.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Ngày bắt đầu"
            type="date"
            value={form.expected_start_date}
            onChange={(e) => update('expected_start_date', e.target.value)}
          />
          <Input
            label="Ngày kết thúc"
            type="date"
            value={form.expected_end_date}
            onChange={(e) => update('expected_end_date', e.target.value)}
          />
        </div>

        <Input
          label="Số học viên tối đa"
          type="number"
          placeholder="Không giới hạn nếu để trống"
          value={form.max_students}
          onChange={(e) => update('max_students', e.target.value)}
          min={1}
        />

        <Textarea
          label="Mô tả"
          placeholder="Mô tả ngắn về lớp học..."
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          rows={2}
        />
      </div>
    </Modal>
  );
}
