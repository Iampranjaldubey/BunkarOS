import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/Feedback';
import { useT } from '../../i18n';
export default function ItemFormPage() { const { t } = useT(); return (<section><PageHeader title="ItemFormPage" back /><EmptyState title={t('common.empty')} /></section>); }
