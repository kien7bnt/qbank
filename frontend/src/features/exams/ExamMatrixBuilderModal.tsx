import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Layers, Sparkles, Table2, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { examMatrixApi, curriculumApi, getErrorMessage } from '@/services/api';
import type { ExamMatrixSection, MatrixGridValidateResult } from '@/types';

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

interface GridRow {
  topic_name: string;
  remember: number;
  understand: number;
  apply: number;
  analyze: number;
  points_per_q: number;
}

export function ExamMatrixBuilderModal({ open, onOpenChange }: ExamMatrixBuilderModalProps) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'sections' | 'grid'>('grid');
  const [name, setName] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [sections, setSections] = useState<ExamMatrixSection[]>(DEFAULT_SECTIONS);

  // 2D Grid State
  const [gridRows, setGridRows] = useState<GridRow[]>([
    { topic_name: 'Chương 1: Kiến thức nền tảng', remember: 4, understand: 3, apply: 2, analyze: 0, points_per_q: 0.25 },
    { topic_name: 'Chương 2: Thiết kế & Xử lý dữ liệu', remember: 2, understand: 4, apply: 3, analyze: 1, points_per_q: 0.25 },
    { topic_name: 'Chương 3: Phân tích & Tối ưu hóa', remember: 1, understand: 2, apply: 3, analyze: 2, points_per_q: 0.5 },
  ]);

  const [validationResult, setValidationResult] = useState<MatrixGridValidateResult | null>(null);

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => curriculumApi.subjects(),
    enabled: open,
  });

  // Calculate totals for Sections mode
  const totalQuestionsSections = sections.reduce((sum, s) => sum + (Number(s.question_count) || 0), 0);
  const totalPointsSections = sections.reduce(
    (sum, s) => sum + (Number(s.question_count) || 0) * (Number(s.points_per_question) || 0),
    0
  );

  // Calculate totals for Grid mode
  const gridTotalQuestions = gridRows.reduce(
    (sum, r) => sum + r.remember + r.understand + r.apply + r.analyze,
    0
  );
  const gridTotalPoints = gridRows.reduce(
    (sum, r) => sum + (r.remember + r.understand + r.apply + r.analyze) * r.points_per_q,
    0
  );

  const totalQuestions = mode === 'grid' ? gridTotalQuestions : totalQuestionsSections;
  const totalPoints = mode === 'grid' ? gridTotalPoints : totalPointsSections;

  // Validate Grid Mutation
  const validateMutation = useMutation({
    mutationFn: () => {
      const rules = [];
      for (const r of gridRows) {
        if (r.remember > 0) {
          rules.push({ bloom_level: 'remember', difficulty: 'easy', question_type: 'mcq', question_count: r.remember, points_per_question: r.points_per_q });
        }
        if (r.understand > 0) {
          rules.push({ bloom_level: 'understand', difficulty: 'medium', question_type: 'mcq', question_count: r.understand, points_per_question: r.points_per_q });
        }
        if (r.apply > 0) {
          rules.push({ bloom_level: 'apply', difficulty: 'medium', question_type: 'mcq', question_count: r.apply, points_per_question: r.points_per_q });
        }
        if (r.analyze > 0) {
          rules.push({ bloom_level: 'analyze', difficulty: 'hard', question_type: 'essay', question_count: r.analyze, points_per_question: r.points_per_q });
        }
      }
      return examMatrixApi.validateGrid({
        expected_total_questions: gridTotalQuestions,
        expected_total_points: 10.0,
        rules,
      });
    },
    onSuccess: (res) => {
      setValidationResult(res.data);
      if (res.data.is_valid) {
        toast.success('Ma trận đề thi 2D hợp lệ!');
      } else {
        toast.error('Ma trận có lỗi cần điều chỉnh.');
      }
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      let finalSections: ExamMatrixSection[] = [];
      if (mode === 'grid') {
        finalSections = gridRows.map((r, idx) => ({
          name: r.topic_name,
          question_type: 'mcq',
          question_count: r.remember + r.understand + r.apply + r.analyze,
          points_per_question: r.points_per_q,
          rules: {
            bloom_mix: {
              remember: r.remember,
              understand: r.understand,
              apply: r.apply,
              analyze: r.analyze,
            },
          },
        }));
      } else {
        finalSections = sections;
      }

      return examMatrixApi.create({
        name,
        subject_id: subjectId || subjects?.data[0]?.id || '',
        total_questions: totalQuestions,
        total_points: totalPoints,
        sections: finalSections,
      });
    },
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
    setValidationResult(null);
  };

  const handleAddGridRow = () => {
    setGridRows([
      ...gridRows,
      {
        topic_name: `Chương ${gridRows.length + 1}: Chủ đề mới`,
        remember: 2,
        understand: 2,
        apply: 1,
        analyze: 0,
        points_per_q: 0.25,
      },
    ]);
  };

  const handleUpdateGridRow = (index: number, field: keyof GridRow, val: any) => {
    setGridRows(
      gridRows.map((r, i) => (i === index ? { ...r, [field]: val } : r))
    );
  };

  const handleRemoveGridRow = (index: number) => {
    setGridRows(gridRows.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên ma trận đề thi');
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
          <span>Thiết lập Ma Trận Đề Thi (2D Matrix Builder)</span>
        </div>
      }
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          {mode === 'grid' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => validateMutation.mutate()}
              loading={validateMutation.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Kiểm tra Ma trận
            </Button>
          )}
          <Button onClick={handleSubmit} loading={createMutation.isPending}>
            Lưu ma trận
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Tên ma trận đề thi *"
            placeholder="Ví dụ: Ma trận Khảo sát Định kỳ 45 phút"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kiểu cấu hình</label>
            <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1">
              <button
                type="button"
                onClick={() => setMode('grid')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  mode === 'grid' ? 'bg-white shadow-xs text-primary-700 font-bold' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Table2 className="h-3.5 w-3.5" />
                Ma trận 2D (Chủ đề x Bloom)
              </button>
              <button
                type="button"
                onClick={() => setMode('sections')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  mode === 'sections' ? 'bg-white shadow-xs text-primary-700 font-bold' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                Phần thi (Sections)
              </button>
            </div>
          </div>
        </div>

        {/* Matrix Stats Summary */}
        <div className="flex items-center justify-between bg-primary-50 border border-primary-100 rounded-xl p-4">
          <div>
            <p className="text-xs text-primary-600 font-medium uppercase tracking-wider">Tổng quan đề thi</p>
            <p className="text-lg font-bold text-primary-900 mt-0.5">
              {totalQuestions} câu hỏi • {mode === 'grid' ? `${gridRows.length} chủ đề` : `${sections.length} phần`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-primary-600 font-medium uppercase tracking-wider">Tổng thang điểm</p>
            <p className="text-2xl font-black text-primary-700">{totalPoints.toFixed(2)} / 10.0 đ</p>
          </div>
        </div>

        {/* Validation Alert */}
        {validationResult && (
          <div
            className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
              validationResult.is_valid
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
              {validationResult.is_valid ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>Ma trận đạt chuẩn khảo thí</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span>Cần điều chỉnh ma trận</span>
                </>
              )}
            </div>
            {validationResult.errors.map((err, i) => (
              <p key={i} className="text-red-600 flex items-center gap-1">• {err}</p>
            ))}
            {validationResult.warnings.map((warn, i) => (
              <p key={i} className="text-amber-700 flex items-center gap-1">• {warn}</p>
            ))}
          </div>
        )}

        {/* 2D Grid Mode */}
        {mode === 'grid' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Bảng Ma Trận 2D (Chủ đề × Mức độ Bloom)</h3>
              <Button type="button" size="sm" variant="outline" onClick={handleAddGridRow}>
                <Plus className="h-4 w-4 mr-1" />
                Thêm dòng chủ đề
              </Button>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="p-3 text-left min-w-[180px]">Chủ đề / Bài học</th>
                    <th className="p-3 text-center bg-blue-50 text-blue-800">Nhận biết</th>
                    <th className="p-3 text-center bg-emerald-50 text-emerald-800">Thông hiểu</th>
                    <th className="p-3 text-center bg-amber-50 text-amber-800">Vận dụng</th>
                    <th className="p-3 text-center bg-purple-50 text-purple-800">Vận dụng cao</th>
                    <th className="p-3 text-center">Điểm/câu</th>
                    <th className="p-3 text-center">Tổng câu</th>
                    <th className="p-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {gridRows.map((row, idx) => {
                    const rowSum = row.remember + row.understand + row.apply + row.analyze;
                    return (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.topic_name}
                            onChange={(e) => handleUpdateGridRow(idx, 'topic_name', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-xs font-medium"
                          />
                        </td>
                        <td className="p-2 text-center bg-blue-50/30">
                          <input
                            type="number"
                            min={0}
                            value={row.remember}
                            onChange={(e) => handleUpdateGridRow(idx, 'remember', Number(e.target.value))}
                            className="w-12 text-center px-1 py-1 border border-gray-200 rounded text-xs font-mono"
                          />
                        </td>
                        <td className="p-2 text-center bg-emerald-50/30">
                          <input
                            type="number"
                            min={0}
                            value={row.understand}
                            onChange={(e) => handleUpdateGridRow(idx, 'understand', Number(e.target.value))}
                            className="w-12 text-center px-1 py-1 border border-gray-200 rounded text-xs font-mono"
                          />
                        </td>
                        <td className="p-2 text-center bg-amber-50/30">
                          <input
                            type="number"
                            min={0}
                            value={row.apply}
                            onChange={(e) => handleUpdateGridRow(idx, 'apply', Number(e.target.value))}
                            className="w-12 text-center px-1 py-1 border border-gray-200 rounded text-xs font-mono"
                          />
                        </td>
                        <td className="p-2 text-center bg-purple-50/30">
                          <input
                            type="number"
                            min={0}
                            value={row.analyze}
                            onChange={(e) => handleUpdateGridRow(idx, 'analyze', Number(e.target.value))}
                            className="w-12 text-center px-1 py-1 border border-gray-200 rounded text-xs font-mono"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="number"
                            step="0.05"
                            min={0.1}
                            value={row.points_per_q}
                            onChange={(e) => handleUpdateGridRow(idx, 'points_per_q', Number(e.target.value))}
                            className="w-14 text-center px-1 py-1 border border-gray-200 rounded text-xs font-mono"
                          />
                        </td>
                        <td className="p-2 text-center font-bold font-mono">
                          {rowSum} ({((rowSum * row.points_per_q)).toFixed(2)}đ)
                        </td>
                        <td className="p-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveGridRow(idx)}
                            disabled={gridRows.length <= 1}
                            className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Sections Mode */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Cấu trúc các phần thi (Sections)</h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setSections([
                    ...sections,
                    { name: `Phần ${sections.length + 1}`, question_type: 'mcq', question_count: 5, points_per_question: 0.5, rules: {} },
                  ])
                }
              >
                <Plus className="h-4 w-4 mr-1" />
                Thêm phần thi
              </Button>
            </div>

            <div className="space-y-3">
              {sections.map((sec, idx) => (
                <div key={idx} className="border border-gray-200 rounded-xl p-4 bg-white">
                  <div className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-4">
                      <Input
                        label="Tên phần"
                        value={sec.name}
                        onChange={(e) =>
                          setSections(sections.map((s, i) => (i === idx ? { ...s, name: e.target.value } : s)))
                        }
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Loại câu</label>
                      <select
                        value={sec.question_type}
                        onChange={(e) =>
                          setSections(sections.map((s, i) => (i === idx ? { ...s, question_type: e.target.value as any } : s)))
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
                          setSections(sections.map((s, i) => (i === idx ? { ...s, question_count: Number(e.target.value) } : s)))
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
                          setSections(sections.map((s, i) => (i === idx ? { ...s, points_per_question: Number(e.target.value) } : s)))
                        }
                      />
                    </div>
                    <div className="col-span-1 flex justify-center pt-6">
                      <button
                        type="button"
                        onClick={() => setSections(sections.filter((_, i) => i !== idx))}
                        disabled={sections.length <= 1}
                        className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
