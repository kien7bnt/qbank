import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ChevronDown, BookOpen, Layers, FileText, Circle } from 'lucide-react';
import { clsx } from 'clsx';
import { curriculumApi } from '@/services/api';
import { PageSpinner } from '@/components/ui/Spinner';
import type { Subject, ChapterNode, TopicNode, QuestionFilter } from '@/types';

interface CurriculumTreeProps {
  subjects: Subject[];
  onSelect: (key: string, value: string) => void;
  selectedFilter: QuestionFilter;
}

function TopicItem({
  topic,
  onSelect,
  isSelected,
}: {
  topic: TopicNode;
  onSelect: (key: string, value: string) => void;
  isSelected: boolean;
}) {
  return (
    <button
      onClick={() => onSelect('topic_id', topic.id)}
      className={clsx(
        'flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs text-left transition-colors',
        isSelected ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-100'
      )}
    >
      <Circle className="h-2 w-2 shrink-0" />
      <span className="truncate">{topic.name}</span>
    </button>
  );
}

function ChapterItem({
  chapter,
  onSelect,
  selectedTopicId,
  selectedChapterId,
}: {
  chapter: ChapterNode;
  onSelect: (key: string, value: string) => void;
  selectedTopicId?: string;
  selectedChapterId?: string;
}) {
  const isChapterSelected = selectedChapterId === chapter.id;
  const hasSelectedChild = chapter.topics.some((t) => t.id === selectedTopicId);
  const [open, setOpen] = useState(hasSelectedChild || isChapterSelected);

  return (
    <div>
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => setOpen(!open)}
          className="p-0.5 text-gray-400 hover:text-gray-600"
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        <button
          onClick={() => onSelect('chapter_id', chapter.id)}
          className={clsx(
            'flex flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-left transition-colors',
            isChapterSelected ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
          )}
        >
          <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span className="truncate">{chapter.name}</span>
        </button>
      </div>
      {open && chapter.topics.length > 0 && (
        <div className="ml-5 mt-0.5 space-y-0.5">
          {chapter.topics.map((topic) => (
            <TopicItem
              key={topic.id}
              topic={topic}
              onSelect={onSelect}
              isSelected={selectedTopicId === topic.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SubjectTree({
  subject,
  onSelect,
  selectedFilter,
}: {
  subject: Subject;
  onSelect: (key: string, value: string) => void;
  selectedFilter: QuestionFilter;
}) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['curriculum-tree', subject.id],
    queryFn: () => curriculumApi.tree(subject.id),
    enabled: open,
  });

  const tree = data?.data;
  const isSubjectSelected = selectedFilter.subject_id === subject.id;

  return (
    <div>
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => setOpen(!open)}
          className="p-0.5 text-gray-400 hover:text-gray-600"
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={() => onSelect('subject_id', subject.id)}
          className={clsx(
            'flex flex-1 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-sm text-left transition-colors',
            isSubjectSelected
              ? 'bg-primary-50 text-primary-700 font-semibold'
              : 'text-gray-800 font-medium hover:bg-gray-100'
          )}
        >
          <BookOpen className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="truncate">{subject.name}</span>
        </button>
      </div>

      {open && (
        <div className="ml-4 mt-1 space-y-0.5">
          {isLoading && <div className="py-1 text-xs text-gray-400 px-2">Đang tải...</div>}
          {tree?.chapters.map((chapter) => (
            <ChapterItem
              key={chapter.id}
              chapter={chapter}
              onSelect={onSelect}
              selectedChapterId={selectedFilter.chapter_id}
              selectedTopicId={selectedFilter.topic_id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CurriculumTree({ subjects, onSelect, selectedFilter }: CurriculumTreeProps) {
  const handleReset = () => {
    onSelect('subject_id', '');
    onSelect('chapter_id', '');
    onSelect('topic_id', '');
  };

  return (
    <div className="p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Môn học</p>
        {(selectedFilter.subject_id || selectedFilter.chapter_id) && (
          <button
            onClick={handleReset}
            className="text-xs text-primary-600 hover:underline"
          >
            Xóa lọc
          </button>
        )}
      </div>

      {subjects.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">Chưa có môn học</p>
      ) : (
        <div className="space-y-0.5">
          {subjects.map((subject) => (
            <SubjectTree
              key={subject.id}
              subject={subject}
              onSelect={onSelect}
              selectedFilter={selectedFilter}
            />
          ))}
        </div>
      )}
    </div>
  );
}
