import React, { useMemo } from 'react';
import {
  Layers,
  Sparkles,
  BookOpen,
  Award,
  HelpCircle,
  Clock,
  CheckCircle2,
  FileText,
  X,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { ExamMatrix } from '@/types';

interface ExamMatrixDetailModalProps {
  matrix: ExamMatrix | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerateExam?: (matrix: ExamMatrix) => void;
  isGenerating?: boolean;
  subjects?: any[];
}

interface MergedTopicRow {
  topic_name: string;
  nb_tn: number;
  nb_tl: number;
  th_tn: number;
  th_tl: number;
  vdt_tn: number;
  vdt_tl: number;
  vdc_tn: number;
  vdc_tl: number;
  total_q: number;
  total_score: number;
}

export function ExamMatrixDetailModal({
  matrix,
  open,
  onOpenChange,
  onGenerateExam,
  isGenerating = false,
  subjects = [],
}: ExamMatrixDetailModalProps) {
  if (!matrix) return null;

  // Resolve Subject Name cleanly
  const subjectName = useMemo(() => {
    if (!matrix.subject_id) return null;
    const cleanId = matrix.subject_id.replace(/-/g, '').toLowerCase();
    const found = subjects.find(
      (s: any) => (s.id || '').replace(/-/g, '').toLowerCase() === cleanId
    );
    return found?.name || null;
  }, [matrix.subject_id, subjects]);

  // Extract MCQ and Essay Sections
  const mcqSection = matrix.sections?.find((s) => s.question_type === 'mcq');
  const essaySection = matrix.sections?.find((s) => s.question_type === 'essay');

  const mcqPoint = mcqSection?.points_per_question ?? 0.25;
  const essayPoint = essaySection?.points_per_question ?? 1.0;

  // Merge topic rows from rules
  const mergedTopics: MergedTopicRow[] = useMemo(() => {
    const mcqRows: any[] = mcqSection?.rules?.topic_rows || [];
    const essayRows: any[] = essaySection?.rules?.topic_rows || [];

    if (mcqRows.length === 0 && essayRows.length === 0) {
      return [];
    }

    const rowMap = new Map<string, MergedTopicRow>();

    const getRow = (name: string): MergedTopicRow => {
      if (!rowMap.has(name)) {
        rowMap.set(name, {
          topic_name: name,
          nb_tn: 0,
          nb_tl: 0,
          th_tn: 0,
          th_tl: 0,
          vdt_tn: 0,
          vdt_tl: 0,
          vdc_tn: 0,
          vdc_tl: 0,
          total_q: 0,
          total_score: 0,
        });
      }
      return rowMap.get(name)!;
    };

    mcqRows.forEach((r, idx) => {
      const name = r.topic_name || `Chủ đề ${idx + 1}`;
      const row = getRow(name);
      row.nb_tn = r.remember || 0;
      row.th_tn = r.understand || 0;
      row.vdt_tn = r.apply || 0;
      row.vdc_tn = r.analyze || 0;
    });

    essayRows.forEach((r, idx) => {
      const name = r.topic_name || `Chủ đề ${idx + 1}`;
      const row = getRow(name);
      row.nb_tl = r.remember || 0;
      row.th_tl = r.understand || 0;
      row.vdt_tl = r.apply || 0;
      row.vdc_tl = r.analyze || 0;
    });

    const result = Array.from(rowMap.values());
    result.forEach((r) => {
      r.total_q =
        r.nb_tn + r.nb_tl + r.th_tn + r.th_tl + r.vdt_tn + r.vdt_tl + r.vdc_tn + r.vdc_tl;
      const mcqScore = (r.nb_tn + r.th_tn + r.vdt_tn + r.vdc_tn) * mcqPoint;
      const essayScore = (r.nb_tl + r.th_tl + r.vdt_tl + r.vdc_tl) * essayPoint;
      r.total_score = Number((mcqScore + essayScore).toFixed(2));
    });

    return result;
  }, [mcqSection, essaySection, mcqPoint, essayPoint]);

  // Totals for columns
  const sumNbTn = mergedTopics.reduce((s, r) => s + r.nb_tn, 0);
  const sumNbTl = mergedTopics.reduce((s, r) => s + r.nb_tl, 0);
  const sumThTn = mergedTopics.reduce((s, r) => s + r.th_tn, 0);
  const sumThTl = mergedTopics.reduce((s, r) => s + r.th_tl, 0);
  const sumVdtTn = mergedTopics.reduce((s, r) => s + r.vdt_tn, 0);
  const sumVdtTl = mergedTopics.reduce((s, r) => s + r.vdt_tl, 0);
  const sumVdcTn = mergedTopics.reduce((s, r) => s + r.vdc_tn, 0);
  const sumVdcTl = mergedTopics.reduce((s, r) => s + r.vdc_tl, 0);

  const nbScore = Number(((sumNbTn * mcqPoint) + (sumNbTl * essayPoint)).toFixed(2));
  const thScore = Number(((sumThTn * mcqPoint) + (sumThTl * essayPoint)).toFixed(2));
  const vdtScore = Number(((sumVdtTn * mcqPoint) + (sumVdtTl * essayPoint)).toFixed(2));
  const vdcScore = Number(((sumVdcTn * mcqPoint) + (sumVdcTl * essayPoint)).toFixed(2));

  const totalPointsCalc = Number((nbScore + thScore + vdtScore + vdcScore).toFixed(2)) || matrix.total_points || 10;
  const nbPercent = Math.round((nbScore / totalPointsCalc) * 100);
  const thPercent = Math.round((thScore / totalPointsCalc) * 100);
  const vdtPercent = Math.round((vdtScore / totalPointsCalc) * 100);
  const vdcPercent = Math.round((vdcScore / totalPointsCalc) * 100);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary-100 text-primary-700 rounded-lg">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-gray-900 text-base sm:text-lg leading-snug">
              Cấu Trúc Ma Trận: {matrix.name}
            </div>
            {subjectName && (
              <p className="text-xs text-primary-700 font-medium flex items-center gap-1 mt-0.5">
                <BookOpen className="h-3 w-3" />
                Môn học: {subjectName}
              </p>
            )}
          </div>
        </div>
      }
      size="xl"
      footer={
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
          <div className="text-xs text-gray-500 font-medium">
            Tổng: <strong className="text-gray-900">{matrix.total_questions}</strong> câu hỏi &bull; Thang{' '}
            <strong className="text-primary-700">{matrix.total_points}</strong> điểm
          </div>

          <div className="flex items-center gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
              Đóng
            </Button>
            {onGenerateExam && (
              <Button
                size="sm"
                className="flex-1 sm:flex-none bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                loading={isGenerating}
                onClick={() => onGenerateExam(matrix)}
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                Sinh đề bằng AI
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Quick Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-primary-50/70 border border-primary-100 p-3 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-primary-600 text-white rounded-lg shrink-0">
              <HelpCircle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-primary-800 font-medium">Tổng câu hỏi</p>
              <p className="text-lg font-bold text-primary-900">{matrix.total_questions}</p>
            </div>
          </div>

          <div className="bg-amber-50/70 border border-amber-100 p-3 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-amber-600 text-white rounded-lg shrink-0">
              <Award className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-amber-800 font-medium">Thang điểm</p>
              <p className="text-lg font-bold text-amber-900">{matrix.total_points} đ</p>
            </div>
          </div>

          <div className="bg-purple-50/70 border border-purple-100 p-3 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-purple-600 text-white rounded-lg shrink-0">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-purple-800 font-medium">Số phần thi</p>
              <p className="text-lg font-bold text-purple-900">{matrix.sections?.length || 0} phần</p>
            </div>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-100 p-3 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-lg shrink-0">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-emerald-800 font-medium">Trạng thái</p>
              <p className="text-lg font-bold text-emerald-900 capitalize">{matrix.status || 'Chuẩn'}</p>
            </div>
          </div>
        </div>

        {/* 3-Tier Bloom Matrix Table */}
        {mergedTopics.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary-600" />
                Bảng Ma Trận Đề Thi Chi Tiết (Chuẩn Khảo Thí)
              </h4>
              <span className="text-xs text-gray-500 italic">
                TN = {mcqPoint}đ/câu &bull; TL = {essayPoint}đ/câu
              </span>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-xl shadow-xs">
              <table className="w-full text-xs text-center border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                    <th rowSpan={2} className="p-2.5 border-r border-gray-200 w-8">
                      TT
                    </th>
                    <th rowSpan={2} className="p-2.5 border-r border-gray-200 text-left min-w-[200px]">
                      Đơn vị kiến thức / Chủ đề
                    </th>
                    <th colSpan={2} className="p-2 border-r border-gray-200 bg-blue-50/80 text-blue-900">
                      Nhận biết
                    </th>
                    <th colSpan={2} className="p-2 border-r border-gray-200 bg-green-50/80 text-green-900">
                      Thông hiểu
                    </th>
                    <th colSpan={2} className="p-2 border-r border-gray-200 bg-yellow-50/80 text-yellow-900">
                      Vận dụng
                    </th>
                    <th colSpan={2} className="p-2 border-r border-gray-200 bg-red-50/80 text-red-900">
                      Vận dụng cao
                    </th>
                    <th rowSpan={2} className="p-2 border-r border-gray-200 bg-gray-50 font-bold w-16">
                      Tổng câu
                    </th>
                    <th rowSpan={2} className="p-2 bg-primary-50 font-bold text-primary-900 w-16">
                      Điểm
                    </th>
                  </tr>
                  <tr className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200 text-[11px]">
                    <th className="p-1.5 border-r border-gray-200">TN</th>
                    <th className="p-1.5 border-r border-gray-200">TL</th>
                    <th className="p-1.5 border-r border-gray-200">TN</th>
                    <th className="p-1.5 border-r border-gray-200">TL</th>
                    <th className="p-1.5 border-r border-gray-200">TN</th>
                    <th className="p-1.5 border-r border-gray-200">TL</th>
                    <th className="p-1.5 border-r border-gray-200">TN</th>
                    <th className="p-1.5 border-r border-gray-200">TL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {mergedTopics.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-2 border-r border-gray-100 text-gray-500 font-medium">
                        {idx + 1}
                      </td>
                      <td className="p-2 border-r border-gray-100 text-left font-medium text-gray-800">
                        {row.topic_name}
                      </td>
                      <td className="p-2 border-r border-gray-100 font-semibold text-gray-700">
                        {row.nb_tn || '-'}
                      </td>
                      <td className="p-2 border-r border-gray-100 font-semibold text-gray-700">
                        {row.nb_tl || '-'}
                      </td>
                      <td className="p-2 border-r border-gray-100 font-semibold text-gray-700">
                        {row.th_tn || '-'}
                      </td>
                      <td className="p-2 border-r border-gray-100 font-semibold text-gray-700">
                        {row.th_tl || '-'}
                      </td>
                      <td className="p-2 border-r border-gray-100 font-semibold text-gray-700">
                        {row.vdt_tn || '-'}
                      </td>
                      <td className="p-2 border-r border-gray-100 font-semibold text-gray-700">
                        {row.vdt_tl || '-'}
                      </td>
                      <td className="p-2 border-r border-gray-100 font-semibold text-gray-700">
                        {row.vdc_tn || '-'}
                      </td>
                      <td className="p-2 border-r border-gray-100 font-semibold text-gray-700">
                        {row.vdc_tl || '-'}
                      </td>
                      <td className="p-2 border-r border-gray-100 bg-gray-50/50 font-bold text-gray-900">
                        {row.total_q}
                      </td>
                      <td className="p-2 bg-primary-50/30 font-bold text-primary-700">
                        {row.total_score}đ
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                  {/* Total Question Count */}
                  <tr className="border-b border-gray-200">
                    <td colSpan={2} className="p-2 border-r border-gray-200 text-right text-gray-800 font-bold">
                      Tổng số câu:
                    </td>
                    <td className="p-2 border-r border-gray-200 text-blue-900">{sumNbTn}</td>
                    <td className="p-2 border-r border-gray-200 text-blue-900">{sumNbTl}</td>
                    <td className="p-2 border-r border-gray-200 text-green-900">{sumThTn}</td>
                    <td className="p-2 border-r border-gray-200 text-green-900">{sumThTl}</td>
                    <td className="p-2 border-r border-gray-200 text-yellow-900">{sumVdtTn}</td>
                    <td className="p-2 border-r border-gray-200 text-yellow-900">{sumVdtTl}</td>
                    <td className="p-2 border-r border-gray-200 text-red-900">{sumVdcTn}</td>
                    <td className="p-2 border-r border-gray-200 text-red-900">{sumVdcTl}</td>
                    <td className="p-2 border-r border-gray-200 bg-gray-100 text-gray-900 text-sm">
                      {matrix.total_questions}
                    </td>
                    <td className="p-2 bg-primary-100 text-primary-900 text-sm">
                      {matrix.total_points}đ
                    </td>
                  </tr>

                  {/* Total Score Per Level */}
                  <tr className="border-b border-gray-200 text-gray-700">
                    <td colSpan={2} className="p-2 border-r border-gray-200 text-right font-bold">
                      Điểm từng mức độ:
                    </td>
                    <td colSpan={2} className="p-2 border-r border-gray-200 bg-blue-50/50 text-blue-900">
                      {nbScore} đ
                    </td>
                    <td colSpan={2} className="p-2 border-r border-gray-200 bg-green-50/50 text-green-900">
                      {thScore} đ
                    </td>
                    <td colSpan={2} className="p-2 border-r border-gray-200 bg-yellow-50/50 text-yellow-900">
                      {vdtScore} đ
                    </td>
                    <td colSpan={2} className="p-2 border-r border-gray-200 bg-red-50/50 text-red-900">
                      {vdcScore} đ
                    </td>
                    <td colSpan={2} className="p-2 bg-primary-100/70 text-primary-900 font-extrabold">
                      {totalPointsCalc} đ
                    </td>
                  </tr>

                  {/* Percentage Ratio */}
                  <tr className="text-gray-700">
                    <td colSpan={2} className="p-2 border-r border-gray-200 text-right font-bold">
                      Tỉ lệ %:
                    </td>
                    <td colSpan={2} className="p-2 border-r border-gray-200 bg-blue-50/30 text-blue-800">
                      {nbPercent}%
                    </td>
                    <td colSpan={2} className="p-2 border-r border-gray-200 bg-green-50/30 text-green-800">
                      {thPercent}%
                    </td>
                    <td colSpan={2} className="p-2 border-r border-gray-200 bg-yellow-50/30 text-yellow-800">
                      {vdtPercent}%
                    </td>
                    <td colSpan={2} className="p-2 border-r border-gray-200 bg-red-50/30 text-red-800">
                      {vdcPercent}%
                    </td>
                    <td colSpan={2} className="p-2 bg-primary-100/40 text-primary-800 font-bold">
                      100%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : null}

        {/* Section Cards Breakdown */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Layers className="h-4 w-4 text-purple-600" />
            Cấu Trúc Các Phần Thi ({matrix.sections?.length || 0})
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {matrix.sections?.map((sec, idx) => {
              const bloom = sec.rules?.bloom_mix || {};
              return (
                <div
                  key={idx}
                  className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h5 className="font-bold text-gray-900 text-sm">{sec.name}</h5>
                      <span className="text-xs text-gray-500 capitalize">
                        Hình thức: {sec.question_type === 'mcq' ? 'Trắc nghiệm khách quan' : 'Tự luận'}
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 border border-purple-100">
                      {sec.question_count} câu &bull; {sec.points_per_question} đ/câu
                    </span>
                  </div>

                  {/* Bloom mix pills */}
                  <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                    <div className="bg-blue-50 p-1.5 rounded-lg border border-blue-100">
                      <div className="text-[10px] text-blue-700">Nhận biết</div>
                      <div className="font-bold text-blue-900">{bloom.remember || 0}</div>
                    </div>
                    <div className="bg-green-50 p-1.5 rounded-lg border border-green-100">
                      <div className="text-[10px] text-green-700">Thông hiểu</div>
                      <div className="font-bold text-green-900">{bloom.understand || 0}</div>
                    </div>
                    <div className="bg-yellow-50 p-1.5 rounded-lg border border-yellow-100">
                      <div className="text-[10px] text-yellow-700">Vận dụng</div>
                      <div className="font-bold text-yellow-900">{bloom.apply || 0}</div>
                    </div>
                    <div className="bg-red-50 p-1.5 rounded-lg border border-red-100">
                      <div className="text-[10px] text-red-700">Vận dụng cao</div>
                      <div className="font-bold text-red-900">{bloom.analyze || 0}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
