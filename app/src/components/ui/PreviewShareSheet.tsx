import { Send } from 'lucide-react';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { useT } from '../../i18n';

/**
 * Build a wa.me link. India: a bare 10-digit number gets a 91 prefix.
 * (Mirrors the domain `waMeLink` contract; kept local so the share sheet does
 * not depend on in-progress domain code.)
 */
export function waMeLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

export interface PreviewShareSheetProps {
  open: boolean;
  onClose: () => void;
  recipientName: string;
  phone: string;
  text: string;
  /** Called after the WhatsApp link is opened (e.g. to record the share). */
  onConfirm?: () => void;
}

/**
 * F-3: every WhatsApp share goes through a preview-and-confirm step.
 * Shows the recipient, the full message, and a single confirm button that
 * opens wa.me. Nothing is ever sent silently.
 */
export function PreviewShareSheet({
  open,
  onClose,
  recipientName,
  phone,
  text,
  onConfirm,
}: PreviewShareSheetProps) {
  const { t } = useT();

  const handleSend = () => {
    window.open(waMeLink(phone, text), '_blank', 'noopener,noreferrer');
    onConfirm?.();
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('share.title')}
      footer={
        <>
          <Button variant="secondary" block onClick={onClose}>
            {t('action.cancel')}
          </Button>
          <Button variant="success" block onClick={handleSend}>
            <Send aria-hidden="true" size={20} />
            {t('share.send')}
          </Button>
        </>
      }
    >
      <dl className="mb-3">
        <dt className="text-sm text-muted">{t('share.to')}</dt>
        <dd className="text-lg font-medium text-ink">
          {recipientName} <span className="num text-muted">· {phone}</span>
        </dd>
      </dl>
      <p className="text-sm text-muted">{t('share.preview')}</p>
      <pre className="mt-1 whitespace-pre-wrap rounded-2xl border border-line bg-bg p-3 text-base text-ink font-sans">
        {text}
      </pre>
    </Sheet>
  );
}
