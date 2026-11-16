import { Building2, CalendarRange, FileBadge, GraduationCap, Home, KeyRound, UserSquare2, Users, type LucideIcon } from 'lucide-react';
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
  { to: '/', label: 'Tableau de bord', icon: Home, roles: ['ADMIN', 'SCOLARITE'] },
  { to: '/', label: 'Mon espace', icon: Home, roles: ['ENSEIGNANT', 'ETUDIANT'] },
  { to: '/students', label: 'Étudiants', icon: GraduationCap, roles: ['ADMIN', 'SCOLARITE'] },
  { to: '/teachers', label: 'Enseignants', icon: UserSquare2, roles: ['ADMIN', 'SCOLARITE'] },
  { to: '/timetables', label: 'Emplois du temps', icon: CalendarRange, roles: ['ADMIN', 'SCOLARITE'] },
  { to: '/certificates', label: 'Certificats', icon: FileBadge, roles: ['ADMIN', 'SCOLARITE'] },
  { to: '/admin', label: 'Administration', icon: Building2, roles: ['ADMIN', 'SCOLARITE'] },
  { to: '/users', label: 'Utilisateurs', icon: Users, roles: ['ADMIN'] },
  { to: '/account', label: 'Mon compte', icon: KeyRound },
];
