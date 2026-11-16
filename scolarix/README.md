# Scolarix

**Gestion complète d'un institut supérieur privé regroupant plusieurs écoles** : structure (écoles, spécialités, niveaux, UE), étudiants et enseignants, notes et délibérations, documents officiels (relevés, certificats, syllabus) et emplois du temps générés automatiquement.

> Toutes les données de démonstration (personnes, établissements) sont fictives.

---

## Sommaire

1. [Fonctionnalités](#1-fonctionnalités)
2. [Architecture](#2-architecture)
3. [Démarrer sur votre ordinateur](#3-démarrer-sur-votre-ordinateur)
4. [Données de démonstration](#4-données-de-démonstration)
5. [Rôles et permissions](#5-rôles-et-permissions)
6. [Tests](#6-tests)
7. [Déploiement avec Docker](#7-déploiement-avec-docker)
8. [Configuration](#8-configuration-variables-denvironnement)
9. [Sécurité : à vérifier avant la mise en ligne](#9-sécurité--à-vérifier-avant-la-mise-en-ligne)
10. [Dépannage](#10-dépannage)
11. [Structure du projet et documentation détaillée](#11-structure-du-projet-et-documentation-détaillée)

---

## 1. Fonctionnalités

| Domaine | Ce que fait Scolarix | Doc |
|---|---|---|
| **Comptes et sécurité** | Connexion par session sécurisée (JWT + cookie httpOnly), 4 rôles, comptes reliés aux fiches enseignant / étudiant | [0 bis](docs/MODULE-00b-AUTH.md) |
| **Structure** | Institut, écoles, spécialités, niveaux ordonnés, années académiques | [1](docs/MODULE-01-STRUCTURE.md) |
| **Unités d'enseignement** | Crédits, coefficients, volumes CM / TD / TP, total et volume payé calculés, contenu pédagogique | [2](docs/MODULE-02-UE.md) |
| **Étudiants et enseignants** | Matricule automatique, photo, contact du tuteur, **import CSV**, inscriptions, affectations aux UE (quotas contrôlés), bilan de service | [3](docs/MODULE-03-PERSONNES.md) |
| **Notes et relevés** | Saisie CC / Examen / TP avec calcul en direct, rattrapage, compensation, mention, décision, délibération, **relevé PDF** | [4](docs/MODULE-04-NOTES.md) |
| **Certificats** | Numérotation par année, **QR code de vérification** publique, historique, duplicata, annulation | [5](docs/MODULE-05-CERTIFICATS.md) |
| **Syllabus** | Éditeur (chapitres, méthodes, bibliographie), PDF par UE, **ZIP** pour tout un niveau | [6](docs/MODULE-06-SYLLABUS.md) |
| **Emplois du temps** | Salles, créneaux, disponibilités, **génération automatique sans conflit**, glisser-déposer, vues niveau / enseignant / salle, PDF | [7](docs/MODULE-07-EDT.md) |
| **Tableau de bord et espaces** | Indicateurs et alertes ; **espace enseignant** (ses UE, ses étudiants, saisie des notes) ; **espace étudiant** (notes, relevés, certificats, emploi du temps) | [8](docs/MODULE-08-FINALISATION.md) |

## 2. Architecture

```
 Navigateur ──HTTPS──▶ nginx (site React)  ──/api──▶  API Node.js / Express  ──▶  PostgreSQL
                                                          │ Prisma ORM
                                                          └─▶ Chromium (PDF : relevés, certificats, syllabus, emplois du temps)
```

| Partie | Technologies |
|---|---|
| Frontend | React 18 · TypeScript · Vite · TailwindCSS · composants shadcn/ui · TanStack Query · React Hook Form |
| Backend | Node.js 22 · Express 5 · TypeScript · Prisma 6 · Zod · Puppeteer (Chromium) |
| Base de données | PostgreSQL 16 (contraintes d'intégrité en base : quotas, notes 0–20, pas de double réservation…) |
| Code partagé | `packages/shared` : règles de validation, **calculs** (heures, notes, décisions), types, matrice des permissions — utilisés à l'identique par le serveur et l'interface |

Schéma de la base : [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma) · vue d'ensemble : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## 3. Démarrer sur votre ordinateur

**Prérequis** : [Node.js 20 ou plus](https://nodejs.org) et [Docker Desktop](https://www.docker.com/products/docker-desktop/) (pour la base de données).

1. Installer les dépendances :
   ```bash
   npm install
   ```
2. Créer le fichier de configuration :
   ```bash
   cp backend/.env.example backend/.env
   ```
3. Démarrer la base de données :
   ```bash
   npm run db:up
   ```
4. Créer les tables et le compte administrateur :
   ```bash
   npm run db:migrate
   ```
   ```bash
   npm run db:seed
   ```
5. Lancer l'application (API + site) :
   ```bash
   npm run dev
   ```
6. Ouvrir **http://localhost:5173** et se connecter avec `admin@scolarix.local` / `Admin12345`.

Les PDF utilisent Chromium : s'il n'est pas détecté automatiquement, indiquez son chemin dans `CHROMIUM_PATH` (fichier `backend/.env`).

## 4. Données de démonstration

Pour découvrir l'application avec un institut complet (2 écoles, 15 UE, 41 étudiants, 8 enseignants, notes délibérées, emplois du temps générés, certificat émis), lancez la démo **sur une base vide**, juste après l'étape 4 « migrate » ci-dessus (sans `db:seed`) :

```bash
npm run db:seed:demo -w backend
```

| Rôle | Email | Mot de passe | Ce qu'il voit |
|---|---|---|---|
| Administrateur | `admin@demo.scolarix.local` | `Demo12345` | Tableau de bord complet, toute l'administration |
| Scolarité (école EIT) | `scolarite@demo.scolarix.local` | `Demo12345` | Tableau de bord et gestion limités à l'école EIT |
| Enseignant | `o.fall@demo.scolarix.local` | `Demo12345` | Ses UE (dont il est responsable), ses étudiants, saisie des notes, syllabus, emploi du temps |
| Étudiante | `awa.diallo@demo.scolarix.local` | `Demo12345` | Ses notes délibérées, relevé officiel, certificats, emploi du temps |

Le script refuse de s'exécuter si la base contient déjà des écoles (aucune donnée existante n'est jamais écrasée).

## 5. Rôles et permissions

✔ autorisé · ◐ limité (voir la précision) · — interdit. La même matrice est consultable dans l'application (**Utilisateurs → Rôles et permissions**) ; elle est définie une seule fois dans [`packages/shared/src/permissions.ts`](packages/shared/src/permissions.ts) et appliquée par le serveur route par route.

| Domaine | Action | Administrateur | Scolarité | Enseignant | Étudiant | Précision |
|---|---|:---:|:---:|:---:|:---:|---|
| Tableau de bord | Indicateurs et alertes | ✔ | ◐ | — | — | Scolarité : son école |
| Utilisateurs | Créer, modifier, désactiver des comptes ; changer les rôles | ✔ | — | — | — |  |
| Comptes | Créer le compte de connexion d’un enseignant / étudiant | ✔ | ◐ | — | — | Scolarité : étudiants de son école, enseignants |
| Institut & écoles | Modifier | ✔ | — | — | — |  |
| Années, salles, créneaux | Modifier | ✔ | — | — | — |  |
| Spécialités, niveaux, UE | Créer, modifier, supprimer | ✔ | ◐ | — | — | Scolarité : son école |
| Étudiants & inscriptions | Gérer (fiches, photo, import CSV) | ✔ | ◐ | — | — | Scolarité : son école |
| Enseignants & affectations | Gérer | ✔ | ◐ | — | — | Suppression d’un enseignant : ADMIN |
| Notes | Saisir les notes d’une UE | ✔ | ◐ | ◐ | — | Enseignant : les UE qui lui sont affectées |
| Délibération | Délibérer un niveau | ✔ | ◐ | — | — | Rouvrir : ADMIN |
| Relevés & certificats | Émettre | ✔ | ◐ | — | ◐ | Étudiant : les siens uniquement (Mon espace) |
| Syllabus | Rédiger | ✔ | ◐ | ◐ | — | Enseignant : s’il est responsable de l’UE |
| Syllabus | Consulter / télécharger | ✔ | ◐ | ✔ | ✔ |  |
| Emplois du temps | Générer, modifier, publier | ✔ | ◐ | — | — |  |
| Emplois du temps | Consulter le sien | ✔ | ✔ | ◐ | ◐ | Étudiant : emploi du temps PUBLIÉ de son niveau |
| Mon espace | Ses notes, documents, UE, étudiants | — | — | ◐ | ◐ |  |

**Comptes enseignant / étudiant** : depuis la fiche (Enseignants ou Étudiants → une fiche → « Compte de connexion » → *Créer le compte*). Un mot de passe provisoire est affiché **une seule fois** ; la personne le change ensuite dans « Mon compte ».

## 6. Tests

```bash
npm test
```

175 tests automatiques (base PostgreSQL de test séparée `scolarix_test`) : authentification, droits par rôle et isolation des données, calculs (heures, notes, décisions), contraintes, PDF, ZIP, import CSV, générateur d'emploi du temps (dont un test de propriété sur 200 instances aléatoires).

```bash
npm run typecheck
```

## 7. Déploiement

### 7.0 Le plus simple : Render (quelques clics)

Suivez le guide pas à pas **[DEPLOIEMENT-RENDER.md](DEPLOIEMENT-RENDER.md)**. Le fichier [`render.yaml`](render.yaml) crée automatiquement une base PostgreSQL et un service unique : l'API et le site à la même adresse, en HTTPS. Il utilise l'image « tout-en-un » décrite dans [`Dockerfile`](Dockerfile).

Pour un serveur à vous, utilisez la variante en 3 conteneurs ci-dessous.

### Avec Docker sur votre propre serveur

Trois conteneurs : **db** (PostgreSQL), **api** (Node.js + Chromium), **web** (nginx : site + relais `/api`).

### 7.1 Installation sur un serveur

1. Sur un serveur Linux avec [Docker](https://docs.docker.com/engine/install/), récupérer le code puis entrer dans le dossier `scolarix`.
2. Préparer la configuration :
   ```bash
   cp .env.production.example .env.production
   ```
   puis ouvrir `.env.production` et **remplacer chaque valeur** (voir [§ 8](#8-configuration-variables-denvironnement)). Pour générer un secret :
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
3. Construire et démarrer :
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
   ```
   Au démarrage, l'API applique les migrations et crée le premier administrateur (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).
4. Vérifier :
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production ps
   ```
   Le site répond sur le port `HTTP_PORT` (8080 par défaut dans l'exemple).
5. (Facultatif) charger la démo sur cette installation **vide** :
   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production exec api npx tsx scripts/seed-demo.ts
   ```

### 7.2 HTTPS (obligatoire en production)

Placez un reverse proxy HTTPS devant le conteneur `web`. Exemple avec [Caddy](https://caddyserver.com) (certificat automatique), fichier `Caddyfile` :

```
scolarix.mon-institut.sn {
  reverse_proxy localhost:8080
}
```

`PUBLIC_APP_URL` doit être exactement cette adresse (`https://scolarix.mon-institut.sn`) : elle est imprimée dans les QR codes des certificats et relevés.

### 7.3 Mises à jour, sauvegardes

| Action | Commande |
|---|---|
| Mettre à jour après une nouvelle version du code | `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build` |
| Sauvegarder la base | `docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db pg_dump -U scolarix scolarix > sauvegarde-$(date +%F).sql` |
| Restaurer une sauvegarde (base **neuve**) | `docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db psql -U scolarix scolarix < sauvegarde.sql` |
| Voir les journaux de l'API | `docker compose -f docker-compose.prod.yml --env-file .env.production logs -f api` |

Les photos des étudiants sont dans le volume Docker `uploads` : sauvegardez-le aussi.

### 7.4 Essai local de l'image de production

Pour tester la version Docker sur votre ordinateur en `http://localhost:8088` (sans HTTPS), mettez dans `.env.production` : `PUBLIC_APP_URL=http://localhost:8088`, `HTTP_PORT=8088` et `COOKIE_SECURE=false` — **jamais** `COOKIE_SECURE=false` sur un vrai serveur.

## 8. Configuration (variables d'environnement)

| Variable | Où | Rôle |
|---|---|---|
| `DATABASE_URL` | `backend/.env` (construite automatiquement en Docker) | Connexion PostgreSQL |
| `JWT_ACCESS_SECRET` | les deux | Secret de signature des sessions (≥ 32 caractères aléatoires) |
| `ACCESS_TOKEN_TTL_MINUTES` / `REFRESH_TOKEN_TTL_DAYS` | `backend/.env` | Durée des jetons (15 min / 7 jours) |
| `PUBLIC_APP_URL` | les deux | Adresse publique du site (QR codes, CORS) |
| `CORS_ORIGIN` | `backend/.env` | Origine autorisée (= adresse du site) |
| `COOKIE_SECURE` | production | Cookie de session réservé au HTTPS (`true` par défaut en production) |
| `UPLOAD_DIR` | `backend/.env` | Dossier des photos (hors du dépôt Git) |
| `CHROMIUM_PATH` | facultatif | Chemin de Chromium pour les PDF (détecté automatiquement sinon ; `/usr/bin/chromium` en Docker) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | les deux | Premier administrateur créé s'il n'existe pas |
| `POSTGRES_PASSWORD`, `HTTP_PORT` | `.env.production` | Mot de passe de la base, port exposé par `web` |
| `FRONTEND_DIR` | image tout-en-un | Dossier du site compilé servi par l'API (`/app/web`) |
| `LOAD_DEMO_DATA` | Render / tout-en-un | `true` : charge la démo au démarrage si la base est vide (jamais pour un usage réel) |
| `RENDER_EXTERNAL_URL` | fournie par Render | Sert de valeur par défaut à `PUBLIC_APP_URL` et `CORS_ORIGIN` |

Règles de calcul paramétrables (sans variable d'environnement, dans le code partagé) : coefficients du volume payé (`PAID_HOURS_COEFFICIENTS`) et règlement des notes (`GRADING_RULES` : note de validation, compensation, note éliminatoire, « admis avec dettes », mentions).

## 9. Sécurité : à vérifier avant la mise en ligne

- [ ] Toutes les valeurs de `.env.production` remplacées (secrets longs et aléatoires) ; fichier jamais enregistré dans Git.
- [ ] Site servi **uniquement en HTTPS**, `COOKIE_SECURE=true`.
- [ ] `PUBLIC_APP_URL` = adresse réelle (sinon les QR codes mènent nulle part).
- [ ] Mot de passe de l'administrateur initial changé à la première connexion (« Mon compte »).
- [ ] Règlement des notes (`GRADING_RULES`) et coefficients du volume payé vérifiés avec la direction des études.
- [ ] Sauvegardes automatiques de la base et du volume `uploads` (ex. tâche planifiée quotidienne).
- [ ] Ports 5432 (base) et 4000 (API) non exposés sur Internet (c'est le cas avec `docker-compose.prod.yml` : seul `web` est publié).

Protections intégrées : mots de passe hachés (bcrypt), limitation des tentatives de connexion, jetons de session révocables avec détection de vol, données personnelles réservées aux rôles habilités, photos privées vérifiées par leur contenu, PDF générés sans JavaScript ni accès réseau, textes échappés dans les documents, contraintes d'intégrité dans la base.

## 10. Dépannage

| Problème | Solution |
|---|---|
| `Configuration invalide (.env)` au démarrage | Une variable manque ou est trop courte : le message indique laquelle |
| `Can't reach database server` | La base n'est pas démarrée : `npm run db:up` (local) ou `docker compose … ps` |
| Les PDF ne se génèrent pas (`Chromium introuvable`) | Installer Chromium ou renseigner `CHROMIUM_PATH` |
| Connexion impossible après mise en ligne, on est renvoyé à l'écran de connexion | Le site n'est pas en HTTPS alors que `COOKIE_SECURE=true` : activez HTTPS (§ 7.2) |
| Le QR code d'un certificat ouvre une mauvaise adresse | Corriger `PUBLIC_APP_URL` ; les nouveaux documents utiliseront la bonne adresse |
| La démo refuse de se lancer | Elle ne s'exécute que sur une base vide (aucune école) |

## 11. Structure du projet et documentation détaillée

```
scolarix/
├── packages/shared/      règles, calculs, types, permissions (partagés front/back)
├── backend/              API Express + Prisma
│   ├── prisma/           schéma, migrations, seed minimal
│   ├── scripts/          seed-demo.ts (démo), preview-documents.ts (aperçus PDF)
│   ├── src/modules/      un dossier par module métier
│   ├── src/pdf/          moteur PDF et gabarits (relevé, certificat, syllabus, emploi du temps)
│   └── tests/            tests unitaires et d'intégration
├── frontend/             site React (features/ = un dossier par écran)
├── docker/               configuration nginx
├── docker-compose.yml        base PostgreSQL de développement
├── docker-compose.prod.yml   déploiement complet
└── docs/                 architecture, documentation de chaque module, aperçus des documents
```

| Document | Contenu |
|---|---|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Vue d'ensemble, modèle de données, plan des modules |
| [MODULE-00b-AUTH.md](docs/MODULE-00b-AUTH.md) … [MODULE-08-FINALISATION.md](docs/MODULE-08-FINALISATION.md) | Détail de chaque module : schéma, règles, endpoints, écrans, tests |
| [apercu-releve.pdf](docs/apercu-releve.pdf) · [apercu-certificat.pdf](docs/apercu-certificat.pdf) · [apercu-syllabus.pdf](docs/apercu-syllabus.pdf) | Aperçus des documents générés (données fictives) |
