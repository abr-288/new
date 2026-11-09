export const fcfa = (n: number | null | undefined) =>
  `${new Intl.NumberFormat("fr-FR").format(n ?? 0).replace(/\u202f|\u00a0/g, " ")} FCFA`;

export const fdate = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const fdatetime = (d: Date | string | null | undefined) =>
  d
    ? new Date(d).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const toInputDate = (d: Date | string | null | undefined) =>
  d ? new Date(d).toISOString().slice(0, 10) : "";

type Meta = Record<string, { label: string; tone: string }>;

export const REQUEST_STATUS: Meta = {
  submitted: { label: "Soumise", tone: "blue" },
  info_requested: { label: "Infos demandées", tone: "amber" },
  accepted: { label: "Acceptée", tone: "green" },
  rejected: { label: "Refusée", tone: "red" },
  in_progress: { label: "En cours", tone: "indigo" },
  completed: { label: "Réalisée", tone: "green" },
  closed: { label: "Clôturée", tone: "slate" },
  cancelled: { label: "Annulée", tone: "slate" },
};
export const MISSION_STATUS: Meta = {
  proposed: { label: "Proposée", tone: "amber" },
  accepted: { label: "Acceptée", tone: "blue" },
  refused: { label: "Refusée", tone: "red" },
  in_progress: { label: "En cours", tone: "indigo" },
  completed: { label: "Terminée", tone: "green" },
  cancelled: { label: "Annulée", tone: "slate" },
};
export const PROOF_STATUS: Meta = {
  pending: { label: "À contrôler", tone: "amber" },
  validated: { label: "Validée", tone: "green" },
  rejected: { label: "Rejetée", tone: "red" },
};
export const PAYMENT_STATUS: Meta = {
  planned: { label: "Prévu", tone: "slate" },
  declared: { label: "Déclaré", tone: "amber" },
  validated: { label: "Validé", tone: "blue" },
  partial: { label: "Partiel", tone: "indigo" },
  paid: { label: "Payé", tone: "green" },
  cancelled: { label: "Annulé", tone: "red" },
};
export const DISPUTE_STATUS: Meta = {
  open: { label: "Ouvert", tone: "red" },
  investigating: { label: "En instruction", tone: "amber" },
  resolved: { label: "Résolu", tone: "green" },
  closed: { label: "Clos", tone: "slate" },
};
export const ORDER_STATUS: Meta = {
  requested: { label: "Demandé", tone: "blue" },
  negotiating: { label: "Négociation", tone: "amber" },
  agreed: { label: "Accord conclu", tone: "green" },
  in_progress: { label: "En cours", tone: "indigo" },
  done: { label: "Réalisé (à confirmer)", tone: "amber" },
  confirmed: { label: "Confirmé", tone: "green" },
  declined: { label: "Décliné", tone: "red" },
  cancelled: { label: "Annulé", tone: "slate" },
};
export const LISTING_STATUS: Meta = {
  pending: { label: "En modération", tone: "amber" },
  published: { label: "Publiée", tone: "green" },
  rejected: { label: "Refusée", tone: "red" },
  closed: { label: "Close", tone: "slate" },
};
export const TOKEN_STATUS: Meta = {
  approved: { label: "Validée", tone: "green" },
  pending: { label: "En attente", tone: "amber" },
  rejected: { label: "Rejetée", tone: "red" },
};
export const USER_STATUS: Meta = {
  active: { label: "Actif", tone: "green" },
  suspended: { label: "Suspendu", tone: "red" },
  archived: { label: "Archivé", tone: "slate" },
};

export const KIND_LABEL: Record<string, string> = {
  catalogue: "Don du catalogue",
  personnalise: "Don personnel",
  action: "Action / visite",
  recurrent: "Engagement récurrent",
};
export const PAYMENT_MODE: Record<string, string> = {
  immediate: "Paiement immédiat",
  prefinance: "Préfinancement",
  echeance: "Paiement à chaque échéance",
};
export const RECURRENCE: Record<string, string> = {
  none: "Ponctuel",
  weekly: "Hebdomadaire",
  monthly: "Mensuel",
  quarterly: "Trimestriel",
};
export const CATEGORIES: Record<string, string> = {
  nourriture: "Nourriture",
  betail: "Bétail",
  volaille: "Volailles",
  habits: "Habits",
  fournitures: "Fournitures",
  equipements: "Équipements",
  action: "Actions & visites",
  autre: "Autre",
};
export const PROVIDER_CATEGORIES: Record<string, string> = {
  officiant: "Officiant religieux",
  commerce: "Commerce / approvisionnement",
  traiteur: "Service traiteur",
  transport: "Chauffeur / transporteur",
  photo: "Photo / vidéo",
  autre: "Autre service",
};
export const PROOF_TYPES: Record<string, string> = {
  photo: "Photo",
  video: "Vidéo",
  receipt: "Reçu",
  invoice: "Facture",
  attestation: "Attestation",
};
export const PAY_METHODS: Record<string, string> = {
  mobile_money: "Mobile Money (T-Money, Flooz…)",
  card: "Carte bancaire",
  bank: "Virement bancaire",
  cash: "Espèces",
  exchange: "Échange de services",
};
export const LISTING_TYPES: Record<string, string> = {
  don: "Don",
  action: "Action solidaire",
  crowdfunding: "Financement participatif",
};

export const TOKEN_LEVELS = [
  { key: "bronze", label: "Bronze", min: 0 },
  { key: "silver", label: "Argent", min: 200 },
  { key: "gold", label: "Or", min: 1000 },
  { key: "platinum", label: "Platine", min: 3000 },
];

export function levelFor(earned: number, levels = TOKEN_LEVELS) {
  let cur = levels[0];
  let next: (typeof levels)[number] | null = null;
  for (let i = 0; i < levels.length; i++) {
    if (earned >= levels[i].min) {
      cur = levels[i];
      next = levels[i + 1] ?? null;
    }
  }
  return { cur, next };
}

export const BADGES: Record<string, { label: string; emoji: string; desc: string }> = {
  first_gift: { label: "Premier don", emoji: "💚", desc: "Un premier don clôturé" },
  generous: { label: "Généreux", emoji: "🌟", desc: "5 dons clôturés" },
  patron: { label: "Mécène", emoji: "🏆", desc: "20 dons clôturés" },
  first_mission: { label: "Première mission", emoji: "🤝", desc: "Une mission validée" },
  elite_provider: { label: "Prestataire d'élite", emoji: "🥇", desc: "10 missions validées" },
  five_stars: { label: "5 étoiles", emoji: "⭐", desc: "Note moyenne ≥ 4,5 avec 3 avis" },
  ambassador: { label: "Ambassadeur", emoji: "🌍", desc: "1 000 Mena gagnés" },
};
