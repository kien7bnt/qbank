import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

const SIZE_MAP = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnOutsideClick = true,
  closeOnEscape = true,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          onPointerDownOutside={(e) => {
            if (!closeOnOutsideClick) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e) => {
            if (!closeOnOutsideClick) {
              e.preventDefault();
            }
          }}
          onEscapeKeyDown={(e) => {
            if (!closeOnEscape) {
              e.preventDefault();
            }
          }}
          className={clsx(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-1rem)] sm:w-full -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl flex flex-col max-h-[92dvh]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            SIZE_MAP[size]
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 sm:px-6 py-3 sm:py-4 shrink-0 gap-2">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-sm sm:text-base font-semibold text-gray-900 leading-snug">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-0.5 text-xs sm:text-sm text-gray-500">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 shrink-0"
                aria-label="Đóng"
              >
                <X className="h-5 w-5 sm:h-4 sm:w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="px-3.5 sm:px-6 py-3 sm:py-4 overflow-y-auto flex-1">{children}</div>

          {/* Footer */}
          {footer && (
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2 border-t border-gray-100 px-4 sm:px-6 py-3 sm:py-4 shrink-0 bg-gray-50/50 rounded-b-2xl">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
