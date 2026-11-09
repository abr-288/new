import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { beneficiaries, listings, missions, notifications, proofs, requests, users } from "@/db/schema";
import { PageHeader, StatCard, StatusBadge, Empty, Section } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { fcfa, fdate, fdatetime, levelFor, MISSION_STATUS, REQUEST_STATUS } from "@/lib/format";
import { isAdminRole } from "@/lib/rbac";
import { ensureSeed } from "@/lib/seed";

export default async function Dashboard() {
  await ensureSeed();
  const u = await requireUser();
  if (isAdminRole(u.role)) redirect("/admin");
  const notifs = await db.select().from(notifications).where(eq(notifications.userId, u.id)).orderBy(desc(notifications.id)).limit(5);
  const { cur, next } = levelFor(u.tokensEarned);
  const header = <PageHeader title={`Bonjour ${u.name || ""} 👋`} subtitle="Voici un aperçu de votre activité sur Menewa Naya." />;

  const notifBlock = (
    <Section title="Dernières notifications" actions={<Link href="/espace/notifications" className="text-xs font-semibold text-brand">Tout voir</Link>}>
      {notifs.length === 0 ? <Empty>Aucune notification.</Empty> : (
        <ul className="divide-y divide-slate-100 text-sm">
          {notifs.map((n) => (
            <li key={n.id} className="py-2">
              <Link href={n.link || "/espace/notifications"} className="font-medium hover:text-brand">{!n.readAt && "● "}{n.title}</Link>
              <p className="text-xs text-slate-500">{fdatetime(n.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );

  if (u.role === "provider") {
    const ms = await db.select().from(missions).where(eq(missions.providerId, u.id)).orderBy(desc(missions.id));
    const c = (s: string[]) => ms.filter((m) => s.includes(m.status)).length;
    const proposed = ms.filter((m) => m.status === "proposed");
    return (
      <>
        {header}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Proposées" value={c(["proposed"])} tone="amber" />
          <StatCard label="Acceptées" value={c(["accepted"])} tone="blue" />
          <StatCard label="En cours" value={c(["in_progress"])} />
          <StatCard label="Terminées" value={c(["completed"])} hint={`${ms.filter((m) => m.validatedAt).length} validées`} />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <Section title="Missions proposées" actions={<Link href="/espace/missions" className="text-xs font-semibold text-brand">Toutes mes missions</Link>}>
            {proposed.length === 0 ? <Empty>Aucune proposition en attente.</Empty> : (
              <ul className="divide-y divide-slate-100 text-sm">
                {proposed.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                    <span>{m.title}<br /><span className="text-xs text-slate-500">Échéance {fdate(m.dueDate)}</span></span>
                    <Link href={`/espace/missions/${m.id}`} className="btn btn-yellow btn-sm">Répondre</Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          {notifBlock}
        </div>
      </>
    );
  }

  if (u.role === "partner") {
    const ls = await db.select().from(listings).where(eq(listings.ownerId, u.id));
    return (
      <>
        {header}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Publications" value={ls.length} />
          <StatCard label="Publiées" value={ls.filter((l) => l.status === "published").length} />
          <StatCard label="En modération" value={ls.filter((l) => l.status === "pending").length} tone="amber" />
          <StatCard label="Fonds collectés" value={fcfa(ls.reduce((s, l) => s + l.raisedAmount, 0))} />
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <Section title="Actions rapides">
            <Link href="/espace/publications" className="btn btn-green">Publier un don, une action ou une campagne</Link>
          </Section>
          {notifBlock}
        </div>
      </>
    );
  }

  if (u.role === "beneficiary") {
    const rows = await db
      .select({ r: requests })
      .from(requests)
      .innerJoin(beneficiaries, eq(beneficiaries.id, requests.beneficiaryId))
      .where(and(eq(beneficiaries.userId, u.id), inArray(requests.status, ["in_progress", "completed", "closed"])))
      .orderBy(desc(requests.id));
    return (
      <>
        <PageHeader title={`Bonjour ${u.name || ""} 👋`} subtitle="Les dons qui vous sont destinés. Les informations des donateurs restent confidentielles." />
        <Section title="Dons reçus">
          {rows.length === 0 ? <Empty>Aucun don pour le moment.</Empty> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {rows.map(({ r }) => (
                <li key={r.id} className="flex items-center justify-between py-2.5">
                  <span><strong>{r.title}</strong><br /><span className="text-xs text-slate-500">{fdate(r.createdAt)}</span></span>
                  <StatusBadge meta={REQUEST_STATUS} value={r.status} />
                </li>
              ))}
            </ul>
          )}
        </Section>
        <div className="mt-5">{notifBlock}</div>
      </>
    );
  }

  // donateur / client
  const rs = await db.select().from(requests).where(eq(requests.userId, u.id)).orderBy(desc(requests.id));
  const c = (s: string[]) => rs.filter((r) => s.includes(r.status)).length;
  const pr = await db.select({ n: sql<number>`count(*)::int` }).from(proofs).innerJoin(requests, eq(requests.id, proofs.requestId)).where(and(eq(requests.userId, u.id), eq(proofs.status, "validated"), eq(proofs.visibleToDonor, true)));
  void users;
  return (
    <>
      {header}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="En attente" value={c(["submitted", "info_requested"])} tone="amber" />
        <StatCard label="En cours" value={c(["accepted", "in_progress"])} tone="blue" />
        <StatCard label="Réalisées / clôturées" value={c(["completed", "closed"])} />
        <StatCard label="Preuves disponibles" value={pr[0]?.n ?? 0} />
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-r from-brand to-brand-light p-5 text-white">
        <span className="text-4xl">🪙</span>
        <div className="flex-1">
          <p className="text-lg font-bold">{u.tokenBalance} Mena · niveau {cur.label}</p>
          <p className="text-sm text-white/80">{next ? `Encore ${next.min - u.tokensEarned} Mena gagnés pour atteindre ${next.label}` : "Niveau maximal atteint"}</p>
        </div>
        <Link href="/espace/catalogue" className="btn btn-yellow">Faire un don</Link>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Mes dernières demandes" actions={<Link href="/espace/demandes" className="text-xs font-semibold text-brand">Tout voir</Link>}>
          {rs.length === 0 ? <Empty>Vous n’avez pas encore de demande. <Link href="/espace/catalogue" className="font-semibold text-brand underline">Parcourir le catalogue</Link></Empty> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {rs.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2.5">
                  <Link href={`/espace/demandes/${r.id}`} className="font-medium hover:text-brand">{r.title}<br /><span className="text-xs font-normal text-slate-500">{r.ref} · {fcfa(r.totalAmount)}</span></Link>
                  <StatusBadge meta={REQUEST_STATUS} value={r.status} />
                </li>
              ))}
            </ul>
          )}
        </Section>
        {notifBlock}
      </div>
    </>
  );
}

void MISSION_STATUS;
