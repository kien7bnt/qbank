import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, X, Tag, FileText, FileType2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { documentApi, getErrorMessage } from '@/services/api';

interface UploadDocumentModalProps {
  open: boolean;
  onClose: () => void;
  defaultTopicTag?: string;
  onSuccess?: () => void;
}

const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown'];
const ALLOWED_EXTS = ['.pdf', '.docx', '.txt', '.md'];

export function UploadDocumentModal({ open, onClose, defaultTopicTag = '', onSuccess }: UploadDocumentModalProps) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [topicTag, setTopicTag] = useState(defaultTopicTag);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('Chưa chọn file');
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', title.trim() || selectedFile.name);
      if (description.trim()) formData.append('description', description.trim());
      if (topicTag.trim()) formData.append('topic_tag', topicTag.trim());
      return documentApi.upload(formData);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['document-topics'] });
      toast.success('Đã tải tài liệu lên kho thành công!');
      handleClose();
      onSuccess?.();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleFile = (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      toast.error(`Chỉ chấp nhận: ${ALLOWED_EXTS.join(', ')}`);
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File quá lớn (tối đa 20MB)');
      return;
    }
    setSelectedFile(file);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setTopicTag(defaultTopicTag);
    setSelectedFile(null);
    onClose();
  };

  const fileSizeKB = selectedFile ? (selectedFile.size / 1024).toFixed(1) : null;

  return (
    <Modal
      open={open}
      onOpenChange={handleClose}
      title={
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
            <Upload className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-gray-900">Tải tài liệu lên kho</div>
            <p className="text-xs text-gray-500 font-normal">PDF, DOCX, TXT, MD · Tối đa 20MB</p>
          </div>
        </div>
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>Hủy</Button>
          <Button
            loading={uploadMutation.isPending}
            onClick={() => uploadMutation.mutate()}
            disabled={!selectedFile}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Upload className="h-4 w-4 mr-1.5" />
            Tải lên
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-blue-500 bg-blue-50'
              : selectedFile
              ? 'border-green-400 bg-green-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {selectedFile ? (
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-green-100 rounded-full">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-green-800 text-sm">{selectedFile.name}</p>
                <p className="text-xs text-green-600">{fileSizeKB} KB</p>
              </div>
              <button
                className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1 mt-1"
                onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setTitle(''); }}
              >
                <X className="h-3 w-3" /> Chọn file khác
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-gray-100 rounded-full">
                <Upload className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700">Kéo thả file vào đây</p>
              <p className="text-xs text-gray-400">hoặc nhấn để chọn file từ máy tính</p>
              <p className="text-xs text-gray-400 mt-1">Hỗ trợ: PDF, DOCX, TXT, MD</p>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={ALLOWED_EXTS.join(',')}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />

        {/* Title */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1">
            Tên tài liệu <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Chương 3 - Đạo hàm và Ứng dụng"
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Topic Tag */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1 flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-gray-500" /> Chủ đề / Nhãn phân loại
          </label>
          <input
            type="text"
            value={topicTag}
            onChange={(e) => setTopicTag(e.target.value)}
            placeholder="Ví dụ: Toán 12, Lập trình Python, Vật lý..."
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-gray-800 mb-1">Mô tả (tùy chọn)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả ngắn về nội dung tài liệu..."
            rows={2}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Info note */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
          <strong>Lưu ý:</strong> Hệ thống sẽ tự động đọc và trích xuất nội dung từ tài liệu để AI có thể sinh câu hỏi từ đây.
          Quá trình này có thể mất vài giây tùy kích thước file.
        </div>
      </div>
    </Modal>
  );
}
