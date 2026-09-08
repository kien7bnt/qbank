import React, { useState, useEffect, useRef } from 'react';
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
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { renderAsync } from 'docx-preview';
import * as XLSX from 'xlsx';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { getBackendOrigin } from '@/services/api';

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

  // States for rendering docx & excel
  const [loadingDoc, setLoadingDoc] = useState<boolean>(false);
  const [docError, setDocError] = useState<string | null>(null);

  // Excel state
  const [excelSheets, setExcelSheets] = useState<{ name: string; rows: any[][] }[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);

  const docxContainerRef = useRef<HTMLDivElement | null>(null);

  // Normalize absolute URL: if relative (e.g. /uploads/..., /api/...), route to backend origin
  const backendOrigin = getBackendOrigin();
  const absoluteUrl = url.startsWith('http')
    ? url
    : `${backendOrigin}${url.startsWith('/') ? '' : '/'}${url}`;

  // Deduce extension & type
  const extension = url.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase() || '';
  const isImage =
    fileType.includes('image') ||
    ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(extension);
  const isPdf = fileType.includes('pdf') || extension === 'pdf';
  const isDocx = extension === 'docx';
  const isDocOld = extension === 'doc' || fileType.includes('msword');
  const isSheet =
    fileType.includes('sheet') ||
    fileType.includes('excel') ||
    ['xls', 'xlsx', 'csv'].includes(extension);
  const isPresentation =
    fileType.includes('presentation') ||
    ['ppt', 'pptx'].includes(extension);

  // Fetch and render docx locally
  useEffect(() => {
    if (!open) {
      setDocError(null);
      setLoadingDoc(false);
      setExcelSheets([]);
      return;
    }

    if (isDocx) {
      let isCancelled = false;
      setLoadingDoc(true);
      setDocError(null);

      fetch(absoluteUrl)
        .then(async (res) => {
          if (!res.ok) throw new Error(`Không thể tải tệp (Mã lỗi ${res.status})`);
          return res.blob();
        })
        .then(async (blob) => {
          if (isCancelled || !docxContainerRef.current) return;
          docxContainerRef.current.innerHTML = '';
          await renderAsync(blob, docxContainerRef.current, undefined, {
            className: 'docx-preview-content',
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
          });
          setLoadingDoc(false);
        })
        .catch((err) => {
          if (isCancelled) return;
          console.error('Docx render error:', err);
          setDocError(err.message || 'Không thể hiển thị tệp Word trực tiếp.');
          setLoadingDoc(false);
        });

      return () => {
        isCancelled = true;
      };
    }

    if (isSheet) {
      let isCancelled = false;
      setLoadingDoc(true);
      setDocError(null);

      fetch(absoluteUrl)
        .then(async (res) => {
          if (!res.ok) throw new Error(`Không thể tải bảng tính (Mã lỗi ${res.status})`);
          return res.arrayBuffer();
        })
        .then((buffer) => {
          if (isCancelled) return;
          const workbook = XLSX.read(buffer, { type: 'array' });
          const sheets = workbook.SheetNames.map((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
            return {
              name: sheetName,
              rows: jsonData,
            };
          });
          setExcelSheets(sheets);
          setActiveSheetIndex(0);
          setLoadingDoc(false);
        })
        .catch((err) => {
          if (isCancelled) return;
          console.error('Excel render error:', err);
          setDocError(err.message || 'Không thể hiển thị bảng tính trực tiếp.');
          setLoadingDoc(false);
        });

      return () => {
        isCancelled = true;
      };
    }
  }, [open, absoluteUrl, isDocx, isSheet]);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 250));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(100);
    setRotation(0);
  };

  // Fallback Office viewer url for public domains
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
      <div className="w-full flex flex-col items-center justify-center min-h-[420px] max-h-[75vh] bg-slate-950/5 rounded-xl border border-gray-200 overflow-hidden relative">
        {/* Case 1: Image */}
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
          /* Case 2: PDF */
          <object
            data={`${absoluteUrl}#toolbar=1&navpanes=0`}
            type="application/pdf"
            className="w-full h-[70vh] border-0 rounded-lg bg-white"
          >
            <iframe
              src={`${absoluteUrl}#toolbar=1&navpanes=0`}
              title={title}
              className="w-full h-full border-0 rounded-lg bg-white"
            >
              <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-3 bg-white">
                <FileText className="w-12 h-12 text-rose-500" />
                <p className="text-sm font-semibold text-gray-800">Trình duyệt không hỗ trợ xem trực tiếp tệp PDF này</p>
                <a
                  href={absoluteUrl}
                  download
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold"
                >
                  <Download className="w-4 h-4" />
                  Tải tệp PDF về máy
                </a>
              </div>
            </iframe>
          </object>
        ) : isDocx ? (
          /* Case 3: DOCX rendered directly via docx-preview */
          <div className="w-full h-[70vh] flex flex-col bg-white overflow-hidden">
            <div className="bg-blue-50/80 border-b border-blue-100 px-4 py-2 flex items-center justify-between text-xs text-blue-800">
              <span className="flex items-center gap-1.5 font-medium">
                <FileText className="w-4 h-4 text-blue-600" />
                Xem trước tài liệu Word (.docx) trực tiếp trên trình duyệt
              </span>
              <a
                href={absoluteUrl}
                download
                className="font-bold underline hover:text-blue-950 text-blue-700"
              >
                Tải tệp gốc
              </a>
            </div>

            {loadingDoc && (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 p-8 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="text-xs font-medium">Đang tải và hiển thị tài liệu...</span>
              </div>
            )}

            {docError ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
                <h4 className="text-sm font-bold text-gray-800">Không thể xem trực tiếp tệp này</h4>
                <p className="text-xs text-gray-500 max-w-md">{docError}</p>
                <div className="flex gap-2">
                  <a
                    href={absoluteUrl}
                    download
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold"
                  >
                    <Download className="w-4 h-4" />
                    Tải tệp về máy để mở
                  </a>
                </div>
              </div>
            ) : null}

            <div
              ref={docxContainerRef}
              className={`w-full flex-1 overflow-y-auto p-4 sm:p-8 bg-gray-100/70 text-gray-900 ${
                loadingDoc || docError ? 'hidden' : 'block'
              }`}
            />
          </div>
        ) : isSheet ? (
          /* Case 4: Excel/Spreadsheet rendered directly via xlsx */
          <div className="w-full h-[70vh] flex flex-col bg-white overflow-hidden">
            <div className="bg-emerald-50/80 border-b border-emerald-100 px-4 py-2 flex items-center justify-between text-xs text-emerald-800">
              <span className="flex items-center gap-1.5 font-medium">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Xem trước bảng tính Excel ({excelSheets[activeSheetIndex]?.name || 'Sheet'})
              </span>
              <a
                href={absoluteUrl}
                download
                className="font-bold underline hover:text-emerald-950 text-emerald-700"
              >
                Tải tệp gốc
              </a>
            </div>

            {loadingDoc && (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 p-8 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                <span className="text-xs font-medium">Đang đọc dữ liệu bảng tính...</span>
              </div>
            )}

            {docError ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
                <h4 className="text-sm font-bold text-gray-800">Không thể đọc bảng tính trực tiếp</h4>
                <p className="text-xs text-gray-500 max-w-md">{docError}</p>
                <a
                  href={absoluteUrl}
                  download
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  <Download className="w-4 h-4" />
                  Tải tệp về máy
                </a>
              </div>
            ) : null}

            {!loadingDoc && !docError && excelSheets.length > 0 && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Table Sheet View */}
                <div className="flex-1 overflow-auto p-2 bg-white">
                  <table className="min-w-full border-collapse border border-gray-300 text-xs">
                    <tbody>
                      {(excelSheets[activeSheetIndex]?.rows || []).map((row, rIdx) => (
                        <tr key={rIdx} className={rIdx === 0 ? 'bg-gray-100 font-bold' : 'hover:bg-gray-50'}>
                          <td className="border border-gray-300 bg-gray-50 px-2 py-1 text-center font-mono text-[10px] text-gray-400 w-8 select-none">
                            {rIdx + 1}
                          </td>
                          {Array.isArray(row) &&
                            row.map((cell, cIdx) => (
                              <td key={cIdx} className="border border-gray-200 px-3 py-1.5 text-gray-800 whitespace-nowrap">
                                {cell !== null && cell !== undefined ? String(cell) : ''}
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Sheets navigation tabs */}
                {excelSheets.length > 1 && (
                  <div className="flex items-center gap-1 bg-gray-100 border-t border-gray-200 px-3 py-1.5 overflow-x-auto">
                    {excelSheets.map((sheet, idx) => (
                      <button
                        key={sheet.name}
                        onClick={() => setActiveSheetIndex(idx)}
                        className={`px-3 py-1 text-xs font-medium rounded-t-md transition-colors ${
                          activeSheetIndex === idx
                            ? 'bg-white text-emerald-700 font-bold border-t-2 border-emerald-600 shadow-2xs'
                            : 'text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {sheet.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : isPresentation || isDocOld ? (
          /* Case 5: Legacy doc / PPT -> Fallback to Office Apps or Download */
          <div className="w-full h-[70vh] flex flex-col bg-white">
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-800">
              <span className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-600" />
                Đang xem trước tài liệu văn bản qua Office Online Viewer
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
            />
          </div>
        ) : (
          /* Case 6: Unsupported format */
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
