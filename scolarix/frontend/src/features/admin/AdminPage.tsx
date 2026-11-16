import { useSearchParams } from 'react-router-dom';
import { Tabs } from '@/components/ui/tabs';
import { InstitutePanel } from '../institute/InstitutePanel';
import { SchoolsPanel } from '../schools/SchoolsPanel';

type Tab = 'institute' | 'schools';

/** Page d'administration : institut + écoles (l'onglet actif est dans l'URL). */
export function AdminPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'schools' ? 'schools' : 'institute';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Administration</h1>
        <p className="text-muted-foreground">Structure de l'institut : informations générales, écoles, spécialités et niveaux</p>
      </div>
      <Tabs<Tab>
        value={tab}
        onChange={(t) => setParams({ tab: t })}
        items={[
          { value: 'institute', label: 'Institut' },
          { value: 'schools', label: 'Écoles' },
        ]}
      />
      {tab === 'institute' ? <InstitutePanel /> : <SchoolsPanel />}
    </div>
  );
}
