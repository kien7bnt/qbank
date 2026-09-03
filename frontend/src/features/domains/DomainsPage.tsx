import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FolderTree,
  Plus,
  FolderPlus,
  Edit2,
  Trash2,
  HelpCircle,
  ChevronRight,
  ChevronDown,
  Layers,
  Database,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { domainApi, getErrorMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';

export function DomainsPage() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Modals state
  const [createDomainOpen, setCreateDomainOpen] = useState(false);
  const [domainForm, setDomainForm] = useState({ name: '', description: '', id: '' });
  const [isEditingDomain, setIsEditingDomain] = useState(false);

  const [createTopicOpen, setCreateTopicOpen] = useState(false);
  const [topicForm, setTopicForm] = useState({ name: '', domainId: '', id: '' });
  const [isEditingTopic, setIsEditingTopic] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['domains'],
    queryFn: () => domainApi.list(),
  });

  const domains = data?.data ?? [];

  // Toggle expand
  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Domain Mutations
  const saveDomainMutation = useMutation({
    mutationFn: () => {
      if (isEditingDomain) {
        return domainApi.updateDomain(domainForm.id, {
          name: domainForm.name,
          description: domainForm.description || undefined,
        });
      }
      return domainApi.createDomain({
        name: domainForm.name,
        description: domainForm.description || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domains'] });
      toast.success(isEditingDomain ? 'Đã cập nhật lĩnh vực' : 'Đã tạo lĩnh vực mới');
      setCreateDomainOpen(false);
      setDomainForm({ name: '', description: '', id: '' });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteDomainMutation = useMutation({
    mutationFn: (id: string) => domainApi.deleteDomain(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domains'] });
      toast.success('Đã xóa lĩnh vực');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Topic Mutations
  const saveTopicMutation = useMutation({
    mutationFn: () => {
      if (isEditingTopic) {
        return domainApi.updateTopic(topicForm.id, { name: topicForm.name });
      }
      return domainApi.createTopic(topicForm.domainId, { name: topicForm.name });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domains'] });
      toast.success(isEditingTopic ? 'Đã cập nhật chủ đề' : 'Đã thêm chủ đề mới');
      setCreateTopicOpen(false);
      setTopicForm({ name: '', domainId: '', id: '' });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteTopicMutation = useMutation({
    mutationFn: (id: string) => domainApi.deleteTopic(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domains'] });
      toast.success('Đã xóa chủ đề');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (isLoading) return <PageSpinner />;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <FolderTree className="h-6 w-6 text-primary-600" />
            Quản Lý Lĩnh Vực & Chủ Đề
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Gom nhóm và phân loại toàn bộ ngân hàng câu hỏi theo cây cấu trúc Lĩnh vực & Chủ đề.
          </p>
        </div>

        <Button
          onClick={() => {
            setIsEditingDomain(false);
            setDomainForm({ name: '', description: '', id: '' });
            setCreateDomainOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm lĩnh vực mới
        </Button>
      </div>

      {/* Domain List */}
      {domains.length === 0 ? (
        <EmptyState
          icon={<FolderTree className="h-10 w-10 text-gray-400" />}
          title="Chưa có Lĩnh vực nào"
          description="Hãy tạo Lĩnh vực đầu tiên (ví dụ: Đại số & Giải tích, Hình học, Lập trình...) để phân loại câu hỏi."
          action={
            <Button
              onClick={() => {
                setIsEditingDomain(false);
                setDomainForm({ name: '', description: '', id: '' });
                setCreateDomainOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Tạo lĩnh vực đầu tiên
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {domains.map((domain: any) => {
            const isExp = expanded[domain.id] ?? true;
            return (
              <div
                key={domain.id}
                className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"
              >
                {/* Domain Header */}
                <div className="p-4 bg-gray-50/70 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                  <div
                    className="flex items-center gap-2 cursor-pointer select-none"
                    onClick={() => toggleExpand(domain.id)}
                  >
                    <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                      {isExp ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div className="p-2 bg-primary-100/60 rounded-xl text-primary-700 font-bold">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                        {domain.name}
                        <span className="text-xs bg-primary-50 text-primary-700 font-semibold px-2 py-0.5 rounded-full border border-primary-200">
                          {domain.question_count} câu hỏi
                        </span>
                      </h3>
                      {domain.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{domain.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsEditingTopic(false);
                        setTopicForm({ name: '', domainId: domain.id, id: '' });
                        setCreateTopicOpen(true);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Thêm chủ đề
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-gray-500 hover:text-gray-700"
                      onClick={() => {
                        setIsEditingDomain(true);
                        setDomainForm({ name: domain.name, description: domain.description || '', id: domain.id });
                        setCreateDomainOpen(true);
                      }}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:bg-red-50"
                      onClick={() => {
                        if (confirm(`Bạn có chắc muốn xóa lĩnh vực "${domain.name}" cùng tất cả chủ đề bên trong?`)) {
                          deleteDomainMutation.mutate(domain.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Topics List */}
                {isExp && (
                  <div className="p-4">
                    {domain.topics && domain.topics.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {domain.topics.map((topic: any) => (
                          <div
                            key={topic.id}
                            className="bg-white border border-gray-200 rounded-xl p-3.5 flex items-center justify-between shadow-sm hover:border-primary-300 transition-all"
                          >
                            <div className="space-y-0.5">
                              <span className="font-semibold text-gray-900 text-sm">
                                {topic.name}
                              </span>
                              <p className="text-xs text-gray-400">
                                {topic.question_count} câu hỏi
                              </p>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                                onClick={() => {
                                  setIsEditingTopic(true);
                                  setTopicForm({ name: topic.name, domainId: domain.id, id: topic.id });
                                  setCreateTopicOpen(true);
                                }}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                className="p-1.5 text-red-400 hover:text-red-600 rounded hover:bg-red-50"
                                onClick={() => {
                                  if (confirm(`Bạn có chắc muốn xóa chủ đề "${topic.name}"?`)) {
                                    deleteTopicMutation.mutate(topic.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-xs text-gray-400">
                        Chưa có chủ đề nào trong lĩnh vực này. Bấm "Thêm chủ đề" để tạo mới.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Domain Modal */}
      <Modal
        open={createDomainOpen}
        onOpenChange={setCreateDomainOpen}
        title={isEditingDomain ? 'Chỉnh sửa Lĩnh vực' : 'Tạo Lĩnh vực mới'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateDomainOpen(false)}>
              Hủy
            </Button>
            <Button
              loading={saveDomainMutation.isPending}
              onClick={() => {
                if (!domainForm.name.trim()) {
                  toast.error('Vui lòng nhập tên lĩnh vực');
                  return;
                }
                saveDomainMutation.mutate();
              }}
            >
              Lưu
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Tên Lĩnh vực *"
            placeholder="Ví dụ: Đại số & Giải tích, Hình học Oxyz, v.v."
            value={domainForm.name}
            onChange={(e) => setDomainForm({ ...domainForm, name: e.target.value })}
            required
          />
          <Textarea
            label="Mô tả"
            placeholder="Mô tả phạm vi kiến thức của lĩnh vực này..."
            value={domainForm.description}
            onChange={(e) => setDomainForm({ ...domainForm, description: e.target.value })}
            rows={2}
          />
        </div>
      </Modal>

      {/* Create / Edit Topic Modal */}
      <Modal
        open={createTopicOpen}
        onOpenChange={setCreateTopicOpen}
        title={isEditingTopic ? 'Chỉnh sửa Chủ đề' : 'Thêm Chủ đề mới'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateTopicOpen(false)}>
              Hủy
            </Button>
            <Button
              loading={saveTopicMutation.isPending}
              onClick={() => {
                if (!topicForm.name.trim()) {
                  toast.error('Vui lòng nhập tên chủ đề');
                  return;
                }
                saveTopicMutation.mutate();
              }}
            >
              Lưu
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Tên Chủ đề *"
            placeholder="Ví dụ: Tính đơn điệu của hàm số, Cực trị, Tích phân..."
            value={topicForm.name}
            onChange={(e) => setTopicForm({ ...topicForm, name: e.target.value })}
            required
          />
        </div>
      </Modal>
    </div>
  );
}
