# Mettre Top S'ASSUR en ligne (guide pas à pas)

Ce guide explique comment publier l'application sur internet pour qu'elle ait une
**vraie adresse** accessible depuis n'importe quel téléphone. Aucune compétence en
programmation n'est requise : il s'agit surtout de clics et de copier-coller.

Trois options, de la plus simple à la plus technique. **L'option Render est
recommandée pour débuter (gratuite).**

---

## Option 1 — Render (recommandée, gratuite pour commencer)

1. Créez un compte sur **https://render.com** (connexion avec GitHub).
2. Assurez-vous que ce projet est bien sur votre compte GitHub (c'est déjà le cas :
   dépôt `eric-kine/traducteur`).
3. Dans Render : bouton **« New + » → « Blueprint »**.
4. Sélectionnez le dépôt `traducteur`. Render détecte automatiquement le fichier
   **`render.yaml`** à la racine et propose de créer le service « top-sassur ».
5. Render vous demande de saisir **`ADMIN_PASSWORD`** (le mot de passe de l'espace
   administrateur) : choisissez-en un solide.
6. Cliquez sur **« Apply »**. Après quelques minutes, votre application est en ligne
   à une adresse du type `https://top-sassur.onrender.com`.

C'est tout. Vous pouvez partager cette adresse à vos patients.

> ⚠️ **Important (offre gratuite Render)** : le stockage est *éphémère*. À chaque
> redéploiement ou mise en veille, la base de données peut être réinitialisée
> (les comptes et rendez-vous sont perdus). Pour conserver les données durablement,
> voir « Conserver les données » plus bas.

---

## Option 2 — Railway (simple, alternative)

1. Compte sur **https://railway.app** (connexion GitHub).
2. **« New Project » → « Deploy from GitHub repo »** → choisissez `traducteur`.
3. Dans les réglages du service, définissez le **Root Directory** :
   `top-sassur/server`. Railway détecte le `Procfile` et lance gunicorn.
4. Onglet **Variables** : ajoutez au minimum `SECRET_KEY` (une longue valeur
   aléatoire) et `ADMIN_PASSWORD`.
5. Railway fournit une adresse publique une fois le déploiement terminé.

---

## Option 3 — Docker (VPS ou tout hébergeur Docker)

Un `Dockerfile` est fourni. Sur une machine avec Docker :

```bash
cd top-sassur/server
docker build -t top-sassur .
docker run -d -p 80:8080 \
  -e SECRET_KEY="$(openssl rand -hex 32)" \
  -e ADMIN_PASSWORD="votre-mot-de-passe" \
  -v topsassur-data:/data \
  top-sassur
```

Le volume `topsassur-data` conserve la base de données entre les redémarrages.
Placez ensuite un reverse-proxy HTTPS (Caddy, Nginx) devant le conteneur.

---

## Réglages à faire dans tous les cas

Définissez ces variables d'environnement chez l'hébergeur :

| Variable | Obligatoire | Rôle |
|---|---|---|
| `SECRET_KEY` | ✅ | Sécurise les connexions. Une longue valeur aléatoire. |
| `ADMIN_PASSWORD` | ✅ | Mot de passe de l'espace administrateur. |
| `ADMIN_USERNAME` | — | Identifiant admin (défaut : `admin`). |
| `PAYMENT_PROVIDER` | — | `sandbox` (défaut) ou `campay` (paiement réel). |
| `CAMPAY_USERNAME`, `CAMPAY_PASSWORD`, `CAMPAY_BASE_URL` | si Campay | Identifiants Orange Money / MoMo. |

## Activer les paiements réels (Orange Money + MTN MoMo)

Créez un compte marchand sur **https://campay.net**, puis renseignez chez votre
hébergeur `PAYMENT_PROVIDER=campay` et les variables `CAMPAY_*`. Détails dans
[`README.md`](README.md).

## Conserver les données durablement

L'application utilise une base SQLite (fichier `topsassur.db`). Pour ne rien perdre :

- **Render** : ajoutez un *Persistent Disk* (offre payante) monté par ex. sur
  `/var/data`, puis définissez `DB_PATH=/var/data/topsassur.db`.
- **Docker / VPS** : utilisez un volume (`-v topsassur-data:/data`) comme ci-dessus.
- **Grand volume / plusieurs serveurs** : migrez vers PostgreSQL (évolution possible
  du code).

## HTTPS (obligatoire pour des données de santé)

Render et Railway fournissent le HTTPS automatiquement. Sur un VPS, activez-le via
Caddy (automatique) ou Nginx + Let's Encrypt.
