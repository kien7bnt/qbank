import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  ChevronDown,
  BookOpen,
  Layers,
  FileText,
  Circle,
  Plus,
  Trash2,
  FolderTree,
  CheckCircle2,
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { curriculumApi, getErrorMessage } from '@/services/api';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PageSpinner } from '@/components/ui/Spinner';
import type { Subject, QuestionFilter } from '@/types';

interface CurriculumTreeProps {
  subjects: Subject[];
  onSelect: (key: string, value: string) => void;
  selectedFilter: QuestionFilter;
}

interface TreeNode {
  id: string;
  name: string;
  code?: string;
  type: 'subject' | 'chapter' | 'topic' | 'lesson';
  question_count: number;
  children?: TreeNode[];
}

export function CurriculumTree({ subjects, onSelect, selectedFilter }: CurriculumTreeProps) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isTeacher = user?.roles.includes('teacher') || user?.roles.includes('admin');

  // Expanded nodes state
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Add node modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [nodeType, setNodeType] = useState<'subject' | 'chapter' | 'topic' | 'lesson'>('chapter');
  const [nodeName, setNodeName] = useState('');
  const [parentId, setParentId] = useState<string | undefined>(undefined);
  const [parentName, setParentName] = useState('');

  // Fetch full curriculum tree with question counts
  const { data: treeData, isLoading } = useQuery({
    queryKey: ['curriculum-full-tree'],
    queryFn: () => curriculumApi.getTreeWithCounts(subjects[0]?.id || ''),
  });

  const tree: TreeNode[] = treeData?.data || [];

  // Mutation to create node
  const createNodeMutation = useMutation({
    mutationFn: () =>
      curriculumApi.createNode({
        type: nodeType,
        name: nodeName.trim(),
        parent_id: parentId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['curriculum-full-tree'] });
      qc.invalidateQueries({ queryKey: ['curriculum-tree'] });
      toast.success('Đã thêm mục mới vào cây ngân hàng câu hỏi!');
      setModalOpen(false);
      setNodeName('');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Mutation to delete node
  const deleteNodeMutation = useMutation({
    mutationFn: ({ type, id }: { type: 'chapter' | 'topic' | 'lesson'; id: string }) =>
      curriculumApi.deleteNode(type, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['curriculum-full-tree'] });
      qc.invalidateQueries({ queryKey: ['curriculum-tree'] });
      toast.success('Đã xóa mục khỏi cây ngân hàng');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openAddNodeModal = (type: 'chapter' | 'topic' | 'lesson', pId?: string, pName?: string) => {
    setNodeType(type);
    setParentId(pId);
    setParentName(pName || '');
    setNodeName('');
    setModalOpen(true);
  };

  const handleReset = () => {
    onSelect('subject_id', '');
    onSelect('chapter_id', '');
    onSelect('topic_id', '');
  };

  const renderNode = (node: TreeNode, level: number = 0) => {
    const isExpanded = expandedNodes[node.id] ?? (level < 2);
    const hasChildren = node.children && node.children.length > 0;

    let isSelected = false;
    let filterKey = '';
    if (node.type === 'subject') {
      isSelected = selectedFilter.subject_id === node.id;
      filterKey = 'subject_id';
    } else if (node.type === 'chapter') {
      isSelected = selectedFilter.chapter_id === node.id;
      filterKey = 'chapter_id';
    } else if (node.type === 'topic' || node.type === 'lesson') {
      isSelected = selectedFilter.topic_id === node.id;
      filterKey = 'topic_id';
    }

    return (
      <div key={node.id} className="select-none">
        <div
          className={clsx(
            'group flex items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-all cursor-pointer',
            isSelected
              ? 'bg-primary-50 text-primary-700 font-semibold shadow-xs'
              : 'text-gray-700 hover:bg-gray-100/80',
            level === 0 && 'font-medium'
          )}
          style={{ paddingLeft: `${Math.max(level * 14 + 6, 6)}px` }}
          onClick={() => onSelect(filterKey, node.id)}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(node.id, e)}
                className="p-0.5 text-gray-400 hover:text-gray-600 rounded transition-colors shrink-0"
              >
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}

            {node.type === 'subject' && <BookOpen className="h-3.5 w-3.5 text-primary-600 shrink-0" />}
            {node.type === 'chapter' && <Layers className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
            {node.type === 'topic' && <FileText className="h-3 w-3 text-blue-500 shrink-0" />}
            {node.type === 'lesson' && <Circle className="h-2 w-2 text-emerald-500 shrink-0" />}

            <span className="truncate text-xs" title={node.name}>
              {node.name}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            {/* Question count badge */}
            <span
              className={clsx(
                'px-1.5 py-0.2 rounded-full text-[10px] font-mono font-medium',
                node.question_count > 0
                  ? isSelected
                    ? 'bg-primary-200 text-primary-800'
                    : 'bg-gray-100 text-gray-600'
                  : 'text-gray-300'
              )}
            >
              {node.question_count}
            </span>

            {/* Teacher inline controls */}
            {isTeacher && (
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                {node.type === 'subject' && (
                  <button
                    title="Thêm Chương mới"
                    onClick={(e) => {
                      e.stopPropagation();
                      openAddNodeModal('chapter', node.id, node.name);
                    }}
                    className="p-1 text-gray-400 hover:text-primary-600 rounded hover:bg-white transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                )}
                {node.type === 'chapter' && (
                  <>
                    <button
                      title="Thêm Chủ đề mới"
                      onClick={(e) => {
                        e.stopPropagation();
                        openAddNodeModal('topic', node.id, node.name);
                      }}
                      className="p-1 text-gray-400 hover:text-primary-600 rounded hover:bg-white transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      title="Xóa Chương"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Bạn có chắc muốn xóa chương "${node.name}"?`)) {
                          deleteNodeMutation.mutate({ type: 'chapter', id: node.id });
                        }
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-white transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </>
                )}
                {node.type === 'topic' && (
                  <>
                    <button
                      title="Thêm Bài học mới"
                      onClick={(e) => {
                        e.stopPropagation();
                        openAddNodeModal('lesson', node.id, node.name);
                      }}
                      className="p-1 text-gray-400 hover:text-primary-600 rounded hover:bg-white transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      title="Xóa Chủ đề"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Bạn có chắc muốn xóa chủ đề "${node.name}"?`)) {
                          deleteNodeMutation.mutate({ type: 'topic', id: node.id });
                        }
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-white transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </>
                )}
                {node.type === 'lesson' && (
                  <button
                    title="Xóa Bài học"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Bạn có chắc muốn xóa bài học "${node.name}"?`)) {
                        deleteNodeMutation.mutate({ type: 'lesson', id: node.id });
                      }
                    }}
                    className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-white transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="space-y-0.5">
            {node.children!.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
        <div className="flex items-center gap-1.5">
          <FolderTree className="h-4 w-4 text-primary-600" />
          <p className="text-xs font-bold uppercase tracking-wider text-gray-700">Cây phân loại</p>
        </div>
        {(selectedFilter.subject_id || selectedFilter.chapter_id || selectedFilter.topic_id) && (
          <button
            onClick={handleReset}
            className="text-xs text-primary-600 hover:underline font-medium"
          >
            Xóa lọc
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="py-6 flex justify-center">
          <PageSpinner />
        </div>
      ) : tree.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-xs text-gray-400">Chưa có dữ liệu cây phân loại.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {tree.map((rootNode) => renderNode(rootNode, 0))}
        </div>
      )}

      {/* Add Node Modal */}
      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary-600" />
            <span>
              {nodeType === 'chapter' && `Thêm Chương mới (thuộc ${parentName || 'Môn học'})`}
              {nodeType === 'topic' && `Thêm Chủ đề mới (thuộc ${parentName})`}
              {nodeType === 'lesson' && `Thêm Bài học mới (thuộc ${parentName})`}
            </span>
          </div>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Hủy
            </Button>
            <Button
              loading={createNodeMutation.isPending}
              onClick={() => {
                if (!nodeName.trim()) {
                  toast.error('Vui lòng nhập tên');
                  return;
                }
                createNodeMutation.mutate();
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Tạo mới
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label={
              nodeType === 'chapter'
                ? 'Tên Chương *'
                : nodeType === 'topic'
                ? 'Tên Chủ đề *'
                : 'Tên Bài học *'
            }
            placeholder={
              nodeType === 'chapter'
                ? 'Ví dụ: Chương 1: Cơ sở dữ liệu quan hệ'
                : nodeType === 'topic'
                ? 'Ví dụ: Thiết kế mô hình ERD'
                : 'Ví dụ: Bài 1: Khóa chính và Khóa ngoại'
            }
            value={nodeName}
            onChange={(e) => setNodeName(e.target.value)}
            required
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
}
