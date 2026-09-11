import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Layers, CheckCircle2, AlertTriangle, FolderTree, Search, Check, BookOpen, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { examMatrixApi, curriculumApi, domainApi, getErrorMessage } from '@/services/api';
import type { ExamMatrixSection, MatrixGridValidateResult } from '@/types';

interface ExamMatrixBuilderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MatrixTopicRow {
  id: string;
  topic_name: string;
  topic_id?: string;
  domain_id?: string;
  nb_tn: number;
  nb_tl: number;
  th_tn: number;
  th_tl: number;
  vdt_tn: number;
  vdt_tl: number;
  vdc_tn: number;
  vdc_tl: number;
}

interface BloomRatio {
  remember: number;
  understand: number;
  apply: number;
  analyze: number;
}

interface BloomWeight {
  remember: number;
  understand: number;
  apply: number;
  analyze: number;
}

interface LevelPointsPerQ {
  remember_mcq: number;
  remember_essay: number;
  understand_mcq: number;
  understand_essay: number;
  apply_mcq: number;
  apply_essay: number;
  analyze_mcq: number;
  analyze_essay: number;
}

export function ExamMatrixBuilderModal({ open, onOpenChange }: ExamMatrixBuilderModalProps) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [subjectId, setSubjectId] = useState('');

  // Tỉ lệ % mặc định (40% - 30% - 20% - 10%)
  const [ratios, setRatios] = useState<BloomRatio>({
    remember: 40,
    understand: 30,
    apply: 20,
    analyze: 10,
  });

  // Trọng số điểm (4.0 - 3.0 - 2.0 - 1.0)
  const [weights, setWeights] = useState<BloomWeight>({
    remember: 4.0,
    understand: 3.0,
    apply: 2.0,
    analyze: 1.0,
  });

  // Điểm mỗi câu hỏi theo từng loại và mức độ
  const [pointsPerQ, setPointsPerQ] = useState<LevelPointsPerQ>({
    remember_mcq: 0.25,
    remember_essay: 1.0,
    understand_mcq: 0.25,
    understand_essay: 1.0,
    apply_mcq: 0.25,
    apply_essay: 1.0,
    analyze_mcq: 0.25,
    analyze_essay: 1.0,
  });

  // Dynamic Topic Rows
  const [topicRows, setTopicRows] = useState<MatrixTopicRow[]>([
    {
      id: '1',
      topic_name: 'Chủ đề 1: Hàm số và Đồ thị',
      nb_tn: 4,
      nb_tl: 0,
      th_tn: 3,
      th_tl: 0,
      vdt_tn: 2,
      vdt_tl: 1,
      vdc_tn: 1,
      vdc_tl: 0,
    },
    {
      id: '2',
      topic_name: 'Chủ đề 2: Nguyên hàm và Tích phân',
      nb_tn: 4,
      nb_tl: 0,
      th_tn: 3,
      th_tl: 0,
      vdt_tn: 2,
      vdt_tl: 0,
      vdc_tn: 1,
      vdc_tl: 1,
    },
  ]);

  const [validationResult, setValidationResult] = useState<MatrixGridValidateResult | null>(null);

  // Picker Modal State for selecting topics from question bank
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [selectedTopicsMap, setSelectedTopicsMap] = useState<
    Record<string, { name: string; domain_id?: string; topic_id?: string }>
  >({});

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => curriculumApi.subjects(),
    enabled: open,
  });

  // Fetch Domains and Topics from Question Bank
  const { data: domainsData, isLoading: isLoadingDomains } = useQuery({
    queryKey: ['domains'],
    queryFn: () => domainApi.list(),
    enabled: open,
  });
  const domains = domainsData?.data ?? [];

  // Handle change ratio %
  const handleRatioChange = (level: keyof BloomRatio, value: number) => {
    const newRatios = { ...ratios, [level]: value };
    setRatios(newRatios);
    setWeights({
      remember: Number(((10 * (newRatios.remember || 0)) / 100).toFixed(2)),
      understand: Number(((10 * (newRatios.understand || 0)) / 100).toFixed(2)),
      apply: Number(((10 * (newRatios.apply || 0)) / 100).toFixed(2)),
      analyze: Number(((10 * (newRatios.analyze || 0)) / 100).toFixed(2)),
    });
  };

  const handleWeightChange = (level: keyof BloomWeight, value: number) => {
    setWeights({ ...weights, [level]: value });
  };

  const handlePointsPerQChange = (key: keyof LevelPointsPerQ, value: number) => {
    setPointsPerQ({ ...pointsPerQ, [key]: value });
  };

  const handleAddTopic = () => {
    const nextIdx = topicRows.length + 1;
    setTopicRows([
      ...topicRows,
      {
        id: String(Date.now()),
        topic_name: `Chủ đề ${nextIdx}: Nội dung mới`,
        nb_tn: 0,
        nb_tl: 0,
        th_tn: 0,
        th_tl: 0,
        vdt_tn: 0,
        vdt_tl: 0,
        vdc_tn: 0,
        vdc_tl: 0,
      },
    ]);
  };

  // Add single topic directly from bank
  const handleAddTopicFromBank = (topicName: string, topicId?: string, domainId?: string) => {
    setTopicRows((prev) => [
      ...prev,
      {
        id: String(Date.now() + Math.random()),
        topic_name: topicName,
        topic_id: topicId,
        domain_id: domainId,
        nb_tn: 0,
        nb_tl: 0,
        th_tn: 0,
        th_tl: 0,
        vdt_tn: 0,
        vdt_tl: 0,
        vdc_tn: 0,
        vdc_tl: 0,
      },
    ]);
  };

  // Add bulk selected topics from bank picker modal
  const handleAddBulkTopics = () => {
    const items = Object.values(selectedTopicsMap);
    if (items.length === 0) {
      toast.error('Vui lòng chọn ít nhất một chủ đề từ ngân hàng');
      return;
    }

    const newRows: MatrixTopicRow[] = items.map((item) => ({
      id: String(Date.now() + Math.random()),
      topic_name: item.name,
      topic_id: item.topic_id,
      domain_id: item.domain_id,
      nb_tn: 0,
      nb_tl: 0,
      th_tn: 0,
      th_tl: 0,
      vdt_tn: 0,
      vdt_tl: 0,
      vdc_tn: 0,
      vdc_tl: 0,
    }));

    setTopicRows((prev) => [...prev, ...newRows]);
    toast.success(`Đã thêm ${newRows.length} chủ đề từ ngân hàng vào ma trận!`);
    setIsPickerOpen(false);
    setSelectedTopicsMap({});
    setPickerSearch('');
  };

  const handleTogglePickerTopic = (key: string, name: string, topicId?: string, domainId?: string) => {
    setSelectedTopicsMap((prev) => {
      const copy = { ...prev };
      if (copy[key]) {
        delete copy[key];
      } else {
        copy[key] = { name, topic_id: topicId, domain_id: domainId };
      }
      return copy;
    });
  };

  const handleSelectAllInDomain = (domain: any) => {
    setSelectedTopicsMap((prev) => {
      const copy = { ...prev };
      if (!domain.topics || domain.topics.length === 0) {
        copy[`domain_${domain.id}`] = { name: domain.name, domain_id: domain.id };
      } else {
        for (const t of domain.topics) {
          copy[`topic_${t.id}`] = { name: t.name, topic_id: t.id, domain_id: domain.id };
        }
      }
      return copy;
    });
  };

  const handleUpdateTopic = (index: number, field: keyof MatrixTopicRow, value: any) => {
    setTopicRows(
      topicRows.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const handleRemoveTopic = (index: number) => {
    setTopicRows(topicRows.filter((_, i) => i !== index));
  };

  // Helper calculation for each cell
  const getCellScore = (count: number, pointPerQ: number) => {
    return Number(((count || 0) * (pointPerQ || 0)).toFixed(2));
  };

  // Row totals
  const getRowQuestions = (r: MatrixTopicRow) =>
    (r.nb_tn || 0) + (r.nb_tl || 0) + (r.th_tn || 0) + (r.th_tl || 0) + (r.vdt_tn || 0) + (r.vdt_tl || 0) + (r.vdc_tn || 0) + (r.vdc_tl || 0);

  const getRowScore = (r: MatrixTopicRow) =>
    getCellScore(r.nb_tn, pointsPerQ.remember_mcq) +
    getCellScore(r.nb_tl, pointsPerQ.remember_essay) +
    getCellScore(r.th_tn, pointsPerQ.understand_mcq) +
    getCellScore(r.th_tl, pointsPerQ.understand_essay) +
    getCellScore(r.vdt_tn, pointsPerQ.apply_mcq) +
    getCellScore(r.vdt_tl, pointsPerQ.apply_essay) +
    getCellScore(r.vdc_tn, pointsPerQ.analyze_mcq) +
    getCellScore(r.vdc_tl, pointsPerQ.analyze_essay);

  // Column sums
  const sumNbTnCount = topicRows.reduce((s, r) => s + (r.nb_tn || 0), 0);
  const sumNbTnScore = getCellScore(sumNbTnCount, pointsPerQ.remember_mcq);

  const sumNbTlCount = topicRows.reduce((s, r) => s + (r.nb_tl || 0), 0);
  const sumNbTlScore = getCellScore(sumNbTlCount, pointsPerQ.remember_essay);

  const sumThTnCount = topicRows.reduce((s, r) => s + (r.th_tn || 0), 0);
  const sumThTnScore = getCellScore(sumThTnCount, pointsPerQ.understand_mcq);

  const sumThTlCount = topicRows.reduce((s, r) => s + (r.th_tl || 0), 0);
  const sumThTlScore = getCellScore(sumThTlCount, pointsPerQ.understand_essay);

  const sumVdtTnCount = topicRows.reduce((s, r) => s + (r.vdt_tn || 0), 0);
  const sumVdtTnScore = getCellScore(sumVdtTnCount, pointsPerQ.apply_mcq);

  const sumVdtTlCount = topicRows.reduce((s, r) => s + (r.vdt_tl || 0), 0);
  const sumVdtTlScore = getCellScore(sumVdtTlCount, pointsPerQ.apply_essay);

  const sumVdcTnCount = topicRows.reduce((s, r) => s + (r.vdc_tn || 0), 0);
  const sumVdcTnScore = getCellScore(sumVdcTnCount, pointsPerQ.analyze_mcq);

  const sumVdcTlCount = topicRows.reduce((s, r) => s + (r.vdc_tl || 0), 0);
  const sumVdcTlScore = getCellScore(sumVdcTlCount, pointsPerQ.analyze_essay);

  // Grand totals
  const totalQuestions =
    sumNbTnCount + sumNbTlCount + sumThTnCount + sumThTlCount + sumVdtTnCount + sumVdtTlCount + sumVdcTnCount + sumVdcTlCount;

  const totalPoints = Number(
    (
      sumNbTnScore +
      sumNbTlScore +
      sumThTnScore +
      sumThTlScore +
      sumVdtTnScore +
      sumVdtTlScore +
      sumVdcTnScore +
      sumVdcTlScore
    ).toFixed(2)
  );

  const totalRatio =
    (ratios.remember || 0) + (ratios.understand || 0) + (ratios.apply || 0) + (ratios.analyze || 0);

  const totalWeight = Number(
    ((weights.remember || 0) + (weights.understand || 0) + (weights.apply || 0) + (weights.analyze || 0)).toFixed(2)
  );

  // Validate Mutation
  const validateMutation = useMutation({
    mutationFn: () => {
      const rules = [];
      if (sumNbTnCount > 0) {
        rules.push({ bloom_level: 'remember', difficulty: 'easy', question_type: 'mcq', question_count: sumNbTnCount, points_per_question: pointsPerQ.remember_mcq });
      }
      if (sumNbTlCount > 0) {
        rules.push({ bloom_level: 'remember', difficulty: 'easy', question_type: 'essay', question_count: sumNbTlCount, points_per_question: pointsPerQ.remember_essay });
      }
      if (sumThTnCount > 0) {
        rules.push({ bloom_level: 'understand', difficulty: 'medium', question_type: 'mcq', question_count: sumThTnCount, points_per_question: pointsPerQ.understand_mcq });
      }
      if (sumThTlCount > 0) {
        rules.push({ bloom_level: 'understand', difficulty: 'medium', question_type: 'essay', question_count: sumThTlCount, points_per_question: pointsPerQ.understand_essay });
      }
      if (sumVdtTnCount > 0) {
        rules.push({ bloom_level: 'apply', difficulty: 'medium', question_type: 'mcq', question_count: sumVdtTnCount, points_per_question: pointsPerQ.apply_mcq });
      }
      if (sumVdtTlCount > 0) {
        rules.push({ bloom_level: 'apply', difficulty: 'medium', question_type: 'essay', question_count: sumVdtTlCount, points_per_question: pointsPerQ.apply_essay });
      }
      if (sumVdcTnCount > 0) {
        rules.push({ bloom_level: 'analyze', difficulty: 'hard', question_type: 'mcq', question_count: sumVdcTnCount, points_per_question: pointsPerQ.analyze_mcq });
      }
      if (sumVdcTlCount > 0) {
        rules.push({ bloom_level: 'analyze', difficulty: 'hard', question_type: 'essay', question_count: sumVdcTlCount, points_per_question: pointsPerQ.analyze_essay });
      }

      return examMatrixApi.validateGrid({
        expected_total_questions: totalQuestions,
        expected_total_points: 10.0,
        rules,
      });
    },
    onSuccess: (res) => {
      setValidationResult(res.data);
      if (res.data.is_valid) {
        toast.success('Ma trận đề thi chuẩn khảo thí hợp lệ!');
      } else {
        toast.error('Ma trận có điểm hoặc tỷ lệ chưa cân đối.');
      }
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Create Matrix Mutation
  const createMutation = useMutation({
    mutationFn: () => {
      const finalSections: ExamMatrixSection[] = [];
      const totalMcq = sumNbTnCount + sumThTnCount + sumVdtTnCount + sumVdcTnCount;
      const totalTl = sumNbTlCount + sumThTlCount + sumVdtTlCount + sumVdcTlCount;

      const topicIds = Array.from(
        new Set(topicRows.map((r) => r.topic_id).filter((id): id is string => Boolean(id)))
      );

      if (totalMcq > 0) {
        const mcqScore = sumNbTnScore + sumThTnScore + sumVdtTnScore + sumVdcTnScore;
        finalSections.push({
          name: 'Phần I: Câu hỏi trắc nghiệm',
          question_type: 'mcq',
          question_count: totalMcq,
          points_per_question: Number((mcqScore / totalMcq).toFixed(3)),
          rules: {
            bloom_mix: {
              remember: sumNbTnCount,
              understand: sumThTnCount,
              apply: sumVdtTnCount,
              analyze: sumVdcTnCount,
            },
            topic_ids: topicIds,
            topic_rows: topicRows.map((r) => ({
              topic_name: r.topic_name,
              topic_id: r.topic_id,
              domain_id: r.domain_id,
              remember: r.nb_tn,
              understand: r.th_tn,
              apply: r.vdt_tn,
              analyze: r.vdc_tn,
            })),
          },
        });
      }

      if (totalTl > 0) {
        const tlScore = sumNbTlScore + sumThTlScore + sumVdtTlScore + sumVdcTlScore;
        finalSections.push({
          name: 'Phần II: Câu hỏi tự luận',
          question_type: 'essay',
          question_count: totalTl,
          points_per_question: Number((tlScore / totalTl).toFixed(3)),
          rules: {
            bloom_mix: {
              remember: sumNbTlCount,
              understand: sumThTlCount,
              apply: sumVdtTlCount,
              analyze: sumVdcTlCount,
            },
            topic_ids: topicIds,
            topic_rows: topicRows.map((r) => ({
              topic_name: r.topic_name,
              topic_id: r.topic_id,
              domain_id: r.domain_id,
              remember: r.nb_tl,
              understand: r.th_tl,
              apply: r.vdt_tl,
              analyze: r.vdc_tl,
            })),
          },
        });
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
      toast.success('Đã lưu ma trận đề thi thành công!');
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên ma trận đề thi');
      return;
    }
    if (totalQuestions <= 0) {
      toast.error('Vui lòng nhập số câu hỏi cho ma trận');
      return;
    }
    createMutation.mutate();
  };

  // Filter domains and topics for the picker modal
  const filteredDomains = domains.map((d: any) => {
    const s = pickerSearch.trim().toLowerCase();
    if (!s) return d;
    const matchDomain = d.name.toLowerCase().includes(s);
    const matchedTopics = d.topics?.filter((t: any) => t.name.toLowerCase().includes(s)) || [];
    if (matchDomain) return d;
    if (matchedTopics.length > 0) {
      return { ...d, topics: matchedTopics };
    }
    return null;
  }).filter(Boolean);

  const selectedCount = Object.keys(selectedTopicsMap).length;

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary-600" />
            <span className="font-bold text-gray-900">Ma Trận Cấu Trúc Đề Thi Chuẩn</span>
          </div>
        }
        size="3xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Tổng số: <strong className="text-gray-900 font-bold">{totalQuestions}</strong> câu hỏi</span>
              <span>•</span>
              <span>Thang điểm: <strong className={`font-bold ${Math.abs(totalPoints - 10) < 0.01 ? 'text-green-600' : 'text-amber-600'}`}>{totalPoints} / 10.0 đ</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => validateMutation.mutate()}
                loading={validateMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-600" />
                Kiểm tra Ma trận
              </Button>
              <Button onClick={handleSubmit} loading={createMutation.isPending}>
                Lưu ma trận
              </Button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Header Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Input
                label="Tên ma trận đề thi *"
                placeholder="Ví dụ: Ma trận Đề kiểm tra Cuối học kỳ 1 môn Toán"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Môn học / Lĩnh vực</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:outline-hidden"
              >
                <option value="">-- Mặc định --</option>
                {subjects?.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Validation Alert */}
          {validationResult && (
            <div
              className={`p-3 rounded-xl border text-xs space-y-1 ${
                validationResult.is_valid
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              <div className="flex items-center gap-2 font-bold">
                {validationResult.is_valid ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Ma trận đạt chuẩn khảo thí (Tổng 10.0 điểm, độ khó cân đối)</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span>Cần điều chỉnh số lượng câu hỏi hoặc điểm số ma trận</span>
                  </>
                )}
              </div>
              {validationResult.errors?.map((err, i) => (
                <p key={i} className="text-red-600 flex items-center gap-1">• {err}</p>
              ))}
              {validationResult.warnings?.map((warn, i) => (
                <p key={i} className="text-amber-700 flex items-center gap-1">• {warn}</p>
              ))}
            </div>
          )}

          {/* Standard Multi-tier Matrix Table */}
          <div className="overflow-x-auto border border-gray-300 rounded-xl shadow-xs bg-white">
            <table className="w-full text-xs border-collapse">
              {/* 3-TIER HEADER */}
              <thead>
                {/* Level 1: Bloom Levels */}
                <tr className="bg-gray-50 text-gray-800 border-b border-gray-300 text-center font-bold divide-x divide-gray-200">
                  <th rowSpan={2} className="p-2.5 text-left min-w-[220px] bg-gray-100/70">
                    Cài đặt chung
                  </th>
                  <th colSpan={4} className="p-2 bg-blue-50/70 text-blue-900 border-b border-blue-200">
                    Nhận biết
                  </th>
                  <th colSpan={4} className="p-2 bg-emerald-50/70 text-emerald-900 border-b border-emerald-200">
                    Thông hiểu
                  </th>
                  <th colSpan={4} className="p-2 bg-amber-50/70 text-amber-900 border-b border-amber-200">
                    Vận dụng thấp
                  </th>
                  <th colSpan={4} className="p-2 bg-purple-50/70 text-purple-900 border-b border-purple-200">
                    Vận dụng cao
                  </th>
                  <th rowSpan={3} className="p-2.5 min-w-[75px] bg-gray-100 text-gray-900 font-bold border-l border-gray-300">
                    Tổng
                  </th>
                </tr>

                {/* Level 2: Trắc nghiệm / Tự luận */}
                <tr className="bg-gray-50 text-gray-700 border-b border-gray-300 text-center font-semibold divide-x divide-gray-200 text-[11px]">
                  <th colSpan={2} className="p-1.5 bg-blue-50/40">Trắc nghiệm</th>
                  <th colSpan={2} className="p-1.5 bg-blue-50/40">Tự luận</th>
                  <th colSpan={2} className="p-1.5 bg-emerald-50/40">Trắc nghiệm</th>
                  <th colSpan={2} className="p-1.5 bg-emerald-50/40">Tự luận</th>
                  <th colSpan={2} className="p-1.5 bg-amber-50/40">Trắc nghiệm</th>
                  <th colSpan={2} className="p-1.5 bg-amber-50/40">Tự luận</th>
                  <th colSpan={2} className="p-1.5 bg-purple-50/40">Trắc nghiệm</th>
                  <th colSpan={2} className="p-1.5 bg-purple-50/40">Tự luận</th>
                </tr>

                {/* Level 3: Số câu / Số điểm */}
                <tr className="bg-gray-50 text-gray-600 border-b border-gray-300 text-center text-[10px] divide-x divide-gray-200">
                  <th className="p-1 text-left bg-gray-100/50"></th>
                  {/* NB */}
                  <th className="p-1 w-12 min-w-[48px]">Số câu</th>
                  <th className="p-1 w-12 min-w-[48px]">Số điểm</th>
                  <th className="p-1 w-12 min-w-[48px]">Số câu</th>
                  <th className="p-1 w-12 min-w-[48px]">Số điểm</th>
                  {/* TH */}
                  <th className="p-1 w-12 min-w-[48px]">Số câu</th>
                  <th className="p-1 w-12 min-w-[48px]">Số điểm</th>
                  <th className="p-1 w-12 min-w-[48px]">Số câu</th>
                  <th className="p-1 w-12 min-w-[48px]">Số điểm</th>
                  {/* VDT */}
                  <th className="p-1 w-12 min-w-[48px]">Số câu</th>
                  <th className="p-1 w-12 min-w-[48px]">Số điểm</th>
                  <th className="p-1 w-12 min-w-[48px]">Số câu</th>
                  <th className="p-1 w-12 min-w-[48px]">Số điểm</th>
                  {/* VDC */}
                  <th className="p-1 w-12 min-w-[48px]">Số câu</th>
                  <th className="p-1 w-12 min-w-[48px]">Số điểm</th>
                  <th className="p-1 w-12 min-w-[48px]">Số câu</th>
                  <th className="p-1 w-12 min-w-[48px]">Số điểm</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {/* CONFIG ROW 1: Tỉ lệ % */}
                <tr className="bg-white hover:bg-gray-50/50 divide-x divide-gray-200">
                  <td className="p-2 font-medium text-gray-800 bg-gray-50/70">
                    Tỉ lệ %
                  </td>
                  <td colSpan={4} className="p-1.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={ratios.remember}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleRatioChange('remember', Number(e.target.value))}
                        className="w-14 text-center px-1.5 py-1 border border-gray-300 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                      />
                      <span className="text-gray-500 font-bold">%</span>
                    </div>
                  </td>
                  <td colSpan={4} className="p-1.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={ratios.understand}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleRatioChange('understand', Number(e.target.value))}
                        className="w-14 text-center px-1.5 py-1 border border-gray-300 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                      />
                      <span className="text-gray-500 font-bold">%</span>
                    </div>
                  </td>
                  <td colSpan={4} className="p-1.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={ratios.apply}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleRatioChange('apply', Number(e.target.value))}
                        className="w-14 text-center px-1.5 py-1 border border-gray-300 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                      />
                      <span className="text-gray-500 font-bold">%</span>
                    </div>
                  </td>
                  <td colSpan={4} className="p-1.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={ratios.analyze}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleRatioChange('analyze', Number(e.target.value))}
                        className="w-14 text-center px-1.5 py-1 border border-gray-300 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-purple-500 focus:outline-hidden"
                      />
                      <span className="text-gray-500 font-bold">%</span>
                    </div>
                  </td>
                  <td className="p-1.5 text-center font-bold bg-gray-50 text-gray-800">
                    <span className={totalRatio === 100 ? 'text-green-700' : 'text-amber-700 font-extrabold'}>
                      {totalRatio}%
                    </span>
                  </td>
                </tr>

                {/* CONFIG ROW 2: Trọng số điểm */}
                <tr className="bg-white hover:bg-gray-50/50 divide-x divide-gray-200">
                  <td className="p-2 font-medium text-gray-800 bg-gray-50/70">
                    Trọng số điểm
                  </td>
                  <td colSpan={4} className="p-1.5 text-center">
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={weights.remember}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleWeightChange('remember', Number(e.target.value))}
                      className="w-20 text-center px-1.5 py-1 border border-gray-200 bg-gray-50 rounded-lg text-xs font-bold text-blue-900"
                    />
                  </td>
                  <td colSpan={4} className="p-1.5 text-center">
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={weights.understand}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleWeightChange('understand', Number(e.target.value))}
                      className="w-20 text-center px-1.5 py-1 border border-gray-200 bg-gray-50 rounded-lg text-xs font-bold text-emerald-900"
                    />
                  </td>
                  <td colSpan={4} className="p-1.5 text-center">
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={weights.apply}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleWeightChange('apply', Number(e.target.value))}
                      className="w-20 text-center px-1.5 py-1 border border-gray-200 bg-gray-50 rounded-lg text-xs font-bold text-amber-900"
                    />
                  </td>
                  <td colSpan={4} className="p-1.5 text-center">
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={weights.analyze}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleWeightChange('analyze', Number(e.target.value))}
                      className="w-20 text-center px-1.5 py-1 border border-gray-200 bg-gray-50 rounded-lg text-xs font-bold text-purple-900"
                    />
                  </td>
                  <td className="p-1.5 text-center font-bold bg-gray-50 text-gray-800">
                    {totalWeight} đ
                  </td>
                </tr>

                {/* CONFIG ROW 3: Điểm (mỗi câu) */}
                <tr className="bg-white hover:bg-gray-50/50 divide-x divide-gray-200">
                  <td className="p-2 font-medium text-gray-800 bg-gray-50/70">
                    Điểm (mỗi câu)
                  </td>
                  {/* NB: TN & TL */}
                  <td colSpan={2} className="p-1.5 text-center">
                    <input
                      type="number"
                      step="0.05"
                      min={0.05}
                      value={pointsPerQ.remember_mcq}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handlePointsPerQChange('remember_mcq', Number(e.target.value))}
                      className="w-14 text-center px-1 py-1 border border-gray-300 rounded text-xs font-medium"
                    />
                  </td>
                  <td colSpan={2} className="p-1.5 text-center">
                    <input
                      type="number"
                      step="0.25"
                      min={0.1}
                      value={pointsPerQ.remember_essay}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handlePointsPerQChange('remember_essay', Number(e.target.value))}
                      className="w-14 text-center px-1 py-1 border border-gray-300 rounded text-xs font-medium"
                    />
                  </td>
                  {/* TH: TN & TL */}
                  <td colSpan={2} className="p-1.5 text-center">
                    <input
                      type="number"
                      step="0.05"
                      min={0.05}
                      value={pointsPerQ.understand_mcq}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handlePointsPerQChange('understand_mcq', Number(e.target.value))}
                      className="w-14 text-center px-1 py-1 border border-gray-300 rounded text-xs font-medium"
                    />
                  </td>
                  <td colSpan={2} className="p-1.5 text-center">
                    <input
                      type="number"
                      step="0.25"
                      min={0.1}
                      value={pointsPerQ.understand_essay}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handlePointsPerQChange('understand_essay', Number(e.target.value))}
                      className="w-14 text-center px-1 py-1 border border-gray-300 rounded text-xs font-medium"
                    />
                  </td>
                  {/* VDT: TN & TL */}
                  <td colSpan={2} className="p-1.5 text-center">
                    <input
                      type="number"
                      step="0.05"
                      min={0.05}
                      value={pointsPerQ.apply_mcq}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handlePointsPerQChange('apply_mcq', Number(e.target.value))}
                      className="w-14 text-center px-1 py-1 border border-gray-300 rounded text-xs font-medium"
                    />
                  </td>
                  <td colSpan={2} className="p-1.5 text-center">
                    <input
                      type="number"
                      step="0.25"
                      min={0.1}
                      value={pointsPerQ.apply_essay}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handlePointsPerQChange('apply_essay', Number(e.target.value))}
                      className="w-14 text-center px-1 py-1 border border-gray-300 rounded text-xs font-medium"
                    />
                  </td>
                  {/* VDC: TN & TL */}
                  <td colSpan={2} className="p-1.5 text-center">
                    <input
                      type="number"
                      step="0.05"
                      min={0.05}
                      value={pointsPerQ.analyze_mcq}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handlePointsPerQChange('analyze_mcq', Number(e.target.value))}
                      className="w-14 text-center px-1 py-1 border border-gray-300 rounded text-xs font-medium"
                    />
                  </td>
                  <td colSpan={2} className="p-1.5 text-center">
                    <input
                      type="number"
                      step="0.25"
                      min={0.1}
                      value={pointsPerQ.analyze_essay}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handlePointsPerQChange('analyze_essay', Number(e.target.value))}
                      className="w-14 text-center px-1 py-1 border border-gray-300 rounded text-xs font-medium"
                    />
                  </td>
                  <td className="p-1.5 text-center text-gray-400 bg-gray-50">-</td>
                </tr>

                {/* BUTTON ROW: + Thêm chủ đề / Chọn từ ngân hàng */}
                <tr className="bg-gray-50/70 border-y border-gray-200">
                  <td colSpan={18} className="p-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsPickerOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer"
                        >
                          <FolderTree className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Chọn từ ngân hàng câu hỏi</span>
                          {domains.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.2 bg-emerald-200 text-emerald-900 rounded-full text-[10px] font-bold">
                              {domains.reduce((s: number, d: any) => s + (d.topics?.length || 0), 0) || domains.length}
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleAddTopic}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-colors cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Thêm chủ đề tùy chỉnh
                        </button>
                      </div>

                      {/* Quick Select Dropdown from bank */}
                      {domains.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-gray-500 font-medium hidden sm:inline">Chọn nhanh:</span>
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) return;
                              const [type, id, nameVal, domainId] = val.split(':::');
                              handleAddTopicFromBank(
                                nameVal,
                                type === 'topic' ? id : undefined,
                                domainId || (type === 'domain' ? id : undefined)
                              );
                              toast.success(`Đã thêm "${nameVal}"`);
                              e.target.value = '';
                            }}
                            className="px-2.5 py-1 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 max-w-[260px] truncate focus:ring-1 focus:ring-primary-500 focus:outline-hidden cursor-pointer"
                          >
                            <option value="">-- Chọn nhanh danh mục --</option>
                            {domains.map((d: any) => (
                              <optgroup key={d.id} label={`📁 ${d.name} (${d.question_count} câu)`}>
                                <option value={`domain:::${d.id}:::${d.name}:::`}>
                                  📁 {d.name} (Tất cả - {d.question_count} câu)
                                </option>
                                {d.topics?.map((t: any) => (
                                  <option key={t.id} value={`topic:::${t.id}:::${t.name}:::${d.id}`}>
                                    ↳ {t.name} ({t.question_count} câu)
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>

                {/* DYNAMIC TOPIC ROWS */}
                {topicRows.map((row, idx) => {
                  const rQuestions = getRowQuestions(row);
                  const rScore = getRowScore(row);
                  return (
                    <tr key={row.id} className="hover:bg-blue-50/20 divide-x divide-gray-200">
                      <td className="p-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={row.topic_name}
                              onChange={(e) => handleUpdateTopic(idx, 'topic_name', e.target.value)}
                              placeholder="Tên chủ đề..."
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-medium focus:border-primary-500 focus:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveTopic(idx)}
                              disabled={topicRows.length <= 1}
                              className="text-gray-400 hover:text-red-500 disabled:opacity-20 p-1"
                              title="Xóa chủ đề này"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Inline Category Switcher / Picker */}
                          {domains.length > 0 && (
                            <select
                              value={
                                row.topic_id
                                  ? `topic:::${row.topic_id}`
                                  : row.domain_id
                                  ? `domain:::${row.domain_id}`
                                  : ''
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                if (!val) return;
                                const [type, id, nameVal, domainId] = val.split(':::');
                                handleUpdateTopic(idx, 'topic_name', nameVal);
                                handleUpdateTopic(idx, 'topic_id', type === 'topic' ? id : undefined);
                                handleUpdateTopic(idx, 'domain_id', domainId || (type === 'domain' ? id : undefined));
                              }}
                              className="w-full text-[10px] text-gray-500 bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 truncate cursor-pointer hover:bg-gray-100"
                            >
                              <option value="">-- Đổi danh mục từ ngân hàng --</option>
                              {domains.map((d: any) => (
                                <optgroup key={d.id} label={`📁 ${d.name}`}>
                                  <option value={`domain:::${d.id}:::${d.name}:::`}>📁 {d.name}</option>
                                  {d.topics?.map((t: any) => (
                                    <option key={t.id} value={`topic:::${t.id}:::${t.name}:::${d.id}`}>
                                      ↳ {t.name} ({t.question_count} câu)
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>

                      {/* NB: TN */}
                      <td className="p-1 text-center bg-blue-50/20">
                        <input
                          type="number"
                          min={0}
                          value={row.nb_tn}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleUpdateTopic(idx, 'nb_tn', Number(e.target.value))}
                          className="w-10 text-center py-0.5 border border-gray-200 rounded text-xs font-mono"
                        />
                      </td>
                      <td className="p-1 text-center text-[11px] font-mono text-gray-600 bg-blue-50/20">
                        {getCellScore(row.nb_tn, pointsPerQ.remember_mcq)}
                      </td>

                      {/* NB: TL */}
                      <td className="p-1 text-center bg-blue-50/20">
                        <input
                          type="number"
                          min={0}
                          value={row.nb_tl}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleUpdateTopic(idx, 'nb_tl', Number(e.target.value))}
                          className="w-10 text-center py-0.5 border border-gray-200 rounded text-xs font-mono"
                        />
                      </td>
                      <td className="p-1 text-center text-[11px] font-mono text-gray-600 bg-blue-50/20">
                        {getCellScore(row.nb_tl, pointsPerQ.remember_essay)}
                      </td>

                      {/* TH: TN */}
                      <td className="p-1 text-center bg-emerald-50/20">
                        <input
                          type="number"
                          min={0}
                          value={row.th_tn}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleUpdateTopic(idx, 'th_tn', Number(e.target.value))}
                          className="w-10 text-center py-0.5 border border-gray-200 rounded text-xs font-mono"
                        />
                      </td>
                      <td className="p-1 text-center text-[11px] font-mono text-gray-600 bg-emerald-50/20">
                        {getCellScore(row.th_tn, pointsPerQ.understand_mcq)}
                      </td>

                      {/* TH: TL */}
                      <td className="p-1 text-center bg-emerald-50/20">
                        <input
                          type="number"
                          min={0}
                          value={row.th_tl}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleUpdateTopic(idx, 'th_tl', Number(e.target.value))}
                          className="w-10 text-center py-0.5 border border-gray-200 rounded text-xs font-mono"
                        />
                      </td>
                      <td className="p-1 text-center text-[11px] font-mono text-gray-600 bg-emerald-50/20">
                        {getCellScore(row.th_tl, pointsPerQ.understand_essay)}
                      </td>

                      {/* VDT: TN */}
                      <td className="p-1 text-center bg-amber-50/20">
                        <input
                          type="number"
                          min={0}
                          value={row.vdt_tn}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleUpdateTopic(idx, 'vdt_tn', Number(e.target.value))}
                          className="w-10 text-center py-0.5 border border-gray-200 rounded text-xs font-mono"
                        />
                      </td>
                      <td className="p-1 text-center text-[11px] font-mono text-gray-600 bg-amber-50/20">
                        {getCellScore(row.vdt_tn, pointsPerQ.apply_mcq)}
                      </td>

                      {/* VDT: TL */}
                      <td className="p-1 text-center bg-amber-50/20">
                        <input
                          type="number"
                          min={0}
                          value={row.vdt_tl}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleUpdateTopic(idx, 'vdt_tl', Number(e.target.value))}
                          className="w-10 text-center py-0.5 border border-gray-200 rounded text-xs font-mono"
                        />
                      </td>
                      <td className="p-1 text-center text-[11px] font-mono text-gray-600 bg-amber-50/20">
                        {getCellScore(row.vdt_tl, pointsPerQ.apply_essay)}
                      </td>

                      {/* VDC: TN */}
                      <td className="p-1 text-center bg-purple-50/20">
                        <input
                          type="number"
                          min={0}
                          value={row.vdc_tn}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleUpdateTopic(idx, 'vdc_tn', Number(e.target.value))}
                          className="w-10 text-center py-0.5 border border-gray-200 rounded text-xs font-mono"
                        />
                      </td>
                      <td className="p-1 text-center text-[11px] font-mono text-gray-600 bg-purple-50/20">
                        {getCellScore(row.vdc_tn, pointsPerQ.analyze_mcq)}
                      </td>

                      {/* VDC: TL */}
                      <td className="p-1 text-center bg-purple-50/20">
                        <input
                          type="number"
                          min={0}
                          value={row.vdc_tl}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleUpdateTopic(idx, 'vdc_tl', Number(e.target.value))}
                          className="w-10 text-center py-0.5 border border-gray-200 rounded text-xs font-mono"
                        />
                      </td>
                      <td className="p-1 text-center text-[11px] font-mono text-gray-600 bg-purple-50/20">
                        {getCellScore(row.vdc_tl, pointsPerQ.analyze_essay)}
                      </td>

                      {/* ROW TOTAL */}
                      <td className="p-1 text-center bg-gray-50 text-[11px] font-bold text-gray-800">
                        <div>{rQuestions}</div>
                        <div className="text-[10px] text-primary-700">{rScore.toFixed(2)}đ</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* SUMMARY FOOTER: Tổng số */}
              <tfoot>
                <tr className="bg-gray-100 text-gray-900 border-t-2 border-gray-300 font-bold divide-x divide-gray-200">
                  <td className="p-2.5 text-left font-bold text-gray-900 bg-gray-200/70">
                    Tổng số
                  </td>

                  {/* NB: TN & TL */}
                  <td className="p-1 text-center font-mono text-blue-900 bg-blue-50/40">{sumNbTnCount}</td>
                  <td className="p-1 text-center font-mono text-blue-900 bg-blue-50/40">{sumNbTnScore}</td>
                  <td className="p-1 text-center font-mono text-blue-900 bg-blue-50/40">{sumNbTlCount}</td>
                  <td className="p-1 text-center font-mono text-blue-900 bg-blue-50/40">{sumNbTlScore}</td>

                  {/* TH: TN & TL */}
                  <td className="p-1 text-center font-mono text-emerald-900 bg-emerald-50/40">{sumThTnCount}</td>
                  <td className="p-1 text-center font-mono text-emerald-900 bg-emerald-50/40">{sumThTnScore}</td>
                  <td className="p-1 text-center font-mono text-emerald-900 bg-emerald-50/40">{sumThTlCount}</td>
                  <td className="p-1 text-center font-mono text-emerald-900 bg-emerald-50/40">{sumThTlScore}</td>

                  {/* VDT: TN & TL */}
                  <td className="p-1 text-center font-mono text-amber-900 bg-amber-50/40">{sumVdtTnCount}</td>
                  <td className="p-1 text-center font-mono text-amber-900 bg-amber-50/40">{sumVdtTnScore}</td>
                  <td className="p-1 text-center font-mono text-amber-900 bg-amber-50/40">{sumVdtTlCount}</td>
                  <td className="p-1 text-center font-mono text-amber-900 bg-amber-50/40">{sumVdtTlScore}</td>

                  {/* VDC: TN & TL */}
                  <td className="p-1 text-center font-mono text-purple-900 bg-purple-50/40">{sumVdcTnCount}</td>
                  <td className="p-1 text-center font-mono text-purple-900 bg-purple-50/40">{sumVdcTnScore}</td>
                  <td className="p-1 text-center font-mono text-purple-900 bg-purple-50/40">{sumVdcTlCount}</td>
                  <td className="p-1 text-center font-mono text-purple-900 bg-purple-50/40">{sumVdcTlScore}</td>

                  {/* GRAND TOTAL */}
                  <td className="p-1.5 text-center bg-gray-200 text-gray-900 font-extrabold text-xs">
                    <div>{totalQuestions} câu</div>
                    <div className={Math.abs(totalPoints - 10) < 0.01 ? 'text-green-700' : 'text-amber-700'}>
                      {totalPoints} đ
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </form>
      </Modal>

      {/* ─── MODAL CHỌN CHỦ ĐỀ TỪ NGÂN HÀNG CÂU HỎI ─── */}
      <Modal
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        title={
          <div className="flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-emerald-600" />
            <span className="font-bold text-gray-900">Chọn danh mục / chủ đề từ Ngân hàng câu hỏi</span>
          </div>
        }
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-gray-600">
              Đã chọn: <strong className="text-emerald-700 font-bold">{selectedCount}</strong> chủ đề
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setIsPickerOpen(false)}>
                Đóng
              </Button>
              <Button
                onClick={handleAddBulkTopics}
                disabled={selectedCount === 0}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Check className="h-4 w-4 mr-1.5" />
                Thêm {selectedCount > 0 ? `(${selectedCount})` : ''} vào ma trận
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm lĩnh vực, chủ đề bài học..."
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
            {pickerSearch && (
              <button
                type="button"
                onClick={() => setPickerSearch('')}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* List Domains & Topics */}
          {isLoadingDomains ? (
            <div className="py-8 text-center text-xs text-gray-500">Đang tải danh mục từ ngân hàng câu hỏi...</div>
          ) : filteredDomains.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-500 space-y-2">
              <BookOpen className="h-8 w-8 text-gray-300 mx-auto" />
              <p className="font-medium text-gray-600">
                {domains.length === 0
                  ? 'Chưa có danh mục nào trong ngân hàng câu hỏi.'
                  : 'Không tìm thấy chủ đề nào phù hợp từ khóa.'}
              </p>
              <p className="text-gray-400 text-[11px]">
                Bạn có thể tạo thêm danh mục trong mục "Ngân hàng câu hỏi" hoặc bấm "Thêm chủ đề tùy chỉnh".
              </p>
            </div>
          ) : (
            <div className="max-h-[380px] overflow-y-auto space-y-3 pr-1">
              {filteredDomains.map((d: any) => {
                const hasTopics = d.topics && d.topics.length > 0;
                return (
                  <div key={d.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                    {/* Domain Header */}
                    <div className="flex items-center justify-between px-3.5 py-2.5 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <FolderTree className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="font-bold text-gray-800 text-xs">{d.name}</span>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-semibold">
                          {d.question_count} câu hỏi
                        </span>
                      </div>

                      {hasTopics ? (
                        <button
                          type="button"
                          onClick={() => handleSelectAllInDomain(d)}
                          className="text-[11px] font-medium text-emerald-700 hover:text-emerald-900 cursor-pointer"
                        >
                          Chọn tất cả ({d.topics.length})
                        </button>
                      ) : (
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-700">
                          <input
                            type="checkbox"
                            checked={Boolean(selectedTopicsMap[`domain_${d.id}`])}
                            onChange={() => handleTogglePickerTopic(`domain_${d.id}`, d.name, undefined, d.id)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>Chọn</span>
                        </label>
                      )}
                    </div>

                    {/* Topics under Domain */}
                    {hasTopics && (
                      <div className="p-2.5 divide-y divide-gray-100">
                        {d.topics.map((t: any) => {
                          const key = `topic_${t.id}`;
                          const isSelected = Boolean(selectedTopicsMap[key]);
                          const isAlreadyInMatrix = topicRows.some(
                            (r) => r.topic_id === t.id || r.topic_name.trim() === t.name.trim()
                          );
                          return (
                            <label
                              key={t.id}
                              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                                isSelected ? 'bg-emerald-50/70 text-emerald-900 font-medium' : 'hover:bg-gray-50 text-gray-700'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleTogglePickerTopic(key, t.name, t.id, d.id)}
                                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                                />
                                <span className="text-xs">{t.name}</span>
                                {isAlreadyInMatrix && (
                                  <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                    Đã có trong ma trận
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] font-mono text-gray-500">
                                {t.question_count} câu
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
