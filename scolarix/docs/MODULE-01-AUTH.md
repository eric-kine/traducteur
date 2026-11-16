# Module 1 — Socle technique & authentification

## 1. Modèle de données

Ajout de la table **`RefreshToken`** (voir `backend/prisma/schema.prisma`) :

| Champ | Rôle |
|---|---|
| `tokenHash` | Hash SHA-256 du jeton (le jeton lui-même n'est jamais stocké) |
| `expiresAt` | Fin de validité (7 jours par défaut) |
| `revokedAt` | Date de révocation (déconnexion, rotation, mot de passe changé) |
| `replacedById` | Jeton qui l'a remplacé lors d'une rotation |
| `userAgent`, `ipAddress` | Traçabilité de la session |

Migration initiale : `backend/prisma/migrations/*_init`.

## 2. Fonctionnement de la connexion

```
 Connexion          ┌──────────────┐   accessToken (JWT 15 min, en mémoire)
 email + mdp  ───▶  │ /auth/login  │ ─▶ + cookie httpOnly "scolarix_rt" (7 j)
                    └──────────────┘
 Chaque appel API : Authorization: Bearer <accessToken>
 Jeton expiré (401) → POST /auth/refresh (cookie) → nouveau couple de jetons
                                                    l'ancien est révoqué (rotation)
 Ancien jeton réutilisé → vol suspecté → TOUTES les sessions de l'utilisateur sont fermées
```

Sécurité : mots de passe hachés (bcrypt), même message d'erreur que l'email existe ou non,
10 tentatives de connexion max / 15 min / IP, compte désactivé bloqué immédiatement,
en-têtes de sécurité (helmet), CORS restreint au frontend.

## 3. Endpoints API

| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | `/api/health` | public | État du serveur et de la base |
| POST | `/api/auth/login` | public | `{ email, password }` → `{ accessToken, user }` + cookie |
| POST | `/api/auth/refresh` | cookie | Rotation de session → `{ accessToken, user }` |
| POST | `/api/auth/logout` | cookie | Révoque la session (204) |
| GET | `/api/auth/me` | connecté | Utilisateur courant |
| POST | `/api/auth/change-password` | connecté | `{ currentPassword, newPassword }` ; ferme toutes les sessions |
| GET | `/api/users` | ADMIN | Liste paginée ; filtres `search`, `role`, `isActive`, `page`, `pageSize` |
| POST | `/api/users` | ADMIN | Création `{ email, password, firstName, lastName, role, schoolId? }` |
| GET | `/api/users/:id` | ADMIN | Détail |
| PATCH | `/api/users/:id` | ADMIN | Modification partielle (dont `isActive`) |
| POST | `/api/users/:id/reset-password` | ADMIN | `{ password }` ; ferme les sessions de l'utilisateur |
| DELETE | `/api/users/:id` | ADMIN | **Désactivation** (l'historique est conservé) |

Format d'erreur unique : `{ "error": { "code", "message", "details?": { champ: [messages] } } }`.

Règles métier : `schoolId` n'est conservé que pour le rôle SCOLARITE ; un admin ne peut ni se
désactiver ni retirer ses propres droits ; il reste toujours au moins un administrateur actif.

Middlewares réutilisables par les modules suivants : `authenticate`, `authorize(...roles)`,
`validate(schema, source)`, `getSchoolScope(user)` / `assertSchoolAccess(user, schoolId)`.

## 4. Frontend

| Fichier | Rôle |
|---|---|
| `lib/api.ts` | Client HTTP : jeton en mémoire, rafraîchissement automatique sur 401 (une seule demande à la fois) |
| `stores/auth.store.ts` | État de connexion (Zustand) ; restaure la session au chargement |
| `routes/ProtectedRoute.tsx` | Redirige vers `/login` ou affiche « Accès refusé » selon le rôle |
| `components/layout/AppShell.tsx` | Menu latéral filtré par rôle (tiroir sur mobile) + barre supérieure |
| `features/auth/LoginPage.tsx` | Écran de connexion |
| `features/auth/AccountPage.tsx` | Mon compte + changement de mot de passe |
| `features/users/*` | Liste, recherche, filtres, création/modification, réinitialisation, (dés)activation |
| `components/ui/*` | Composants shadcn/ui (Button, Input, Card, Table, Dialog, Badge…) |

## 5. Tests et validation

**Automatiques** (`npm test`, base `scolarix_test`) — 34 tests :
- unitaires : signature/vérification JWT, jeton falsifié, expiré, `alg: none`, hachage
- connexion : succès + cookie httpOnly, mauvais mot de passe = email inconnu, compte désactivé, validation
- session : `/me`, rotation, **réutilisation détectée**, jeton expiré, déconnexion
- mot de passe : changement (anciennes sessions coupées), refus si faux ou trop faible
- utilisateurs : 403 pour chaque rôle non admin, CRUD, email en double (409), école inexistante,
  désactivation coupant les sessions, protection du dernier admin

**Scénario manuel** (vérifié dans un navigateur) :
1. Ouvrir `/users` sans être connecté → redirection vers la connexion
2. Mauvais mot de passe → « Email ou mot de passe incorrect »
3. Connexion `admin@scolarix.local` / `Admin12345` → retour sur `/users`
4. Créer un enseignant (un mot de passe trop court est refusé) → il apparaît dans la liste
5. Recharger la page → on reste connecté
6. Se déconnecter, se reconnecter avec l'enseignant → pas de menu « Utilisateurs »
7. Taper `/users` dans l'adresse → page « Accès refusé »
8. Sur téléphone : menu repliable, pas de défilement horizontal
