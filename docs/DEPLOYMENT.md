# Déploiement

## Prérequis
Node.js ≥ 20, PostgreSQL ≥ 14, un reverse proxy HTTPS (Nginx/Caddy).

## Étapes
1. `cp .env.example .env` et renseigner : `DATABASE_URL`, `OTP_SECRET` (long et aléatoire), `OTP_DEV_MODE=false`, `SMS_GATEWAY_URL` / `SMS_GATEWAY_TOKEN`, `COOKIE_SECURE=true`, `STORAGE_DIR` (volume persistant hors dépôt).
2. `npm ci`
3. `npx drizzle-kit push --config drizzle.config.json` (ou migrations versionnées pour la production).
4. `npm run build && npm run start` (port 3000) derrière le reverse proxy ; sonde de santé : `GET /api/health`.
5. Connectez-vous avec le compte administrateur initial, **créez vos administrateurs réels** (Rôles & permissions) puis archivez les comptes de démonstration (Utilisateurs).

## Sauvegardes
- Base : `pg_dump -Fc $DATABASE_URL > backup-$(date +%F).dump` (quotidien, rétention ≥ 30 jours, copie hors site, test de restauration régulier).
- Fichiers : sauvegarde du dossier `STORAGE_DIR` (preuves, reçus).

## Sécurité & conformité
- HTTPS obligatoire ; en-têtes de sécurité au niveau du proxy ; accès base restreint.
- Revue périodique du journal d'audit (`/admin/audit`) et des permissions.
- Valider les points listés dans `docs/ARCHITECTURE.md` (décisions métier / réglementaires) avant ouverture publique, notamment le cadre juridique des Mena et des collectes.
- Prévoir le branchement d'un prestataire de paiement (Mobile Money / agrégateur) et d'un fournisseur e-mail.
