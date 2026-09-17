import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  Shuffle,
  Users,
  CheckCircle2,
  AlertTriangle,
  Play,
  FileText,
  Eye,
  Percent,
  Cpu,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { PageSpinner } from '@/components/ui/Spinner';
import { examApi, assignmentApi, getErrorMessage } from '@/services/api';
import type { ExamInstance, SimulateInstancesResponse } from '@/types';

interface ExamInstancesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string;
  examName: string;
  assignmentId?: string;
  assignmentName?: string;
  isRandomPerStudent?: boolean;
  questionsPerInstance?: number;
}

export function ExamInstancesModal({
  open,
  onOpenChange,
  examId,
  examName,
  assignmentId,
  assignmentName,
  isRandomPerStudent = true,
  questionsPerInstance,
}: ExamInstancesModalProps) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'instances' | 'simulate'>('instances');
  const [selectedInstance, setSelectedInstance] = useState<ExamInstance | null>(null);

  // Simulation controls
  const [simStudents, setSimStudents] = useState<number>(5);
  const [simSampleSize, setSimSampleSize] = useState<number>(questionsPerInstance || 30);
  const [simMaxOverlap, setSimMaxOverlap] = useState<number>(50);

  // 1. Fetch Real Instances
  const {
    data: instancesData,
    isLoading: loadingInstances,
    refetch: refetchInstances,
  } = useQuery({
    queryKey: ['exam-instances', examId, assignmentId],
    queryFn: async () => {
      if (assignmentId) {
        const res = await assignmentApi.getInstances(assignmentId);
        return res.data;
      }
      const res = await examApi.getInstances(examId);
      return res.data;
    },
    enabled: open && !!examId,
  });

  const instances: ExamInstance[] = instancesData || [];

  // 2. Pre-generate mutation (if assignmentId exists)
  const preGenMutation = useMutation({
    mutationFn: () => assignmentApi.preGenerateInstances(assignmentId!),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['exam-instances', examId, assignmentId] });
      toast.success(res.data.message || 'Đã sinh đề cho cả lớp thành công!');
      refetchInstances();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // 3. Simulation mutation
  const simMutation = useMutation({
    mutationFn: async () => {
      const res = await examApi.simulateInstances(examId, {
        num_students: simStudents,
        sample_size: simSampleSize,
        max_overlap: simMaxOverlap / 100.0,
      });
      return res.data as SimulateInstancesResponse;
    },
    onSuccess: () => {
      toast.success('Mô phỏng thành công!');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const simResult = simMutation.data;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
            <Shuffle className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-gray-900 text-base">
              Quản Lý Đề Thi Theo Từng Học Sinh
            </div>
            <p className="text-xs text-gray-500 font-normal">
              {assignmentName ? `Đợt thi: ${assignmentName}` : `Đề gốc: ${examName}`}
            </p>
          </div>
        </div>
      }
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-gray-500">
            Tổng cộng: <strong className="text-gray-900">{instances.length}</strong> học sinh đã nhận đề
          </span>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-gray-200">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('instances')}
              className={`pb-3 px-3.5 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'instances'
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Users className="h-4 w-4" />
              Danh sách đề học sinh ({instances.length})
            </button>
            <button
              onClick={() => setActiveTab('simulate')}
              className={`pb-3 px-3.5 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'simulate'
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Cpu className="h-4 w-4" />
              Mô phỏng thử nghiệm (Simulation)
            </button>
          </div>

          {assignmentId && activeTab === 'instances' && (
            <Button
              size="sm"
              loading={preGenMutation.isPending}
              onClick={() => preGenMutation.mutate()}
              className="mb-2 bg-purple-600 hover:bg-purple-700"
            >
              <Play className="h-3.5 w-3.5 mr-1" />
              Sinh trước cho cả lớp
            </Button>
          )}
        </div>

        {/* Tab 1: Real Instances List */}
        {activeTab === 'instances' && (
          <div className="space-y-4">
            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-xs text-purple-900 flex items-start gap-2">
              <Info className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <strong>Cơ chế Lazy Generation & Chống trùng:</strong> Đề thi của mỗi học sinh được cố định vĩnh viễn ngay khi học sinh bắt đầu làm bài (hoặc khi giáo viên bấm "Sinh trước cho cả lớp"). Học sinh refresh trang hay thoát ra đăng nhập lại đều nhận đúng đề thi này.
              </div>
            </div>

            {loadingInstances ? (
              <PageSpinner />
            ) : instances.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-2xl">
                <Users className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-700">Chưa có học sinh nào nhận đề</p>
                <p className="text-xs text-gray-400 mt-1">
                  Đề thi sẽ được tự động sinh ngẫu nhiên cho từng em khi các em vào phòng thi, hoặc bạn có thể bấm "Sinh trước cho cả lớp" ở trên.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Học sinh</th>
                      <th className="py-2.5 px-3">Mã đề</th>
                      <th className="py-2.5 px-3">Số câu</th>
                      <th className="py-2.5 px-3">Tỷ lệ trùng max</th>
                      <th className="py-2.5 px-3">Random Seed</th>
                      <th className="py-2.5 px-3 text-right">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {instances.map((inst) => (
                      <tr key={inst.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-gray-900">{inst.student_name}</div>
                          {inst.student_email && (
                            <div className="text-xs text-gray-400">{inst.student_email}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono font-black text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-lg text-xs">
                            {inst.instance_code}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-gray-700">
                          {inst.question_count} câu
                        </td>
                        <td className="py-2.5 px-3">
                          {inst.max_overlap_ratio !== undefined && inst.max_overlap_ratio !== null ? (
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                                inst.max_overlap_ratio <= 0.5
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              {(inst.max_overlap_ratio * 100).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] font-mono text-gray-500 truncate max-w-[140px]">
                          {inst.random_seed}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedInstance(inst)}
                            className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Xem đề
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Simulation */}
        {activeTab === 'simulate' && (
          <div className="space-y-5">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-600">
                Tham số mô phỏng
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Số học sinh thử nghiệm:
                  </label>
                  <Input
                    type="number"
                    min={2}
                    max={20}
                    value={simStudents}
                    onChange={(e) => setSimStudents(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Số câu hỏi mỗi đề:
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={simSampleSize}
                    onChange={(e) => setSimSampleSize(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Tỷ lệ trùng tối đa cho phép (%):
                  </label>
                  <Input
                    type="number"
                    min={10}
                    max={100}
                    value={simMaxOverlap}
                    onChange={(e) => setSimMaxOverlap(Number(e.target.value))}
                  />
                </div>
              </div>

              <Button
                loading={simMutation.isPending}
                onClick={() => simMutation.mutate()}
                className="w-full bg-purple-600 hover:bg-purple-700 mt-2"
              >
                <Cpu className="h-4 w-4 mr-1.5" />
                Chạy mô phỏng bốc đề ngẫu nhiên
              </Button>
            </div>

            {simResult && (
              <div className="space-y-4 pt-2">
                {/* Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-white border border-gray-200 rounded-xl">
                    <p className="text-[11px] text-gray-500 font-semibold uppercase">Tổng câu nguồn</p>
                    <p className="text-xl font-bold text-gray-900 mt-0.5">{simResult.pool_size} câu</p>
                  </div>
                  <div className="p-3 bg-white border border-gray-200 rounded-xl">
                    <p className="text-[11px] text-gray-500 font-semibold uppercase">Số câu mỗi đề</p>
                    <p className="text-xl font-bold text-purple-700 mt-0.5">{simResult.sample_size} câu</p>
                  </div>
                  <div className="p-3 bg-white border border-gray-200 rounded-xl">
                    <p className="text-[11px] text-gray-500 font-semibold uppercase">Trùng max quan sát</p>
                    <p className="text-xl font-bold text-emerald-600 mt-0.5">{simResult.max_overlap_observed}%</p>
                  </div>
                  <div className="p-3 bg-white border border-gray-200 rounded-xl">
                    <p className="text-[11px] text-gray-500 font-semibold uppercase">Trùng trung bình</p>
                    <p className="text-xl font-bold text-blue-600 mt-0.5">{simResult.average_overlap_observed}%</p>
                  </div>
                </div>

                {/* Overlap Matrix */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600">
                      Ma trận tỷ lệ trùng lặp (%) giữa các học sinh
                    </h4>
                    <span className="text-[11px] text-gray-500">
                      Ngưỡng cho phép: &le; <strong>{simResult.max_overlap_configured}%</strong>
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="w-full text-center text-xs">
                      <thead className="bg-gray-100 font-bold text-gray-700">
                        <tr>
                          <th className="p-2 border-r border-b border-gray-200 text-left">Đề / Học sinh</th>
                          {simResult.students.map((s, idx) => (
                            <th key={idx} className="p-2 border-b border-gray-200 font-mono">
                              {s.instance_code}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {simResult.overlap_matrix.map((row, rIdx) => (
                          <tr key={rIdx}>
                            <td className="p-2 border-r border-gray-200 bg-gray-50 font-semibold text-gray-900 text-left">
                              {simResult.students[rIdx].student_label} ({simResult.students[rIdx].instance_code})
                            </td>
                            {row.map((val, cIdx) => (
                              <td
                                key={cIdx}
                                className={`p-2 font-mono font-semibold ${
                                  rIdx === cIdx
                                    ? 'bg-gray-100 text-gray-400'
                                    : val <= simResult.max_overlap_configured
                                    ? 'bg-emerald-50/70 text-emerald-800'
                                    : 'bg-red-50 text-red-700'
                                }`}
                              >
                                {rIdx === cIdx ? '—' : `${val}%`}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Sample students question breakdown */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600">
                    Danh sách câu hỏi mẫu được chọn cho từng học sinh
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {simResult.students.map((s) => (
                      <div key={s.student_index} className="p-3 bg-purple-50/50 border border-purple-200 rounded-xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-purple-900 text-xs">{s.student_label}</span>
                          <span className="font-mono text-[11px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                            {s.instance_code} ({s.question_count} câu)
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-600 space-y-1">
                          {s.sample_questions.map((stem, qIdx) => (
                            <div key={qIdx} className="truncate">
                              &bull; Câu {qIdx + 1}: {stem}...
                            </div>
                          ))}
                          {s.question_count > 5 && (
                            <div className="text-gray-400 italic">...và {s.question_count - 5} câu khác</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detail Modal for Selected Student Instance */}
      {selectedInstance && (
        <Modal
          open={!!selectedInstance}
          onOpenChange={() => setSelectedInstance(null)}
          title={`Chi tiết đề thi: ${selectedInstance.student_name} (${selectedInstance.instance_code})`}
          size="lg"
          footer={
            <Button variant="secondary" onClick={() => setSelectedInstance(null)}>
              Đóng
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2.5 p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs">
              <div>
                <span className="text-gray-500">Mã đề:</span>
                <p className="font-mono font-bold text-purple-900">{selectedInstance.instance_code}</p>
              </div>
              <div>
                <span className="text-gray-500">Số lượng câu:</span>
                <p className="font-bold text-gray-900">{selectedInstance.question_count} câu</p>
              </div>
              <div>
                <span className="text-gray-500">Random Seed:</span>
                <p className="font-mono text-[10px] text-gray-700 truncate">{selectedInstance.random_seed}</p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600">
                Danh sách câu hỏi trong đề này ({selectedInstance.question_ids.length} câu)
              </h4>
              <div className="max-h-80 overflow-y-auto space-y-2 p-1">
                {selectedInstance.question_ids.map((qid, idx) => (
                  <div
                    key={qid}
                    className="p-2.5 bg-white border border-gray-200 rounded-lg flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                        Câu {idx + 1}
                      </span>
                      <span className="font-mono text-gray-600">{qid}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
