import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/Feedback';
import { useT } from '../../i18n';
export default function WorkersPage() { const { t } = useT(); return (<section><PageHeader title="WorkersPage" back /><EmptyState title={t('common.empty')} /></section>); }
