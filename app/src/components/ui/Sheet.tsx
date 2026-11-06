import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { useT } from '../../i18n';
import { cn } from '../../lib/utils';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Sticky footer actions. */
  footer?: ReactNode;
  className?: string;
}

/**
 * Bottom sheet built on the native <dialog> element.
 * - Native modal gives us a focus trap + inert background for free.
 * - Esc closes (dialog `cancel` event), as does the close button + backdrop.
 */
export function Sheet({ open, onClose, title, children, footer, className }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useT();

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Click outside the panel (on the backdrop) closes.
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        // Below lg: bottom sheet pinned to the bottom edge, full-width rail centred horizontally.
        'sheet w-full max-w-md m-0 mt-auto mb-0 rounded-t-3xl border border-line bg-surface p-0 text-ink',
        'backdrop:bg-[#1f1b16]/45 shadow-sheet',
        'left-1/2 -translate-x-1/2',
        // lg+: a centred modal dialog instead of a bottom sheet.
        'lg:max-w-lg lg:my-auto lg:rounded-3xl lg:shadow-float',
        className,
      )}
    >
      <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong lg:hidden" aria-hidden="true" />
      <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3 lg:pt-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="tap-48 -mr-3 inline-flex items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline focus-visible:outline-3 focus-visible:outline-accent-ink"
        >
          <X aria-hidden="true" size={20} />
          <span className="visually-hidden">{t('action.cancel')}</span>
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-5 py-3">{children}</div>
      {footer && (
        <div className="sticky bottom-0 flex gap-3 border-t border-line bg-surface px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {footer}
        </div>
      )}
    </dialog>
  );
}

export interface ConfirmSheetProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

/** Yes/No confirmation sheet. */
export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  danger,
}: ConfirmSheetProps) {
  const { t } = useT();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" block onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} block onClick={onConfirm}>
            {confirmLabel ?? t('action.confirm')}
          </Button>
        </>
      }
    >
      <p className="text-lg text-ink">{message}</p>
    </Sheet>
  );
}
