# Top S'ASSUR

Application web d'aide à la prise en charge en **kinésithérapie** (neurologie,
traumatologie, rhumatologie, gynécologie, orthopédie, bien-être corporel),
pensée pour le Cameroun et les acteurs du secteur informel.

Le patient suit un parcours simple et progressif :

1. **Accueil** — présentation de la kinésithérapie et de la mission sociale.
2. **Zone douloureuse** — sélection interactive sur une carte du corps.
3. **Établissement** — choix d'un hôpital / clinique partenaire.
4. **Rendez-vous** — jour + créneau horaire, avec gestion des disponibilités.
5. **Reçu** — bouton vert « Enregistrer », génération automatique d'un reçu PDF téléchargeable.

Un **espace d'administration** (`/admin`) permet de gérer les établissements
partenaires et de consulter des statistiques.

## Stack

| Couche       | Technologie |
|--------------|-------------|
| Front-end    | React 18 + Vite, React Router |
| Back-end     | Django 5 + Django REST Framework |
| Auth         | JWT (SimpleJWT) |
| Base         | PostgreSQL 16 (repli SQLite en local) |
| PDF          | ReportLab |
| Sécurité     | Champ téléphone chiffré au repos (Fernet), CORS, throttling, durcissement HTTPS |
| Conteneurs   | Docker Compose |

## Démarrage rapide (Docker)

```bash
cd top-sassur
cp .env.example .env          # adapter les secrets
docker compose up --build
```

- Front : http://localhost:5173
- API : http://localhost:8000/api/
- Admin Django : http://localhost:8000/admin/ (compte `admin` / `admin1234` par défaut)

La base est migrée et pré-remplie automatiquement (zones, établissements, compte admin)
au premier démarrage.

## Démarrage sans Docker (développement)

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed
python manage.py runserver    # http://localhost:8000
```
Sans variable `POSTGRES_DB`, le backend utilise SQLite — pratique pour tester.

**Frontend**
```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

## Principaux points d'API

| Méthode | Route | Rôle |
|---------|-------|------|
| GET  | `/api/zones/` | Zones douloureuses (public) |
| GET  | `/api/etablissements/` | Établissements actifs (public) |
| GET  | `/api/etablissements/{id}/disponibilites/?date=AAAA-MM-JJ` | Créneaux libres |
| POST | `/api/rendez-vous/` | Créer un rendez-vous (public) |
| POST | `/api/rendez-vous/{ref}/valider/` | Valider + générer le reçu PDF |
| GET  | `/api/recus/{numero}/telecharger/` | Télécharger le reçu |
| POST | `/api/auth/token/` | Authentification admin (JWT) |
| GET  | `/api/admin/statistiques/` | Tableau de bord (JWT requis) |
| CRUD | `/api/etablissements/` | Gestion des partenaires (JWT staff) |

## Sécurité — l'essentiel

- Le **numéro de téléphone** est chiffré avant écriture en base (`enc:…`) ; l'API
  ne le renvoie jamais en clair.
- Le **consentement** au traitement des données est obligatoire pour réserver.
- Les endpoints d'administration exigent un **jeton JWT** ; limitation de débit
  (throttling) activée.
- Hors `DEBUG`, redirection HTTPS, HSTS et cookies sécurisés sont activés.

Voir [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) pour l'architecture détaillée,
le modèle de données, la conformité et la feuille de route.
