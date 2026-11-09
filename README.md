# Menewa Naya — Plateforme de dons solidaires et de services communautaires

> « Ensemble, on fait la différence. » — Togo · Afrique · Diaspora

Application fullstack **Next.js 16 (App Router) + PostgreSQL (Drizzle ORM) + Tailwind CSS 4**.

## Démarrage rapide

```bash
npm install
cp .env.example .env            # puis adapter DATABASE_URL
npx drizzle-kit push --config drizzle.config.json   # crée / met à jour le schéma
npm run build && npm run start  # ou : npm run dev
```

Au premier appel (`/api/health`, accueil, connexion), les **paramètres, règles de tokens, catalogue et comptes de démonstration** sont créés automatiquement (`src/lib/seed.ts`).

### Comptes de démonstration (OTP affiché à l'écran tant qu'aucune passerelle SMS n'est configurée)

| Rôle | Téléphone |
|---|---|
| Administrateur principal | +228 90 00 00 01 |
| Administrateur secondaire (permissions limitées) | +228 90 00 00 06 |
| Donateur | +228 90 00 00 02 |
| Prestataire (traiteur) | +228 90 00 00 03 |
| Partenaire | +228 90 00 00 04 |
| Bénéficiaire | +228 90 00 00 05 |

> **En production** : définir `OTP_DEV_MODE=false`, `SMS_GATEWAY_URL`, `SMS_GATEWAY_TOKEN`, `OTP_SECRET`, `COOKIE_SECURE=true` et supprimer les comptes de démonstration.

## Modules livrés (MVP)

| Module | Où |
|---|---|
| Site public fidèle à la maquette, pages À propos / Fonctionnement / Partenaires / Actualités / Contact / Aide / Mentions | `src/app/(public)` |
| Auth téléphone + OTP SMS, sessions, rôles, permissions côté serveur | `src/lib/auth.ts`, `src/lib/rbac.ts` |
| Catalogue de dons, panier, dons personnels, actions/visites, engagements récurrents, services annexes | `/espace/catalogue`, `/panier`, `/demandes` |
| Suivi des demandes (statuts, historique, motif de refus, demande d'infos) | `/espace/demandes`, `/admin/demandes` |
| Missions, réponse/refus motivé, réattribution, exception administrative documentée | `/espace/missions`, `/admin/missions` |
| Preuves de remise (upload sécurisé, contrôle admin, visibilité donateur) | `/api/files`, `/admin/preuves` |
| Paiements & échanges de services (prévu / validé / payé / reste dû, justificatifs) | `/espace/paiements`, `/admin/paiements` |
| Finances : marge brute par don, répertoire prestataires/coûts | `/admin/finances` |
| Services communautaires : recherche, négociation, suivi, notation | `/espace/services` |
| Marketplace partenaires, crowdfunding, modération | `/espace/publications`, `/espace/campagnes`, `/admin/publications` |
| Token Mena, règles, anti-fraude, badges, niveaux (transferts/conversions désactivés) | `/espace/tokens`, `/admin/tokens` |
| Litiges (parties, échanges, pièces, décision, clôture) | `/espace/litiges`, `/admin/litiges` |
| Statistiques filtrables, export CSV / impression PDF | `/admin/statistiques` |
| Rôles & permissions granulaires, journal d'audit, paramètres | `/admin/roles`, `/admin/audit`, `/admin/parametres` |
| Notifications multicanales (in-app, SMS, e-mail à brancher) | `src/lib/audit.ts` |

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — architecture, modèle de données, règles de gestion, décisions à valider
- [`docs/API.md`](docs/API.md) — API HTTP
- [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) — guide utilisateur par profil
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — déploiement, sauvegardes, sécurité
