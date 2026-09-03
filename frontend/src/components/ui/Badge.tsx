import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import type { QuestionType, QuestionStatus, BloomLevel, DifficultyLevel } from '@/types';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
  {
    variants: {
      variant: {
        default: 'bg-gray-50 text-gray-700 ring-gray-200',
        blue: 'bg-blue-50 text-blue-700 ring-blue-200',
        green: 'bg-green-50 text-green-700 ring-green-200',
        yellow: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
        red: 'bg-red-50 text-red-700 ring-red-200',
        purple: 'bg-purple-50 text-purple-700 ring-purple-200',
        orange: 'bg-orange-50 text-orange-700 ring-orange-200',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ children, variant, className }: BadgeProps) {
  return (
    <span className={clsx(badgeVariants({ variant }), className)}>
      {children}
    </span>
  );
}

// ─── Semantic Badges ─────────────────────────────────────────────────────────
const STATUS_MAP: Record<QuestionStatus, { label: string; variant: BadgeProps['variant'] }> = {
  draft: { label: 'Nháp', variant: 'default' },
  review: { label: 'Đang duyệt', variant: 'yellow' },
  approved: { label: 'Đã duyệt', variant: 'green' },
  rejected: { label: 'Từ chối', variant: 'red' },
  archived: { label: 'Lưu trữ', variant: 'default' },
};

export function QuestionStatusBadge({ status }: { status: QuestionStatus }) {
  const { label, variant } = STATUS_MAP[status] ?? { label: status, variant: 'default' };
  return <Badge variant={variant}>{label}</Badge>;
}

const TYPE_MAP: Record<QuestionType, { label: string; variant: BadgeProps['variant'] }> = {
  mcq: { label: 'Trắc nghiệm', variant: 'blue' },
  essay: { label: 'Tự luận', variant: 'purple' },
  coding: { label: 'Lập trình', variant: 'orange' },
};

export function QuestionTypeBadge({ type }: { type: QuestionType }) {
  const { label, variant } = TYPE_MAP[type] ?? { label: type, variant: 'default' };
  return <Badge variant={variant}>{label}</Badge>;
}

const BLOOM_MAP: Record<BloomLevel, { label: string; variant: BadgeProps['variant'] }> = {
  remember: { label: 'Nhớ', variant: 'default' },
  understand: { label: 'Hiểu', variant: 'blue' },
  apply: { label: 'Vận dụng', variant: 'green' },
  analyze: { label: 'Vận dụng cao', variant: 'purple' },
};

export function BloomBadge({ level }: { level: BloomLevel }) {
  const { label, variant } = BLOOM_MAP[level] ?? { label: level, variant: 'default' };
  return <Badge variant={variant}>{label}</Badge>;
}

const DIFFICULTY_MAP: Record<DifficultyLevel, { label: string; variant: BadgeProps['variant'] }> = {
  easy: { label: 'Dễ', variant: 'green' },
  medium: { label: 'Trung bình', variant: 'yellow' },
  hard: { label: 'Khó', variant: 'red' },
};

export function DifficultyBadge({ level }: { level: DifficultyLevel }) {
  const { label, variant } = DIFFICULTY_MAP[level] ?? { label: level, variant: 'default' };
  return <Badge variant={variant}>{label}</Badge>;
}

const CLASS_STATUS_MAP: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
  active: { label: 'Hoạt động', variant: 'green' },
  archived: { label: 'Đã lưu trữ', variant: 'default' },
  pending: { label: 'Chờ duyệt', variant: 'yellow' },
};

export function ClassStatusBadge({ status }: { status: string }) {
  const { label, variant } = CLASS_STATUS_MAP[status] ?? { label: status, variant: 'default' };
  return <Badge variant={variant}>{label}</Badge>;
}
