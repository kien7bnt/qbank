import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Award,
  Paperclip,
  FileText,
  FileSpreadsheet,
  FileImage,
  Search,
  Eye,
} from 'lucide-react';
import { assignmentApi } from '@/services/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { DocumentPreviewModal } from '@/components/ui/DocumentPreviewModal';
import type { AssignmentSubmissionItem, SubmissionAttachment } from '@/types';

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type?: string, name?: string) {
  const ext = (type || name?.split('.').pop() || '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) {
    return <FileImage className="h-3.5 w-3.5 text-sky-500 shrink-0" />;
  }
  if (['xls', 'xlsx'].includes(ext)) {
    return <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 shrink-0" />;
  }
  if (['doc', 'docx'].includes(ext)) {
    return <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />;
  }
  if (ext === 'pdf') {
    return <FileText className="h-3.5 w-3.5 text-red-500 shrink-0" />;
  }
  return <Paperclip className="h-3.5 w-3.5 text-indigo-500 shrink-0" />;
}

interface AssignmentSubmissionsModalProps {
  assignmentId: string | null;
  assignmentName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignmentSubmissionsModal({
  assignmentId,
  assignmentName,
  open,
  onOpenChange,
}: AssignmentSubmissionsModalProps) {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'has_file' | 'submitted' | 'in_progress'>('all');
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string; type: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['assignment-submissions', assignmentId],
    queryFn: () => assignmentApi.submissions(assignmentId!),
    enabled: open && !!assignmentId,
  });

  const rawSubmissions: AssignmentSubmissionItem[] = data?.data ?? [];

  // Metrics
  const totalCount = rawSubmissions.length;
  const submittedCount = rawSubmissions.filter((s) => s.status === 'graded' || s.status === 'submitted').length;
  const inProgressCount = rawSubmissions.filter((s) => s.status === 'in_progress').length;
  const withFilesCount = rawSubmissions.filter((s) => s.has_attachment || (s.attachments && s.attachments.length > 0)).length;

  // Filtered list
  const filteredSubmissions = useMemo(() => {
    return rawSubmissions.filter((sub) => {
      // Status & Attachment filters
      if (filterMode === 'has_file') {
        if (!sub.has_attachment && (!sub.attachments || sub.attachments.length === 0)) return false;
      } else if (filterMode === 'submitted') {
        if (sub.status !== 'graded' && sub.status !== 'submitted') return false;
      } else if (filterMode === 'in_progress') {
        if (sub.status !== 'in_progress') return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = sub.student_name?.toLowerCase().includes(q);
        const matchEmail = sub.student_email?.toLowerCase().includes(q);
        const matchFile = sub.attachments?.some((a) => a.name.toLowerCase().includes(q));
        if (!matchName && !matchEmail && !matchFile) return false;
      }

      return true;
    });
  }, [rawSubmissions, filterMode, searchQuery]);

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary-600" />
            <span>Danh sách nộp bài — {assignmentName}</span>
          </div>
        }
        size="xl"
        footer={
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        }
      >
        {isLoading ? (
          <PageSpinner />
        ) : rawSubmissions.length === 0 ? (
          <EmptyState
            icon={<Clock className="h-8 w-8 text-gray-400" />}
            title="Chưa có học sinh nào nộp bài"
            description="Khi học sinh trong lớp hoàn thành bài thi, danh sách và điểm số sẽ xuất hiện ở đây."
          />
        ) : (
          <div className="space-y-4">
            {/* Filter & Metric summary */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    filterMode === 'all'
                      ? 'bg-gray-900 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Tất cả ({totalCount})
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMode('has_file')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    filterMode === 'has_file'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : withFilesCount > 0
                      ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  <Paperclip className="h-3 w-3" />
                  Có gửi file ({withFilesCount})
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMode('submitted')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    filterMode === 'submitted'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Đã nộp ({submittedCount})
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMode('in_progress')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    filterMode === 'in_progress'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Đang làm ({inProgressCount})
                </button>
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm học sinh, file..."
                  className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            {filteredSubmissions.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs">
                Không tìm thấy lượt làm bài nào khớp với bộ lọc hiện tại.
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Học sinh</th>
                      <th className="px-4 py-3">Trạng thái</th>
                      <th className="px-4 py-3">Tệp đính kèm</th>
                      <th className="px-4 py-3">Thời gian nộp</th>
                      <th className="px-4 py-3 text-center">Điểm số</th>
                      <th className="px-4 py-3 text-center">Kết quả</th>
                      <th className="px-4 py-3 text-right">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredSubmissions.map((sub) => {
                      const isGraded = sub.status === 'graded' || sub.status === 'submitted';
                      const attachments = sub.attachments || [];
                      const hasFiles = sub.has_attachment || attachments.length > 0;

                      return (
                        <tr key={sub.id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-gray-900">{sub.student_name}</span>
                              {hasFiles && (
                                <span
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 shrink-0"
                                  title={`Học sinh có gửi ${attachments.length || 1} tệp bài làm`}
                                >
                                  <Paperclip className="h-2.5 w-2.5" />
                                  {attachments.length || 1}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400">{sub.student_email}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {sub.status === 'in_progress' ? (
                              <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-xs border border-amber-200">
                                <Clock className="h-3 w-3 animate-spin" /> Đang làm bài
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-full text-xs border border-green-200">
                                <CheckCircle2 className="h-3 w-3" /> Đã nộp bài
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {hasFiles ? (
                              <div className="flex flex-col gap-1 items-start">
                                {attachments.map((att: SubmissionAttachment, idx: number) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPreviewDoc({
                                        url: att.url,
                                        name: att.name,
                                        type: att.type || att.name.split('.').pop() || '',
                                      });
                                    }}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-colors max-w-[200px] truncate shadow-2xs group text-left cursor-pointer"
                                    title={`Bấm để xem nhanh tệp: ${att.name}`}
                                  >
                                    {getFileIcon(att.type, att.name)}
                                    <span className="truncate max-w-[110px]">{att.name}</span>
                                    {att.size ? (
                                      <span className="text-[10px] text-blue-500 font-mono">
                                        ({formatFileSize(att.size)})
                                      </span>
                                    ) : null}
                                    <Eye className="h-3 w-3 ml-0.5 text-blue-400 group-hover:text-blue-600 shrink-0" />
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                            {sub.submitted_at
                              ? format(new Date(sub.submitted_at), 'dd/MM/yyyy HH:mm', { locale: vi })
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-center font-bold font-mono text-gray-900 whitespace-nowrap">
                            {isGraded && sub.score !== null && sub.score !== undefined ? `${sub.score}/${sub.max_score}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {isGraded ? (
                              sub.is_passed ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-xs font-semibold">
                                  <Award className="h-3.5 w-3.5" /> Đạt
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded-full text-xs font-semibold">
                                  <XCircle className="h-3.5 w-3.5" /> Chưa đạt
                                </span>
                              )
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {isGraded ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  onOpenChange(false);
                                  navigate(`/exam-result/${sub.id}`, {
                                    state: {
                                      fromSubmissions: true,
                                      fromUrl: window.location.pathname + window.location.search,
                                      assignmentId,
                                      assignmentName,
                                    },
                                  });
                                }}
                              >
                                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                Xem bài làm
                              </Button>
                            ) : (
                              <span className="text-xs text-gray-400 italic">Đang thi</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Direct Document Preview Modal from Submissions List */}
      {previewDoc && (
        <DocumentPreviewModal
          open={!!previewDoc}
          onOpenChange={(v) => !v && setPreviewDoc(null)}
          url={previewDoc.url}
          title={previewDoc.name}
          fileType={previewDoc.type}
        />
      )}
    </>
  );
}
