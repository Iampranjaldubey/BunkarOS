import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/Feedback';
import { useT } from '../../i18n';
export default function StockMovePage() { const { t } = useT(); return (<section><PageHeader title="StockMovePage" back /><EmptyState title={t('common.empty')} /></section>); }
