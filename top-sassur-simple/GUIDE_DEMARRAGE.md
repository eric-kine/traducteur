# Guide de démarrage — Top S'ASSUR (application prête à l'emploi)

Vous n'avez jamais programmé ? Aucun souci. Suivez simplement les étapes.
En 10 minutes, votre application aura une **adresse internet** (un lien) que vous
pourrez ouvrir depuis un téléphone ou un ordinateur, et partager avec vos collègues.

Vous n'avez **rien à installer** sur votre ordinateur. Tout se passe sur internet,
et c'est **gratuit**.

---

## Mise en ligne gratuite (recommandé)

### Étape 1 — Créer un compte GitHub (gratuit)
1. Allez sur https://github.com et cliquez sur **Sign up**.
2. Créez votre compte avec votre adresse email.

### Étape 2 — Déposer les fichiers de l'application
1. Une fois connecté, cliquez sur le bouton **+** en haut à droite, puis **New repository**.
2. Donnez un nom, par exemple `top-sassur`, puis cliquez sur **Create repository**.
3. Sur la page qui s'affiche, cliquez sur **uploading an existing file**.
4. Glissez-déposez les 3 fichiers fournis :
   - `app.py`
   - `requirements.txt`
   - `logo.png` (le logo, pour qu'il s'affiche dans l'appli et sur le reçu)
   (vous pouvez aussi ajouter ce guide, ce n'est pas obligatoire).
5. Cliquez sur le bouton vert **Commit changes** pour valider l'envoi.

### Étape 3 — Publier l'application (Streamlit, gratuit)
1. Allez sur https://streamlit.io/cloud et connectez-vous avec votre compte GitHub.
2. Cliquez sur **New app** puis **Deploy a public app from GitHub**.
3. Sélectionnez le dépôt `top-sassur` que vous venez de créer.
4. Dans le champ « Main file path », indiquez `app.py`.
5. Cliquez sur **Deploy**. Après une à deux minutes, votre application est en ligne,
   à une adresse du type `https://top-sassur.streamlit.app`.

C'est cette adresse que vous ouvrez depuis n'importe quel appareil, ou que vous partagez.

---

## Comment utiliser l'application

### Côté patient (le parcours en 5 étapes)
1. **Accueil** — cliquez sur « Commencer ».
2. **Zone douloureuse** — choisissez où vous avez mal (cou, épaule, dos, genou, etc.).
3. **Établissement** — choisissez l'hôpital ou la clinique.
4. **Rendez-vous** — choisissez le jour et l'heure (les créneaux déjà pris n'apparaissent pas).
5. **Enregistrer** — remplissez nom, prénom, téléphone, cochez le consentement, puis
   cliquez sur le bouton vert **✓ Enregistrer**. Le **reçu PDF** est généré : cliquez
   sur **⬇️ Télécharger le reçu PDF**.

### Côté administration (vous)
Dans la barre de gauche (« Espace administration ») :
1. Entrez le mot de passe administrateur. Par défaut : **`admin1234`**.
2. Vous voyez alors le tableau de bord : nombre de rendez-vous, reçus, établissements.
3. Vous pouvez **ajouter** ou **supprimer** des hôpitaux/cliniques partenaires.
4. Vous voyez la liste des derniers rendez-vous.

> **Changer le mot de passe administrateur** (fortement conseillé) :
> sur Streamlit, ouvrez votre application → menu **⋮** en haut à droite →
> **Settings** → **Secrets**, et collez cette ligne :
> ```
> ADMIN_PASSWORD = "votre-mot-de-passe-solide"
> ```
> Enregistrez : le nouveau mot de passe remplace `admin1234`.

---

## À savoir

- **Le montant du reçu dépend du type d'établissement** (valeurs de départ :
  Hôpital 20 000 · Clinique 15 000 · Centre de kinésithérapie 10 000 FCFA).
  Pour les modifier, changez les valeurs de `MONTANT_PAR_TYPE` au début du fichier `app.py`.
- **Le logo et la couleur** se changent aussi au début de `app.py`
  (`LOGO_FICHIER`, `COULEUR_PRINCIPALE`). Pour remplacer le logo, déposez votre
  propre image nommée `logo.png` à côté de `app.py`.
- **Les établissements par défaut** (Douala, Yaoundé, Bafoussam…) sont des exemples.
  Supprimez-les et ajoutez les vôtres depuis l'espace administration.
- **Conservation des données** : sur l'hébergement gratuit, les données (rendez-vous,
  reçus) peuvent être remises à zéro lorsque l'application redémarre après une longue
  inactivité. C'est suffisant pour démarrer et faire des démonstrations. Pour une
  conservation permanente et un usage à grande échelle, une base de données en ligne
  est nécessaire (voir la version avancée dans le dossier `top-sassur/` et le document
  `docs/ARCHITECTURE.md`).
- **Données personnelles** : ne collectez que le nécessaire et protégez le mot de
  passe administrateur. Le reçu indique que les données sont traitées de façon confidentielle.

---

## Utilisation sur votre ordinateur (facultatif)

Si vous préférez tester sans internet :
1. Installez Python depuis https://www.python.org/downloads/ (cochez « Add Python to PATH »).
2. Dans le dossier contenant `app.py`, ouvrez le terminal et tapez :
   ```
   pip install -r requirements.txt
   streamlit run app.py
   ```
3. L'application s'ouvre dans votre navigateur. Pour l'arrêter : `Ctrl + C`.
