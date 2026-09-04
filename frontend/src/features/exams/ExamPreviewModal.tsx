import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  CheckCircle2,
  Clock,
  Award,
  HelpCircle,
  Printer,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { examApi } from '@/services/api';
import type { Exam, ExamSectionDetail } from '@/types';

interface ExamPreviewModalProps {
  examId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExamPreviewModal({ examId, open, onOpenChange }: ExamPreviewModalProps) {
  const [showAnswerKey, setShowAnswerKey] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ['exam', examId],
    queryFn: () => examApi.get(examId!),
    enabled: !!examId && open,
  });

  const exam: Exam | undefined = data?.data;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary-600" />
          <span>{exam?.name || 'Xem trước đề thi'}</span>
        </div>
      }
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAnswerKey(!showAnswerKey)}
          >
            {showAnswerKey ? (
              <>
                <EyeOff className="h-4 w-4 mr-1.5" />
                Ẩn đáp án đúng
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-1.5" />
                Hiện đáp án đúng
              </>
            )}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4 mr-1.5" />
              In đề thi (Print)
            </Button>
            <Button onClick={() => onOpenChange(false)}>
              Đóng
            </Button>
          </div>
        </div>
      }
    >
      {isLoading ? (
        <PageSpinner />
      ) : exam ? (
        <div className="space-y-6 print:p-0">
          {/* Official Exam Header */}
          <div className="border-b-2 border-gray-900 pb-4 text-center space-y-1">
            <div className="flex justify-between text-xs text-gray-700 uppercase font-semibold">
              <span>HỆ THỐNG ĐÀO TẠO & KHẢO THÍ EDUMATE</span>
              <span>MÃ ĐỀ THI: {exam.id.slice(0, 4).toUpperCase()}</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 pt-2 uppercase tracking-wide">
              {exam.name}
            </h2>
            <p className="text-xs text-gray-600">
              Thời gian làm bài: <strong>{exam.duration_minutes} phút</strong> (Không kể thời gian phát đề)
            </p>
          </div>

          {/* Metadata Bar */}
          <div className="grid grid-cols-3 gap-3 bg-gray-50 p-3.5 rounded-xl text-xs border border-gray-100 print:hidden">
            <div className="flex items-center gap-1.5 text-gray-700">
              <Clock className="h-3.5 w-3.5 text-gray-500" />
              <span>Thời gian: <strong>{exam.duration_minutes} phút</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-700">
              <HelpCircle className="h-3.5 w-3.5 text-gray-500" />
              <span>
                Tổng số câu:{' '}
                <strong>
                  {exam.sections?.reduce((sum, s) => sum + (s.questions?.length || 0), 0) || 0} câu
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-700">
              <Award className="h-3.5 w-3.5 text-gray-500" />
              <span>Trạng thái: <strong className="text-primary-600 capitalize">{exam.status}</strong></span>
            </div>
          </div>

          {/* Sections & Questions */}
          <div className="space-y-6">
            {exam.sections && exam.sections.length > 0 ? (
              exam.sections.map((section: ExamSectionDetail, sIdx: number) => (
                <div key={section.id || sIdx} className="space-y-4">
                  <div className="bg-gray-100 print:bg-transparent print:border-b px-4 py-2 rounded-lg border-l-4 border-primary-500 font-bold text-gray-900 text-sm">
                    {section.name} ({section.questions?.length || 0} câu)
                  </div>

                  <div className="space-y-4 pl-2">
                    {section.questions?.map((q, qIdx) => (
                      <div key={q.id || qIdx} className="border border-gray-200 print:border-0 rounded-xl p-4 bg-white space-y-2.5">
                        <div className="flex items-start justify-between">
                          <p className="text-sm font-medium text-gray-900 leading-relaxed">
                            <span className="font-bold text-primary-900 mr-2">
                              Câu {qIdx + 1} ({q.points}đ):
                            </span>
                            {q.stem}
                          </p>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded capitalize print:hidden">
                            {q.bloom_level || 'Hiểu'}
                          </span>
                        </div>

                        {/* MCQ Options */}
                        {q.options && q.options.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            {q.options.map((opt) => (
                              <div
                                key={opt.id}
                                className={`flex items-center gap-2 p-2.5 rounded-lg text-xs border ${
                                  showAnswerKey && opt.is_correct
                                    ? 'bg-green-50 border-green-300 text-green-900 font-bold'
                                    : 'bg-gray-50/70 border-gray-200 text-gray-700'
                                }`}
                              >
                                <span className={`h-5 w-5 rounded-full flex items-center justify-center font-bold ${
                                  showAnswerKey && opt.is_correct ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'
                                }`}>
                                  {opt.label}
                                </span>
                                <span>{opt.text}</span>
                                {showAnswerKey && opt.is_correct && (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 ml-auto" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">
                Đề thi chưa có câu hỏi nào.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          Không tìm thấy thông tin đề thi.
        </div>
      )}
    </Modal>
  );
}
