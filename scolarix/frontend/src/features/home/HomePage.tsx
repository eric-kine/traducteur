import { ROLE_LABELS } from '@scolarix/shared';
import { useAuth } from '@/stores/auth.store';
import { AdminDashboard } from '../dashboard/AdminDashboard';
import { StudentSpace } from '../me/StudentSpace';
import { TeacherSpace } from '../me/TeacherSpace';

/** Accueil selon le rôle : tableau de bord (administration, scolarité) ou espace personnel. */
export function HomePage() {
  const user = useAuth((s) => s.user);
  if (!user) return null;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bonjour {user.firstName} 👋</h1>
        <p className="text-muted-foreground">
          {user.role === 'ETUDIANT' ? 'Votre espace étudiant' : user.role === 'ENSEIGNANT' ? 'Votre espace enseignant' : `Tableau de bord — ${ROLE_LABELS[user.role]}`}
        </p>
      </div>
      {user.role === 'ETUDIANT' ? <StudentSpace /> : user.role === 'ENSEIGNANT' ? <TeacherSpace /> : <AdminDashboard />}
    </div>
  );
}
