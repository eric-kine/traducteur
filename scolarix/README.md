# Scolarix

Gestion d'un institut supérieur privé multi-écoles.
Documentation : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/MODULE-00b-AUTH.md`](docs/MODULE-00b-AUTH.md) · [`docs/MODULE-01-STRUCTURE.md`](docs/MODULE-01-STRUCTURE.md) · [`docs/MODULE-02-UE.md`](docs/MODULE-02-UE.md) · [`docs/MODULE-03-PERSONNES.md`](docs/MODULE-03-PERSONNES.md) · [`docs/MODULE-04-NOTES.md`](docs/MODULE-04-NOTES.md) · [`docs/MODULE-05-CERTIFICATS.md`](docs/MODULE-05-CERTIFICATS.md)

## Démarrer sur votre ordinateur

Prérequis : [Node.js 20+](https://nodejs.org) et [Docker Desktop](https://www.docker.com/products/docker-desktop/).

1. Installer les dépendances (une seule fois) :
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
4. Créer les tables puis le compte administrateur :
   ```bash
   npm run db:migrate
   ```
   ```bash
   npm run db:seed
   ```
5. Lancer l'application :
   ```bash
   npm run dev
   ```
6. Ouvrir http://localhost:5173 et se connecter avec `admin@scolarix.local` / `Admin12345`
   (**changez ce mot de passe** dans « Mon compte »).

Lancer les tests : `npm test`
