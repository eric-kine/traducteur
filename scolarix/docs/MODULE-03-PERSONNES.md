# Module 3 — Étudiants, enseignants, affectations et inscriptions

## 1. Schéma Prisma (modifications)

| Modèle | Changement |
|---|---|
| `AcademicYear` | Libellé `2026-2027`, dates, `isCurrent` : une seule année courante, gérée par une transaction |
| `Student` | `photoUrl` est renommé en **`photoPath`** (nom du fichier stocké, sans perte de données). Ajout de `guardianRelation` et `guardianEmail` |
| `Teacher` | `employeeNumber` est généré automatiquement (`ENS-00001`) |
| `TeachingAssignment` | `assignedHours` = heures **prévues** ; nouveau champ `completedHours` = heures **assurées**. Unicité enseignant × UE × année × type. Nouvel index (enseignant, année) |
| `Enrollment` | Une inscription par étudiant et par année. Le niveau et la spécialité appartiennent à l'école de l'étudiant |
| `Counter` (nouveau) | Compteurs atomiques pour les numéros : `matricule:EIT:2026` → `EIT-2026-00042` ; `teacher` → `ENS-00007` |

**Migration** `*_students_teachers_assignments`. Elle ajoute aussi deux contraintes CHECK :
- heures prévues > 0 et heures assurées ≥ 0 ;
- taux horaire ≥ 0.

**Numérotation.** L'incrément se fait en une seule requête SQL : `INSERT … ON CONFLICT DO UPDATE … RETURNING`. Deux créations simultanées n'obtiennent donc jamais le même numéro.
L'année utilisée dans le matricule est, dans l'ordre :
1. celle de l'inscription ;
2. sinon l'année courante ;
3. sinon l'année civile.

## 2. Endpoints

| Ressource | Routes | Accès |
|---|---|---|
| Années académiques | `GET/POST /api/academic-years`, `PATCH/DELETE /api/academic-years/:id` | lecture : connecté ; écriture : ADMIN |
| Étudiants | `GET/POST /api/students`, `GET/PATCH/DELETE /api/students/:id`, `GET /api/students/:id/enrollments` | ADMIN, SCOLARITE (limité à son école) |
| Photo | `PUT/GET/DELETE /api/students/:id/photo` | idem |
| Import CSV | `POST /api/students/import` (multipart : `file`, `schoolId`, `academicYearId?`, `dryRun`) | idem |
| Inscriptions | `GET/POST /api/enrollments`, `PATCH/DELETE /api/enrollments/:id` | idem |
| Enseignants | `GET/POST /api/teachers`, `GET/PATCH /api/teachers/:id`, `GET /api/teachers/:id/service?academicYearId=` | ADMIN, SCOLARITE ; suppression : ADMIN |
| Affectations | `GET/POST /api/assignments`, `PATCH/DELETE /api/assignments/:id` | ADMIN, SCOLARITE de l'école de l'UE |
| Couverture d'une UE | `GET /api/teaching-units/:id/coverage?academicYearId=` | idem |

**Règles métier**

- **Quota d'heures** : pour une UE, un type (CM/TD/TP) et une année, la somme des heures prévues ne dépasse pas le quota de l'UE. Le message donne le reste disponible.
  La ligne de l'UE est verrouillée (`FOR UPDATE`) pendant la vérification : deux affectations simultanées ne peuvent pas dépasser le quota ensemble.
- Les heures assurées ne dépassent pas les heures prévues.
- Il y a un seul responsable par UE et par année.
- Un enseignant désactivé ne peut pas recevoir de nouvelle affectation.
- **Bilan de service** : heures assurées par type, converties en équivalent TD (mêmes coefficients que le module 2), multipliées par le taux horaire **de l'enseignant**.
- **Photo** :
  - 2 Mo maximum ;
  - le type réel est vérifié à partir des premiers octets du fichier (JPEG, PNG ou WebP) ;
  - le fichier est enregistré sous un nom aléatoire, dans `UPLOAD_DIR`, en dehors du dépôt Git ;
  - elle n'est accessible qu'avec une session valide, car c'est une donnée personnelle.
- **Suppressions** :
  - un étudiant qui a des notes ou des documents émis ne peut pas être supprimé : on change son statut à la place ;
  - un enseignant qui a des affectations non plus : on le désactive ;
  - une année qui a des inscriptions ou des affectations non plus.
- Les données des étudiants sont **invisibles pour les rôles ENSEIGNANT et ETUDIANT** pour l'instant.

## 3. Import CSV d'étudiants

1. Téléchargez le **modèle** depuis la fenêtre d'import. Il s'ouvre directement dans Excel (séparateur `;`, UTF-8).
2. Colonnes obligatoires : `nom`, `prenom`, `sexe`, `date_naissance`, `lieu_naissance`.
   Colonnes facultatives : `nationalite`, `email`, `telephone`, `adresse`, `tuteur_nom`, `tuteur_lien`, `tuteur_telephone`, `tuteur_email`, `niveau`, `specialite` (pour les deux dernières, mettez les codes, ex. `L1` et `GL`).
3. Le fichier est tolérant :
   - les en-têtes sont reconnus avec ou sans accents ni majuscules (« Date de naissance » fonctionne) ;
   - le séparateur `;` ou `,` est détecté automatiquement ;
   - les dates peuvent s'écrire `JJ/MM/AAAA` ou `AAAA-MM-JJ` ;
   - le sexe peut s'écrire `M`, `F`, `H`, `Homme`, `Femme`…
4. **« Vérifier le fichier »** : le serveur contrôle chaque ligne **sans rien enregistrer** et affiche le résultat (valide, erreur avec le détail, ou doublon).
5. **« Importer »** : les lignes valides sont enregistrées **en une seule fois (tout ou rien)**, avec matricule automatique et inscription si la colonne `niveau` est remplie et qu'une année est choisie.
6. Doublon = même nom, prénom et date de naissance, déjà présent dans l'école ou répété dans le fichier. Réimporter le même fichier ne crée donc rien en double.
7. Limites : 2 000 lignes et 2 Mo par fichier.

## 4. Pages React

| Page | Contenu |
|---|---|
| Administration → **Années académiques** | Liste, création (dates proposées automatiquement), ★ pour définir l'année courante, suppression |
| **Étudiants** (`/students`) | Recherche (nom, prénom, matricule), filtres (école, année, niveau, spécialité, statut), pagination, « Nouvel étudiant », « Importer (CSV) » |
| Fiche étudiant (`/students/:id`) | Photo (changer, retirer), état civil, tuteur, inscriptions (inscrire, modifier, supprimer), modifier, supprimer |
| **Enseignants** (`/teachers`) | Liste, recherche, filtre de statut, création |
| Fiche enseignant (`/teachers/:id`) | Choix de l'année ; 4 compteurs (prévues, assurées, équivalent TD, montant dû) ; affectations avec barre de progression ; « Affecter à une UE » |
| Fenêtre d'affectation | Listes liées école → niveau → UE → type ; quota, heures déjà affectées et **reste disponible** en direct ; heures prévues pré-remplies avec ce reste |

## 5. Tests et validation

**Automatiques** : 18 nouveaux tests (100 au total, `tests/integration/people.test.ts`).
- Années : année courante unique, dont un **test de non-régression** sur le bug trouvé pendant le test manuel ; validation ; doublon.
- Étudiants : matricules successifs `EIT-2026-00001`, `-00002` ; inscription à la création ; validation ; niveau d'une autre école refusé ; recherche et filtres ; périmètre SCOLARITE ; ENSEIGNANT refusé.
- Photo : envoi, lecture, faux fichier image refusé, accès sans session refusé.
- Inscriptions : unicité par année, modification, suppression.
- Import :
  - vérification à blanc : rapport détaillé et rien en base ;
  - import réel : matricules et inscriptions créés ;
  - réimport du même fichier : tout est signalé comme doublon ;
  - séparateur virgule accepté ; colonnes obligatoires exigées ; année exigée pour inscrire.
- Enseignants et affectations :
  - numéros `ENS-…` et email unique ;
  - quota respecté (« 8 h encore disponibles ») et UE sans heures de TP refusée ;
  - couverture de l'UE ;
  - doublon refusé, heures assurées > prévues refusées, un seul responsable ;
  - bilan : 10 h CM + 6 h TD assurées donnent 21 h équivalent TD, soit 210 000 ;
  - suppressions bloquées.

**Scénario manuel** (vérifié dans un navigateur) :
1. Créer l'année 2026-2027 : elle devient courante.
2. Créer Awa Diallo, inscrite en N1 GL : matricule `EIT-2026-00001`. Ajouter sa photo.
3. Importer un CSV de 4 lignes :
   - la vérification indique 3 lignes valides et 1 en erreur, avec le détail : sexe « X », date du 31/02 invalide, niveau « Z9 » inconnu ;
   - l'import enregistre 3 étudiants, matricules et inscriptions compris.
4. Créer Dr Ousmane Fall (`ENS-00001`, taux 10 000). L'affecter aux CM de INF101 : 30 h pré-remplies, marqué responsable.
5. Tenter 25 h de TD : refusé (« 18 h au total »). Saisir 18 h, dont 6 assurées.
6. Indiquer 10 h de CM assurées. Bilan : 48 h prévues, 16 h assurées, 21 h équivalent TD, 210 000 dus.
7. Sur téléphone : pas de défilement horizontal.
