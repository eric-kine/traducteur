# Top S'ASSUR — Serveur (version production)

Version **connectée** de l'application : un vrai serveur avec base de données.
Contrairement à la démo hors-ligne (dossier parent), les données sont **partagées
entre tous les appareils** : un patient retrouve ses rendez-vous et reçus depuis
n'importe quel téléphone, et l'administrateur voit toute l'activité en temps réel.

## Ce qui est inclus

- **Comptes patients** sécurisés (inscription / connexion, mots de passe chiffrés).
- **Espace administrateur** protégé (identifiant + mot de passe).
- **Base de données** SQLite (un simple fichier, rien à installer).
- **Paiements** : mode *sandbox* (simulation) activé par défaut, et intégration
  réelle **Campay** (Orange Money + MTN Mobile Money) prête à brancher.
- **Reçus PDF** générés côté serveur.
- L'interface web complète est servie par le serveur (même design que la démo).

## Démarrage rapide

Prérequis : Python 3.10 ou plus.

```bash
cd top-sassur/server

# 1) créer un environnement isolé et installer les dépendances
python3 -m venv .venv
. .venv/bin/activate            # Windows : .venv\Scripts\activate
pip install -r requirements.txt

# 2) lancer le serveur
python server.py
```

Ouvrez ensuite **http://localhost:5000** dans votre navigateur.

- Créez un compte patient depuis le bouton « Se connecter ».
- Pour l'espace **Admin**, connectez-vous avec l'identifiant/mot de passe définis
  par les variables `ADMIN_USERNAME` / `ADMIN_PASSWORD` (par défaut `admin` / `admin123`
  — **à changer**).

## Configuration

Copiez `.env.example` puis définissez les valeurs comme variables d'environnement
(ou via votre hébergeur). Principales options :

| Variable | Rôle | Défaut |
|---|---|---|
| `SECRET_KEY` | Signe les jetons de connexion — **mettez une valeur aléatoire longue** | `dev-secret-change-me` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Compte administrateur | `admin` / `admin123` |
| `HOME_FEE` | Supplément soins à domicile (FCFA) | `3000` |
| `PORT` | Port d'écoute | `5000` |
| `PAYMENT_PROVIDER` | `sandbox` ou `campay` | `sandbox` |
| `CAMPAY_USERNAME` / `CAMPAY_PASSWORD` / `CAMPAY_BASE_URL` | Identifiants Campay | — |

Exemple pour générer une clé secrète :
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

## Activer les paiements réels (Orange Money + MTN MoMo)

1. Créez un compte marchand sur **https://campay.net** (agrégateur camerounais
   couvrant Orange Money et MTN Mobile Money).
2. Récupérez vos identifiants d'application (username / password).
3. Renseignez les variables `CAMPAY_*` et mettez `PAYMENT_PROVIDER=campay`.
4. Testez d'abord avec l'environnement **DEMO** de Campay (`CAMPAY_BASE_URL=https://demo.campay.net`).

Le client reçoit alors une demande de paiement sur son téléphone et valide avec
son code PIN Mobile Money ; l'application confirme automatiquement le rendez-vous.

> Le paiement par **carte (MasterCard)** reste en simulation ici. Pour l'activer,
> branchez un prestataire carte (Stripe, ou l'offre carte de l'agrégateur) sur le
> même modèle dans `payments.py`.

## Mise en production

Le serveur intégré de Flask convient au test, **pas** à la production. Pour un
déploiement réel :

- Servez l'application avec un serveur WSGI (ex. `gunicorn server:app`) derrière
  un reverse-proxy HTTPS (Nginx / Caddy) — le **HTTPS est indispensable** pour
  protéger les données de santé.
- Utilisez un `SECRET_KEY` fort et un mot de passe admin robuste.
- Sauvegardez régulièrement le fichier `topsassur.db` (ou migrez vers PostgreSQL).
- Hébergeurs simples possibles : Render, Railway, un VPS, etc.

## Architecture

```
server/
├── server.py         # application Flask : API + service du site
├── payments.py       # paiements (sandbox + Campay Orange Money / MoMo)
├── pdf_receipt.py    # génération du reçu PDF (Python pur)
├── requirements.txt  # dépendances (Flask, PyJWT, requests)
├── .env.example      # modèle de configuration
└── webapp/           # interface web (HTML/CSS/JS) servie par le serveur
```

La base `topsassur.db` est créée automatiquement au premier lancement, avec des
établissements partenaires d'exemple.
