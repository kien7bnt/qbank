import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tag, CheckCircle2, FolderTree } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { domainApi, questionApi, getErrorMessage } from '@/services/api';

interface AssignTopicModalProps {
  questionIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AssignTopicModal({
  questionIds,
  open,
  onOpenChange,
  onSuccess,
}: AssignTopicModalProps) {
  const qc = useQueryClient();
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');

  const { data: domainsData } = useQuery({
    queryKey: ['domains'],
    queryFn: () => domainApi.list(),
    enabled: open,
  });

  const domains = domainsData?.data ?? [];
  const activeDomain = domains.find((d: any) => d.id === selectedDomainId);
  const topics = activeDomain?.topics ?? [];

  const assignMutation = useMutation({
    mutationFn: () =>
      questionApi.bulkAction(questionIds, 'assign_topic', {
        chapter_id: selectedDomainId || undefined,
        topic_id: selectedTopicId || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['questions'] });
      qc.invalidateQueries({ queryKey: ['domains'] });
      toast.success(`Đã gắn Lĩnh vực · Chủ đề cho ${questionIds.length} câu hỏi thành công!`);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleAssign = () => {
    if (!selectedDomainId) {
      toast.error('Vui lòng chọn một Lĩnh vực');
      return;
    }
    assignMutation.mutate();
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-primary-600" />
          <span>Gắn Lĩnh vực & Chủ đề cho {questionIds.length} câu hỏi</span>
        </div>
      }
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            loading={assignMutation.isPending}
            onClick={handleAssign}
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            Xác nhận gắn
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Chọn Lĩnh vực *
          </label>
          <select
            value={selectedDomainId}
            onChange={(e) => {
              setSelectedDomainId(e.target.value);
              setSelectedTopicId('');
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">— Chọn Lĩnh vực —</option>
            {domains.map((d: any) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.question_count} câu)
              </option>
            ))}
          </select>
        </div>

        {selectedDomainId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chọn Chủ đề (Tùy chọn)
            </label>
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">— Chọn Chủ đề trong Lĩnh vực này —</option>
              {topics.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.question_count} câu)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </Modal>
  );
}
