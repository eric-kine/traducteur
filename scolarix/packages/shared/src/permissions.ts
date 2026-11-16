import type { Role } from './enums';

/**
 * MATRICE DES PERMISSIONS (référence unique, affichée dans Utilisateurs → Rôles
 * et dans le README). Le serveur applique ces règles route par route
 * (middlewares authorize + contrôles de périmètre dans les services).
 *
 *   ✔ = autorisé · ◐ = limité (voir la note) · — = interdit
 */
export type Access = 'all' | 'scoped' | 'none';

export interface PermissionRow {
  area: string;
  action: string;
  roles: Record<Role, Access>;
  note?: string;
}

const r = (ADMIN: Access, SCOLARITE: Access, ENSEIGNANT: Access, ETUDIANT: Access) => ({ ADMIN, SCOLARITE, ENSEIGNANT, ETUDIANT });

export const PERMISSIONS: PermissionRow[] = [
  { area: 'Tableau de bord', action: 'Indicateurs et alertes', roles: r('all', 'scoped', 'none', 'none'), note: 'Scolarité : son école' },
  { area: 'Utilisateurs', action: 'Créer, modifier, désactiver des comptes ; changer les rôles', roles: r('all', 'none', 'none', 'none') },
  { area: 'Comptes', action: 'Créer le compte de connexion d’un enseignant / étudiant', roles: r('all', 'scoped', 'none', 'none'), note: 'Scolarité : étudiants de son école, enseignants' },
  { area: 'Institut & écoles', action: 'Modifier', roles: r('all', 'none', 'none', 'none') },
  { area: 'Années, salles, créneaux', action: 'Modifier', roles: r('all', 'none', 'none', 'none') },
  { area: 'Spécialités, niveaux, UE', action: 'Créer, modifier, supprimer', roles: r('all', 'scoped', 'none', 'none'), note: 'Scolarité : son école' },
  { area: 'Étudiants & inscriptions', action: 'Gérer (fiches, photo, import CSV)', roles: r('all', 'scoped', 'none', 'none'), note: 'Scolarité : son école' },
  { area: 'Enseignants & affectations', action: 'Gérer', roles: r('all', 'scoped', 'none', 'none'), note: 'Suppression d’un enseignant : ADMIN' },
  { area: 'Notes', action: 'Saisir les notes d’une UE', roles: r('all', 'scoped', 'scoped', 'none'), note: 'Enseignant : les UE qui lui sont affectées' },
  { area: 'Délibération', action: 'Délibérer un niveau', roles: r('all', 'scoped', 'none', 'none'), note: 'Rouvrir : ADMIN' },
  { area: 'Relevés & certificats', action: 'Émettre', roles: r('all', 'scoped', 'none', 'scoped'), note: 'Étudiant : les siens uniquement (Mon espace)' },
  { area: 'Syllabus', action: 'Rédiger', roles: r('all', 'scoped', 'scoped', 'none'), note: 'Enseignant : s’il est responsable de l’UE' },
  { area: 'Syllabus', action: 'Consulter / télécharger', roles: r('all', 'scoped', 'all', 'all') },
  { area: 'Emplois du temps', action: 'Générer, modifier, publier', roles: r('all', 'scoped', 'none', 'none') },
  { area: 'Emplois du temps', action: 'Consulter le sien', roles: r('all', 'all', 'scoped', 'scoped'), note: 'Étudiant : emploi du temps PUBLIÉ de son niveau' },
  { area: 'Mon espace', action: 'Ses notes, documents, UE, étudiants', roles: r('none', 'none', 'scoped', 'scoped') },
];
