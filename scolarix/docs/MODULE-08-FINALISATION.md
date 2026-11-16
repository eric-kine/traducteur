# Module 8 — Tableau de bord, rôles, espaces enseignant et étudiant, démo, déploiement

## 1. Tableau de bord (ADMIN, SCOLARITE)

`GET /api/dashboard`, accueil des rôles ADMIN et SCOLARITE. Un agent de scolarité rattaché à une école ne voit que cette école.

**Indicateurs :**
- écoles, niveaux, étudiants actifs, enseignants actifs, UE, inscrits de l'année courante ;
- certificats et relevés émis sur les 30 derniers jours ;
- comptes actifs ;
- répartition par école et nombre d'inscrits par niveau.

**Alertes**, calculées sur l'année courante, chacune avec la liste détaillée et un lien vers l'écran concerné :

| Alerte | Règle |
|---|---|
| Aucune année courante | Il n'existe aucune année académique « courante » |
| Heures non affectées ⚠ | Pour une UE et un type (CM/TD/TP) : heures affectées < quota (ex. « INF101 TD : 0/18 h ») |
| UE sans responsable | UE qui a des affectations mais aucun responsable |
| Étudiants non inscrits ⚠ | Étudiants actifs sans inscription pour l'année courante |
| Inscriptions en attente | Inscriptions au statut « En attente » |
| Notes encore à saisir | Dans un niveau non délibéré : inscrits sans note de session normale dans une UE |
| Emplois du temps à finaliser | Pas généré, séances non placées, ou brouillon non publié |
| UE sans syllabus | Aucun syllabus rédigé pour l'année |
| Enseignants sans compte | Fiche active sans compte de connexion |

## 2. Rôles et permissions

- La **matrice unique** est dans `packages/shared/src/permissions.ts`. Elle est affichée dans **Utilisateurs → Rôles et permissions** et recopiée dans le README.
- Le serveur l'applique route par route : middleware `authorize(...)`, plus le contrôle de périmètre « école » dans les services.
- Le **menu** s'adapte au rôle :
  - ADMIN et SCOLARITE ont la gestion complète, chacun dans son périmètre ;
  - ENSEIGNANT et ETUDIANT n'ont que « Mon espace » et « Mon compte ».
- Une page interdite tapée à la main affiche « Accès refusé », et l'API répond 403.

**Comptes reliés aux fiches :**

| Route | Rôle |
|---|---|
| `GET / POST /api/teachers/:id/account` | Voir ou créer le compte ENSEIGNANT (email de la fiche) |
| `GET / POST /api/students/:id/account` `{ email? }` | Voir ou créer le compte ETUDIANT (email de la fiche ou fourni) |

- Le **mot de passe provisoire** (format `Scx-XXXX-XXXX7`) n'est renvoyé et affiché **qu'une seule fois**.
- Un compte existant du **même rôle** avec cet email est simplement relié à la fiche.
- Un compte d'un **autre rôle** avec cet email est refusé (409).

## 3. Espace étudiant (`/api/me/…`, rôle ETUDIANT)

L'étudiant ne voit **que** sa propre fiche.

| Route | Contenu |
|---|---|
| `GET /api/me/student` | Profil et inscriptions (avec l'état « délibéré ») |
| `GET /api/me/results?year=` | Notes, moyennes et crédits, provisoires tant que la délibération n'a pas eu lieu |
| `GET /api/me/transcript?year=` | **Relevé officiel PDF**, disponible seulement **après délibération** (403 avant) |
| `GET /api/me/certificate?year=` | **Certificat en libre-service** ; si un certificat valide a moins de 24 h, son duplicata est renvoyé (pas de numéro gaspillé) |
| `GET /api/me/certificates`, `/api/me/certificates/:id/pdf` | Ses certificats et leurs duplicatas |
| `GET /api/me/timetable?semester=[&format=pdf]` | Emploi du temps **publié** de son niveau : tronc commun et **sa** spécialité seulement |

Écran (accueil de l'étudiant) : en-tête avec photo, puis onglets **Mes notes / Mes documents / Mon emploi du temps**.

## 4. Espace enseignant (`/api/me/…`, rôle ENSEIGNANT)

| Route | Contenu |
|---|---|
| `GET /api/me/teacher` | Ses UE de l'année (types, heures prévues et assurées, responsable ou non, nombre d'étudiants, notes saisies) et son bilan de service |
| `GET /api/me/teacher/courses/:ueId/students?academicYearId=` | Les étudiants d'**une de ses** UE (403 sinon) |
| `GET /api/me/timetable?semester=` | Son emploi du temps (emplois du temps publiés seulement) |
| Routes existantes | **Saisie des notes** de ses UE (module 4) ; **rédaction du syllabus** s'il est responsable (module 6) |

Écran (accueil de l'enseignant) :
- 4 compteurs : heures prévues, heures assurées, équivalent TD, montant estimé ;
- une carte par UE, avec la progression de la saisie des notes et trois boutons : **Saisir les notes**, **Étudiants**, **Syllabus** ;
- l'onglet **Mon emploi du temps**.

## 5. Données de démonstration

Script : `backend/scripts/seed-demo.ts`. Commande : `npm run db:seed:demo -w backend`.

Il ne s'exécute que sur une base **vide** (aucune école) : rien d'existant n'est écrasé. Il utilise les **services de l'application** : matricules, calculs des notes, délibération, générateur d'emploi du temps, certificat. Les données sont donc cohérentes, et identiques à chaque installation (générateur aléatoire à graine fixe).

**Contenu :**
- 2 écoles (EIT, ESC), 4 spécialités, 5 niveaux, 15 UE, 6 salles ;
- 8 enseignants : disponibilités, toutes les heures affectées ;
- 41 étudiants ;
- notes de EIT L1 saisies (avec rattrapage) et **délibérées** ; notes de ESC B1 en cours ;
- emplois du temps : EIT L1 S1 publié, EIT L1 S2 et ESC B1 S1 en brouillon ;
- syllabus INF101 publié, un certificat.

Comptes : voir le README, § 4.

## 6. Déploiement

Fichiers :
- `backend/Dockerfile` : Node 22, Chromium, utilisateur non-root, contrôle de santé. Au démarrage : migrations, puis seed minimal, puis lancement du serveur.
- `frontend/Dockerfile` : build Vite, puis nginx.
- `docker/nginx.conf` : application monopage, relais `/api`, en-têtes de sécurité, cache des fichiers du site.
- `docker-compose.prod.yml` : seul le conteneur `web` est publié ; volumes `db-data` et `uploads`.
- `.env.production.example` : modèle de configuration.

Le guide complet (installation, HTTPS, mises à jour, sauvegardes, dépannage) est dans le README, § 7 à 10.

Nouvelle variable `COOKIE_SECURE` : cookie de session réservé au HTTPS, `true` par défaut en production. On ne la met à `false` que pour un essai local de l'image de production en http://localhost.

## 7. Tests et validation

**Automatiques** : 10 nouveaux tests (`tests/integration/spaces.test.ts`).
- Comptes : création avec mot de passe provisoire, connexion, compte en double refusé ; email requis pour un étudiant ; liaison d'un compte existant ; conflit de rôle.
- Étudiant :
  - notes provisoires ; relevé refusé avant la délibération, puis PDF après ;
  - certificat en libre-service réutilisé dans les 24 h ;
  - **isolation** : 7 routes d'autres données renvoient 403, et le certificat d'un autre étudiant renvoie 404 ;
  - emploi du temps visible seulement une fois publié.
- Enseignant : ses UE, ses étudiants, son service ; saisie des notes de **ses** UE seulement ; syllabus en tant que responsable ; compte sans fiche reliée.
- Tableau de bord : indicateurs, alertes (dont les heures non affectées), périmètre de la scolarité, rôle ENSEIGNANT refusé.

**Scénario manuel sur la base de démonstration** (vérifié dans un navigateur, 4 rôles) :
1. **ADMIN** : indicateurs (41 étudiants, 8 enseignants, 15 UE, 2 écoles) et 5 alertes ; matrice des permissions ; création du compte de Khady Diop avec son mot de passe provisoire.
2. **SCOLARITÉ** : menu sans « Utilisateurs », tableau de bord limité à l'école EIT.
3. **ENSEIGNANT** (Dr Fall) :
   - menu réduit à « Mon espace » et « Mon compte » ;
   - service : 90 h prévues, 36 h assurées, 570 000 ;
   - 2 UE ; 24 étudiants en INF101 ;
   - feuille de notes **verrouillée**, car le niveau a été délibéré ;
   - emploi du temps : 3 séances ;
   - /students, /admin et /users affichent « Accès refusé ».
4. **ÉTUDIANTE** (Awa Diallo) :
   - 14,09/20, 40/40 crédits, mention Bien, admise ;
   - relevé officiel PDF ; certificat en libre-service (le même numéro est réutilisé) ;
   - emploi du temps : 9 séances, sans les cours de la spécialité RT ;
   - /students affiche « Accès refusé » ;
   - mobile : pas de défilement horizontal.
5. **Docker** : construction des 3 images, démarrage de la pile complète, connexion et génération d'un PDF dans les conteneurs (voir le compte rendu du module).
