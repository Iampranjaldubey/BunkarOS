import type { Lang } from '../../db/types';
import { useT, LANGS, LANG_LABEL } from '../../i18n';
import { SegmentedControl } from './SegmentedControl';

/** हिंदी / Hinglish / EN — applies instantly and is remembered on this device. */
export function LanguageSwitch({ className }: { className?: string }) {
  const { lang, setLang, t } = useT();
  return (
    <SegmentedControl<Lang>
      label={t('lang.toggle')}
      value={lang}
      onChange={setLang}
      className={className}
      options={LANGS.map((l) => ({ value: l, label: LANG_LABEL[l] }))}
    />
  );
}
