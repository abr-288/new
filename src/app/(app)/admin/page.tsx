import Link from "next/link";
import { and, count, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { disputes, missions, payments, proofs, requests, users } from "@/db/schema";
import { PageHeader, Section, StatCard, StatusBadge, Empty } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { runDueScan } from "@/lib/due";
import { fcfa, fdate, REQUEST_STATUS } from "@/lib/format";
import { hasPerm, PERMISSIONS, type Perm } from "@/lib/rbac";
import { ensureSeed } from "@/lib/seed";

export default async function Page({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  await ensureSeed();
  const u = await requireAdmin();
  const { denied } = await searchParams;
  if (hasPerm(u, "requests.manage")) await runDueScan();
  const c = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
  const [toTreat, info, late, toReview, payFollow, openDisputes, usersN, completed, collected] = await Promise.all([
    c(db.select({ n: count() }).from(requests).where(eq(requests.status, "submitted"))),
    c(db.select({ n: count() }).from(requests).where(eq(requests.status, "info_requested"))),
    c(db.select({ n: count() }).from(missions).where(and(inArray(missions.status, ["proposed", "accepted", "in_progress"]), lt(missions.dueDate, new Date())))),
    c(db.select({ n: count() }).from(proofs).where(eq(proofs.status, "pending"))),
    c(db.select({ n: count() }).from(payments).where(inArray(payments.status, ["declared", "validated", "partial"]))),
    c(db.select({ n: count() }).from(disputes).where(inArray(disputes.status, ["open", "investigating"]))),
    c(db.select({ n: count() }).from(users)),
    c(db.select({ n: count() }).from(requests).where(inArray(requests.status, ["completed", "closed"]))),
    c(db.select({ n: sql<number>`coalesce(sum(${payments.amountPaid}),0)::int` }).from(payments).where(eq(payments.direction, "in"))),
  ]);
  const recent = await db.select().from(requests).where(inArray(requests.status, ["submitted", "info_requested"])).orderBy(desc(requests.id)).limit(6);
  return (
    <>
      <PageHeader title="Tableau de bord" subtitle="Indicateurs globaux et éléments à traiter." />
      {denied && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">Accès refusé : votre rôle n’inclut pas la permission « {PERMISSIONS[denied as Perm] ?? denied} ».</p>}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link href="/admin/demandes?status=submitted"><StatCard label="Demandes à traiter" value={toTreat} tone="amber" hint={`${info} en attente d’infos`} /></Link>
        <Link href="/admin/missions"><StatCard label="Missions en retard" value={late} tone={late ? "red" : "green"} /></Link>
        <Link href="/admin/preuves"><StatCard label="Preuves à contrôler" value={toReview} tone="blue" /></Link>
        <Link href="/admin/paiements"><StatCard label="Paiements à suivre" value={payFollow} tone="amber" /></Link>
        <Link href="/admin/litiges"><StatCard label="Litiges ouverts" value={openDisputes} tone={openDisputes ? "red" : "green"} /></Link>
        <StatCard label="Dons réalisés" value={completed} />
        <StatCard label="Montants encaissés" value={fcfa(collected)} />
        <StatCard label="Utilisateurs" value={usersN} />
      </div>
      <Section title="Demandes à traiter" actions={<Link href="/admin/demandes" className="text-xs font-semibold text-brand">Toutes les demandes</Link>}>
        {recent.length === 0 ? <Empty>Aucune demande en attente. 🎉</Empty> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2.5">
                <Link href={`/admin/demandes/${r.id}`} className="font-medium hover:text-brand">{r.title}<br /><span className="text-xs font-normal text-slate-500">{r.ref} · {fcfa(r.totalAmount)} · {fdate(r.createdAt)}</span></Link>
                <StatusBadge meta={REQUEST_STATUS} value={r.status} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
