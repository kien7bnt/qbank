import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, Sparkles, FileText, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { questionApi, curriculumApi, apiClient, getErrorMessage } from '@/services/api';

interface ImportQuestionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SAMPLE_TEXT = `Câu 1: Cho hàm số y = x^4 - 2x^2 + 1. Điểm cực đại của đồ thị hàm số là:
A. (0; 1)
B. (1; 0)
C. (-1; 0)
D. (0; 0)
Đáp án: A
Giải thích: y' = 4x^3 - 4x = 0 <=> x=0, x=1, x=-1. Tại x=0 là điểm cực đại y(0)=1.

Câu 2: Số nghiệm của phương trình log_2(x - 1) = 3 là:
A. 1
B. 2
C. 3
D. 0
Đáp án: A
Giải thích: x - 1 = 2^3 = 8 => x = 9 (thỏa mãn x > 1).`;

export function ImportQuestionsModal({ open, onOpenChange }: ImportQuestionsModalProps) {
  const qc = useQueryClient();
  const [rawText, setRawText] = useState(SAMPLE_TEXT);

  const importMutation = useMutation({
    mutationFn: async () => {
      // Split questions by "Câu "
      const chunks = rawText.split(/(?=Câu\s+\d+[:.])/i).filter((c) => c.trim().length > 0);
      let successCount = 0;

      for (const chunk of chunks) {
        // Parse stem, options, correct answer
        const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length === 0) continue;

        const stemLine = lines[0].replace(/^Câu\s+\d+[:.]\s*/i, '');
        const options = [];
        let correctLabel = 'A';
        let rationale = '';

        for (const line of lines.slice(1)) {
          const matchOpt = line.match(/^([A-D])[\.\)]\s*(.*)/i);
          if (matchOpt) {
            options.push({
              label: matchOpt[1].toUpperCase(),
              text: matchOpt[2],
              is_correct: false,
            });
          }
          const matchAns = line.match(/^Đáp án[:\s]*([A-D])/i);
          if (matchAns) {
            correctLabel = matchAns[1].toUpperCase();
          }
          const matchExp = line.match(/^Giải thích[:\s]*(.*)/i);
          if (matchExp) {
            rationale = matchExp[1];
          }
        }

        // Set correct option
        options.forEach((o) => {
          if (o.label === correctLabel) o.is_correct = true;
        });

        if (options.length === 0) {
          // Default 4 fallback options if not parsed
          options.push(
            { label: 'A', text: 'Phương án A', is_correct: true },
            { label: 'B', text: 'Phương án B', is_correct: false },
            { label: 'C', text: 'Phương án C', is_correct: false },
            { label: 'D', text: 'Phương án D', is_correct: false }
          );
        }

        await questionApi.create({
          type: 'mcq',
          stem: stemLine || chunk.slice(0, 100),
          rationale: rationale || undefined,
          bloom_level: 'understand',
          expected_difficulty: 'medium',
          options,
        });
        successCount++;
      }

      return successCount;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['questions'] });
      toast.success(`✨ Đã nhập thành công ${count} câu hỏi vào ngân hàng!`);
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary-600" />
          <span>Import Câu Hỏi Hàng Loạt</span>
        </div>
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            loading={importMutation.isPending}
            onClick={() => importMutation.mutate()}
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            Tự động bóc tách & Import
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dán văn bản câu hỏi (Hỗ trợ định dạng Word / Text)
          </label>
          <Textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={10}
            className="font-mono text-xs"
            placeholder="Dán nội dung câu hỏi dạng Câu 1:... A... B... C... D... Đáp án:..."
          />
        </div>
      </div>
    </Modal>
  );
}
