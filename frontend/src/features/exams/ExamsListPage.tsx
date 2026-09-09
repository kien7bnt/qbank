import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Clock, Trash2, Eye, Calendar, Layers, Plus, FolderPlus, FolderTree } from 'lucide-react';
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
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [folderForm, setFolderForm] = useState({ name: '', description: '' });

  const { data: exams, isLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examApi.list(),
  });

  const createFolderMutation = useMutation({
    mutationFn: () =>
      domainApi.createDomain({
        name: folderForm.name.trim(),
        description: folderForm.description.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domains'] });
      toast.success(`Đã thêm thư mục môn học/lĩnh vực "${folderForm.name.trim()}" thành công!`);
      setCreateFolderOpen(false);
      setFolderForm({ name: '', description: '' });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => examApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exams'] });
      toast.success('Đã xóa đề thi');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const examList: Exam[] = exams?.data || [];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600" />
            Danh Sách Đề Thi
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Quản lý các đề thi đã được tạo từ Ma trận hoặc biên soạn thủ công.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => {
              setFolderForm({ name: '', description: '' });
              setCreateFolderOpen(true);
            }}
            size="sm"
            className="sm:h-10 sm:px-3 text-xs sm:text-sm border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <FolderPlus className="h-4 w-4 mr-1.5 text-blue-600" />
            Thêm thư mục (môn/lĩnh vực)
          </Button>
          <Button
            variant="outline"
            onClick={() => setCreateFromBankOpen(true)}
            size="sm"
            className="sm:h-10 sm:px-4 text-xs sm:text-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Tạo đề từ Ngân hàng
          </Button>
          <Link to="/exam-matrices">
            <Button size="sm" className="sm:h-10 sm:px-4 text-xs sm:text-sm">
              <Layers className="h-4 w-4 mr-1.5" />
              Tạo đề từ Ma trận
            </Button>
          </Link>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <PageSpinner />
      ) : examList.length === 0 ? (
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
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-6">Tên đề thi</th>
                  <th className="py-3.5 px-6">Thời lượng</th>
                  <th className="py-3.5 px-6">Số phần thi</th>
                  <th className="py-3.5 px-6">Trạng thái</th>
                  <th className="py-3.5 px-6">Ngày tạo</th>
                  <th className="py-3.5 px-6 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {examList.map((exam) => (
                  <tr key={exam.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-4 px-6 font-medium text-gray-900">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary-50 text-primary-600">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{exam.name}</p>
                          <span className="text-xs text-gray-400 font-mono">ID: {exam.id.slice(0, 8)}...</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>{exam.duration_minutes} phút</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-600">
                      {exam.sections?.length || 0} phần
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200 capitalize">
                        {exam.status === 'draft' ? 'Bản nháp' : exam.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-gray-500 text-xs">
                      {exam.created_at
                        ? format(new Date(exam.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })
                        : '—'}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setPreviewExamId(exam.id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Xem đề
                        </Button>
                        <button
                          onClick={() => {
                            if (confirm('Bạn có chắc muốn xóa đề thi này?')) {
                              deleteMutation.mutate(exam.id);
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      {/* Modal Thêm thư mục (Môn học / Lĩnh vực) */}
      <Modal
        open={createFolderOpen}
        onOpenChange={(v) => {
          if (!v) {
            setCreateFolderOpen(false);
            setFolderForm({ name: '', description: '' });
          }
        }}
        title={
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <FolderPlus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Thêm thư mục môn học / lĩnh vực mới</h3>
              <p className="text-xs text-gray-500 font-normal">Tạo thư mục môn học/lĩnh vực dùng chung cho ngân hàng câu hỏi, bài tập và đề thi</p>
            </div>
          </div>
        }
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="secondary"
              onClick={() => {
                setCreateFolderOpen(false);
                setFolderForm({ name: '', description: '' });
              }}
            >
              Hủy
            </Button>
            <Button
              loading={createFolderMutation.isPending}
              onClick={() => {
                if (!folderForm.name.trim()) {
                  toast.error('Vui lòng nhập tên thư mục môn học/lĩnh vực');
                  return;
                }
                createFolderMutation.mutate();
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Lưu thư mục
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Tên thư mục môn học / lĩnh vực <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={folderForm.name}
              onChange={(e) => setFolderForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ví dụ: Toán học, Vật lý 10, Lập trình Web..."
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Mô tả ngắn (tùy chọn)
            </label>
            <textarea
              rows={2}
              value={folderForm.description}
              onChange={(e) => setFolderForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Mô tả phạm vi hoặc phân môn..."
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
