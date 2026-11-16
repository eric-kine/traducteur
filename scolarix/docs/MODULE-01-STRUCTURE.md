# Module 1 — Institut, écoles, spécialités et niveaux

## 1. Schéma Prisma final de ces tables

```prisma
/// Un seul institut en pratique : géré par GET/PUT /api/institute.
model Institute {
  id           String  @id @default(uuid())
  name         String
  acronym      String?
  address      String?
  city         String?   // "Fait à <ville>" sur les documents officiels
  country      String?
  phone        String?
  email        String?
  website      String?
  logoUrl      String?
  directorName String?   // signataire par défaut des certificats
  schools School[]  // (+ academicYears, rooms)
}

model School {
  id           String  @id @default(uuid())
  code         String  @unique   // "EIT" — majuscules, utilisé dans les matricules
  name         String
  description  String?
  directorName String?
  email        String?
  phone        String?
  address      String?
  logoUrl      String?
  isActive     Boolean @default(true)
  instituteId  String            // → Institute (Restrict)
  specialties Specialty[]  levels Level[]  students Student[]  staff User[]
}

model Specialty {
  id           String  @id @default(uuid())
  code         String            // unique dans l'école : @@unique([schoolId, code])
  name         String
  description  String?
  diplomaTitle String?           // intitulé officiel du diplôme (relevés)
  isActive     Boolean @default(true)
  schoolId     String            // → School (Restrict)
}

model Level {
  id              String     @id @default(uuid())
  code            String     // "L1" — @@unique([schoolId, code])
  name            String     // "Licence 1"
  cycle           LevelCycle // PREPA | LICENCE | MASTER | DOCTORAT | AUTRE
  order           Int        // 1, 2, 3… — @@unique([schoolId, order])
  requiredCredits Int @default(60)
  schoolId        String     // → School (Restrict)
}
```

Le schéma complet se trouve dans `backend/prisma/schema.prisma`.

## 2. Migrations
- `20261116113116_init` : création de toutes les tables.
- `*_institute_schools_specialties_levels` : ajout de `city` et `country` (institut), `email`, `phone` et `address` (école), `diplomaTitle` (spécialité),
  et des **contraintes vérifiées par la base** : ordre > 0, crédits ≥ 0, codes non vides.

## 3. Endpoints REST

| Méthode | Route | Lecture / écriture |
|---|---|---|
| GET | `/api/institute` | tout utilisateur connecté (404 si non configuré) |
| PUT | `/api/institute` | ADMIN — crée ou met à jour l'unique institut |
| GET | `/api/schools?search=&isActive=` | connecté (un agent SCOLARITE ne voit que son école) ; avec les compteurs `_count` |
| GET | `/api/schools/:id` | connecté (403 si hors du périmètre) |
| POST · PATCH · DELETE | `/api/schools[/:id]` | ADMIN |
| GET · POST | `/api/schools/:schoolId/specialties` | lecture connecté ; écriture ADMIN ou SCOLARITE **de cette école** |
| GET · PATCH · DELETE | `/api/specialties/:id` | idem |
| GET · POST | `/api/schools/:schoolId/levels` | idem ; `order` facultatif (sinon placé à la fin, les suivants sont décalés) |
| PUT | `/api/schools/:schoolId/levels/order` | `{ ids: [...] }` = nouvel ordre complet |
| GET · PATCH · DELETE | `/api/levels/:id` | idem ; après une suppression, l'ordre est recompacté |

**Suppression** : refusée (409) si des données sont rattachées, avec un message explicite
(« 2 spécialité(s), 4 niveau(x) rattaché(s). Désactivez plutôt cet élément. »).

**Validation Zod** (`packages/shared/src/schemas/`, partagée avec le frontend) :
- codes passés en majuscules, limités aux lettres, chiffres et tirets ;
- emails et adresses web vérifiés ;
- un champ texte vide devient `null` ;
- cycle choisi dans une liste fixe ;
- crédits entre 0 et 300 ;
- liste d'ordre sans doublon.

## 4. Composants React

| Fichier | Rôle |
|---|---|
| `features/admin/AdminPage.tsx` | Page **Administration** (`/admin`) : onglets Institut / Écoles |
| `features/institute/InstitutePanel.tsx` | Formulaire de l'institut (lecture seule pour la scolarité) |
| `features/schools/SchoolsPanel.tsx` | Liste des écoles : recherche, filtre de statut, compteurs, modifier / supprimer |
| `features/schools/SchoolFormDialog.tsx` | Formulaire de création et de modification d'une école |
| `features/schools/SchoolDetailPage.tsx` | Fiche d'une école (`/admin/schools/:id`) : onglets Niveaux / Spécialités |
| `features/levels/LevelsPanel.tsx` + `LevelFormDialog.tsx` | Liste ordonnée (boutons ↑ ↓), formulaire, suppression |
| `features/specialties/SpecialtiesPanel.tsx` + `SpecialtyFormDialog.tsx` | Liste, formulaire, suppression |
| `components/common/ConfirmDialog.tsx` | Confirmation de suppression qui affiche le refus de l'API |
| `features/users/UserFormDialog.tsx` | Nouveau : choix de l'école gérée pour un agent SCOLARITE |

## 5. Tests et validation

**Automatiques** : 19 nouveaux tests (53 au total) dans `backend/tests/integration/structure.test.ts`.
- Institut : 404, puis création et mise à jour d'une ligne unique ; validation ; droits.
- Écoles : CRUD et compteurs ; code en double ou invalide ; institut requis ; suppression bloquée ; périmètre SCOLARITE.
- Spécialités : CRUD ; code unique dans une école mais réutilisable dans une autre ; 404 ; droits SCOLARITE et ENSEIGNANT.
- Niveaux : ordre automatique ; insertion à une position ; réordonnancement ; recompactage ; liste incomplète refusée ; code en double ; validation ; suppression bloquée par une UE.

**Scénario manuel** (vérifié dans un navigateur) :
1. Administration → Institut : un email invalide est refusé ; on renseigne le nom et la ville, puis on enregistre et on recharge la page.
2. Écoles : créer EIT, ESC et une école temporaire ; un code en double est signalé sous le champ ; supprimer l'école vide.
3. Ouvrir EIT → Niveaux : ajouter N1, L3, M1, puis N2 en position 2. L'ordre obtenu est N1, N2, L3, M1. Tester ↑ et ↓.
4. Spécialités : ajouter GL et RT, puis modifier RT.
5. Supprimer EIT : refus avec le nombre de spécialités et de niveaux rattachés.
6. Créer un agent Scolarité rattaché à ESC et se connecter avec lui. Il ne voit que ESC, ne peut pas créer d'école, peut ajouter un niveau à ESC, et voit l'institut en lecture seule.
7. Sur téléphone : pas de défilement horizontal.
