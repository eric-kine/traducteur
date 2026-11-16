import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, MapPin, Phone, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs } from '@/components/ui/tabs';
import { canManageSchool } from '@/lib/permissions';
import { useAuth } from '@/stores/auth.store';
import { NotFoundPage } from '@/routes/ErrorPages';
import { ApiError } from '@/lib/api';
import { SpecialtiesPanel } from '../specialties/SpecialtiesPanel';
import { LevelsPanel } from '../levels/LevelsPanel';
import { useSchool } from './schools.api';

type Tab = 'levels' | 'specialties';

/** Fiche d'une école : informations + onglets Niveaux / Spécialités. */
export function SchoolDetailPage() {
  const { id = '' } = useParams();
  const user = useAuth((s) => s.user);
  const { data: school, isLoading, error } = useSchool(id);
  const [tab, setTab] = useState<Tab>('levels');

  if (isLoading) return <p className="text-muted-foreground">Chargement…</p>;
  if (error instanceof ApiError && error.status === 403) return <p className="text-destructive">Vous n'avez pas accès à cette école.</p>;
  if (!school) return <NotFoundPage />;
  const canEdit = canManageSchool(user, school.id);

  return (
    <div className="space-y-6">
      <Link to="/admin?tab=schools" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Toutes les écoles
      </Link>
      <div className="flex flex-wrap items-start gap-3">
        <Badge variant="secondary" className="mt-1 font-mono text-sm">{school.code}</Badge>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{school.name}</h1>
          {school.description && <p className="text-muted-foreground">{school.description}</p>}
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {school.directorName && <span className="flex items-center gap-1"><User className="h-4 w-4" />{school.directorName}</span>}
            {school.email && <span className="flex items-center gap-1"><Mail className="h-4 w-4" />{school.email}</span>}
            {school.phone && <span className="flex items-center gap-1"><Phone className="h-4 w-4" />{school.phone}</span>}
            {school.address && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{school.address}</span>}
          </div>
        </div>
        {!school.isActive && <Badge variant="muted">Inactive</Badge>}
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'levels', label: 'Niveaux', count: school._count.levels },
          { value: 'specialties', label: 'Spécialités', count: school._count.specialties },
        ]}
      />
      {tab === 'levels' ? <LevelsPanel schoolId={school.id} canEdit={canEdit} /> : <SpecialtiesPanel schoolId={school.id} canEdit={canEdit} />}
    </div>
  );
}
