import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/Feedback';
import { useT } from '../../i18n';
export default function OrderFormPage() { const { t } = useT(); return (<section><PageHeader title="OrderFormPage" back /><EmptyState title={t('common.empty')} /></section>); }
