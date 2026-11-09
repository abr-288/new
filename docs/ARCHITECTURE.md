# Architecture technique

## Vue d'ensemble

- **Front + back** : Next.js App Router (Server Components, Server Actions, Route Handlers).
- **Base de données** : PostgreSQL via Drizzle ORM (`src/db/schema.ts`).
- **Modules** : `src/lib` (auth, rbac, audit/notifications, tokens, requests, finance, stats, storage, sms, settings, seed), `src/app/actions` (mutations par domaine : `auth`, `donor`, `provider`, `admin`), `src/app/(public)`, `src/app/(app)/espace` (utilisateurs) et `src/app/(app)/admin`.
- **Sécurité** : toutes les autorisations sont revérifiées **côté serveur** (`requireUser`, `requireRole`, `requirePerm`, `guard()` dans les actions). Les fichiers sont stockés hors `public/` et servis via `/api/files/*` après contrôle des droits.

## Authentification & rôles

- OTP SMS à 6 chiffres, haché (SHA-256 + secret), validité 5 min, 5 essais, 3 envois / 10 min / numéro.
- Session : jeton aléatoire 256 bits, seul son hash est stocké ; cookie `httpOnly`, `sameSite=lax`, 14 jours.
- Rôles : `donor`, `client`, `provider`, `partner`, `beneficiary`, `subadmin`, `admin`.
- Permissions granulaires (administrateur secondaire) : voir `src/lib/rbac.ts` (`requests.manage`, `proofs.review`, `payments.manage`, `finances.view`, `tokens.manage`, …). `roles.manage` est réservé à l'administrateur principal.

## Modèle de données (tables principales)

`users`, `otp_codes`, `sessions`, `provider_profiles`, `provider_services`, `catalog_items`, `cart_items`, `beneficiaries`, `requests` (+ `request_items`, `request_history`, `installments`), `missions`, `proofs`, `payments`, `disputes` (+ `dispute_messages`), `service_orders` (+ `service_messages`), `reviews`, `token_rules`, `token_transactions`, `user_badges`, `listings` (+ `listing_contributions`), `notifications`, `settings`, `audit_logs`, `contact_messages`.

## Règles de gestion implémentées

| Règle | Implémentation |
|---|---|
| Identifiant unique, date, statut, historique | `requests.ref` (MN-AAAA-NNNNN), `request_history` |
| Refus motivé consultable | motif obligatoire (`decideRequest`), visible du donateur |
| Mission rattachée à une demande acceptée + prestataire (sauf exception documentée) | `createMission` : exception ≥ 10 caractères, tracée |
| Mission refusée réattribuable par un admin autorisé | `reassignMission` (refus motivé obligatoire côté prestataire) |
| Pas de don « réalisé » sans preuve validée + contrôle admin | `markRequestCompleted` (`proofs.min_validated`, missions terminées, échéances faites) |
| Donateur : ses demandes et preuves destinées seulement | requêtes filtrées par `userId`, preuves `validated` + `visibleToDonor` |
| Prestataire : ses missions seulement ; coordonnées bénéficiaire après acceptation | `missions/[id]` |
| Admin secondaire : permissions actives uniquement | `hasPerm` / `guard` |
| Audit des actions critiques | `audit()` (acteur, rôle, action, objet, détails, IP) |
| Pas de suppression des éléments financiers | statuts `cancelled` / archivage ; aucune action `DELETE` sur paiements/demandes |
| Données personnelles bénéficiaires restreintes | permission `beneficiaries.view`, accès journalisé |

## Finances

- Marge brute d'un don = contribution − (budget d'exécution + frais prestataires + autres frais) (`src/lib/finance.ts`).
- `payments` : sens (`in` donateur / `out` prestataire), mode (`money` / `exchange`), prévu / validé / payé / reste dû, référence, justificatif, statut d'exécution d'un échange de services.
- Modes de paiement du donateur : immédiat, préfinancement, à chaque échéance (`installments`).
- Intégration future des paiements mobiles : l'interface est « paiement déclaré puis validé par l'administration » ; le paramètre `payments.external_provider` prépare le branchement d'un agrégateur (Mobile Money, cartes) dans `declarePayment` / `updatePayment`.

## Token Mena

Règles (`token_rules`), attribution automatique à la validation d'une mission / confirmation d'un service / clôture d'un don / avis. Contrôles : anti-doublon (`ref_key` unique), plafond quotidien, pas d'auto-attribution, ajustements manuels motivés avec seuil de validation par l'administrateur principal. **Transfert et conversion : désactivés par défaut** (`feature.token_transfer`, `feature.token_conversion`), activables uniquement par l'administrateur principal.

## Décisions métier / réglementaires à valider (valeurs provisoires configurables)

1. Marge cible de la plateforme (`finance.platform_margin_pct` = 15 %).
2. Tarifs du catalogue, des services annexes (`annex.prices`) et coûts estimés.
3. Règle de preuve de remise (`proofs.min_validated`, types acceptés).
4. Barèmes de tokens, plafonds et seuils de niveaux ; statut juridique des Mena (transfert / conversion).
5. Fournisseur SMS et moyens de paiement (Mobile Money T-Money / Flooz, cartes, agrégateur).
6. Durées de conservation, mentions légales, politique de confidentialité, consentement des bénéficiaires (photos).
7. Formats d'export (CSV fourni ; PDF via impression, à valider).
8. Cadre d'agrément des collectes (financement participatif) et fiscalité.
9. Coordonnées de contact et chiffres d'impact de la page d'accueil (`public.stats`).

## Évolutions prévues

Paiements mobiles automatisés, e-mail transactionnel, stockage objet (S3) pour les fichiers, application mobile (l'API `/api/v1` est prête pour l'extension), tests automatisés E2E, files de tâches pour les notifications.
