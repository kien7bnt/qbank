import { useState } from 'react';
import { Plus, Upload, Sparkles, Copy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { QuestionTable } from './QuestionTable';
import { CreateQuestionModal } from './CreateQuestionModal';
import { ImportQuestionsModal } from './ImportQuestionsModal';
import { DuplicateScannerModal } from './DuplicateScannerModal';
import { QuestionDetailDrawer } from './QuestionDetailDrawer';
import { AIGenerationModal } from '@/features/ai/AIGenerationModal';
import type { QuestionFilter } from '@/types';

type Segment = 'all' | 'unscaled' | 'scaled';

export function QuestionBankPage() {
  const [segment, setSegment] = useState<Segment>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [filter, setFilter] = useState<QuestionFilter>({ page: 1, page_size: 20 });

  const handleFilterChange = (updates: Partial<QuestionFilter>) => {
    setFilter((f) => ({ ...f, ...updates, page: 1 }));
  };

  return (
    <div className="flex h-full">
      {/* Questions */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="shrink-0 border-b border-gray-200 bg-white px-5 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold text-gray-900">Ngân hàng câu hỏi</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Copy className="h-4 w-4 text-gray-500" />}
                onClick={() => setShowDuplicates(true)}
              >
                Quét trùng
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Sparkles className="h-4 w-4 text-purple-500" />}
                className="text-purple-600 hover:bg-purple-50"
                onClick={() => setShowAI(true)}
              >
                Tạo bằng AI
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Upload className="h-4 w-4" />}
                onClick={() => setShowImport(true)}
              >
                Import
              </Button>
              <Button
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => setShowCreate(true)}
              >
                Tạo câu hỏi
              </Button>
            </div>
          </div>

          {/* Segment tabs */}
          <div className="mt-3 flex gap-0.5 bg-gray-100 rounded-lg p-0.5 w-fit">
            {(['all', 'unscaled', 'scaled'] as Segment[]).map((s) => (
              <button
                key={s}
                onClick={() => setSegment(s)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  segment === s
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {s === 'all' ? 'Tất cả' : s === 'unscaled' ? 'Chưa định cỡ' : 'Đã định cỡ'}
              </button>
            ))}
          </div>
        </div>

        {/* Question table */}
        <div className="flex-1 overflow-auto">
          <QuestionTable
            filter={filter}
            onFilterChange={handleFilterChange}
            onSelectQuestion={setSelectedQuestionId}
          />
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateQuestionModal
          open={showCreate}
          onOpenChange={setShowCreate}
        />
      )}

      {showImport && (
        <ImportQuestionsModal
          open={showImport}
          onOpenChange={setShowImport}
        />
      )}

      {showDuplicates && (
        <DuplicateScannerModal
          open={showDuplicates}
          onOpenChange={setShowDuplicates}
        />
      )}

      {/* AI Modal */}
      {showAI && (
        <AIGenerationModal
          open={showAI}
          onClose={() => setShowAI(false)}
        />
      )}

      <QuestionDetailDrawer
        questionId={selectedQuestionId}
        onClose={() => setSelectedQuestionId(null)}
      />
    </div>
  );
}
