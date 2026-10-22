import type { Lang } from '../../db/types';
import { useT } from '../../i18n';
import { SegmentedControl } from './SegmentedControl';

/**
 * हिंदी / EN switch. Applies immediately (live re-render via the language
 * provider) and is remembered on this device, so the choice made on the
 * setup or login screen carries into the app and survives a reload.
 */
export function LanguageSwitch({ className }: { className?: string }) {
  const { lang, setLang, t } = useT();
  return (
    <SegmentedControl<Lang>
      label={t('lang.toggle')}
      value={lang}
      onChange={setLang}
      className={className}
      options={[
        { value: 'hi', label: 'हिंदी' },
        { value: 'en', label: 'EN' },
      ]}
    />
  );
}
