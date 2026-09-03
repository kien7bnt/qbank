import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Layers, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { examMatrixApi, curriculumApi, getErrorMessage } from '@/services/api';
import type { ExamMatrixSection } from '@/types';

interface ExamMatrixBuilderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_SECTIONS: ExamMatrixSection[] = [
  {
    name: 'Phần I: Trắc nghiệm 4 lựa chọn',
    question_type: 'mcq',
    question_count: 12,
    points_per_question: 0.25,
    rules: {
      bloom_mix: { remember: 4, understand: 4, apply: 4 },
      difficulty_mix: { easy: 4, medium: 6, hard: 2 },
    },
  },
  {
    name: 'Phần II: Tự luận / Trả lời ngắn',
    question_type: 'essay',
    question_count: 2,
    points_per_question: 1.0,
    rules: {
      bloom_mix: { apply: 1, analyze: 1 },
      difficulty_mix: { medium: 1, hard: 1 },
    },
  },
];

export function ExamMatrixBuilderModal({ open, onOpenChange }: ExamMatrixBuilderModalProps) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [sections, setSections] = useState<ExamMatrixSection[]>(DEFAULT_SECTIONS);

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => curriculumApi.subjects(),
    enabled: open,
  });

  const totalQuestions = sections.reduce((sum, s) => sum + (Number(s.question_count) || 0), 0);
  const totalPoints = sections.reduce(
    (sum, s) => sum + (Number(s.question_count) || 0) * (Number(s.points_per_question) || 0),
    0
  );

  const createMutation = useMutation({
    mutationFn: () =>
      examMatrixApi.create({
        name,
        subject_id: subjectId,
        total_questions: totalQuestions,
        total_points: totalPoints,
        sections,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exam-matrices'] });
      toast.success('Đã tạo ma trận đề thi thành công!');
      handleReset();
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleReset = () => {
    setName('');
    setSubjectId('');
    setSections(DEFAULT_SECTIONS);
  };

  const handleAddSection = () => {
    setSections([
      ...sections,
      {
        name: `Phần ${sections.length + 1}`,
        question_type: 'mcq',
        question_count: 5,
        points_per_question: 0.5,
        rules: {},
      },
    ]);
  };

  const handleRemoveSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index));
  };

  const handleUpdateSection = (index: number, field: keyof ExamMatrixSection, value: any) => {
    setSections(
      sections.map((sec, i) => (i === index ? { ...sec, [field]: value } : sec))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên ma trận đề thi');
      return;
    }
    if (sections.length === 0) {
      toast.error('Ma trận cần có ít nhất 1 phần thi');
      return;
    }
    createMutation.mutate();
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary-600" />
          <span>Tạo Ma Trận Đề Thi Mới</span>
        </div>
      }
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} loading={createMutation.isPending}>
            Lưu ma trận
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div>
          <Input
            label="Tên ma trận đề thi *"
            placeholder="Ví dụ: Ma trận đề thi Khảo sát Chất lượng - 45 phút"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        {/* Matrix Stats Summary */}
        <div className="flex items-center justify-between bg-primary-50 border border-primary-100 rounded-xl p-4">
          <div>
            <p className="text-xs text-primary-600 font-medium uppercase tracking-wider">Tổng quan đề thi</p>
            <p className="text-lg font-bold text-primary-900 mt-0.5">
              {sections.length} phần thi • {totalQuestions} câu hỏi
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-primary-600 font-medium uppercase tracking-wider">Tổng thang điểm</p>
            <p className="text-2xl font-black text-primary-700">{totalPoints.toFixed(2)} / 10.0 đ</p>
          </div>
        </div>

        {/* Sections Builder */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Cấu trúc các phần thi (Sections)</h3>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAddSection}
            >
              <Plus className="h-4 w-4 mr-1" />
              Thêm phần thi
            </Button>
          </div>

          <div className="space-y-3">
            {sections.map((sec, idx) => (
              <div
                key={idx}
                className="border border-gray-200 rounded-xl p-4 bg-white hover:border-gray-300 transition-colors relative"
              >
                <div className="grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-4">
                    <Input
                      label="Tên phần"
                      value={sec.name}
                      onChange={(e) => handleUpdateSection(idx, 'name', e.target.value)}
                      placeholder="e.g. Trắc nghiệm nhiều lựa chọn"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Loại câu
                    </label>
                    <select
                      value={sec.question_type}
                      onChange={(e) =>
                        handleUpdateSection(idx, 'question_type', e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="mcq">Trắc nghiệm (MCQ)</option>
                      <option value="essay">Tự luận (Essay)</option>
                      <option value="coding">Lập trình (Code)</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <Input
                      label="Số câu"
                      type="number"
                      min={1}
                      value={sec.question_count}
                      onChange={(e) =>
                        handleUpdateSection(idx, 'question_count', Number(e.target.value))
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      label="Điểm / câu"
                      type="number"
                      step="0.05"
                      min={0.1}
                      value={sec.points_per_question}
                      onChange={(e) =>
                        handleUpdateSection(
                          idx,
                          'points_per_question',
                          Number(e.target.value)
                        )
                      }
                    />
                  </div>
                  <div className="col-span-1 flex justify-center pt-6">
                    <button
                      type="button"
                      onClick={() => handleRemoveSection(idx)}
                      disabled={sections.length <= 1}
                      className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-30 rounded-lg hover:bg-gray-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
                  <span>
                    Tổng điểm phần này:{' '}
                    <strong>
                      {((sec.question_count || 0) * (sec.points_per_question || 0)).toFixed(2)} đ
                    </strong>
                  </span>
                  <span className="flex items-center text-purple-600">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Hỗ trợ AI Auto-select theo Bloom & Phân loại
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
