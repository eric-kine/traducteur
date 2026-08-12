# Top S'ASSUR — Assurance Santé Kinésithérapie

Prototype d'application **web & mobile** pour une assurance santé spécialisée dans les
soins de kinésithérapie (neurologie, traumatologie, rhumatologie, gynécologie, orthopédie,
bien-être corporel). Sa mission : **rendre la rééducation accessible aux acteurs du secteur
informel au Cameroun**, où les frais de kiné sont élevés et où plus de 80 % de la population
active évolue dans l'informel.

## Lancer l'application

Aucune installation. Ouvrez simplement le fichier :

```
top-sassur/index.html
```

Pour un rendu identique au web (chemins relatifs), vous pouvez aussi servir le dossier :

```bash
cd top-sassur && python3 -m http.server 8000
# puis http://localhost:8000
```

C'est un prototype **100 % front-end** (HTML/CSS/JavaScript sans dépendance externe).
Les données (rendez-vous, partenaires, notifications) sont conservées dans le
`localStorage` du navigateur pour simuler un back-end.

## Parcours utilisateur

1. **Accueil** — logo dans l'en-tête, mission sociale, bienfaits de la kinésithérapie,
   domaines pris en charge, illustration de rééducation.
2. **Zone douloureuse** — carte du corps interactive + puces (Cou, épaule, dos, fesse,
   hanche, cuisse, genou, jambe, cheville, pied), **sélection multiple**. Option
   *bien-être corporel* si aucune douleur.
3. **Établissement** — liste dynamique de cliniques/hôpitaux partenaires, sélection par case.
4. **Rendez-vous** — calendrier interactif, horloge + créneaux horaires, option *soins à domicile*.
5. **Paiement** — Orange Money, MTN Mobile Money, MasterCard (formulaires adaptés).
6. **Validation & reçu PDF** — bouton vert **Enregistrer**, génération d'un reçu officiel
   (référence unique) téléchargeable en PDF via l'impression du navigateur.

## Fonctionnalités additionnelles

- **Espace patient** — historique des rendez-vous, re-téléchargement des reçus PDF,
  suivi statistique des zones douloureuses.
- **Espace administrateur** — statistiques d'utilisation (RDV, recettes, partenaires,
  soins à domicile), ajout/suppression de partenaires, suivi des paiements.
- **Notifications** — rappels de rendez-vous et suivi des soins (simulés via la cloche).
- **Multilingue** — bascule Français / Anglais (mémorisée).
- **Responsive** — mise en page adaptée mobile et desktop (menu burger, grilles fluides).
- **Sécurité** — mention de chiffrement des données et de conformité aux standards de
  protection des données médicales (à implémenter côté back-end en production).

## Structure

```
top-sassur/
├── index.html          # structure et vues (accueil, wizard, patient, admin)
├── css/styles.css      # design system (charte verte du logo)
├── js/app.js           # logique, i18n FR/EN, données, persistance localStorage
└── assets/
    ├── logo.svg        # logo Top S'ASSUR
    └── rehab.svg       # illustration de rééducation
```

## Vers la production

Ce prototype est prêt à être branché sur un back-end réel. Prochaines étapes recommandées :

- **API & base de données** (comptes patients, RDV, partenaires) avec authentification.
- **Paiement réel** : intégration des API Orange Money / MTN MoMo et d'un PSP carte.
- **Reçu PDF serveur** signé (au lieu de l'impression navigateur) pour valeur officielle.
- **Notifications push** réelles (service worker + FCM) et rappels programmés.
- **Sécurité** : chiffrement au repos et en transit, journalisation d'accès, conformité
  aux exigences de protection des données de santé.
- **Photos réelles** de séances de rééducation (remplacer les illustrations SVG).
