import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  Upload,
  Sparkles,
  Copy,
  FolderTree,
  MoreVertical,
} from 'lucide-react';
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
  const [mobileFolderOpen, setMobileFolderOpen] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);

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
      <div className="shrink-0 border-b border-gray-200/80 bg-white px-3 sm:px-6 py-2.5 sm:py-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Top Row: Title + Mobile Folder Trigger + Segment Tabs */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 sm:gap-3">
              <h1 className="text-sm sm:text-base font-bold text-gray-900 tracking-tight whitespace-nowrap">
                Ngân hàng câu hỏi
              </h1>

              {/* Mobile Folder Drawer Button (visible only on < lg) */}
              <button
                type="button"
                onClick={() => setMobileFolderOpen(true)}
                className="lg:hidden inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200/80 hover:bg-blue-100 transition-colors shrink-0 max-w-[150px] truncate"
                title="Mở danh sách thư mục"
              >
                <FolderTree className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span className="truncate text-[11px]">
                  {selectedFolder ? selectedFolder.name : 'Thư mục'}
                </span>
              </button>
            </div>

            {/* Segment tabs */}
            <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5 overflow-x-auto no-scrollbar shrink-0">
              {(['all', 'unscaled', 'scaled'] as Segment[]).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSegment(s);
                    handleFilterChange({
                      psychometric_status: s === 'all' ? undefined : s,
                    });
                  }}
                  className={`px-2 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap ${
                    segment === s
                      ? 'bg-white text-gray-900 shadow-2xs font-semibold'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {s === 'all' ? 'Tất cả' : s === 'unscaled' ? 'Chưa định cỡ' : 'Đã định cỡ'}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 justify-end">
            {/* Desktop Full Action Buttons */}
            <div className="hidden sm:flex items-center gap-2">
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
            </div>

            {/* Mobile Actions: Compact AI + Dropdown for other tools */}
            <div className="flex sm:hidden items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAI(true)}
                className="text-purple-600 bg-purple-50 hover:bg-purple-100 text-xs px-2 h-8 font-medium"
                leftIcon={<Sparkles className="h-3.5 w-3.5 text-purple-600" />}
              >
                AI
              </Button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMobileActionsOpen(!mobileActionsOpen)}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
                  aria-label="Thêm tùy chọn"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                {mobileActionsOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setMobileActionsOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-40 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-1 text-xs">
                      <button
                        onClick={() => {
                          setMobileActionsOpen(false);
                          setShowImport(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50"
                      >
                        <Upload className="h-3.5 w-3.5 text-gray-500" />
                        Import câu hỏi
                      </button>
                      <button
                        onClick={() => {
                          setMobileActionsOpen(false);
                          setShowDuplicates(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50 border-t border-gray-100"
                      >
                        <Copy className="h-3.5 w-3.5 text-gray-500" />
                        Quét trùng câu hỏi
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Primary Action Button: Always prominent */}
            <Button
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => setShowCreate(true)}
              className="text-xs font-semibold px-3 h-8 shadow-xs"
            >
              Tạo câu hỏi
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content: Split Layout */}
      <div className="flex-1 flex gap-4 p-2.5 sm:p-4 min-h-0 overflow-hidden">
        {/* Left: Folder Tree Sidebar for Desktop (hidden on < lg) */}
        <div className="hidden lg:flex h-full">
          <FolderTreeSidebar
            selectedFolder={selectedFolder}
            onSelectFolder={handleSelectFolder}
            totalQuestions={globalTotalQuestions}
          />
        </div>

        {/* Mobile Folder Drawer (< lg) */}
        {mobileFolderOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden animate-in fade-in duration-200">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
              onClick={() => setMobileFolderOpen(false)}
            />
            <div className="relative z-10 w-80 max-w-[85vw] h-full bg-white shadow-2xl p-3.5 flex flex-col animate-in slide-in-from-left duration-200">
              <FolderTreeSidebar
                selectedFolder={selectedFolder}
                onSelectFolder={handleSelectFolder}
                totalQuestions={globalTotalQuestions}
                className="w-full h-full border-0 rounded-none shadow-none p-0"
                onClose={() => setMobileFolderOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Right: Question Table (Takes 100% width on mobile) */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <QuestionTable
            filter={filter}
            onFilterChange={handleFilterChange}
            onSelectQuestion={setSelectedQuestionId}
            selectedFolderName={selectedFolder?.name}
            onOpenFolderDrawer={() => setMobileFolderOpen(true)}
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
