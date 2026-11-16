# Module 7 — Emplois du temps automatiques

## 1. Schéma Prisma

```prisma
model Room {                       // salle, partagée par toutes les écoles
  code String @unique ; name? ; building? ; capacity Int ; isActive
  supportedTypes SessionType[]     // CM / TD / TP accueillis
  unavailability Json?             // [{ day: "LUNDI", start: "08:00" }, …]
}
model Timeslot {                   // grille de la semaine (identique LUNDI → SAMEDI)
  order Int ; startTime "08:00" ; endTime "10:00"    // par défaut 08-10, 10-12, 14-16, 16-18
}
model Schedule {                   // emploi du temps d'un NIVEAU pour un semestre
  academicYear, level, semester, weeks (14 par défaut), status BROUILLON|PUBLIE,
  generationReport Json, generatedAt
  @@unique([academicYearId, levelId, semester])
}
model ScheduleSession {            // séance hebdomadaire placée
  day Weekday ; timeslot ; sessionType ; teachingUnit ; teacher? ; room?
  audienceSpecialty?               // null = tronc commun (tout le niveau), sinon une spécialité
  locked Boolean                   // épinglée : conservée lors d'une régénération
  academicYearId, semester         // recopiés pour les contraintes ci-dessous
  @@unique([teacherId, academicYearId, semester, day, timeslotId])   // un enseignant, une case
  @@unique([roomId,    academicYearId, semester, day, timeslotId])   // une salle, une case
}
Teacher.unavailability Json?       // créneaux où l'enseignant n'est pas disponible
```

Migration `*_schedules` :
- elle remplace les anciennes tables `timetables` et `timetable_slots`, jamais utilisées et vides ;
- elle renomme `teachers.availability` (vide) en `unavailability` ;
- elle ajoute des CHECK : format des heures, capacité > 0, semestre entre 1 et 2, semaines entre 1 et 30.

**Les doubles réservations sont impossibles même en base** : les deux contraintes d'unicité ci-dessus refusent un enseignant ou une salle placés deux fois sur la même case.

**Un emploi du temps par niveau, avec des « publics ».** Le tronc commun et toutes les spécialités du niveau sont dans la même grille.
- Les séances de deux spécialités différentes (GL et RT) peuvent avoir lieu **en même temps**.
- Une séance de tronc commun occupe **tout** le niveau.

## 2. Des volumes horaires aux séances

Pour chaque UE du semestre et chaque type (CM / TD / TP) dont le volume est > 0 :

```
séances par semaine = ⌈ volume du semestre / (semaines × durée d'un créneau) ⌉   (au moins 1)
   ex. CM 30 h, 14 semaines, créneaux de 2 h → ⌈30 / 28⌉ = 2 séances par semaine
```

- **Enseignant** : celui de l'affectation de ce type (module 3). Si plusieurs enseignants se partagent les heures, les séances sont réparties au prorata de leurs heures (méthode du plus fort reste). Sans affectation : la séance est placée sans enseignant, avec un avertissement.
- **Effectif** : les inscrits du niveau (tronc commun) ou de la spécialité. Il sert à vérifier la capacité des salles.
- Le rapport affiche, pour chaque UE : le volume, le nombre de séances par semaine et les heures réellement prévues.

## 3. Algorithme : pseudo-code

Code : `backend/src/modules/schedules/scheduler.ts`. C'est une fonction pure (aucun accès à la base), testée seule.

```
ENTRÉES  jours (LUNDI→SAMEDI), créneaux, salles, séances à placer,
         indisponibilités (enseignants, salles), occupations des AUTRES niveaux, séances épinglées

CONTRAINTES DURES (jamais violées)
  C1 un enseignant : une séance par case, tous niveaux confondus
  C2 une salle : une séance par case, tous niveaux confondus
  C3 le niveau : pas deux séances pour le même public ; le tronc commun prend tout le niveau
  C4 enseignant disponible        C5 salle disponible
  C6 salle du bon type (CM/TD/TP) et assez grande pour le public

PRÉFÉRENCES (score, plus petit = meilleur)
  P1 +10 par séance de la même UE déjà ce jour-là (étaler une UE sur la semaine)
  P2 +2  par séance du même public ce jour-là (équilibrer les journées)
  P3 +0,1 × rang du créneau, +0,01 × rang du jour (plutôt le matin, plutôt en début de semaine)
  P4 la plus petite salle suffisante (garder les grands amphis libres)

1. réserver les séances épinglées
2. trier les séances : nombre de cases possibles croissant ("le plus contraint d'abord"),
                       puis CM avant TD/TP, puis public le plus nombreux
3. PLACER(i) :                                   ← retour arrière (backtracking)
       si i = nombre de séances : SUCCÈS
       pour chaque case (jour, créneau) possible, de la mieux notée à la moins bien notée :
           réserver enseignant + salle + public
           si PLACER(i + 1) : SUCCÈS
           libérer (retour arrière)
           si plus de 50 000 essais : ABANDON
       ÉCHEC
4. si PLACER(0) réussit → emploi du temps complet
   sinon → GLOUTON : chaque séance, dans l'ordre, prend sa meilleure case libre ;
           celles qui n'en ont aucune sont listées avec la raison
           (« aucune salle ne convient (type TP, 31 étudiants) », « l'enseignant n'est disponible
           sur aucune case libre », « la grille du niveau est pleine pour ce public »)
```

## 4. Endpoints

| Méthode | Route | Rôle |
|---|---|---|
| GET / POST / PATCH / DELETE | `/api/rooms[/:id]` | Salles : lecture ADMIN et SCOLARITE ; écriture ADMIN ; suppression refusée si elle est utilisée |
| GET / PUT | `/api/timeslots` | Grille horaire (créée par défaut) ; PUT réservé à ADMIN, refusé si les créneaux se chevauchent ou si un créneau supprimé est utilisé |
| PUT | `/api/teachers/:id/unavailability` | Indisponibilités d'un enseignant |
| **POST** | **`/api/schedules/generate`** `{ levelId, academicYearId, semester, weeks }` | Génère ou régénère (les séances épinglées sont conservées) ; renvoie la grille et le rapport |
| GET | `/api/schedules?levelId=&academicYearId=&semester=` | Grille du niveau (`null` si elle n'est pas encore générée) |
| GET / PATCH / DELETE | `/api/schedules/:id` | Lire ; publier ou repasser en brouillon ; supprimer |
| GET | `/api/schedules/:id/pdf` | **PDF** de la grille du niveau (A4 paysage) |
| POST | `/api/schedules/:id/sessions` | Ajouter une séance à la main |
| PATCH / DELETE | `/api/schedule-sessions/:id` | Déplacer, changer de salle ou d'enseignant, épingler ; supprimer. **409** avec la raison en cas de conflit |
| GET | `/api/timetables/teacher/:id?academicYearId=&semester=[&format=pdf]` | Grille **par enseignant**, tous niveaux et toutes écoles |
| GET | `/api/timetables/room/:id?…[&format=pdf]` | Grille **par salle** |

Accès : ADMIN, et SCOLARITE pour les niveaux de son école.

## 5. Pages React

| Page | Contenu |
|---|---|
| **Emplois du temps** (menu) | Année, semestre ; onglets **Par niveau / Par enseignant / Par salle** (voir ci-dessous) |
| Administration → **Salles & créneaux** | Salles (places, types accueillis, grille de disponibilité) ; créneaux horaires modifiables |
| Fiche enseignant → **Disponibilités** | Grille jours × créneaux : un clic rend un créneau indisponible |

**Onglet Par niveau :**
- choix de l'école, du niveau et du nombre de semaines ;
- **Générer / Régénérer**, **Publier**, **PDF** ;
- rapport : séances placées, séances non placées avec la raison, avertissements, tableau volumes → séances ;
- **calendrier interactif** :
  - glisser-déposer une séance vers une autre case ; le serveur refuse les conflits et le message s'affiche ;
  - clic sur une séance : changer de case, de salle (seules les salles compatibles sont proposées) ou d'enseignant, épingler, supprimer ;
  - 🔒 = séance épinglée.

**Onglets Par enseignant et Par salle :** grille en lecture seule et PDF.

Les couleurs distinguent les types : CM en bleu, TD en vert, TP en orange. Une ligne « Pause » s'affiche entre 12 h et 14 h.

## 6. Tests et validation

**Automatiques** : 21 nouveaux tests, 165 au total.
- *Algorithme* (`tests/unit/scheduler.test.ts`) :
  - calcul des séances hebdomadaires et répartition entre enseignants ;
  - tronc commun et spécialités en parallèle ;
  - indisponibilités et cours des autres niveaux ;
  - choix de la plus petite salle suffisante ;
  - séance impossible, avec la raison ; séances épinglées ;
  - étalement d'une UE sur la semaine ; repli glouton ;
  - **test de propriété sur 200 instances aléatoires** : aucune contrainte dure n'est jamais violée.
- *API* (`tests/integration/schedules.test.ts`) :
  - créneaux par défaut et chevauchements refusés ; salles ;
  - génération complète (CM en amphi, TP en labo, aucun conflit) ;
  - **enseignant partagé entre deux niveaux** jamais placé deux fois au même moment, et jamais sur ses indisponibilités ;
  - salle trop petite signalée dans le rapport ; régénération qui garde les séances épinglées ;
  - déplacements refusés (niveau, enseignant, salle occupée, indisponibilité de l'enseignant, salle indisponible ou inadaptée) ;
  - ajout et suppression manuels, publication ;
  - **PDF niveau, enseignant et salle** ;
  - salle ou créneau utilisés impossibles à supprimer ; droits.

**Scénario manuel** (vérifié dans un navigateur) :
1. Création de la salle AMPHI-A (150 places, indisponible le samedi à 16 h). Créneaux par défaut 08-10, 10-12, 14-16, 16-18.
2. Dr Fall est marqué indisponible le lundi matin.
3. Génération de N1 au semestre 1 : **9 séances sur 9 placées** par retour arrière (solution complète). L'avertissement « ANG101 TD : aucun enseignant affecté » s'affiche. Aucune séance de Dr Fall le lundi. GL103 et RT103 ne sont pas en parallèle, car elles ont le même enseignant.
4. Glisser-déposer d'une séance vers le samedi à 16 h : elle est déplacée et épinglée. Dépôt sur une case déjà prise : refusé, avec le message « Le niveau a déjà MAT101 (CM, tronc commun) sur ce créneau ».
5. Dialogue d'une séance de TD : seules les salles qui accueillent des TD sont proposées.
6. Publication ; PDF du niveau ; vue « Sow » (3 séances par semaine) ; vue « LAB-1 ».

## 7. Limites connues

- Les **groupes de TD/TP** (dédoubler une promotion trop nombreuse en G1 et G2) ne sont pas gérés : une séance concerne tout son public.
- La préférence « plutôt le matin » remplit les matinées en premier. Pour étaler sur les après-midi, ajustez le score P3 dans `scheduler.ts`.
