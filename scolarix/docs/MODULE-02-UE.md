# Module 2 — Unités d'Enseignement (UE) et quotas horaires

## 1. Schéma Prisma (`TeachingUnit`)

```prisma
model TeachingUnit {
  id            String   @id @default(uuid())
  code          String              // "INF101" — @@unique([levelId, code])
  title         String              // intitulé
  description   String?
  semester      Int                 // 1 ou 2
  credits       Int                 // ECTS
  coefficient   Decimal  @db.Decimal(4, 2)

  cmHours       Decimal  @db.Decimal(6, 2)   // heures CM
  tdHours       Decimal  @db.Decimal(6, 2)   // heures TD
  tpHours       Decimal  @db.Decimal(6, 2)   // heures TP
  totalHours    Decimal  @db.Decimal(6, 2)   // = CM + TD + TP (CALCULÉ, jamais saisi)
  paidHours     Decimal  @db.Decimal(6, 2)   // volume horaire payé
  paidHoursAuto Boolean  @default(true)      // true = recalculé en équivalent TD
  hourlyRate    Decimal? @db.Decimal(10, 2)  // taux horaire

  ccWeight Int  examWeight Int  tpWeight Int  // pondération des notes, somme = 100

  objectives    String? @db.Text   // objectifs pédagogiques  ┐
  prerequisites String? @db.Text   // prérequis               ├ repris par le syllabus (module 8)
  bibliography  String? @db.Text   // bibliographie           ┘

  isActive    Boolean @default(true)
  levelId     String               // → Level → School
  specialtyId String?              // null = tronc commun ; sinon spécialité de la même école
}
```

**Migration** `*_teaching_units_quotas` : ajoute `paidHoursAuto`, `hourlyRate`, `objectives`, `prerequisites` et `bibliography`.
Elle ajoute aussi des **contraintes CHECK** pour que la base refuse toute donnée incohérente, même si elle est écrite sans passer par l'API :
- `totalHours = cmHours + tdHours + tpHours` ;
- les pondérations font 100 ;
- les heures, les crédits et le taux ne sont jamais négatifs, et le coefficient est positif ;
- le semestre vaut 1 ou 2.

## 2. Logique de calcul

Fichier `packages/shared/src/calc/teaching-unit.ts`. Le **même code** est utilisé par le serveur (valeurs enregistrées) et par le formulaire (affichage en direct).

| Calcul | Formule | Exemple (CM 24, TD 18, TP 12, taux 10 000) |
|---|---|---|
| Volume total | CM + TD + TP | 54 h |
| Volume payé (auto) | CM × 1,5 + TD × 1 + TP × 1 (« équivalent TD ») | 66 h |
| Coût estimé | volume payé × taux horaire | 660 000 |
| Totaux de la maquette | sommes par semestre et pour l'année | crédits, CM, TD, TP, total, payé, coût |

- Les calculs se font en centièmes d'heure, sans erreur d'arrondi (0,1 + 0,2 = 0,3).
- Les coefficients d'équivalence se règlent dans `PAID_HOURS_COEFFICIENTS`.
- `totalHours` envoyé par un client est **ignoré** : le serveur le recalcule toujours.
- Volume payé : `null` ou absent → calcul automatique (recalculé à chaque changement d'heures) ; un nombre → saisie manuelle conservée.

## 3. Endpoints

| Méthode | Route | Accès |
|---|---|---|
| GET | `/api/levels/:levelId/teaching-units?semester=&specialtyId=&search=&isActive=` | connecté (dans son périmètre d'école) — renvoie `data`, `totals` (S1, S2, année) et `level` |
| POST | `/api/levels/:levelId/teaching-units` | ADMIN ou SCOLARITE de l'école |
| GET | `/api/teaching-units/:id` | connecté (dans son périmètre) |
| PATCH | `/api/teaching-units/:id` | ADMIN ou SCOLARITE de l'école — recalcul et revérification sur l'UE complète |
| DELETE | `/api/teaching-units/:id` | idem — refusé (409) si des notes, affectations, syllabus ou créneaux y sont rattachés |

`specialtyId=common` : seulement le tronc commun. `specialtyId=<id>` : les UE de cette spécialité, plus le tronc commun.

**Validation Zod** (`schemas/teaching-unit.schema.ts`) :
- code en majuscules ;
- heures de 0 à 999, 2 décimales au maximum ;
- au moins 1 heure au total ;
- pondérations = 100 %, avec la somme actuelle dans le message ;
- semestre 1 ou 2 ;
- spécialité de la même école que le niveau ;
- champs de formulaire vides convertis en `null`.

## 4. Frontend

| Fichier | Rôle |
|---|---|
| `features/teaching-units/LevelCurriculumPage.tsx` | Page **Maquette pédagogique** d'un niveau (`/admin/levels/:id`), détaillée ci-dessous |
| `features/teaching-units/TeachingUnitFormDialog.tsx` | Formulaire en 3 sections, détaillé ci-dessous |
| `features/teaching-units/HoursSummary.tsx` | Panneau de **calcul en temps réel** (total, payé, coût, somme des pondérations), mis à jour à chaque frappe |
| `features/levels/LevelsPanel.tsx` | Le nom de chaque niveau et une icône 📖 mènent à sa maquette |

La page **Maquette pédagogique** contient :
- 4 compteurs : crédits obtenus sur crédits requis, volume total, volume payé, coût ;
- des filtres : semestre, spécialité, recherche ;
- le tableau des UE groupé par semestre, avec sous-totaux et total de l'année.

Le **formulaire** a 3 sections :
- *Identification* ;
- *Quotas horaires*, avec la case « Calcul automatique (équivalent TD) » ; décochée, le volume payé se saisit à la main ;
- *Contenu pédagogique*.

## 5. Tests et validation

**Automatiques** : 29 nouveaux tests, 82 au total.
- *Calculs* (`tests/unit/teaching-unit-calc.test.ts`) : total, arrondis, valeurs manquantes, équivalent TD, coût, conversion des champs de formulaire, règles de validation.
- *API* (`tests/integration/teaching-units.test.ts`) :
  - calcul serveur, `totalHours` du client ignoré, volume payé manuel, contenu pédagogique ;
  - code en double, spécialité d'une autre école ;
  - recalcul en modification et retour au mode automatique ; pondérations revérifiées sur l'UE fusionnée ; contrainte CHECK en base ;
  - totaux par semestre et par année ; filtres ;
  - suppression, et niveau impossible à supprimer tant qu'il a des UE ; droits par rôle ; 404.

**Scénario manuel** (vérifié dans un navigateur) :
1. École EIT → Niveau 1 → icône 📖 → « Nouvelle UE ».
2. Saisir CM 24 : le panneau affiche 24 h au total et 36 h payées. Ajouter TD 18 et TP 12 : 54 h et 66 h.
3. Saisir un taux de 10 000 : le coût affiché est 660 000.
4. Pondérations 50/40/0 : alerte « La somme doit faire 100 % ». L'enregistrement est refusé (« actuellement 90 % »). Corriger avec TP = 10.
5. Créer une UE de semestre 2, spécialité GL, en décochant le calcul automatique : volume payé manuel de 50 h, signalé par ✎ dans le tableau.
6. Vérifier les sous-totaux et le compteur « 17 / 60 — il manque 43 crédit(s) ».
7. Modifier INF101 avec CM 30 : 60 h au total et 75 h payées, recalculées en direct puis enregistrées.
8. Filtrer sur le tronc commun, supprimer une UE, vérifier l'affichage sur téléphone.
