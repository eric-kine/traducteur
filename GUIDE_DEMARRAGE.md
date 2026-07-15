# Guide de démarrage — Traducteur de documents

Vous n'avez jamais programmé ? Pas de souci, suivez simplement les étapes ci-dessous.
Il y a deux façons d'utiliser l'application :

- **Option A — En ligne, accessible depuis n'importe où** (recommandé) : votre application
  aura une adresse internet (un lien) que vous pourrez ouvrir depuis votre téléphone ou
  ordinateur, et partager avec des collègues.
- **Option B — Sur votre ordinateur uniquement** : plus rapide à tester, mais l'application
  ne fonctionne que pendant que votre ordinateur est allumé.

---

## Option A — Mise en ligne gratuite (Streamlit Community Cloud)

### Étape 1 — Créer un compte GitHub (gratuit)
1. Allez sur https://github.com et cliquez sur **Sign up**.
2. Créez votre compte avec votre adresse email.

### Étape 2 — Déposer les fichiers de l'application sur GitHub
1. Une fois connecté, cliquez sur le bouton **+** en haut à droite, puis **New repository**.
2. Donnez un nom, par exemple `traducteur-documents`, et cliquez sur **Create repository**.
3. Sur la page qui s'affiche, cliquez sur **uploading an existing file**.
4. Glissez-déposez les 3 fichiers fournis : `app.py`, `requirements.txt`, et ce guide.
5. Cliquez sur **Commit changes** (bouton vert) pour valider l'envoi.

### Étape 3 — Déployer sur Streamlit Community Cloud (gratuit)
1. Allez sur https://streamlit.io/cloud et connectez-vous avec votre compte GitHub.
2. Cliquez sur **New app**.
3. Sélectionnez le dépôt `traducteur-documents` que vous venez de créer.
4. Dans le champ « Main file path », indiquez `app.py`.
5. Cliquez sur **Deploy**. Après une ou deux minutes, votre application est en ligne,
   avec une adresse du type `https://votre-nom-app.streamlit.app`.

C'est cette adresse que vous pouvez ouvrir depuis n'importe quel appareil, ou partager.

---

## Option B — Utilisation locale sur votre ordinateur

### Étape 1 — Installer Python
1. Allez sur https://www.python.org/downloads/ et téléchargez la dernière version.
2. Lancez l'installateur. **Important** : cochez la case "Add Python to PATH" avant de cliquer sur Installer.

### Étape 2 — Installer les outils nécessaires
1. Ouvrez l'invite de commandes (« Terminal » sur Mac, « Invite de commandes » ou
   « PowerShell » sur Windows).
2. Placez-vous dans le dossier contenant les fichiers `app.py` et `requirements.txt`
   (par exemple, si le dossier est sur votre Bureau : `cd Desktop/traducteur_app`).
3. Tapez cette commande et appuyez sur Entrée :
   ```
   pip install -r requirements.txt
   ```
   Cela installe automatiquement tout ce dont l'application a besoin (patientez quelques minutes).

### Étape 3 — Lancer l'application
Dans la même fenêtre, tapez :
```
streamlit run app.py
```
Une page va s'ouvrir automatiquement dans votre navigateur internet avec l'application prête à l'emploi.
Pour arrêter l'application, revenez dans la fenêtre du terminal et appuyez sur `Ctrl + C`.

---

## Utilisation de l'application

1. Déposez votre fichier Word, PDF ou PowerPoint.
2. Choisissez la langue de sortie (la langue source est détectée automatiquement,
   ou vous pouvez la choisir vous-même).
3. Cliquez sur **Traduire le document**.
4. Une fois la traduction terminée, cliquez sur **Télécharger le document traduit**.

## Limites à connaître

- Les très gros documents (plusieurs centaines de pages) peuvent prendre plusieurs minutes.
- Sur les PDF avec une mise en page très complexe (magazines, plaquettes graphiques),
  la disposition du texte traduit peut être légèrement différente de l'original.
- Le service de traduction utilisé est gratuit et public : en cas d'usage très intensif
  et répété en peu de temps, il peut temporairement ralentir. Ce n'est pas un problème
  de l'application, il suffit de réessayer quelques minutes après.
