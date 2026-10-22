import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/Feedback';
import { useT } from '../../i18n';
export default function BuyersPage() { const { t } = useT(); return (<section><PageHeader title="BuyersPage" back /><EmptyState title={t('common.empty')} /></section>); }
