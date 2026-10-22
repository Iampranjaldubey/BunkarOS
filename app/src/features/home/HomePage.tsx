import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/Feedback';
import { useT } from '../../i18n';
export default function HomePage() { const { t } = useT(); return (<section><PageHeader title="HomePage" back /><EmptyState title={t('common.empty')} /></section>); }
