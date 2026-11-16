import { Building2, Home, KeyRound, Users, type LucideIcon } from 'lucide-react';
import type { Role } from '@scolarix/shared';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Rôles autorisés (absent = tout utilisateur connecté) */
  roles?: Role[];
}

/** Menu latéral. Chaque nouveau module ajoutera ses entrées ici. */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Accueil', icon: Home },
  { to: '/admin', label: 'Administration', icon: Building2, roles: ['ADMIN', 'SCOLARITE'] },
  { to: '/users', label: 'Utilisateurs', icon: Users, roles: ['ADMIN'] },
  { to: '/account', label: 'Mon compte', icon: KeyRound },
];
