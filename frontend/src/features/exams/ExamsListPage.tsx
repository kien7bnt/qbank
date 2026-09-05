import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Clock, Trash2, Eye, Calendar, Layers, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { examApi, getErrorMessage } from '@/services/api';
import { ExamPreviewModal } from './ExamPreviewModal';
import { CreateExamFromBankModal } from './CreateExamFromBankModal';
import type { Exam } from '@/types';

export function ExamsListPage() {
  const qc = useQueryClient();
  const [previewExamId, setPreviewExamId] = useState<string | null>(null);
  const [createFromBankOpen, setCreateFromBankOpen] = useState(false);

  const { data: exams, isLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examApi.list(),
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
    </div>
  );
}
