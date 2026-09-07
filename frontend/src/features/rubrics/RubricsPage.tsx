import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardCheck,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronRight,
  Award,
  Layers,
  Percent,
  CheckCircle2,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { rubricApi, getErrorMessage } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { PageSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Rubric, RubricCreate } from '@/types';

const TEMPLATE_ESSAY_GENERAL: RubricCreate = {
  name: 'Tiêu chuẩn Đánh giá Bài Tự Luận Tổng Hợp',
  description: 'Khung đánh giá chuẩn mực dùng cho AI tự động chấm các bài tự luận, đối chiếu dẫn chứng và lập luận.',
  is_public: true,
  criteria: [
    {
      name: 'Nội dung & Tính đúng đắn của luận điểm',
      description: 'Đánh giá mức độ bao quát kiến thức và độ chính xác của các luận điểm nêu ra so với yêu cầu đề bài.',
      weight: 40,
      max_score: 4,
      levels: [
        { score: 4, level_name: '1', description: 'Đáp ứng đầy đủ, chính xác mọi yêu cầu cốt lõi; có hiểu biết sâu sắc và mở rộng liên hệ thực tế.' },
        { score: 3, level_name: '2', description: 'Nắm vững các luận điểm chính, lập luận đúng hướng nhưng đôi chỗ chưa đào sâu.' },
        { score: 2, level_name: '3', description: 'Nêu được một số ý cơ bản nhưng còn thiếu sót hoặc có một vài nhầm lẫn nhỏ.' },
        { score: 1, level_name: '4', description: 'Nội dung sơ sài, sai lệch trọng tâm hoặc không trả lời đúng câu hỏi.' },
      ],
    },
    {
      name: 'Lập luận, Dẫn chứng & Tính thuyết phục',
      description: 'Khả năng phân tích, đưa ra bằng chứng thực tế hoặc dữ liệu thuyết phục hỗ trợ cho luận điểm.',
      weight: 35,
      max_score: 3.5,
      levels: [
        { score: 3.5, level_name: '1', description: 'Lập luận logic chặt chẽ, dẫn chứng cụ thể, phân tích sắc sảo và rõ ràng.' },
        { score: 2.5, level_name: '2', description: 'Có dẫn chứng và lập luận tương đối rõ ràng, tính thuyết phục tốt.' },
        { score: 1.5, level_name: '3', description: 'Có dẫn chứng nhưng còn chung chung, lập luận đôi lúc rời rạc.' },
        { score: 0.5, level_name: '4', description: 'Không có dẫn chứng hoặc lập luận cảm tính, thiếu căn cứ logic.' },
      ],
    },
    {
      name: 'Trình bày, Ngữ pháp & Diễn đạt',
      description: 'Cấu trúc bài viết mạch lạc, câu từ chuẩn xác, không lỗi chính tả hoặc diễn đạt lủng củng.',
      weight: 25,
      max_score: 2.5,
      levels: [
        { score: 2.5, level_name: '1', description: 'Văn phong mạch lạc, cấu trúc rõ ràng, dùng từ chuẩn xác, không lỗi chính tả.' },
        { score: 2.0, level_name: '2', description: 'Trình bày tốt, cấu trúc đoạn rõ ràng, có thể có 1-2 lỗi ngữ pháp nhỏ.' },
        { score: 1.0, level_name: '3', description: 'Diễn đạt tạm ổn nhưng câu văn đôi chỗ rườm rà hoặc mắc lỗi chính tả.' },
        { score: 0.5, level_name: '4', description: 'Trình bày cẩu thả, nhiều lỗi chính tả, câu văn khó hiểu.' },
      ],
    },
  ],
};

type EditableLevel = {
  score: number | string;
  level_name: string;
  description: string;
  order_index?: number;
};

type EditableCriterion = {
  name: string;
  description?: string;
  weight: number | string;
  max_score: number | string;
  levels: EditableLevel[];
};

export function RubricsPage() {
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRubricId, setExpandedRubricId] = useState<string | null>(null);

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRubric, setEditingRubric] = useState<Rubric | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [criteria, setCriteria] = useState<EditableCriterion[]>([
    {
      name: 'Nội dung kiến thức',
      description: 'Đánh giá độ chính xác và tính toàn diện của nội dung kiến thức',
      weight: 30,
      max_score: 3.0,
      levels: [
        { score: 3.0, level_name: '1', description: 'Trình bày chính xác, đầy đủ và sâu sắc...' },
        { score: 2.0, level_name: '2', description: 'Đủ ý chính, lập luận đúng hướng...' },
        { score: 1.0, level_name: '3', description: 'Thiếu một vài ý cơ bản...' },
        { score: 0.5, level_name: '4', description: 'Nội dung sơ sài, sai lệch...' },
      ],
    },
  ]);

  // Fetch rubrics
  const { data: rubrics = [], isLoading } = useQuery<Rubric[]>({
    queryKey: ['rubrics'],
    queryFn: async () => {
      const res = await rubricApi.list();
      return res.data || [];
    },
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (payload: RubricCreate) => rubricApi.create(payload),
    onSuccess: () => {
      toast.success('Tạo Rubric thành công!');
      qc.invalidateQueries({ queryKey: ['rubrics'] });
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<RubricCreate> }) =>
      rubricApi.update(id, payload),
    onSuccess: () => {
      toast.success('Cập nhật Rubric thành công!');
      qc.invalidateQueries({ queryKey: ['rubrics'] });
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => rubricApi.delete(id),
    onSuccess: () => {
      toast.success('Đã xóa Rubric!');
      qc.invalidateQueries({ queryKey: ['rubrics'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setEditingRubric(null);
    setCriteria([
      {
        name: 'Nội dung kiến thức',
        description: 'Đánh giá độ chính xác và tính toàn diện của nội dung kiến thức',
        weight: 30,
        max_score: 3.0,
        levels: [
          { score: 3.0, level_name: '1', description: 'Trình bày chính xác, đầy đủ và sâu sắc...' },
          { score: 2.0, level_name: '2', description: 'Đủ ý chính, lập luận đúng hướng...' },
          { score: 1.0, level_name: '3', description: 'Thiếu một vài ý cơ bản...' },
          { score: 0.5, level_name: '4', description: 'Nội dung sơ sài, sai lệch...' },
        ],
      },
    ]);
  };

  const handleOpenEdit = (rubric: Rubric) => {
    setEditingRubric(rubric);
    setName(rubric.name);
    setDescription(rubric.description || '');
    setCriteria(
      rubric.criteria.map((c) => ({
        name: c.name,
        description: c.description,
        weight: c.weight,
        max_score: c.max_score,
        levels: c.levels.map((l, lIdx) => ({
          score: l.score,
          level_name: (l.level_name || '').replace(/^Mức\s*/i, '').trim() || `${lIdx + 1}`,
          description: l.description,
        })),
      }))
    );
    setIsCreateModalOpen(true);
  };

  const handleApplyTemplate = (tmpl: RubricCreate) => {
    setName(tmpl.name);
    setDescription(tmpl.description || '');
    setCriteria(JSON.parse(JSON.stringify(tmpl.criteria)));
  };

  const handleAddCriterion = () => {
    const nextIdx = criteria.length + 1;
    setCriteria([
      ...criteria,
      {
        name: `Tiêu chí ${nextIdx}`,
        description: '',
        weight: 20,
        max_score: 3.0,
        levels: [
          { score: 3.0, level_name: '1', description: 'Trình bày chính xác, đầy đủ và sâu sắc...' },
          { score: 2.0, level_name: '2', description: 'Đủ ý chính, đúng hướng...' },
          { score: 1.0, level_name: '3', description: 'Thiếu một vài ý cơ bản...' },
          { score: 0.5, level_name: '4', description: 'Nội dung sơ sài...' },
        ],
      },
    ]);
  };

  const handleRemoveCriterion = (index: number) => {
    setCriteria(criteria.filter((_, idx) => idx !== index));
  };

  const handleUpdateLevel = (cIdx: number, lIdx: number, field: keyof EditableLevel, val: any) => {
    const next = [...criteria];
    const lvls = [...next[cIdx].levels];
    lvls[lIdx] = { ...lvls[lIdx], [field]: val };
    next[cIdx].levels = lvls;
    setCriteria(next);
  };

  const handleAddLevel = (cIdx: number) => {
    const next = [...criteria];
    const lvls = [...next[cIdx].levels];
    const nextLevelNum = lvls.length + 1;
    lvls.push({
      score: 0,
      level_name: `${nextLevelNum}`,
      description: '',
    });
    next[cIdx].levels = lvls;
    setCriteria(next);
  };

  const handleRemoveLevel = (cIdx: number, lIdx: number) => {
    const next = [...criteria];
    const filtered = next[cIdx].levels.filter((_, idx) => idx !== lIdx);
    const allNumeric = filtered.every((l) => /^\d+$/.test(l.level_name.trim()));
    if (allNumeric) {
      filtered.forEach((l, idx) => {
        l.level_name = `${idx + 1}`;
      });
    }
    next[cIdx].levels = filtered;
    setCriteria(next);
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Vui lòng nhập tên Rubric');
      return;
    }
    if (criteria.length === 0) {
      toast.error('Cần ít nhất một tiêu chí đánh giá');
      return;
    }

    const payload: RubricCreate = {
      name: name.trim(),
      description: description.trim(),
      is_public: true,
      criteria: criteria.map((c) => ({
        ...c,
        max_score: Number(c.max_score) || 0,
        weight: Number(c.weight) || 0,
        levels: (c.levels || []).map((l: any) => ({
          ...l,
          score: Number(l.score) || 0,
        })),
      })),
    };

    if (editingRubric) {
      updateMutation.mutate({ id: editingRubric.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filteredRubrics = rubrics.filter((r) =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Rubric / Tiêu chí Chấm Tự Luận
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Khung tiêu chí chuẩn hóa để AI tự động chấm bài tự luận của học sinh, trích xuất dẫn chứng và tính điểm tất định.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              resetForm();
              setIsCreateModalOpen(true);
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Tạo Rubric Mới
          </Button>
        </div>
      </div>

      {/* Info Callout */}
      <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
        <div className="text-xs text-purple-900 leading-relaxed space-y-1">
          <p className="font-semibold text-purple-950">
            Cơ chế Chấm Tự Luận Tự Động bằng Trí Tuệ Nhân Tạo (AI Co-Scoring):
          </p>
          <p>
            Khác với trắc nghiệm và lập trình được chấm tự động mặc định, các câu hỏi <strong>Tự luận (Essay)</strong> được AI đối chiếu bài làm học sinh với đáp án mẫu và từng tiêu chí trong Rubric. AI trích xuất dẫn chứng cụ thể từ câu trả lời của học sinh, đề xuất điểm số theo mức đạt được, và giáo viên có toàn quyền kiểm duyệt trước khi lưu điểm chính thức.
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
        <Search className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
        <input
          type="text"
          placeholder="Tìm kiếm rubric theo tên, mô tả..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-sm bg-transparent border-none outline-hidden text-gray-900 placeholder:text-gray-400"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
          >
            Xóa
          </button>
        )}
      </div>

      {/* Rubrics List */}
      {isLoading ? (
        <PageSpinner />
      ) : filteredRubrics.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <EmptyState
            title="Chưa có Rubric nào"
            description="Tạo bộ tiêu chí đầu tiên hoặc sử dụng mẫu gợi ý để bắt đầu chấm tự luận tự động bằng AI."
            action={
              <Button
                onClick={() => {
                  resetForm();
                  setIsCreateModalOpen(true);
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Tạo Rubric Mới
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredRubrics.map((rubric) => {
            const isExpanded = expandedRubricId === rubric.id;
            const totalMaxScore = rubric.criteria.reduce((acc, c) => acc + (c.max_score || 0), 0);

            return (
              <div
                key={rubric.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-2xs hover:shadow-xs transition overflow-hidden"
              >
                {/* Header Row */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      onClick={() => setExpandedRubricId(isExpanded ? null : rubric.id)}
                      className="mt-0.5 p-1 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 transition"
                      aria-label="Mở rộng chi tiết"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-purple-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-gray-900 tracking-tight">
                          {rubric.name}
                        </h3>
                        <Badge variant="purple" className="text-[11px] font-semibold">
                          <Sparkles className="w-3 h-3 mr-1" />
                          AI Auto-Grade
                        </Badge>
                        {rubric.subject_name && (
                          <span className="text-xs text-gray-500 font-medium">
                            • {rubric.subject_name}
                          </span>
                        )}
                      </div>
                      {rubric.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {rubric.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 sm:self-center self-end">
                    <div className="text-right">
                      <div className="text-xs text-gray-400 uppercase font-bold tracking-wider">
                        {rubric.criteria.length} tiêu chí
                      </div>
                      <div className="text-sm font-bold text-gray-900 font-mono">
                        Tổng điểm: {totalMaxScore.toFixed(1)}đ
                      </div>
                    </div>

                    <div className="flex items-center gap-1 border-l border-gray-200 pl-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(rubric)}
                        className="text-gray-600 hover:text-purple-600"
                        title="Chỉnh sửa Rubric"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Bạn có chắc chắn muốn xóa Rubric "${rubric.name}"?`)) {
                            deleteMutation.mutate(rubric.id);
                          }
                        }}
                        className="text-gray-400 hover:text-rose-600"
                        title="Xóa Rubric"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Expanded Criteria Table */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50/50 p-4 sm:p-5 space-y-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-purple-600" />
                      Bảng Chi Tiết Tiêu Chí & Các Mức Điểm (Levels)
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {rubric.criteria.map((crit, cIdx) => (
                        <div
                          key={cIdx}
                          className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-2xs space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2">
                            <div>
                              <p className="text-xs font-bold text-gray-900">{crit.name}</p>
                              {crit.description && (
                                <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">
                                  {crit.description}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs font-bold text-purple-700 font-mono">
                                {crit.max_score}đ
                              </span>
                              <span className="block text-[10px] text-gray-400">
                                Trọng số: {crit.weight}%
                              </span>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            {crit.levels.map((lvl, lIdx) => (
                              <div
                                key={lIdx}
                                className="p-2 rounded-lg bg-gray-50 border border-gray-100 flex items-start justify-between gap-2 text-xs"
                              >
                                <div className="space-y-0.5 min-w-0">
                                  <span className="font-semibold text-gray-800 text-[11px]">
                                    {lvl.level_name}
                                  </span>
                                  <p className="text-[11px] text-gray-600 leading-tight">
                                    {lvl.description}
                                  </p>
                                </div>
                                <span className="font-mono font-bold text-gray-700 text-xs shrink-0">
                                  {lvl.score}đ
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Rubric Modal */}
      <Modal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        size="xl"
        title={
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-purple-600" />
            <span className="font-bold text-gray-900">
              {editingRubric ? 'Chỉnh Sửa Rubric Chấm Tự Luận' : 'Tạo Rubric Chấm Tự Luận Mới'}
            </span>
          </div>
        }
        description="Định nghĩa các tiêu chí, trọng số và mức điểm để AI tự động đánh giá bài tự luận."
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleApplyTemplate(TEMPLATE_ESSAY_GENERAL)}
              className="text-purple-700 border-purple-200 hover:bg-purple-50"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
              Tải Mẫu Chuẩn AI
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Hủy
              </Button>
              <Button
                onClick={handleSave}
                loading={createMutation.isPending || updateMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {editingRubric ? 'Lưu Thay Đổi' : 'Tạo Rubric'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Tên Rubric <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="VD: Tiêu chí chấm bài luận văn học / Kỹ thuật..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Mô tả chi tiết
              </label>
              <Input
                placeholder="Mô tả mục đích sử dụng khung tiêu chuẩn chấm..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Danh Sách Tiêu Chí Đánh Giá ({criteria.length})
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCriterion}
                className="text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Thêm tiêu chí
              </Button>
            </div>

            <div className="space-y-6">
              {criteria.map((crit, cIdx) => (
                <div
                  key={cIdx}
                  className="p-5 rounded-2xl border-2 border-purple-200/90 bg-white shadow-xs space-y-4"
                >
                  {/* TIÊU CHÍ HEADER */}
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                    <span className="text-xs font-black uppercase tracking-wider text-purple-900 bg-purple-100 px-3 py-1 rounded-lg">
                      TIÊU CHÍ {cIdx + 1}
                    </span>
                    {criteria.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCriterion(cIdx)}
                        className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1 font-medium hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        title="Xóa tiêu chí này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Xóa tiêu chí
                      </button>
                    )}
                  </div>

                  {/* Form fields: Tên tiêu chí & Điểm tối đa */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-8">
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                        Tên tiêu chí <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        value={crit.name}
                        onChange={(e) => {
                          const next = [...criteria];
                          next[cIdx].name = e.target.value;
                          setCriteria(next);
                        }}
                        placeholder="VD: Nội dung kiến thức..."
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                        Điểm tối đa
                      </label>
                      <Input
                        type="number"
                        step="0.5"
                        value={crit.max_score === '' ? '' : (crit.max_score ?? '')}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const val = e.target.value;
                          const next = [...criteria];
                          next[cIdx].max_score = val === '' ? '' : (isNaN(parseFloat(val)) ? '' : parseFloat(val));
                          setCriteria(next);
                        }}
                        placeholder="VD: 3.0"
                      />
                    </div>
                  </div>

                  {/* Hướng dẫn tiêu chí */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                      Mô tả / Hướng dẫn đánh giá tiêu chí (Tùy chọn cho AI)
                    </label>
                    <Input
                      value={crit.description || ''}
                      onChange={(e) => {
                        const next = [...criteria];
                        next[cIdx].description = e.target.value;
                        setCriteria(next);
                      }}
                      placeholder="VD: Đánh giá độ chính xác và tính toàn diện của nội dung..."
                    />
                  </div>

                  {/* BẢNG CÁC MỨC ĐẠT ĐIỂM (LEVELS TABLE) */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                        Bảng phân mức đạt điểm ({crit.levels.length} mức):
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddLevel(cIdx)}
                        className="text-[11px] font-semibold text-purple-700 hover:text-purple-800 flex items-center gap-1 px-2.5 py-1 rounded hover:bg-purple-50 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Thêm mức điểm
                      </button>
                    </div>

                    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3 w-20 sm:w-24 text-center">Mức</th>
                            <th className="py-2.5 px-3 w-24 sm:w-28">Điểm</th>
                            <th className="py-2.5 px-3">Mô tả</th>
                            <th className="py-2.5 px-2 w-8 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {crit.levels.map((lvl, lIdx) => (
                            <tr key={lIdx} className="hover:bg-purple-50/20 transition-colors">
                              <td className="p-2 w-20 sm:w-24">
                                <input
                                  type="text"
                                  value={lvl.level_name}
                                  onChange={(e) => handleUpdateLevel(cIdx, lIdx, 'level_name', e.target.value)}
                                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-center text-gray-800 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                                  placeholder={`${lIdx + 1}`}
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  step="0.25"
                                  value={lvl.score === '' ? '' : (lvl.score ?? '')}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    handleUpdateLevel(cIdx, lIdx, 'score', val === '' ? '' : (isNaN(parseFloat(val)) ? '' : parseFloat(val)));
                                  }}
                                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-mono font-bold text-purple-700 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                                  placeholder="0.0"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={lvl.description}
                                  onChange={(e) => handleUpdateLevel(cIdx, lIdx, 'description', e.target.value)}
                                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                                  placeholder="Mô tả tiêu chuẩn đạt mức này (VD: Trình bày chính xác, đầy đủ...)"
                                />
                              </td>
                              <td className="p-2 text-center">
                                {crit.levels.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveLevel(cIdx, lIdx)}
                                    className="p-1 text-gray-400 hover:text-rose-500 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="Xóa mức này"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Nút Xóa tiêu chí căn giữa như mockup */}
                  {criteria.length > 1 && (
                    <div className="flex justify-center pt-2">
                      <button
                        type="button"
                        onClick={() => handleRemoveCriterion(cIdx)}
                        className="px-4 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:text-rose-600 hover:border-rose-300 bg-white hover:bg-rose-50 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        [ Xóa tiêu chí ]
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
