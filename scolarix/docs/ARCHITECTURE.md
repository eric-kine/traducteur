# Scolarix — Architecture globale (Module 0)

> Application web de gestion d'un institut supérieur privé regroupant plusieurs écoles.
> Ce document couvre uniquement le **socle** : arborescence, modèle de données, relations et plan de travail.

---

## 1. Vue d'ensemble

```
┌──────────────────────────┐        HTTPS / JSON (JWT)        ┌───────────────────────────┐
│  Frontend (navigateur)   │  ─────────────────────────────▶  │  Backend API              │
│  React + TS + Vite       │                                  │  Node.js + Express + TS   │
│  TailwindCSS + shadcn/ui │  ◀─────────────────────────────  │  Prisma ORM               │
│  TanStack Query          │        PDF (application/pdf)     │  Puppeteer (PDF)          │
└──────────────────────────┘                                  └─────────────┬─────────────┘
                                                                            │
                                                              ┌─────────────▼─────────────┐
                                                              │  PostgreSQL               │
                                                              └───────────────────────────┘
```

**Choix structurants**

| Sujet | Choix | Pourquoi |
|---|---|---|
| Framework backend | **Express + TypeScript**, organisé par modules métier | Plus simple à prendre en main que NestJS, tout en gardant une structure claire (un dossier = un module). |
| Validation | **Zod** (schémas partagés backend/frontend) | Une seule définition des règles (ex. CM+TD+TP = total). |
| Auth | JWT *access* (15 min) + *refresh* (7 j, cookie httpOnly), mots de passe **bcrypt** | Standard, sûr, sans état côté serveur. |
| PDF | **Puppeteer** + gabarits HTML (Handlebars) | Les relevés/certificats sont des mises en page « papier officiel » : HTML/CSS est le plus facile à styliser. |
| Emploi du temps | Algorithme glouton + retour arrière (backtracking) sur contraintes | Simple, explicable, suffisant pour un institut. |
| Monorepo | **npm workspaces** : `backend`, `frontend`, `packages/shared` | Types et schémas Zod partagés. |

---

## 2. Arborescence

```
scolarix/
├── package.json                  # npm workspaces
├── docker-compose.yml            # PostgreSQL local (+ pgAdmin)
├── .env.example
├── docs/
│   └── ARCHITECTURE.md           # ce document
│
├── packages/
│   └── shared/                   # code partagé front/back
│       └── src/
│           ├── enums.ts          # Role, SessionType… (miroir des enums Prisma)
│           ├── schemas/          # schémas Zod (school.schema.ts, teaching-unit.schema.ts…)
│           └── types/            # types DTO (réponses API)
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma         # ✅ livré dans ce module
│   │   ├── migrations/
│   │   └── seed.ts               # données de démo (institut, 2 écoles, admin…)
│   ├── src/
│   │   ├── server.ts             # démarrage HTTP
│   │   ├── app.ts                # création de l'app Express, middlewares, routes
│   │   ├── config/
│   │   │   ├── env.ts            # lecture + validation des variables d'env (Zod)
│   │   │   └── prisma.ts         # client Prisma unique
│   │   ├── common/
│   │   │   ├── middlewares/
│   │   │   │   ├── authenticate.ts     # vérifie le JWT
│   │   │   │   ├── authorize.ts        # authorize('ADMIN','SCOLARITE')
│   │   │   │   ├── school-scope.ts     # limite un agent SCOLARITE à son école
│   │   │   │   ├── validate.ts         # validate(zodSchema)
│   │   │   │   └── error-handler.ts
│   │   │   ├── errors/AppError.ts
│   │   │   └── utils/            # pagination, dates, matricule, arrondis
│   │   ├── modules/              # 1 dossier = 1 module métier
│   │   │   ├── auth/             # auth.routes.ts · auth.controller.ts · auth.service.ts
│   │   │   ├── users/
│   │   │   ├── institute/
│   │   │   ├── academic-years/
│   │   │   ├── schools/
│   │   │   ├── specialties/
│   │   │   ├── levels/
│   │   │   ├── teaching-units/
│   │   │   ├── students/
│   │   │   ├── teachers/         # + teaching-assignments
│   │   │   ├── enrollments/
│   │   │   ├── grades/
│   │   │   ├── documents/        # relevés + certificats
│   │   │   ├── syllabi/
│   │   │   └── timetables/
│   │   │       └── scheduler/    # algorithme de contraintes
│   │   └── pdf/
│   │       ├── pdf.service.ts    # Puppeteer : HTML → PDF
│   │       └── templates/        # *.hbs + styles d'impression
│   └── tests/
│       ├── unit/                 # Vitest
│       └── integration/          # Supertest + base de test
│
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── components.json           # config shadcn/ui
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── routes/               # React Router (routes protégées par rôle)
        ├── lib/
        │   ├── api.ts            # client HTTP (fetch + refresh token auto)
        │   └── utils.ts
        ├── hooks/                # useAuth, usePagination…
        ├── stores/               # état d'auth (Zustand)
        ├── components/
        │   ├── ui/               # composants shadcn (Button, Dialog, Table…)
        │   ├── layout/           # Sidebar, Topbar, AppShell
        │   └── common/           # DataTable, ConfirmDialog, SchoolSelector…
        └── features/             # miroir des modules backend
            ├── auth/
            ├── schools/
            ├── specialties/
            ├── levels/
            ├── teaching-units/
            ├── students/
            ├── teachers/
            ├── enrollments/
            ├── grades/
            ├── documents/
            ├── syllabi/
            └── timetables/
```

Chaque module backend suit le même découpage :

```
modules/schools/
├── schools.routes.ts       # déclare les URL + middlewares (auth, rôles, validation)
├── schools.controller.ts   # lit la requête, appelle le service, renvoie la réponse
├── schools.service.ts      # règles métier + accès Prisma
└── schools.schema.ts       # ré-export des schémas Zod partagés
```

---

## 3. Modèle de données

Le schéma complet et commenté est dans
[`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma) (validé avec `prisma validate`).

**Entités demandées** : `Institute`, `School`, `Specialty`, `Level`, `TeachingUnit`,
`Student`, `Teacher`, `Enrollment`, `Grade`, `Timetable`, `Syllabus`, `User`.

**Entités de support ajoutées** (indispensables pour que les modules fonctionnent) :

| Entité | Rôle |
|---|---|
| `AcademicYear` | Repère temporel (2026-2027) des inscriptions, notes, EDT, syllabus. |
| `TeachingAssignment` | Affectation enseignant ↔ UE, par année et par type (CM/TD/TP). |
| `Room` | Salles, nécessaires au générateur d'emploi du temps. |
| `TimetableSlot` | Créneaux (jour, heure, UE, enseignant, salle) d'un emploi du temps. |
| `GeneratedDocument` | Registre des PDF officiels émis (référence unique, code de vérification QR). |
| `RefreshToken` | Sessions de connexion (ajouté au module 1). |

**Règles métier clés portées par le schéma**

- Une UE appartient à un **niveau** ; `specialtyId` vide = UE de tronc commun.
- `totalHours = cmHours + tdHours + tpHours` (contrôlé dans le service + contrainte `CHECK` ajoutée dans la migration).
- `ccWeight + examWeight + tpWeight = 100` (même principe).
- Un étudiant a **une seule inscription par année** (`@@unique([studentId, academicYearId])`).
- Une note est unique par **inscription × UE × session** (normale / rattrapage).
- Un enseignant n'est pas lié à une école : il peut enseigner partout dans l'institut.
- Un agent `SCOLARITE` avec `schoolId` ne voit que son école.
- Suppressions en `Restrict` : impossible d'effacer une école qui a des étudiants (on la désactive via `isActive`).

---

## 4. Diagramme des relations

```
                                   ┌──────────────┐
                                   │  Institute   │
                                   └──────┬───────┘
                   ┌──────────────────────┼───────────────────────┐
                   │ 1..*                 │ 1..*                  │ 1..*
            ┌──────▼──────┐        ┌──────▼───────┐        ┌──────▼──────┐
            │ AcademicYear│        │    School    │        │    Room     │
            └──────┬──────┘        └──┬───┬───┬───┘        └──────┬──────┘
                   │                  │   │   │ 1..*              │
                   │          1..*    │   │   └───────────┐       │
                   │     ┌────────────┘   │ 1..*          │       │
                   │ ┌───▼──────┐   ┌─────▼────┐    ┌─────▼────┐  │
                   │ │Specialty │   │  Level   │    │ Student  │──┼──── 0..1 ── User
                   │ └───┬──────┘   └────┬─────┘    └────┬─────┘  │
                   │     │ 0..*          │ 1..*          │ 1..*   │
                   │     │      ┌────────▼────────┐      │        │
                   │     └─────▶│  TeachingUnit   │      │        │
                   │  (UE spé.) │ CM/TD/TP/Total/ │      │        │
                   │            │ Payé, crédits   │      │        │
                   │            └─┬───┬────┬───┬──┘      │        │
                   │              │   │    │   │         │        │
     ┌─────────────┼──────────────┘   │    │   └─────┐   │        │
     │             │                  │    │         │   │        │
┌────▼─────────────▼──┐  ┌────────────▼┐   │   ┌─────▼───▼────┐   │
│ TeachingAssignment  │  │  Syllabus   │   │   │  Enrollment  │◀── AcademicYear, Level,
│ (UE × Teacher ×     │  │ (UE × Année)│   │   │ (Student ×   │    Specialty?
│  Année × CM/TD/TP)  │  └─────────────┘   │   │  Année)      │
└────────▲────────────┘                    │   └──────┬───────┘
         │ 1..*                            │          │ 1..*
   ┌─────┴─────┐                     ┌─────▼──────────▼─────┐
   │  Teacher  │──── 0..1 ── User    │        Grade         │
   └─────┬─────┘                     │ (Enrollment × UE ×   │
         │                           │  Session)            │
         │                           └──────────────────────┘
         │ 0..*
┌────────▼────────┐  1..*  ┌──────────────┐
│  TimetableSlot  │◀───────│  Timetable   │◀── AcademicYear, Level, Specialty?, semestre
│ jour/heure/type │        └──────────────┘
└──┬──────────┬───┘
   │          └──▶ Room (0..1)
   └──▶ TeachingUnit (1)

GeneratedDocument ──▶ Student (0..1), Enrollment (0..1)
User ──▶ School (0..1)  // périmètre d'un agent SCOLARITE
```

**Lecture en clair**

| Relation | Cardinalité |
|---|---|
| Institute → School / AcademicYear / Room | 1 → N |
| School → Specialty / Level / Student | 1 → N |
| Level → TeachingUnit | 1 → N |
| Specialty → TeachingUnit | 1 → N (optionnelle : UE de tronc commun) |
| Student → Enrollment | 1 → N (une par année) |
| Enrollment → Level, AcademicYear, Specialty? | N → 1 |
| Enrollment → Grade | 1 → N |
| TeachingUnit → Grade | 1 → N |
| Teacher ↔ TeachingUnit | N ↔ N via **TeachingAssignment** (par année et type de séance) |
| TeachingUnit → Syllabus | 1 → N (un par année) |
| Timetable → TimetableSlot | 1 → N (suppression en cascade) |
| TimetableSlot → TeachingUnit / Teacher? / Room? | N → 1 |
| User ↔ Student / Teacher | 1 ↔ 0..1 |

---

## 5. Plan de travail (modules à venir)

| # | Module | Contenu principal |
|---|---|---|
| **0** | Architecture & modèle de données | ✅ ce document + `schema.prisma` |
| **0 bis** | Socle technique & authentification | ✅ JWT + rôles, utilisateurs — [`MODULE-00b-AUTH.md`](MODULE-00b-AUTH.md) |
| **1** | Institut, écoles, spécialités, niveaux | ✅ CRUD complets, page Administration — [`MODULE-01-STRUCTURE.md`](MODULE-01-STRUCTURE.md) |
| **2** | Unités d'Enseignement & quotas horaires | ✅ UE par niveau, CM/TD/TP, total calculé, volume payé, taux horaire, contenu pédagogique — [`MODULE-02-UE.md`](MODULE-02-UE.md) |
| **3** | Étudiants, enseignants, affectations & inscriptions | ✅ années académiques, matricule auto, photo, import CSV, affectations avec quotas — [`MODULE-03-PERSONNES.md`](MODULE-03-PERSONNES.md) |
| **4** | Notes & relevés de notes (PDF) | ✅ saisie CC/Examen/TP, rattrapage, moyennes, mention, décision, délibération, relevé PDF — [`MODULE-04-NOTES.md`](MODULE-04-NOTES.md) |
| **5** | Certificats de scolarité (PDF) | ✅ numérotation par année, QR code, vérification publique, historique, duplicata, annulation — [`MODULE-05-CERTIFICATS.md`](MODULE-05-CERTIFICATS.md) |
| **6** | Syllabus | Pré-remplissage automatique depuis l'UE, éditeur, export PDF |
| **7** | Emplois du temps | Salles, algorithme de contraintes, ajustement manuel, vues classe/enseignant/salle, export PDF |
| **8** | Comptes & tableaux de bord | Comptes étudiant/enseignant liés (espace enseignant : saisie de ses notes ; espace étudiant : ses relevés), statistiques, journal d'audit, déploiement |
