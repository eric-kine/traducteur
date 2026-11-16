import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@scolarix/shared';
import { useAuth } from '@/stores/auth.store';
import { ForbiddenPage } from './ErrorPages';

/**
 * Garde de route :
 *  - visiteur non connecté → redirigé vers /login (puis ramené ici après connexion)
 *  - rôle non autorisé → page "Accès refusé"
 */
export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Chargement…</div>;
  }
  if (status === 'anonymous' || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles && !roles.includes(user.role)) return <ForbiddenPage />;
  return <Outlet />;
}
