import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Trash2,
  Eye,
  Calendar,
  Layers,
  Plus,
  Search,
  Clock,
  MoreVertical,
  ArrowUpDown,
  BookOpen,
  Tag,
  FolderMinus,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { examApi, domainApi, getErrorMessage } from '@/services/api';
import { ExamPreviewModal } from './ExamPreviewModal';
import { CreateExamFromBankModal } from './CreateExamFromBankModal';
import type { Exam } from '@/types';

export function ExamsListPage() {
  const qc = useQueryClient();
  const [previewExamId, setPreviewExamId] = useState<string | null>(null);
  const [createFromBankOpen, setCreateFromBankOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Domain Management Modals
  const [createDomainModalOpen, setCreateDomainModalOpen] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [newDomainDesc, setNewDomainDesc] = useState('');
  const [assignDomainItem, setAssignDomainItem] = useState<Exam | null>(null);
  const [targetDomainId, setTargetDomainId] = useState<string>('');

  // 1. Fetch Exams
  const { data: exams, isLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examApi.list(),
  });

  // 2. Fetch Domains
  const { data: domainsData } = useQuery({
    queryKey: ['domains'],
    queryFn: () => domainApi.list(),
  });

  const examList: Exam[] = exams?.data || [];
  const domains: any[] = domainsData?.data ?? [];

  // Map domain id -> domain name
  const domainMap = useMemo(() => {
    const map = new Map<string, string>();
    domains.forEach((d) => map.set(d.id, d.name));
    return map;
  }, [domains]);

  // Compute counts per domain dynamically from exams
  const domainExamCounts = useMemo(() => {
    const counts = new Map<string, number>();
    examList.forEach((ex) => {
      if (ex.domain_id) {
        counts.set(ex.domain_id, (counts.get(ex.domain_id) || 0) + 1);
      }
    });
    return counts;
  }, [examList]);

  // Filter & sort
  const filteredExams = useMemo(() => {
    let list = [...examList];

    // Filter by domain
    if (selectedDomainId !== 'all') {
      list = list.filter((ex) => ex.domain_id === selectedDomainId);
    }

    // Filter by search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter((ex) => (ex.name || '').toLowerCase().includes(term));
    }

    // Sort
    if (sortOrder === 'newest') list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (sortOrder === 'oldest') list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    else if (sortOrder === 'name') list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
    return list;
  }, [examList, selectedDomainId, searchTerm, sortOrder]);

  // Delete Exam Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => examApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exams'] });
      qc.invalidateQueries({ queryKey: ['domains'] });
      toast.success('Đã xóa đề thi');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Create Domain Mutation
  const createDomainMutation = useMutation({
    mutationFn: () => domainApi.createDomain({ name: newDomainName.trim(), description: newDomainDesc.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domains'] });
      toast.success(`Đã thêm lĩnh vực "${newDomainName.trim()}"`);
      setCreateDomainModalOpen(false);
      setNewDomainName('');
      setNewDomainDesc('');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Delete Domain Mutation
  const deleteDomainMutation = useMutation({
    mutationFn: (domainId: string) => domainApi.deleteDomain(domainId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domains'] });
      qc.invalidateQueries({ queryKey: ['exams'] });
      toast.success('Đã xóa lĩnh vực thành công');
      if (selectedDomainId !== 'all') {
        setSelectedDomainId('all');
      }
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Update Exam Domain Mutation (Assign / Remove from Domain)
  const updateDomainMutation = useMutation({
    mutationFn: ({ examId, domainId }: { examId: string; domainId: string | null }) =>
      examApi.updateDomain(examId, domainId),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['exams'] });
      qc.invalidateQueries({ queryKey: ['domains'] });
      if (variables.domainId) {
        toast.success(`Đã gắn đề thi vào lĩnh vực "${domainMap.get(variables.domainId) || ''}"`);
      } else {
        toast.success('Đã xóa đề thi khỏi lĩnh vực');
      }
      setAssignDomainItem(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleDeleteDomain = (domain: any) => {
    const exCount = domainExamCounts.get(domain.id) || domain.exam_count || 0;
    const msg = exCount > 0
      ? `Bạn có chắc muốn xóa lĩnh vực "${domain.name}"? ${exCount} đề thi trong lĩnh vực này sẽ được chuyển về "Chưa phân loại".`
      : `Bạn có chắc muốn xóa lĩnh vực "${domain.name}"?`;
    if (confirm(msg)) {
      deleteDomainMutation.mutate(domain.id);
    }
  };

  const handleRemoveFromDomain = (exam: Exam) => {
    if (confirm(`Bạn có chắc muốn xóa đề thi "${exam.name}" khỏi lĩnh vực này?`)) {
      updateDomainMutation.mutate({ examId: exam.id, domainId: null });
    }
  };

  const sortLabel = { newest: 'Mới nhất', oldest: 'Cũ nhất', name: 'Theo tên' }[sortOrder];

  const statusLabel = (status: string) => {
    if (status === 'draft') return { label: 'Bản nháp', cls: 'bg-yellow-50 text-yellow-700 border-yellow-100' };
    if (status === 'published') return { label: 'Đã xuất bản', cls: 'bg-green-50 text-green-700 border-green-100' };
    return { label: status, cls: 'bg-gray-50 text-gray-600 border-gray-200' };
  };

  return (
    <div className="flex h-full min-h-screen bg-gray-50">
      {/* ── Left sidebar: Lĩnh vực ─────────────────────────────── */}
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col py-4 gap-1 overflow-y-auto">
        <div className="px-4 flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Lĩnh vực</p>
          <button
            onClick={() => setCreateDomainModalOpen(true)}
            className="p-1 hover:bg-gray-100 text-gray-500 hover:text-blue-600 rounded-lg transition-colors"
            title="Thêm lĩnh vực mới"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Tất cả */}
        <button
          onClick={() => setSelectedDomainId('all')}
          className={`flex items-center justify-between mx-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedDomainId === 'all'
              ? 'bg-blue-50 text-blue-700 font-semibold'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <span>Tất cả</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${selectedDomainId === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
            {examList.length}
          </span>
        </button>

        {/* Domains */}
        {domains.map((domain) => {
          const count = domainExamCounts.get(domain.id) || domain.exam_count || 0;
          const isSelected = selectedDomainId === domain.id;

          return (
            <div
              key={domain.id}
              className={`group flex items-center justify-between mx-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => setSelectedDomainId(domain.id)}
            >
              <span className="truncate text-left flex-1 mr-2">{domain.name}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isSelected ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                  {count}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDomain(domain);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                  title="Xóa lĩnh vực"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        <div className="border-t border-gray-100 mx-2 mt-2 pt-2">
          <button
            onClick={() => setCreateDomainModalOpen(true)}
            className="flex items-center gap-1.5 w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors font-medium"
          >
            <Plus className="h-3.5 w-3.5 text-blue-600" />
            Thêm lĩnh vực
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg">
              <FileText className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900">Kho Bài Kiểm Tra</h1>
                {selectedDomainId !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                    Lĩnh vực: {domainMap.get(selectedDomainId) || 'Đang chọn'}
                    <button
                      onClick={() => setSelectedDomainId('all')}
                      className="ml-1 hover:text-red-600 text-blue-600 font-bold"
                      title="Bỏ lọc lĩnh vực"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">Quản lý các đề thi đã được tạo từ Ma trận hoặc biên soạn thủ công.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setCreateFromBankOpen(true)}
              size="sm"
              className="sm:h-9 sm:px-4 text-xs sm:text-sm border-gray-300"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Tạo từ Ngân hàng
            </Button>
            <Link to="/exam-matrices">
              <Button size="sm" className="sm:h-9 sm:px-4 text-xs sm:text-sm bg-blue-600 hover:bg-blue-700 text-white">
                <Layers className="h-4 w-4 mr-1.5" />
                Tạo từ Ma trận
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm đề thi theo tên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
            />
          </div>

          {/* Sort */}
          <div className="ml-auto">
            <button
              onClick={() => {
                const opts: Array<'newest' | 'oldest' | 'name'> = ['newest', 'oldest', 'name'];
                const next = opts[(opts.indexOf(sortOrder) + 1) % opts.length];
                setSortOrder(next);
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
              Sắp xếp: {sortLabel}
            </button>
          </div>

          <div className="text-xs text-gray-400 whitespace-nowrap">
            Hiển thị <strong className="text-gray-700">{filteredExams.length}</strong> / {examList.length} đề thi
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <PageSpinner />
          ) : examList.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <EmptyState
                icon={<FileText className="h-6 w-6" />}
                title="Chưa có đề thi nào"
                description="Hãy tạo ma trận đề thi và dùng AI để sinh đề thi đầu tiên."
                action={
                  <Link to="/exam-matrices">
                    <Button>
                      <Layers className="h-4 w-4 mr-1.5" />
                      Đi đến Ma trận đề
                    </Button>
                  </Link>
                }
              />
            </div>
          ) : filteredExams.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
              Không tìm thấy đề thi nào{selectedDomainId !== 'all' ? ` thuộc lĩnh vực "${domainMap.get(selectedDomainId)}"` : ''} {searchTerm ? `khớp với từ khóa "${searchTerm}"` : ''}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
              {filteredExams.map((exam, idx) => {
                const { label: stLabel, cls: stCls } = statusLabel(exam.status);
                const sectionCount = exam.sections?.length ?? 0;
                const date = exam.created_at
                  ? format(new Date(exam.created_at), 'dd/MM/yyyy', { locale: vi })
                  : '—';
                const isLast = idx === filteredExams.length - 1;
                const domainName = exam.domain_name || (exam.domain_id ? domainMap.get(exam.domain_id) : undefined);

                return (
                  <div
                    key={exam.id}
                    className={`flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors ${!isLast ? 'border-b border-gray-100' : ''}`}
                  >
                    {/* Icon */}
                    <div className="h-9 w-9 shrink-0 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <FileText className="h-4 w-4 text-indigo-500" />
                    </div>

                    {/* Title + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{exam.name}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {date}
                        </span>
                        {exam.duration_minutes > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {exam.duration_minutes} phút
                          </span>
                        )}
                        {sectionCount > 0 && (
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            {sectionCount} phần
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Tags: Domain Badge + Status + Type */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {domainName && (
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                          <Tag className="h-3 w-3 text-blue-500" />
                          {domainName}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${stCls}`}>
                        {stLabel}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                        Kiểm tra
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewExamId(exam.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Xem
                      </button>

                      {/* Three-dot menu */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenMenuId(openMenuId === exam.id ? null : exam.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {openMenuId === exam.id && (
                          <div className="absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-48">
                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                setAssignDomainItem(exam);
                                setTargetDomainId(exam.domain_id || '');
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <Tag className="h-3.5 w-3.5 text-blue-600" />
                              {exam.domain_id ? 'Đổi lĩnh vực...' : 'Gắn vào lĩnh vực...'}
                            </button>

                            {exam.domain_id && (
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  handleRemoveFromDomain(exam);
                                }}
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 transition-colors"
                              >
                                <FolderMinus className="h-3.5 w-3.5 text-amber-600" />
                                Xóa khỏi lĩnh vực
                              </button>
                            )}

                            <div className="border-t border-gray-100 my-1" />

                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                if (confirm('Bạn có chắc muốn xóa đề thi này?')) {
                                  deleteMutation.mutate(exam.id);
                                }
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Xóa đề thi
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Thêm lĩnh vực mới ─────────────────────────────── */}
      <Modal
        open={createDomainModalOpen}
        onOpenChange={(v) => {
          if (!v) {
            setCreateDomainModalOpen(false);
            setNewDomainName('');
            setNewDomainDesc('');
          }
        }}
        title="Thêm lĩnh vực mới"
        description="Tạo lĩnh vực để phân loại và quản lý các bài kiểm tra"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setCreateDomainModalOpen(false)}>
              Hủy
            </Button>
            <Button
              loading={createDomainMutation.isPending}
              disabled={!newDomainName.trim()}
              onClick={() => createDomainMutation.mutate()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Tạo lĩnh vực
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Tên lĩnh vực <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={newDomainName}
              onChange={(e) => setNewDomainName(e.target.value)}
              placeholder="Ví dụ: Khoa học tự nhiên, Toán học, Lập trình..."
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Mô tả ngắn (tùy chọn)
            </label>
            <textarea
              rows={2}
              value={newDomainDesc}
              onChange={(e) => setNewDomainDesc(e.target.value)}
              placeholder="Mô tả phạm vi môn học hoặc lĩnh vực..."
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* ── Modal Gắn / Đổi lĩnh vực cho bài kiểm tra ──────────────── */}
      <Modal
        open={!!assignDomainItem}
        onOpenChange={(v) => !v && setAssignDomainItem(null)}
        title="Gắn lĩnh vực cho đề thi"
        description={`Chọn lĩnh vực cho: ${assignDomainItem?.name || ''}`}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setAssignDomainItem(null)}>
              Hủy
            </Button>
            <Button
              loading={updateDomainMutation.isPending}
              onClick={() => {
                if (!assignDomainItem) return;
                updateDomainMutation.mutate({
                  examId: assignDomainItem.id,
                  domainId: targetDomainId || null,
                });
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Lưu thay đổi
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Chọn lĩnh vực
            </label>
            <select
              value={targetDomainId}
              onChange={(e) => setTargetDomainId(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Chưa phân loại (Không gắn lĩnh vực) —</option>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* Modals */}
      <ExamPreviewModal
        examId={previewExamId}
        open={!!previewExamId}
        onOpenChange={(v) => !v && setPreviewExamId(null)}
      />

      <CreateExamFromBankModal
        open={createFromBankOpen}
        onClose={() => setCreateFromBankOpen(false)}
      />

      {/* Close dropdown on outside click */}
      {openMenuId && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
      )}
    </div>
  );
}
