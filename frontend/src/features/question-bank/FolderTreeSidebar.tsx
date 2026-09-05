import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  FolderPlus,
  Trash2,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  X,
  CheckCircle2,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { domainApi, getErrorMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageSpinner } from '@/components/ui/Spinner';

export interface SelectedFolder {
  type: 'domain' | 'topic';
  id: string;
  name: string;
  parentId?: string;
}

interface FolderTreeSidebarProps {
  selectedFolder: SelectedFolder | null;
  onSelectFolder: (folder: SelectedFolder | null) => void;
  totalQuestions: number;
  className?: string;
  onClose?: () => void;
}

export function FolderTreeSidebar({
  selectedFolder,
  onSelectFolder,
  totalQuestions,
  className,
  onClose,
}: FolderTreeSidebarProps) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // Active context menu state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Modal states
  const [createDomainModalOpen, setCreateDomainModalOpen] = useState(false);
  const [createTopicModalOpen, setCreateTopicModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Target item for modals
  const [targetItem, setTargetItem] = useState<{
    id: string;
    name: string;
    type: 'domain' | 'topic';
  } | null>(null);

  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // Fetch domains & topics list
  const { data, isLoading } = useQuery({
    queryKey: ['domains'],
    queryFn: () => domainApi.list(),
  });

  const domains = data?.data || [];

  // Mutations
  const createDomainMutation = useMutation({
    mutationFn: () =>
      domainApi.createDomain({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['domains'] });
      toast.success('Đã tạo thư mục mới');
      setCreateDomainModalOpen(false);
      setFormName('');
      setFormDescription('');
      if (res?.data?.id) {
        onSelectFolder({ type: 'domain', id: res.data.id, name: res.data.name });
      }
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const createTopicMutation = useMutation({
    mutationFn: () =>
      domainApi.createTopic(targetItem!.id, {
        name: formName.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domains'] });
      toast.success('Đã tạo thư mục con mới');
      setCreateTopicModalOpen(false);
      setFormName('');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const renameMutation = useMutation({
    mutationFn: () => {
      if (targetItem?.type === 'domain') {
        return domainApi.updateDomain(targetItem.id, { name: formName.trim() });
      } else {
        return domainApi.updateTopic(targetItem!.id, { name: formName.trim() });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domains'] });
      toast.success('Đã đổi tên thư mục');
      setRenameModalOpen(false);
      setFormName('');
      if (selectedFolder && selectedFolder.id === targetItem?.id) {
        onSelectFolder({ ...selectedFolder, name: formName.trim() });
      }
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (targetItem?.type === 'domain') {
        return domainApi.deleteDomain(targetItem.id);
      } else {
        return domainApi.deleteTopic(targetItem!.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domains'] });
      qc.invalidateQueries({ queryKey: ['questions'] });
      toast.success('Đã xóa thư mục');
      setDeleteConfirmOpen(false);
      if (selectedFolder?.id === targetItem?.id) {
        onSelectFolder(null);
      }
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedFolders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenAddTopic = (domainId: string, domainName: string) => {
    setTargetItem({ id: domainId, name: domainName, type: 'domain' });
    setFormName('');
    setCreateTopicModalOpen(true);
    setActiveMenuId(null);
  };

  const handleOpenRename = (id: string, name: string, type: 'domain' | 'topic') => {
    setTargetItem({ id, name, type });
    setFormName(name);
    setRenameModalOpen(true);
    setActiveMenuId(null);
  };

  const handleOpenDelete = (id: string, name: string, type: 'domain' | 'topic') => {
    setTargetItem({ id, name, type });
    setDeleteConfirmOpen(true);
    setActiveMenuId(null);
  };

  const handleDeleteCurrent = () => {
    if (!selectedFolder) {
      toast('Vui lòng chọn một thư mục để xóa');
      return;
    }
    handleOpenDelete(selectedFolder.id, selectedFolder.name, selectedFolder.type);
  };

  // Filter folders by search
  const filteredDomains = domains.filter((d: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const matchDomain = d.name?.toLowerCase().includes(q);
    const matchTopic = d.topics?.some((t: any) => t.name?.toLowerCase().includes(q));
    return matchDomain || matchTopic;
  });

  return (
    <aside className={clsx(className || 'w-64 lg:w-72 shrink-0 bg-white border border-gray-200/80 rounded-2xl p-3.5 flex flex-col h-full shadow-xs select-none')}>
      {/* Search folder input */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Tìm thư mục..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-2 text-xs bg-gray-50 border border-gray-200/80 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder:text-gray-400 text-gray-800"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-1 py-1 mb-2">
        <span className="text-xs font-semibold text-gray-700 tracking-tight">Danh sách thư mục</span>
        <div className="flex items-center gap-1 text-gray-500">
          <button
            type="button"
            onClick={() => {
              setFormName('');
              setFormDescription('');
              setCreateDomainModalOpen(true);
            }}
            title="Thêm thư mục mới"
            className="p-1.5 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FolderPlus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleDeleteCurrent}
            disabled={!selectedFolder}
            title={selectedFolder ? `Xóa thư mục "${selectedFolder.name}"` : 'Chọn thư mục để xóa'}
            className={clsx(
              'p-1.5 rounded-lg transition-colors',
              selectedFolder
                ? 'hover:text-red-600 hover:bg-red-50 text-gray-500'
                : 'text-gray-300 cursor-not-allowed'
            )}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors ml-1 text-gray-400"
              title="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tree list */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 custom-scrollbar">
        {/* Item "Tất cả câu hỏi" */}
        <div
          onClick={() => {
            onSelectFolder(null);
            onClose?.();
          }}
          className={clsx(
            'group flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all',
            !selectedFolder
              ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
              : 'text-gray-700 hover:bg-gray-100/70'
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Layers
              className={clsx(
                'h-4 w-4 shrink-0',
                !selectedFolder ? 'text-blue-600' : 'text-gray-400'
              )}
            />
            <span className="truncate">Tất cả câu hỏi</span>
          </div>
          <span
            className={clsx(
              'px-1.5 py-0.5 rounded-full text-[11px] font-mono font-medium shrink-0',
              !selectedFolder
                ? 'bg-blue-100 text-blue-800'
                : 'text-gray-400 bg-gray-100/80'
            )}
          >
            {totalQuestions}
          </span>
        </div>

        {/* Loading state */}
        {isLoading ? (
          <div className="py-8 flex justify-center">
            <PageSpinner />
          </div>
        ) : filteredDomains.length === 0 ? (
          <div className="py-8 text-center px-4">
            <p className="text-xs text-gray-400">
              {search ? 'Không có thư mục phù hợp' : 'Chưa có thư mục nào'}
            </p>
          </div>
        ) : (
          filteredDomains.map((domain: any) => {
            const isDomainSelected =
              selectedFolder?.type === 'domain' && selectedFolder?.id === domain.id;
            const hasTopics = domain.topics && domain.topics.length > 0;
            const isExpanded = expandedFolders[domain.id] ?? false;

            return (
              <div key={domain.id} className="relative">
                {/* Domain folder item */}
                <div
                  onClick={() => {
                    onSelectFolder({
                      type: 'domain',
                      id: domain.id,
                      name: domain.name,
                    });
                    onClose?.();
                  }}
                  className={clsx(
                    'group flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition-all',
                    isDomainSelected
                      ? 'bg-blue-50 text-blue-700 font-semibold shadow-xs'
                      : 'text-gray-700 hover:bg-gray-100/70'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {/* Expand/Collapse chevron */}
                    {hasTopics ? (
                      <button
                        type="button"
                        onClick={(e) => toggleExpand(domain.id, e)}
                        className="p-0.5 text-gray-400 hover:text-gray-600 rounded transition-colors shrink-0"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ) : (
                      <span className="w-3.5 shrink-0" />
                    )}

                    {/* Folder icon */}
                    {isExpanded ? (
                      <FolderOpen
                        className={clsx(
                          'h-4 w-4 shrink-0',
                          isDomainSelected ? 'text-blue-600' : 'text-gray-400'
                        )}
                      />
                    ) : (
                      <Folder
                        className={clsx(
                          'h-4 w-4 shrink-0',
                          isDomainSelected ? 'text-blue-600' : 'text-gray-400'
                        )}
                      />
                    )}

                    <span className="truncate" title={domain.name}>
                      {domain.name}
                    </span>
                    <span
                      className={clsx(
                        'text-[11px] font-mono shrink-0',
                        isDomainSelected ? 'text-blue-600' : 'text-gray-400'
                      )}
                    >
                      ({domain.question_count ?? 0})
                    </span>
                  </div>

                  {/* Context menu trigger */}
                  <div className="relative shrink-0 ml-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === domain.id ? null : domain.id);
                      }}
                      className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>

                    {/* Dropdown context menu */}
                    {activeMenuId === domain.id && (
                      <>
                        <div
                          className="fixed inset-0 z-20"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(null);
                          }}
                        />
                        <div className="absolute right-0 top-full mt-1 z-30 w-40 bg-white border border-gray-200 rounded-xl shadow-lg py-1 text-xs text-gray-700 animate-in fade-in zoom-in-95">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenAddTopic(domain.id, domain.name);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Plus className="h-3.5 w-3.5 text-gray-500" />
                            Thêm thư mục con
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenRename(domain.id, domain.name, 'domain');
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Pencil className="h-3.5 w-3.5 text-gray-500" />
                            Đổi tên
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDelete(domain.id, domain.name, 'domain');
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2 border-t border-gray-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Xóa thư mục
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Sub-topics (Children) */}
                {hasTopics && isExpanded && (
                  <div className="ml-5 pl-2.5 border-l border-gray-200/80 space-y-0.5 mt-0.5">
                    {domain.topics.map((topic: any) => {
                      const isTopicSelected =
                        selectedFolder?.type === 'topic' && selectedFolder?.id === topic.id;

                      return (
                        <div
                          key={topic.id}
                          onClick={() => {
                            onSelectFolder({
                              type: 'topic',
                              id: topic.id,
                              name: topic.name,
                              parentId: domain.id,
                            });
                            onClose?.();
                          }}
                          className={clsx(
                            'group flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-all',
                            isTopicSelected
                              ? 'bg-blue-50 text-blue-700 font-semibold'
                              : 'text-gray-600 hover:bg-gray-100/70'
                          )}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <Folder
                              className={clsx(
                                'h-3.5 w-3.5 shrink-0',
                                isTopicSelected ? 'text-blue-600' : 'text-gray-400'
                              )}
                            />
                            <span className="truncate" title={topic.name}>
                              {topic.name}
                            </span>
                            <span
                              className={clsx(
                                'text-[10px] font-mono shrink-0',
                                isTopicSelected ? 'text-blue-600' : 'text-gray-400'
                              )}
                            >
                              ({topic.question_count ?? 0})
                            </span>
                          </div>

                          {/* Context menu for topic */}
                          <div className="relative shrink-0 ml-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === topic.id ? null : topic.id);
                              }}
                              className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <MoreHorizontal className="h-3 w-3" />
                            </button>

                            {activeMenuId === topic.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-20"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                  }}
                                />
                                <div className="absolute right-0 top-full mt-1 z-30 w-36 bg-white border border-gray-200 rounded-xl shadow-lg py-1 text-xs text-gray-700">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenRename(topic.id, topic.name, 'topic');
                                    }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Pencil className="h-3.5 w-3.5 text-gray-500" />
                                    Đổi tên
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenDelete(topic.id, topic.name, 'topic');
                                    }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2 border-t border-gray-100"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Xóa
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Tạo thư mục mới */}
      <Modal
        open={createDomainModalOpen}
        onOpenChange={setCreateDomainModalOpen}
        title="Tạo thư mục mới"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateDomainModalOpen(false)}>
              Hủy
            </Button>
            <Button
              loading={createDomainMutation.isPending}
              onClick={() => {
                if (!formName.trim()) {
                  toast.error('Vui lòng nhập tên thư mục');
                  return;
                }
                createDomainMutation.mutate();
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Tạo thư mục
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Tên thư mục *"
            placeholder="Ví dụ: Lập trình di động, Trắc nghiệm Tin học..."
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Mô tả (tuỳ chọn)"
            placeholder="Ghi chú về thư mục này..."
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
          />
        </div>
      </Modal>

      {/* Modal: Thêm thư mục con */}
      <Modal
        open={createTopicModalOpen}
        onOpenChange={setCreateTopicModalOpen}
        title={`Thêm thư mục con vào "${targetItem?.name}"`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateTopicModalOpen(false)}>
              Hủy
            </Button>
            <Button
              loading={createTopicMutation.isPending}
              onClick={() => {
                if (!formName.trim()) {
                  toast.error('Vui lòng nhập tên thư mục con');
                  return;
                }
                createTopicMutation.mutate();
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Thêm thư mục con
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Tên thư mục con *"
            placeholder="Ví dụ: Android cơ bản, Jetpack Compose..."
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
            autoFocus
          />
        </div>
      </Modal>

      {/* Modal: Đổi tên thư mục */}
      <Modal
        open={renameModalOpen}
        onOpenChange={setRenameModalOpen}
        title="Đổi tên thư mục"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenameModalOpen(false)}>
              Hủy
            </Button>
            <Button
              loading={renameMutation.isPending}
              onClick={() => {
                if (!formName.trim()) {
                  toast.error('Tên thư mục không được để trống');
                  return;
                }
                renameMutation.mutate();
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Lưu thay đổi
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Tên mới *"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
            autoFocus
          />
        </div>
      </Modal>

      {/* Modal: Xác nhận xóa thư mục */}
      <Modal
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Xác nhận xóa thư mục"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>
              Hủy
            </Button>
            <Button
              variant="danger"
              loading={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Xóa thư mục
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          Bạn có chắc chắn muốn xóa thư mục{' '}
          <strong className="text-gray-900">"{targetItem?.name}"</strong> không?
          <br />
          <span className="text-xs text-amber-600 mt-2 block">
            Lưu ý: Các câu hỏi trong thư mục này sẽ không bị xóa và chuyển về trạng thái Chưa phân loại.
          </span>
        </p>
      </Modal>
    </aside>
  );
}
