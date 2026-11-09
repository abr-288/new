# API HTTP

Base : `/api`. Format JSON. Authentification par cookie de session `mn_session` (httpOnly) obtenu via OTP.

| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | `/api/health` | Public | `{ok:true}` si la base répond (initialise les données par défaut). |
| GET | `/api/v1/catalog` | Public | `{currency:"XOF", items:[…]}` catalogue actif. |
| POST | `/api/v1/auth/request-otp` | Public | `{phone, name?, role?}` → envoie un OTP. Inscription si le numéro est inconnu (`name` requis). En mode démo, `devCode` est renvoyé. 429 si trop de demandes. |
| POST | `/api/v1/auth/verify-otp` | Public | `{phone, code}` → crée la session (cookie) et renvoie `{user}`. 401 si code invalide. |
| GET | `/api/v1/me` | Session | Profil, rôle, permissions, solde Mena. |
| GET | `/api/v1/requests` | Session | Demandes du donateur (toutes pour `requests.manage`). |
| GET | `/api/files/{proof\|receipt\|dispute}/{id}` | Session + droits | Téléchargement sécurisé (403 si non autorisé, accès admin audité). |
| GET | `/admin/statistiques/export?from&to&status&category&provider&zone` | `stats.export` | Export CSV (audité). |

Codes : `401` non authentifié, `403` interdit, `404` introuvable, `429` limitation.

Les mutations métier (demandes, missions, paiements, litiges…) sont exposées via des **Server Actions** Next.js (`src/app/actions/*`) avec contrôle des droits ; elles pourront être doublées par des routes REST `/api/v1` pour une application mobile.
