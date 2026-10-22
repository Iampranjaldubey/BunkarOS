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
        // Below lg: bottom sheet pinned to the bottom edge, full-width rail
        // centered horizontally — identical to the phone layout.
        'w-full max-w-md m-0 mt-auto mb-0 rounded-t-3xl bg-surface p-0',
        'backdrop:bg-ink/40 shadow-sheet',
        'left-1/2 -translate-x-1/2',
        // lg+: a centered modal dialog (fully rounded) instead of a bottom
        // sheet. `my-auto` + the <dialog> default margin:auto re-centres it
        // vertically; the shared `left-1/2 -translate-x-1/2` keeps it centred
        // horizontally at the lg max width.
        'lg:max-w-lg lg:my-auto lg:rounded-2xl',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="text-xl">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="tap-48 -mr-2 inline-flex items-center justify-center rounded-full text-muted hover:text-ink focus-visible:outline focus-visible:outline-3 focus-visible:outline-saffron-ink"
        >
          <X aria-hidden="true" />
          <span className="visually-hidden">{t('action.cancel')}</span>
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-4 py-4">{children}</div>
      {footer && (
        <div className="sticky bottom-0 flex gap-3 border-t border-line bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
