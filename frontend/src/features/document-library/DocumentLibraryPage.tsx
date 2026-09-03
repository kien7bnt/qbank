import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookMarked, Upload, Trash2, FileText, Tag, Search,
  Plus, Filter, FolderOpen, Loader2, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { documentApi, getErrorMessage } from '@/services/api';
import { UploadDocumentModal } from './UploadDocumentModal';

function formatFileSize(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeIcon(fileType?: string) {
  const icons: Record<string, string> = { pdf: '📄', docx: '📝', txt: '📃', md: '📑' };
  return icons[fileType ?? ''] ?? '📄';
}

const TAG_COLORS = [
  'bg-blue-100 text-blue-800 border-blue-200',
  'bg-purple-100 text-purple-800 border-purple-200',
  'bg-green-100 text-green-800 border-green-200',
  'bg-amber-100 text-amber-800 border-amber-200',
  'bg-rose-100 text-rose-800 border-rose-200',
  'bg-teal-100 text-teal-800 border-teal-200',
];

function tagColorClass(tag: string): string {
  let hash = 0;
  for (const c of tag) hash = (hash * 31 + c.charCodeAt(0)) % TAG_COLORS.length;
  return TAG_COLORS[hash];
}

export function DocumentLibraryPage() {
  const qc = useQueryClient();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Fetch topics
  const { data: topicsData } = useQuery({
    queryKey: ['document-topics'],
    queryFn: () => documentApi.topics(),
    select: (res) => res.data,
  });
  const topics: Array<{ topic_tag: string; document_count: number }> = topicsData ?? [];

  // Fetch documents
  const {
    data: docsData,
    isLoading: docsLoading,
    refetch,
  } = useQuery({
    queryKey: ['documents', activeTag, search],
    queryFn: () => documentApi.list({ topic_tag: activeTag ?? undefined, search: search || undefined }),
    select: (res) => res.data,
  });
  const docs: any[] = docsData ?? [];

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['document-topics'] });
      toast.success('Đã xóa tài liệu');
      setConfirmDeleteId(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
            <BookMarked className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Kho Tài Liệu Cá Nhân</h1>
            <p className="text-xs text-gray-500">
              {docs.length} tài liệu · Quản lý và phân loại theo chủ đề
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setUploadOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
          >
            <Upload className="h-4 w-4" />
            Tải tài liệu lên
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: Topics */}
        <aside className="w-52 shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col p-3 gap-1 overflow-y-auto">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 pb-1">Chủ đề</p>
          <button
            onClick={() => setActiveTag(null)}
            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              !activeTag ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Tất cả
            </span>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
              !activeTag ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {docs.length}
            </span>
          </button>

          {topics.map((t) => (
            <button
              key={t.topic_tag}
              onClick={() => setActiveTag(t.topic_tag === activeTag ? null : t.topic_tag)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                activeTag === t.topic_tag ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Tag className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{t.topic_tag}</span>
              </span>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                activeTag === t.topic_tag ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {t.document_count}
              </span>
            </button>
          ))}

          {topics.length === 0 && (
            <p className="text-xs text-gray-400 text-center pt-4 px-2">Chưa có chủ đề. Upload tài liệu để tạo chủ đề đầu tiên.</p>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* Search bar */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm tài liệu..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => refetch()}
              className="p-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 text-gray-500"
              title="Làm mới"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {/* Active tag badge */}
          {activeTag && (
            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm text-gray-600">Đang xem chủ đề:</span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${tagColorClass(activeTag)}`}>
                {activeTag}
              </span>
              <button
                onClick={() => setActiveTag(null)}
                className="text-xs text-gray-400 hover:text-gray-700 underline"
              >
                Xóa bộ lọc
              </button>
            </div>
          )}

          {/* Documents Grid */}
          {docsLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin mr-2" /> Đang tải tài liệu...
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <BookMarked className="h-12 w-12 mb-3 text-gray-200" />
              <p className="text-base font-semibold text-gray-500">
                {search || activeTag ? 'Không tìm thấy tài liệu phù hợp' : 'Kho tài liệu trống'}
              </p>
              {!search && !activeTag && (
                <p className="text-sm mt-1">Hãy tải tài liệu đầu tiên để AI có thể sinh câu hỏi!</p>
              )}
              {!search && !activeTag && (
                <Button
                  size="sm"
                  onClick={() => setUploadOpen(true)}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                >
                  <Upload className="h-4 w-4" /> Tải tài liệu đầu tiên
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {docs.map((doc: any) => (
                <div
                  key={doc.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow"
                >
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0 mt-0.5">{getFileTypeIcon(doc.file_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm line-clamp-2 leading-snug">{doc.title}</p>
                      {doc.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{doc.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {doc.topic_tag && (
                      <span className={`px-2 py-0.5 rounded-full border font-medium ${tagColorClass(doc.topic_tag)}`}>
                        <Tag className="h-2.5 w-2.5 inline mr-0.5" />{doc.topic_tag}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full border bg-gray-50 text-gray-600 border-gray-200 font-mono">
                      {doc.file_type?.toUpperCase()}
                    </span>
                    <span className="px-2 py-0.5 rounded-full border bg-gray-50 text-gray-500 border-gray-200">
                      {formatFileSize(doc.file_size)}
                    </span>
                    <span className="px-2 py-0.5 rounded-full border bg-gray-50 text-gray-500 border-gray-200">
                      {doc.chunk_count} đoạn
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
                    <span className="text-[10px] text-gray-400">
                      Tải lên {new Date(doc.created_at).toLocaleDateString('vi-VN')}
                    </span>
                    {confirmDeleteId === doc.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => deleteMutation.mutate(doc.id)}
                          className="text-[11px] font-bold px-2 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700"
                          disabled={deleteMutation.isPending}
                        >
                          Xác nhận xóa
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-[11px] px-2 py-1 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(doc.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Xóa tài liệu"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <UploadDocumentModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        defaultTopicTag={activeTag ?? ''}
      />
    </div>
  );
}
