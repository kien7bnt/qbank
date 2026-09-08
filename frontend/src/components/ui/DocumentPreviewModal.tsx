import React, { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  Paperclip,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface DocumentPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title?: string;
  fileType?: string;
}

export function DocumentPreviewModal({
  open,
  onOpenChange,
  url,
  title = 'Xem tệp đính kèm',
  fileType = '',
}: DocumentPreviewModalProps) {
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);

  // Normalize absolute URL if relative
  const absoluteUrl = url.startsWith('http')
    ? url
    : `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;

  // Deduce type from fileType or url extension
  const extension = url.split('.').pop()?.toLowerCase() || '';
  const isImage =
    fileType.includes('image') ||
    ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(extension);
  const isPdf = fileType.includes('pdf') || extension === 'pdf';
  const isDoc =
    fileType.includes('word') ||
    fileType.includes('officedocument') ||
    ['doc', 'docx', 'odt', 'rtf'].includes(extension);
  const isSheet =
    fileType.includes('sheet') ||
    fileType.includes('excel') ||
    ['xls', 'xlsx', 'csv'].includes(extension);
  const isPresentation =
    fileType.includes('presentation') ||
    ['ppt', 'pptx'].includes(extension);

  const isOfficeDoc = isDoc || isSheet || isPresentation;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 250));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(100);
    setRotation(0);
  };

  // Collabora / Office Online viewer embed URL
  const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
    absoluteUrl
  )}`;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-2.5 min-w-0">
          {isImage ? (
            <FileImage className="w-5 h-5 text-amber-600 shrink-0" />
          ) : isPdf ? (
            <FileText className="w-5 h-5 text-rose-600 shrink-0" />
          ) : isSheet ? (
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <FileText className="w-5 h-5 text-blue-600 shrink-0" />
          )}
          <span className="font-bold text-gray-900 truncate max-w-md">{title}</span>
        </div>
      }
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {isImage && (
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                <Button size="sm" variant="ghost" onClick={handleZoomOut} title="Thu nhỏ">
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs font-mono font-bold px-1.5">{zoom}%</span>
                <Button size="sm" variant="ghost" onClick={handleZoomIn} title="Phóng to">
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={handleRotate} title="Xoay ảnh">
                  <RotateCw className="w-4 h-4" />
                </Button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[11px] text-gray-500 hover:text-gray-900 px-1.5"
                >
                  Đặt lại
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <a
              href={absoluteUrl}
              download
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              Tải tệp về
            </a>

            <a
              href={absoluteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-colors shadow-2xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Mở tab mới
            </a>

            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
          </div>
        </div>
      }
    >
      <div className="w-full flex flex-col items-center justify-center min-h-[400px] max-h-[75vh] bg-slate-950/5 rounded-xl border border-gray-200 overflow-hidden relative">
        {isImage ? (
          <div className="w-full h-[65vh] flex items-center justify-center overflow-auto p-4 bg-slate-900/10">
            <img
              src={absoluteUrl}
              alt={title}
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transition: 'transform 0.2s ease',
              }}
              className="max-h-full max-w-full object-contain rounded-lg shadow-md select-none"
            />
          </div>
        ) : isPdf ? (
          <iframe
            src={`${absoluteUrl}#toolbar=1&navpanes=0`}
            title={title}
            className="w-full h-[70vh] border-0 rounded-lg"
          />
        ) : isOfficeDoc ? (
          <div className="w-full h-[70vh] flex flex-col">
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-800">
              <span className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-600" />
                Đang xem trước tài liệu văn bản Office / Collabora
              </span>
              <a
                href={absoluteUrl}
                download
                className="font-bold underline hover:text-amber-900"
              >
                Tải tệp gốc
              </a>
            </div>
            <iframe
              src={officeViewerUrl}
              title={title}
              className="w-full flex-1 border-0"
              onError={() => {
                // Fallback handled gracefully
              }}
            />
          </div>
        ) : (
          <div className="p-8 text-center space-y-3">
            <Paperclip className="w-10 h-10 text-gray-400 mx-auto" />
            <h4 className="text-sm font-bold text-gray-800">{title}</h4>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Định dạng tệp này không hỗ trợ xem trực tiếp trong trình duyệt. Vui lòng bấm "Tải tệp về" để mở trên máy tính của bạn.
            </p>
            <a
              href={absoluteUrl}
              download
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold"
            >
              <Download className="w-4 h-4" />
              Tải tệp về máy
            </a>
          </div>
        )}
      </div>
    </Modal>
  );
}
