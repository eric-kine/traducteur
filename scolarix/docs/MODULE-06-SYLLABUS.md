# Module 6 — Génération automatique des syllabus

## 1. Données utilisées

Le syllabus d'une UE, pour une année académique, est **assemblé automatiquement** à partir de trois sources :

| Source | Ce qu'elle fournit |
|---|---|
| **UE** (module 2) | code, intitulé, niveau, spécialité, semestre, crédits ECTS, coefficient, **volumes CM / TD / TP / total**, pondérations ; objectifs, prérequis et bibliographie par défaut |
| **Affectations** (module 3) | **enseignant responsable** (affectation « responsable ») et intervenants, avec leurs types de séance et leur email |
| **Table `Syllabus`** (ce module) | les **champs complémentaires** rédigés pour l'année : voir ci-dessous |

Les champs complémentaires sont :
- objectifs, compétences visées, prérequis ;
- **contenu détaillé** (chapitres) ;
- **méthodes pédagogiques** ;
- précisions sur l'évaluation ;
- bibliographie ;
- statut brouillon ou publié.

Les **modalités d'évaluation** sont générées depuis les pondérations de l'UE et les règles du module 4 (fonction partagée `evaluationSummary`). Exemple : « Note de l'UE = Contrôle continu : 30 % + Examen final : 50 % + TP : 20 % ». La note de validation, la compensation et le rattrapage sont aussi décrits. Les précisions saisies s'y ajoutent.

## 2. Schéma Prisma

```prisma
model Syllabus {
  status            PublicationStatus  // BROUILLON | PUBLIE (« BROUILLON » imprimé sinon)
  objectives        String?            // null → objectifs de l'UE
  competencies      String?
  prerequisites     String?            // null → prérequis de l'UE
  content           Json?              // [{ title, sessionType: CM|TD|TP|null, hours, description }]
  teachingMethods   String?            // nouveau
  evaluationMethods String?            // précisions (le reste est généré)
  bibliography      String?            // null → bibliographie de l'UE
  generatedAt       DateTime?          // dernière génération PDF
  updatedBy → User                     // nouveau : qui a modifié en dernier
  @@unique([teachingUnitId, academicYearId])
}
```

Migration `*_syllabus_fields` : ajoute `teachingMethods` et `updatedById`, et supprime `pdfUrl`, qui n'était pas utilisé (table vide). Les PDF sont générés à la demande.

## 3. Endpoints

| Méthode | Route | Rôle |
|---|---|---|
| **GET** | **`/api/ues/:id/syllabus?year=2026-2027`** | PDF du syllabus (`&format=html` : aperçu) ; sans `year` → année courante |
| GET | `/api/ues/:id/syllabus/data?year=…` | Données de l'éditeur (UE, enseignants, champs, droit de modifier) |
| PUT | `/api/ues/:id/syllabus` | Enregistre les champs complémentaires |
| **GET** | **`/api/levels/:id/syllabi?year=…[&semester=1][&includeDrafts=false]`** | **ZIP** : un PDF par UE active du niveau (`S1-INF101.pdf`, `S2-GL201.pdf`…) |

**Droits.**
- Lecture : tout utilisateur connecté. Un agent de scolarité reste limité à son école.
- Rédaction : l'administration, la scolarité de l'école et **l'enseignant responsable de l'UE** pour l'année.

**ZIP.**
- Toutes les données sont vérifiées **avant** l'envoi : une erreur renvoie un vrai message, pas une archive coupée.
- L'archive est ensuite construite au fil de l'eau (bibliothèque `archiver`).
- L'en-tête `X-Syllabus-Count` donne le nombre de syllabus.

## 4. Gabarit HTML / PDF

Fichier : `backend/src/pdf/templates/syllabus.ts`. Format A4, sur plusieurs pages si nécessaire.

**En-tête :**
- logo Scolarix, institut, école, niveau, spécialité, semestre, année ;
- bandeau avec code et intitulé de l'UE ;
- tableau : crédits, coefficient, volumes CM / TD / TP / total, responsable, intervenants.

**Sections, dans l'ordre :** Présentation, Objectifs, Compétences, Prérequis, **Contenu détaillé** (avec le total des heures prévues comparé au volume de l'UE), Méthodes pédagogiques, Modalités d'évaluation, Bibliographie (numérotée).

**Pied de page :** référence de l'UE et numérotation « Page X / Y ». Le moteur PDF accepte désormais ce pied de page en option (`htmlToPdf(html, { footerText })`).

**Mise en forme du texte :** une ligne commençant par « - » devient une puce. Tout le texte est échappé.

**Aperçus** (données fictives) : [`apercu-syllabus.html`](apercu-syllabus.html), [`apercu-syllabus.pdf`](apercu-syllabus.pdf). Pour les régénérer : `npm run preview:documents -w backend`.

## 5. Formulaire d'édition

Accès : **Maquette d'un niveau → icône 📄 « Syllabus »** sur une UE (`/syllabus/:ueId?year=…`).

- Choix de l'année ; boutons **Aperçu**, **PDF**, **Enregistrer**.
- Les champs sont **pré-remplis avec le texte de l'UE** tant que le syllabus n'a pas été rédigé.
- **Éditeur de chapitres** : ajouter, monter, descendre, supprimer ; titre, type (CM/TD/TP), heures, description.
  Un contrôle en direct compare les heures prévues au volume de l'UE pour chaque type (vert si égal, rouge si dépassé). Exemple : « CM : 30 h / 30 h ».
- Encadré des modalités d'évaluation générées, plus un champ de précisions.
- Colonne de droite : informations de l'UE et enseignants affectés (le responsable est mis en évidence).
- Case **Publié** : sans elle, la mention « BROUILLON » apparaît sur le PDF.
- **Lecture seule** pour les personnes qui n'ont pas le droit de modifier.
- Dans la maquette, le bouton **« Syllabus (ZIP) »** télécharge les syllabus de toutes les UE du niveau pour l'année courante.

## 6. Tests et validation

**Automatiques** : 8 nouveaux tests, 144 au total (`tests/integration/syllabi.test.ts`).
- Pré-remplissage depuis l'UE ; année courante par défaut ; enregistrement ; validation des chapitres.
- Droits : le responsable peut modifier ; un autre enseignant est refusé (403) ; un agent d'une autre école est refusé.
- Aperçu HTML : toutes les rubriques demandées sont présentes, et le texte est échappé.
- PDF valide ; `generatedAt` mis à jour.
- **ZIP** : signature `PK`, nom de l'archive, un PDF par UE, filtres « rédigés seulement » et « semestre ».
- Erreurs 404.

**Scénario manuel** (vérifié dans un navigateur) :
1. INF101 : l'éditeur affiche « Pas encore rédigé » ; les objectifs sont repris de l'UE ; Dr Fall apparaît comme responsable.
2. Saisie des compétences et de 4 chapitres. Le contrôle affiche « CM 30 h / 30 h · TD 18 h / 18 h · TP 12 h / 12 h ». Les boutons monter et descendre fonctionnent.
3. Saisie des méthodes, des précisions sur l'évaluation et de la bibliographie ; publication ; enregistrement ; rechargement : tout est conservé.
4. Aperçu avec les 7 sections ; PDF de 2 pages numérotées.
5. **ZIP** `syllabus-EIT-N1-2026-2027.zip` : contient `S1-INF101.pdf` et `S2-GL201.pdf`, qui s'ouvrent correctement.
