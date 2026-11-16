# Module 5 — Certificats de scolarité

## 1. Schéma Prisma

```prisma
enum CertificateStatus { VALIDE  ANNULE }

model Certificate {
  orderNumber      Int                 // numéro d'ordre dans l'année : 1, 2, 3…
  number           String  @unique     // "CS-2026-00001"
  verificationCode String  @unique     // 10 caractères, imprimé + QR code
  purpose          String?             // motif facultatif (bourse, stage, visa…)
  status           CertificateStatus   // VALIDE | ANNULE
  issuedAt         DateTime
  revokedAt / revokedReason / revokedBy
  snapshot         Json                // copie exacte des données imprimées
  student → Student ; enrollment → Enrollment ; academicYear → AcademicYear ; issuedBy → User
  @@unique([academicYearId, orderNumber])
}
```

Migration : `*_certificates`.

- **Numérotation séquentielle par année académique.** Compteur atomique `certificate:2026`, plus la contrainte d'unicité (année, n° d'ordre) : deux émissions simultanées ne peuvent pas recevoir le même numéro.
- **Snapshot.** Un duplicata est identique à l'original, même si l'étudiant change ensuite de nom ou de niveau.

## 2. Données imprimées

- **Institut** : nom, sigle, coordonnées, ville (« Fait à … »).
- **École** et son directeur (signataire).
- **Étudiant** : civilité (M./Mme), nom, prénom, date et lieu de naissance, nationalité, matricule.
- **Inscription** : niveau, spécialité, diplôme préparé, mention « redoublant » éventuelle.
- **Année académique** avec ses dates ; « est inscrit(e) », ou « était inscrit(e) » si l'année est terminée.
- **Document** : numéro d'ordre, date d'émission, motif facultatif.
- **Authenticité** : QR code, lien et code de vérification.

Le gabarit est dans `backend/src/pdf/templates/certificate.ts`. Toutes les valeurs y sont échappées.
Aperçus avec données fictives : [`apercu-certificat.html`](apercu-certificat.html) et [`apercu-certificat.pdf`](apercu-certificat.pdf).
Pour les régénérer avec ceux du relevé : `npm run preview:documents -w backend`.

## 3. Règles d'émission

| Cas | Résultat |
|---|---|
| Inscription « En attente » ou « Annulée » | refusé (400), avec le motif |
| Étudiant suspendu ou exclu, année en cours | refusé (400) ; autorisé pour une année passée (« était inscrit ») |
| Année sans inscription | 404 |
| SCOLARITE d'une autre école, ENSEIGNANT, ETUDIANT | 403 |

## 4. Endpoints

| Méthode | Route | Rôle |
|---|---|---|
| **GET** | **`/api/students/:id/certificate?year=2026-2027[&purpose=…]`** | **Émet** un nouveau certificat numéroté et renvoie le PDF. En-têtes : `X-Document-Reference`, `X-Certificate-Id` |
| GET | `/api/students/:id/certificate?year=…&format=html` | Aperçu : aucun numéro consommé, rien n'est enregistré |
| GET | `/api/certificates?search=&academicYearId=&status=&page=` | Historique (le plus récent d'abord) |
| GET | `/api/certificates/:id/pdf` | Duplicata : même numéro, même code, mention « DUPLICATA » (et « ANNULÉ » s'il a été annulé) |
| POST | `/api/certificates/:id/revoke` `{ reason }` | Annulation définitive : le certificat reste dans l'historique |
| GET | `/api/public/verify/:code` | **Public, sans connexion**, limité à 30 requêtes par minute et par IP |

Accès : ADMIN et SCOLARITE, chacun dans le périmètre de son école.

**Vérification publique.** La route `/api/public/verify/:code` sert aux certificats **et** aux relevés de notes (le QR code est maintenant imprimé sur les deux).
Elle ne renvoie que le minimum pour comparer avec le papier : type, référence, statut, date, nom et matricule, niveau, année, établissement.
Elle **ne renvoie pas** la date de naissance.
Le lien du QR code est construit avec `PUBLIC_APP_URL` (variable `.env`, à remplacer par l'adresse réelle du site en production).

> Une émission étant un `GET` qui crée un enregistrement (comme demandé), ne mettez jamais cette adresse dans un lien partagé ou un favori : chaque ouverture émet un nouveau numéro. L'interface passe toujours par le bouton « Émettre ».

## 5. Pages

| Page | Contenu |
|---|---|
| **Certificats** (`/certificates`, menu) | **Émission** et **historique** (voir ci-dessous) |
| Fiche étudiant | Icône 🏅 sur chaque inscription : ouvre la page Certificats avec l'étudiant et l'année déjà choisis |
| **`/verifier/:code`** (public) | Page ouverte par le QR code : « Document authentique et valide » (vert), « Document ANNULÉ » (rouge) ou « Document introuvable » |

**Émission :**
1. Recherche de l'étudiant (nom, prénom ou matricule).
2. Choix de l'année parmi ses inscriptions. Celles qui ne permettent pas de certificat sont grisées, avec la raison.
3. Motif facultatif (suggestions proposées).
4. « Aperçu », puis « Émettre le certificat (PDF) ».

**Historique :**
- recherche (n°, nom, matricule) et filtres année et statut ;
- pour chaque certificat : émis par qui et quand, motif ;
- actions : **duplicata** et **annulation** (avec le motif de l'annulation).

## 6. Tests et validation

**Automatiques** : 9 nouveaux tests, 136 au total (`tests/integration/certificates.test.ts`).
- PDF valide ; numéros CS-2026-00001 puis -00002 ; enregistrement et snapshot.
- Aperçu sans enregistrement et sans numéro consommé.
- Refus : inscription annulée, étudiant exclu, année inconnue, mauvais rôle, autre école.
- Historique et recherche ; duplicata sans nouveau numéro.
- Vérification **sans connexion**, données minimales, annulation visible dans la vérification ; double annulation refusée ; code inconnu (404) ou mal formé (400).
- **Non-régression** : une route inconnue renvoie 404 et non 401 ; `/api/health` reste public.
  Un routeur monté sur `/api` exigeait la connexion pour tout `/api` : il bloquait la vérification publique. Corrigé.

**Vérifications manuelles :**
- Parcours complet dans le navigateur : recherche, aperçu (rien enregistré), émission, émission depuis la fiche étudiant, vérification par un visiteur **non connecté**, annulation (la vérification indique « ANNULÉ »), code inventé (« introuvable »), affichage mobile.
- **QR codes décodés** (bibliothèque jsQR) sur le rendu des PDF : aperçu du certificat, aperçu du relevé et certificat réel émis par l'application. Tous renvoient vers la bonne page de vérification.
