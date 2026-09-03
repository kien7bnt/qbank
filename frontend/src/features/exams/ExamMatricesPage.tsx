import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  Plus,
  Sparkles,
  Trash2,
  Calendar,
  HelpCircle,
  Award,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { examMatrixApi, curriculumApi, getErrorMessage } from '@/services/api';
import { ExamMatrixBuilderModal } from './ExamMatrixBuilderModal';
import { ExamPreviewModal } from './ExamPreviewModal';
import type { ExamMatrix } from '@/types';

export function ExamMatricesPage() {
  const qc = useQueryClient();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [previewExamId, setPreviewExamId] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('');

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => curriculumApi.subjects(),
  });

  const { data: matrices, isLoading } = useQuery({
    queryKey: ['exam-matrices', selectedSubject],
    queryFn: () =>
      examMatrixApi.list(selectedSubject ? { subject_id: selectedSubject } : undefined),
  });

  // AI 1-click Generate Exam Mutation
  const generateExamMutation = useMutation({
    mutationFn: (matrix: ExamMatrix) =>
      examMatrixApi.generateExam(matrix.id, {
        name: `Đề thi từ ${matrix.name}`,
        class_id: matrix.class_id,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['exams'] });
      toast.success('✨ AI đã tự động sinh đề thi thành công!');
      setPreviewExamId(res.data.id);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Delete Matrix Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => examMatrixApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exam-matrices'] });
      toast.success('Đã xóa ma trận đề thi');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const matrixList: ExamMatrix[] = matrices?.data || [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary-600" />
            Ma Trận Đề Thi
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Thiết kế cấu trúc ma trận và dùng AI để sinh đề thi chuẩn hóa tự động trong 1 click.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Tất cả môn học</option>
            {subjects?.data?.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <Button onClick={() => setBuilderOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Tạo ma trận mới
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <PageSpinner />
      ) : matrixList.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-6 w-6" />}
          title="Chưa có ma trận đề thi nào"
          description="Tạo ma trận để định nghĩa cấu trúc đề, phân bổ điểm và cho phép AI tự động chọn câu hỏi."
          action={
            <Button onClick={() => setBuilderOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Tạo ma trận đầu tiên
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {matrixList.map((matrix) => (
            <div
              key={matrix.id}
              className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-100">
                    <BookOpen className="h-3 w-3 mr-1" />
                    Môn học: {matrix.subject_id}
                  </span>
                  <button
                    onClick={() => {
                      if (confirm('Bạn có chắc muốn xóa ma trận này?')) {
                        deleteMutation.mutate(matrix.id);
                      }
                    }}
                    className="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-gray-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <h3 className="font-bold text-gray-900 text-base leading-snug">
                  {matrix.name}
                </h3>

                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 bg-gray-50 p-3 rounded-xl">
                  <div className="flex items-center gap-1.5">
                    <HelpCircle className="h-3.5 w-3.5 text-gray-400" />
                    <span><strong>{matrix.total_questions}</strong> câu hỏi</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-gray-400" />
                    <span>Thang <strong>{matrix.total_points}</strong> đ</span>
                  </div>
                </div>

                {/* Sections List */}
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cấu trúc các phần ({matrix.sections?.length || 0})
                  </p>
                  <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                    {matrix.sections?.map((sec, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded bg-gray-50 border border-gray-100"
                      >
                        <span className="truncate max-w-[150px] font-medium text-gray-700">
                          {sec.name}
                        </span>
                        <span className="text-gray-500">
                          {sec.question_count} câu ({sec.points_per_question}đ)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-5 mt-3 border-t border-gray-100 flex items-center gap-2">
                <Button
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                  size="sm"
                  loading={
                    generateExamMutation.isPending &&
                    generateExamMutation.variables?.id === matrix.id
                  }
                  onClick={() => generateExamMutation.mutate(matrix)}
                >
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  Sinh đề bằng AI
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <ExamMatrixBuilderModal
        open={builderOpen}
        onOpenChange={setBuilderOpen}
      />

      <ExamPreviewModal
        examId={previewExamId}
        open={!!previewExamId}
        onOpenChange={(v) => !v && setPreviewExamId(null)}
      />
    </div>
  );
}
