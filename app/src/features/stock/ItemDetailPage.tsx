import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/Feedback';
import { useT } from '../../i18n';
export default function ItemDetailPage() { const { t } = useT(); return (<section><PageHeader title="ItemDetailPage" back /><EmptyState title={t('common.empty')} /></section>); }
