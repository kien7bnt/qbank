import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Upload, Sparkles, Copy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { QuestionTable } from './QuestionTable';
import { FolderTreeSidebar, type SelectedFolder } from './FolderTreeSidebar';
import { CreateQuestionModal } from './CreateQuestionModal';
import { ImportQuestionsModal } from './ImportQuestionsModal';
import { DuplicateScannerModal } from './DuplicateScannerModal';
import { QuestionDetailDrawer } from './QuestionDetailDrawer';
import { AIGenerationModal } from '@/features/ai/AIGenerationModal';
import { questionApi } from '@/services/api';
import type { QuestionFilter } from '@/types';

type Segment = 'all' | 'unscaled' | 'scaled';

export function QuestionBankPage() {
  const [segment, setSegment] = useState<Segment>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  // Selected folder from sidebar
  const [selectedFolder, setSelectedFolder] = useState<SelectedFolder | null>(null);

  const [filter, setFilter] = useState<QuestionFilter>({ page: 1, page_size: 20 });

  // Query global total count for "Tất cả câu hỏi"
  const { data: allQuestionsData } = useQuery({
    queryKey: ['questions-global-count'],
    queryFn: () => questionApi.list({ page: 1, page_size: 1 }),
  });
  const globalTotalQuestions = allQuestionsData?.data?.total ?? 0;

  const handleFilterChange = (updates: Partial<QuestionFilter>) => {
    setFilter((f) => ({ ...f, ...updates, page: 1 }));
  };

  const handleSelectFolder = (folder: SelectedFolder | null) => {
    setSelectedFolder(folder);
    if (!folder) {
      setFilter((f) => ({
        ...f,
        chapter_id: undefined,
        topic_id: undefined,
        page: 1,
      }));
    } else if (folder.type === 'domain') {
      setFilter((f) => ({
        ...f,
        chapter_id: folder.id,
        topic_id: undefined,
        page: 1,
      }));
    } else if (folder.type === 'topic') {
      setFilter((f) => ({
        ...f,
        chapter_id: folder.parentId,
        topic_id: folder.id,
        page: 1,
      }));
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/60 overflow-hidden">
      {/* Top Header Bar */}
      <div className="shrink-0 border-b border-gray-200/80 bg-white px-6 py-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-semibold text-gray-900 tracking-tight">
              Ngân hàng câu hỏi
            </h1>

            {/* Segment tabs */}
            <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
              {(['all', 'unscaled', 'scaled'] as Segment[]).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSegment(s);
                    handleFilterChange({
                      psychometric_status: s === 'all' ? undefined : s,
                    });
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    segment === s
                      ? 'bg-white text-gray-900 shadow-2xs'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {s === 'all' ? 'Tất cả' : s === 'unscaled' ? 'Chưa định cỡ' : 'Đã định cỡ'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Copy className="h-4 w-4 text-gray-500" />}
              onClick={() => setShowDuplicates(true)}
              className="text-xs"
            >
              Quét trùng
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Sparkles className="h-4 w-4 text-purple-500" />}
              className="text-purple-600 hover:bg-purple-50 text-xs font-medium"
              onClick={() => setShowAI(true)}
            >
              Tạo bằng AI
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Upload className="h-4 w-4" />}
              onClick={() => setShowImport(true)}
              className="text-xs"
            >
              Import
            </Button>
            <Button
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => setShowCreate(true)}
              className="text-xs font-medium"
            >
              Tạo câu hỏi
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content: Split Layout (Tree Sidebar on Left + Question Table on Right) */}
      <div className="flex-1 flex gap-4 p-4 min-h-0 overflow-hidden">
        {/* Left: Folder Tree Sidebar */}
        <FolderTreeSidebar
          selectedFolder={selectedFolder}
          onSelectFolder={handleSelectFolder}
          totalQuestions={globalTotalQuestions}
        />

        {/* Right: Question Table */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <QuestionTable
            filter={filter}
            onFilterChange={handleFilterChange}
            onSelectQuestion={setSelectedQuestionId}
            selectedFolderName={selectedFolder?.name}
          />
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateQuestionModal
          open={showCreate}
          onOpenChange={setShowCreate}
          defaultChapterId={selectedFolder?.type === 'domain' ? selectedFolder.id : selectedFolder?.parentId}
          defaultTopicId={selectedFolder?.type === 'topic' ? selectedFolder.id : undefined}
        />
      )}

      {showImport && (
        <ImportQuestionsModal
          open={showImport}
          onOpenChange={setShowImport}
          defaultChapterId={selectedFolder?.type === 'domain' ? selectedFolder.id : selectedFolder?.parentId}
          defaultTopicId={selectedFolder?.type === 'topic' ? selectedFolder.id : undefined}
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
