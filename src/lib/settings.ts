import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

/** Valeurs PROVISOIRES — décisions métier / juridiques à valider (modifiables en administration). */
export const DEFAULT_SETTINGS: Record<string, { value: unknown; description: string }> = {
  "feature.token_transfer": {
    value: false,
    description: "Transferts de Mena entre membres — désactivé jusqu'à validation juridique et réglementaire.",
  },
  "feature.token_conversion": {
    value: false,
    description: "Conversion des Mena en monnaie — désactivée jusqu'à validation juridique et réglementaire.",
  },
  "finance.platform_margin_pct": {
    value: 15,
    description: "Marge brute cible de la plateforme (%) — valeur provisoire à valider.",
  },
  "finance.currency": { value: "FCFA", description: "Devise d'affichage." },
  "proofs.min_validated": {
    value: 1,
    description: "Nombre minimal de preuves validées avant de déclarer un don réalisé (règle à valider).",
  },
  "proofs.accepted_types": {
    value: ["photo", "video", "receipt", "attestation"],
    description: "Types de preuves acceptés comme preuve de remise (hors factures).",
  },
  "tokens.manual_adjust_max": {
    value: 500,
    description: "Plafond d'un ajustement manuel de Mena ; au-delà, validation de l'administrateur principal.",
  },
  "tokens.conversion_rate_xof": {
    value: 0,
    description: "Valeur d'un Mena en FCFA (0 = non défini, conversion impossible).",
  },
  "tokens.level_thresholds": {
    value: { silver: 200, gold: 1000, platinum: 3000 },
    description: "Seuils de niveaux d'engagement (Mena gagnés cumulés).",
  },
  "payments.external_provider": {
    value: "manual",
    description: "Prestataire de paiement externe (manual | futur : mobile money / agrégateur). Intégration à prévoir.",
  },
  "annex.prices": {
    value: { packaging: 2000, officiant: 5000, photos: 3000, video: 10000 },
    description: "Tarifs provisoires des services annexes (FCFA) : packaging, officiant religieux, photos, reportage vidéo.",
  },
  "requests.late_alert_days": { value: 3, description: "Nombre de jours avant échéance pour notifier." },
  "catalog.targets": {
    value: ["Famille", "Orphelinat", "École", "Personne âgée", "Personne malade", "Communauté / village", "Lieu de culte"].map((label, i) => ({
      id: `cible-${i + 1}`, label, description: "", active: true,
    })),
    description: "Cibles des dons proposées aux donateurs — à gérer depuis Administration › Cibles.",
  },
  "public.stats": {
    value: { beneficiaries: "12 500+", partners: "420+", gifts: "1 850+", members: "2 300+" },
    description: "Chiffres d'impact affichés sur la page d'accueil (à remplacer par des données vérifiées).",
  },
};

export async function getSetting<T = unknown>(key: string): Promise<T> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  if (rows[0]) return rows[0].value as T;
  return DEFAULT_SETTINGS[key]?.value as T;
}
