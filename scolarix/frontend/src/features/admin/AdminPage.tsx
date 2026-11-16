import { useSearchParams } from 'react-router-dom';
import { Tabs } from '@/components/ui/tabs';
import { InstitutePanel } from '../institute/InstitutePanel';
import { SchoolsPanel } from '../schools/SchoolsPanel';
import { AcademicYearsPanel } from '../academic-years/AcademicYearsPanel';

type Tab = 'institute' | 'schools' | 'years';

/** Page d'administration : institut + écoles (l'onglet actif est dans l'URL). */
export function AdminPage() {
  const [params, setParams] = useSearchParams();
  const t = params.get('tab');
  const tab: Tab = t === 'schools' || t === 'years' ? t : 'institute';

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
          { value: 'years', label: 'Années académiques' },
        ]}
      />
      {tab === 'institute' ? <InstitutePanel /> : tab === 'schools' ? <SchoolsPanel /> : <AcademicYearsPanel />}
    </div>
  );
}
