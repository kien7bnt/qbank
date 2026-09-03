import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { classApi, getErrorMessage } from '@/services/api';

interface JoinClassModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JoinClassModal({ open, onOpenChange }: JoinClassModalProps) {
  const [code, setCode] = useState('');
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => classApi.join(code.toUpperCase().trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classes'] });
      toast.success('Tham gia lớp thành công!');
      onOpenChange(false);
      setCode('');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Tham gia lớp"
      description="Nhập mã lớp do giảng viên cung cấp"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={code.trim().length < 4}
          >
            Tham gia
          </Button>
        </>
      }
    >
      <Input
        label="Mã lớp"
        placeholder="Ví dụ: AB12CD"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        required
        autoFocus
        className="font-mono text-lg tracking-widest"
      />
    </Modal>
  );
}
