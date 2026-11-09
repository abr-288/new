export const ROLES: Record<string, string> = {
  donor: "Donateur",
  client: "Client",
  provider: "Prestataire",
  partner: "Partenaire",
  beneficiary: "Bénéficiaire",
  subadmin: "Administrateur secondaire",
  admin: "Administrateur",
};

export const SELF_REGISTER_ROLES = ["donor", "client", "provider", "partner", "beneficiary"] as const;

export const PERMISSIONS = {
  "requests.manage": "Traiter les demandes (accepter / refuser / demander des infos)",
  "users.manage": "Gérer les utilisateurs (suspension, archivage)",
  "providers.manage": "Gérer les prestataires et leurs services",
  "beneficiaries.view": "Consulter / gérer les bénéficiaires (données personnelles)",
  "missions.manage": "Créer, attribuer et réattribuer les missions",
  "proofs.review": "Contrôler les preuves de remise",
  "payments.manage": "Suivre et valider les paiements",
  "finances.view": "Consulter coûts, marges et finances globales",
  "disputes.manage": "Traiter les litiges",
  "stats.view": "Consulter les statistiques",
  "stats.export": "Exporter les rapports",
  "tokens.manage": "Gérer les règles et opérations Token Mena",
  "catalog.manage": "Gérer le catalogue et les tarifs",
  "listings.moderate": "Modérer les publications partenaires et campagnes",
  "audit.view": "Consulter le journal d'audit",
  "roles.manage": "Gérer les rôles et permissions (administrateur principal)",
  "settings.manage": "Modifier la configuration de la plateforme",
} as const;

export type Perm = keyof typeof PERMISSIONS;

type PermUser = { role: string; permissions: string[] };

export function isAdminRole(role: string) {
  return role === "admin" || role === "subadmin";
}

export function hasPerm(user: PermUser | null | undefined, perm: Perm): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "subadmin") {
    if (perm === "roles.manage") return false;
    return user.permissions.includes(perm);
  }
  return false;
}

export function isRequester(role: string) {
  return role === "donor" || role === "client";
}
