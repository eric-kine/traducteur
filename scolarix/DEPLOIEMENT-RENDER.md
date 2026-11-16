# Mettre Scolarix en ligne avec Render (pas à pas, sans programmer)

Durée : environ 15 minutes, dont 10 d'attente. À la fin, Scolarix est accessible à une adresse du type `https://scolarix-xxxx.onrender.com`, en HTTPS.

## Avant de commencer

- La *pull request* Scolarix doit être **fusionnée** dans `main` (sur GitHub : bouton vert « Merge pull request »).
- Choisissez l'**email** et le **mot de passe** du premier administrateur : au moins 8 caractères, avec des lettres et des chiffres. Notez-les.

## Étapes

1. Allez sur **https://render.com** et connectez-vous. Vous avez déjà un compte pour Top S'ASSUR ; sinon, choisissez « Sign up » puis « GitHub ».
2. En haut à droite, cliquez sur **« New + »**, puis sur **« Blueprint »**.
3. Choisissez le dépôt **`eric-kine/traducteur`**. S'il n'apparaît pas, cliquez sur « Configure account » et autorisez Render à y accéder.
4. Dans **« Blueprint Path »**, remplacez `render.yaml` par :
   ```
   scolarix/render.yaml
   ```
   **Attention** : sans ce changement, Render prendrait le fichier de Top S'ASSUR.
5. Donnez un nom au groupe (par exemple `scolarix`). Render affiche ce qu'il va créer : une base **scolarix-db** et un service web **scolarix**.
6. Render demande deux valeurs :
   - **SEED_ADMIN_EMAIL** : l'email du premier administrateur ;
   - **SEED_ADMIN_PASSWORD** : son mot de passe.
7. Cliquez sur **« Apply »** (ou « Deploy Blueprint »). La première construction prend **5 à 10 minutes** : Render installe le logiciel et Chromium pour les PDF.
8. Quand le service **scolarix** affiche **« Live »** (en vert), cliquez sur son adresse (`https://scolarix-….onrender.com`) et connectez-vous avec l'email et le mot de passe de l'étape 6.

C'est en ligne. Commencez par **Administration → Institut** (nom, ville…), puis **Administration → Années académiques**.

## Voir l'application avec des données d'exemple (facultatif)

Pour découvrir l'application **avant** de saisir vos vraies données :

1. Sur Render, ouvrez le service **scolarix**, puis **Environment**.
2. Passez **LOAD_DEMO_DATA** à `true` et enregistrez. Render redémarre le service.
3. Connectez-vous avec `admin@demo.scolarix.local`, `o.fall@demo.scolarix.local` ou `awa.diallo@demo.scolarix.local` (mot de passe `Demo12345`).

**Important :** les comptes de démonstration ont un mot de passe connu de tous. Pour une utilisation réelle, **repartez d'une base vide** :
1. Supprimez la base **scolarix-db** (Render → la base → Settings → Delete).
2. Remettez **LOAD_DEMO_DATA** à `false`.
3. Relancez le Blueprint (Render → Blueprints → Sync).

## Gratuit ou payant ?

| | Plan gratuit | Pour un usage réel |
|---|---|---|
| Service web | S'endort après 15 min sans visite (environ 1 min pour se réveiller) ; 512 Mo de mémoire, suffisant mais juste pour les gros PDF | **Starter** : toujours actif, plus de mémoire |
| Base de données | **Supprimée au bout de 30 jours** | **Basic** : conservée, avec sauvegardes |
| Photos des étudiants | **Perdues à chaque mise à jour** | Ajoutez un disque : décommentez le bloc `disk` dans `scolarix/render.yaml` |

Pour changer de plan : sur Render, ouvrez le service ou la base, puis **Settings → Instance Type**.

## Mises à jour

Chaque nouvelle version fusionnée dans `main` est **redéployée automatiquement** par Render. Les migrations de la base sont appliquées toutes seules au démarrage.

## Un problème ?

| Symptôme | Que faire |
|---|---|
| Le déploiement échoue (« Failed ») | Ouvrez le service → **Logs** : la dernière ligne rouge dit pourquoi. Le plus souvent, c'est un mot de passe administrateur trop court. |
| « Configuration invalide » dans les logs | Une valeur manque dans **Environment** |
| La page met une minute à s'ouvrir | C'est normal sur le plan gratuit : le service se réveille |
| Les QR codes ouvrent une mauvaise adresse | Vous utilisez votre propre nom de domaine : ajoutez `PUBLIC_APP_URL=https://votre-domaine` dans **Environment** |
