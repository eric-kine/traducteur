import { ROLE_LABELS } from '@scolarix/shared';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/stores/auth.store';

/** Tableau de bord d'accueil (enrichi au module 12). */
export function HomePage() {
  const user = useAuth((s) => s.user);
  if (!user) return null;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bonjour {user.firstName} 👋</h1>
        <p className="text-muted-foreground">Bienvenue sur Scolarix — espace {ROLE_LABELS[user.role]}.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Votre espace est prêt</CardTitle>
          <CardDescription>
            Les fonctionnalités (écoles, étudiants, notes, documents…) apparaîtront dans le menu au fur et à mesure.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
