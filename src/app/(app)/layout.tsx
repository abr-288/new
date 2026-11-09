import type { ReactNode } from "react";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { AppShell, type NavItem } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { hasPerm, isAdminRole, ROLES, type Perm } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const common: NavItem[] = [
  { href: "/espace/notifications", label: "Notifications", icon: "🔔" },
  { href: "/espace/profil", label: "Profil & paramètres", icon: "⚙️" },
  { href: "/espace/aide", label: "Aide", icon: "❓" },
];

const requester: NavItem[] = [
  { href: "/espace", label: "Tableau de bord", icon: "🏠" },
  { href: "/espace/catalogue", label: "Catalogue de dons", icon: "🎁" },
  { href: "/espace/panier", label: "Mon panier", icon: "🛒" },
  { href: "/espace/demandes/nouvelle", label: "Don personnel / action", icon: "✍️" },
  { href: "/espace/demandes", label: "Mes demandes", icon: "📋" },
  { href: "/espace/paiements", label: "Mes paiements", icon: "💳" },
  { href: "/espace/services", label: "Services communautaires", icon: "🤝" },
  { href: "/espace/campagnes", label: "Campagnes & partenaires", icon: "📣" },
  { href: "/espace/tokens", label: "Token Mena", icon: "🪙" },
];

const provider: NavItem[] = [
  { href: "/espace", label: "Tableau de bord", icon: "🏠" },
  { href: "/espace/missions", label: "Mes missions", icon: "🧰" },
  { href: "/espace/services", label: "Demandes de services", icon: "🤝" },
  { href: "/espace/paiements", label: "Rémunérations", icon: "💳" },
  { href: "/espace/tokens", label: "Token Mena", icon: "🪙" },
];

const partner: NavItem[] = [
  { href: "/espace", label: "Tableau de bord", icon: "🏠" },
  { href: "/espace/publications", label: "Mes publications", icon: "📣" },
  { href: "/espace/campagnes", label: "Campagnes", icon: "🌍" },
  { href: "/espace/tokens", label: "Token Mena", icon: "🪙" },
];

const beneficiary: NavItem[] = [{ href: "/espace", label: "Dons reçus", icon: "🏠" }];

const adminNav: (NavItem & { perm?: Perm })[] = [
  { href: "/admin", label: "Tableau de bord", icon: "📊" },
  { href: "/admin/demandes", label: "Demandes", icon: "📋", perm: "requests.manage" },
  { href: "/admin/missions", label: "Missions", icon: "🧰", perm: "missions.manage" },
  { href: "/admin/preuves", label: "Preuves", icon: "📸", perm: "proofs.review" },
  { href: "/admin/paiements", label: "Paiements", icon: "💳", perm: "payments.manage" },
  { href: "/admin/finances", label: "Finances & marges", icon: "💰", perm: "finances.view" },
  { href: "/admin/litiges", label: "Litiges", icon: "⚖️", perm: "disputes.manage" },
  { href: "/admin/utilisateurs", label: "Utilisateurs", icon: "👥", perm: "users.manage" },
  { href: "/admin/prestataires", label: "Prestataires", icon: "🛠️", perm: "providers.manage" },
  { href: "/admin/beneficiaires", label: "Bénéficiaires", icon: "🫶", perm: "beneficiaries.view" },
  { href: "/admin/publications", label: "Publications partenaires", icon: "📣", perm: "listings.moderate" },
  { href: "/admin/catalogue", label: "Catalogue & tarifs", icon: "🎁", perm: "catalog.manage" },
  { href: "/admin/cibles", label: "Cibles", icon: "🎯", perm: "catalog.manage" },
  { href: "/admin/tokens", label: "Token Mena", icon: "🪙", perm: "tokens.manage" },
  { href: "/admin/statistiques", label: "Statistiques", icon: "📈", perm: "stats.view" },
  { href: "/admin/roles", label: "Rôles & permissions", icon: "🔐", perm: "roles.manage" },
  { href: "/admin/audit", label: "Journal d'audit", icon: "🧾", perm: "audit.view" },
  { href: "/admin/parametres", label: "Paramètres", icon: "⚙️", perm: "settings.manage" },
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));

  const admin = isAdminRole(user.role);
  let nav: NavItem[];
  if (admin) {
    nav = [
      ...adminNav.filter((i) => !i.perm || hasPerm(user, i.perm)),
      { href: "/espace/notifications", label: "Notifications", icon: "🔔" },
      { href: "/espace/profil", label: "Mon profil", icon: "⚙️" },
      { href: "/espace/aide", label: "Aide", icon: "❓" },
    ];
  } else {
    const base = user.role === "provider" ? provider : user.role === "partner" ? partner : user.role === "beneficiary" ? beneficiary : requester;
    nav = [...base, ...common];
  }
  return (
    <AppShell nav={nav} userName={user.name || user.phone} roleLabel={ROLES[user.role]} unread={n} admin={admin}>
      {children}
    </AppShell>
  );
}
