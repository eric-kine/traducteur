# Module 4 — Notes, résultats et relevés de notes (PDF)

## 1. Schéma Prisma

```prisma
model Grade {
  session      ExamSession            // NORMALE | RATTRAPAGE
  ccScore      Decimal? (4,2)         // /20  contrôle continu (non ressaisi au rattrapage)
  examScore    Decimal? (4,2)         // /20
  tpScore      Decimal? (4,2)         // /20
  finalScore   Decimal? (4,2)         // CALCULÉ par le serveur (jamais saisi)
  isAbsent     Boolean                // absent à l'examen → examen = 0, affiché "ABS"
  isValidated  Boolean                // finalScore ≥ 10
  isLocked     Boolean                // verrouillée par la délibération
  enrollmentId → Enrollment ; teachingUnitId → TeachingUnit
  enteredByUserId → User              // traçabilité : qui a saisi/modifié en dernier
  @@unique([enrollmentId, teachingUnitId, session])
}
model Enrollment { … finalAverage, creditsEarned, decision, mention, deliberatedAt }   // figés à la délibération
model GeneratedDocument { … fileUrl? }  // registre des relevés émis (référence, code, snapshot)
```

**Migration** `*_grades_transcripts`. Elle change trois choses :
- `enteredById`, qui pointait vers un enseignant, devient `enteredByUserId`, qui pointe vers un utilisateur. La table des notes était vide : aucune donnée perdue.
- Elle ajoute les colonnes de délibération sur l'inscription.
- Elle ajoute la contrainte CHECK « notes entre 0 et 20 ».

La **pondération** (CC / Examen / TP en %, somme = 100) se règle sur chaque UE (module 2).

## 2. Règles de calcul

Elles sont écrites dans **`packages/shared/src/calc/grades.ts`** : le même code calcule sur le serveur et dans l'écran de saisie.
Les paramètres du règlement se trouvent dans `GRADING_RULES` :

| Paramètre | Valeur par défaut | Rôle |
|---|---|---|
| `passMark` | 10 | note de validation d'une UE et seuil de la compensation |
| `compensation` | `true` | compensation entre les UE d'un même semestre |
| `eliminatoryMark` | 5 | en dessous, une UE ne peut pas être compensée |
| `carryOverMinRatio` | `null` (désactivé) | ex. `0.75` → « admis avec dettes » si 75 % des crédits sont acquis |
| `mentions` | 16 / 14 / 12 / 10 | Très bien / Bien / Assez bien / Passable |

| # | Règle | Exemple |
|---|---|---|
| 1 | **Note d'UE** = (CC × %CC + Examen × %Examen + TP × %TP) / 100. Seules les composantes pondérées > 0 sont exigées. Si une composante manque, la note reste vide (—) | 40/60 : CC 14, Examen 12 → **12,80** |
| 2 | **Absent à l'examen** : l'examen compte 0 | 50/40/10 : CC 10, ABS, TP 12 → **6,20** |
| 3 | **Rattrapage** : ouvert aux étudiants dont la note d'UE est < 10. La note d'examen de rattrapage remplace celle de la session normale ; le CC est conservé (le TP aussi, sauf s'il est ressaisi). **La meilleure des deux notes est retenue** (marquée ᴿ sur le relevé) | CC 8 conservé, examen 6 → 13 : 7,40 → **10,20** |
| 4 | **Moyenne semestrielle** = Σ(note × coefficient) / Σ coefficients | (14,70 × 3) / 3 = 14,70 |
| 5 | **Validation d'une UE** : **V** si note ≥ 10. Sinon **VC** (par compensation) si la moyenne du semestre ≥ 10 et la note ≥ 5. Sinon **NV** | 7,80 dans un semestre à 12,03 → VC |
| 6 | **Crédits acquis** = somme des crédits des UE V ou VC | |
| 7 | **Moyenne annuelle** = moyenne de toutes les UE de l'année, pondérée par les coefficients (et non la moyenne des deux semestres) | (14,70 × 3 + 15,40 × 1) / 4 = **14,88** |
| 8 | **Décision** : **ADMIS** si toutes les UE sont V ou VC ; **ADMIS AVEC DETTES** si l'option est activée et le ratio atteint ; sinon **AJOURNÉ (redoublant)** ; **INCOMPLET** tant qu'une note manque | |
| 9 | **Mention** selon la moyenne annuelle, **pour les admis seulement** | 14,88 → Bien |
| 10 | Arrondi au centième, calculs en centièmes (pas d'erreur de virgule) | |

À noter :
- La compensation se fait **au sein d'un semestre**, pas entre les deux semestres. Un étudiant peut donc avoir une moyenne annuelle ≥ 10 et être ajourné, si un semestre est sous 10 et contient une UE non validée.
- Les UE prises en compte pour un étudiant : celles de son niveau qui sont actives, de tronc commun ou de **sa** spécialité.

## 3. Endpoints

| Méthode | Route | Accès |
|---|---|---|
| GET | `/api/teaching-units/:id/grades?academicYearId=&session=` | ADMIN, SCOLARITE (son école), ENSEIGNANT **affecté à l'UE cette année-là** |
| PUT | `/api/teaching-units/:id/grades` `{ academicYearId, session, grades: [{ enrollmentId, ccScore, examScore, tpScore, isAbsent }] }` | idem ; 409 si les notes sont verrouillées |
| GET | `/api/enrollments/:id/results` | ADMIN, SCOLARITE |
| GET | `/api/levels/:id/results?academicYearId=` | idem — tableau de la classe |
| POST | `/api/levels/:id/deliberation` `{ academicYearId }` | idem — refusée si un résultat est incomplet |
| POST | `/api/levels/:id/deliberation/reopen` `{ academicYearId }` | ADMIN |
| **GET** | **`/api/students/:id/transcript?year=2026-2027`** | ADMIN, SCOLARITE — **renvoie le PDF** (`&format=html` : aperçu) |
| GET | `/api/transcripts/preview?format=html\|pdf` | aperçu du gabarit avec des données fictives |

La délibération fige, sur chaque inscription :
- la moyenne, les crédits, la décision et la mention ;
- le statut (ADMIS ou AJOURNÉ) ;
- le verrouillage des notes.

Chaque **PDF** émis est enregistré dans `GeneratedDocument` avec :
- une **référence** unique (`RN-2026-000001`) ;
- un **code de vérification** (10 caractères) ;
- une copie exacte des données imprimées.

Ces trois éléments servent à vérifier l'authenticité d'un relevé. Un aperçu HTML n'est pas enregistré.

## 4. Service PDF

- `backend/src/pdf/pdf.service.ts` : Puppeteer (`puppeteer-core`) et Chromium.
  - Un seul navigateur est lancé, puis réutilisé.
  - Dans la page, JavaScript est **désactivé** et **tout accès réseau est bloqué** : le document ne peut rien charger de l'extérieur.
  - Chemin du navigateur : variable `CHROMIUM_PATH`, sinon détection automatique.
- `backend/src/pdf/templates/transcript.ts` : gabarit A4 dans une fonction TypeScript, avec toutes les valeurs **échappées**.
  - **En-tête** : logo Scolarix (vectoriel intégré), nom et sigle de l'institut, école, coordonnées, référence et code de vérification.
  - **Identité** : étudiant, niveau, spécialité, diplôme préparé.
  - **Tableau par semestre** : CC, Examen, TP, note, résultat, crédits.
  - **Bilan** : moyenne annuelle, crédits, mention, décision.
  - **Légende**, puis « Fait à … le … » et la signature du directeur de l'école (ou, à défaut, de l'institut).
  - Avant la délibération, le filigrane **PROVISOIRE** apparaît.
- **Aperçu du gabarit** : [`apercu-releve.html`](apercu-releve.html) et [`apercu-releve.pdf`](apercu-releve.pdf), avec des données fictives. Pour les régénérer : `npm run preview:transcript -w backend`.

## 5. Écrans

| Écran | Accès | Contenu |
|---|---|---|
| **Saisie des notes** (`/grades/:ueId`) | Maquette → icône 📋 sur une UE | Onglets Session normale / Rattrapage, une ligne par étudiant (CC, Examen, TP, Absent), **note finale calculée en direct**, nombre de notes saisies et moyenne de la classe, enregistrement de toute la feuille d'un coup, verrou visible après délibération |
| **Résultats** (`/admin/levels/:id/results`) | Maquette → « Résultats » | Moyennes S1/S2/année, crédits, mention, décision ; « Délibérer » (avec confirmation) ; « Rouvrir » (admin) ; aperçu 👁 et PDF ⬇ par étudiant |
| Fiche étudiant | Étudiants → un étudiant | Bouton « Relevé de notes (PDF) » sur chaque inscription |

## 6. Tests et validation

**Automatiques** : 27 nouveaux tests, 127 au total.
- *Règles de calcul* (`tests/unit/grades-calc.test.ts`) : pondérations, absence, note manquante, rattrapage, meilleure note retenue, moyenne pondérée, V / VC / NV, note éliminatoire, décisions (dont « avec dettes »), mentions.
- *API* (`tests/integration/grades.test.ts`) :
  - note finale imposée par le client ignorée ; bornes 0–20 ;
  - liste du rattrapage ; droits de l'enseignant affecté et refus pour une autre UE ;
  - résultats de classe ; délibération refusée si incomplète, puis faite et verrouillée ; réouverture ;
  - **PDF** : en-tête `%PDF-`, référence, registre ;
  - aperçu HTML échappé et marqué « provisoire » ; 404 et 400.

**Scénario manuel** (vérifié dans un navigateur) :
1. INF101 (pondération 50/40/10) :
   - Awa (15 / 14 / 16) obtient **14,70** pendant la frappe ;
   - Cheikh, absent avec CC 10 et TP 12, obtient **6,20** ;
   - Ousmane obtient 7,40.
2. Rattrapage : seuls Cheikh et Ousmane apparaissent. Ousmane passe l'examen à 13 et obtient **10,20** (CC conservé).
3. GL201 (spécialité GL) : seules Awa et Fatou apparaissent.
4. Résultats :
   - Awa : 14,88, **Bien, Admise** ;
   - Ousmane : 10,20, Passable, Admis ;
   - Fatou : 10,88 mais semestre 2 à 8,40, donc **ajournée** ;
   - Cheikh : ajourné.
5. Délibération : « 2/4 admis » ; la feuille de notes est ensuite verrouillée.
6. Relevé PDF d'Awa : 83 Ko, référence RN-2026-000002, enregistré au registre.
