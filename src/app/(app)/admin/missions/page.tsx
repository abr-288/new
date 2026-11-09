import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { missions, providerProfiles, requests, users } from "@/db/schema";
import { reassignMission, validateMission } from "@/app/actions/admin";
import { ActionForm } from "@/components/forms";
import { Empty, PageHeader, StatusBadge, Table } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { fcfa, fdate, MISSION_STATUS, PROVIDER_CATEGORIES } from "@/lib/format";

export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  await requirePerm("missions.manage");
  const { s } = await searchParams;
  const rows = await db.select({ m: missions, ref: requests.ref, pname: users.name }).from(missions).innerJoin(requests, eq(requests.id, missions.requestId)).leftJoin(users, eq(users.id, missions.providerId)).where(s ? eq(missions.status, s) : undefined).orderBy(desc(missions.id)).limit(200);
  const provs = await db.select({ id: users.id, name: users.name, cat: providerProfiles.category }).from(users).leftJoin(providerProfiles, eq(providerProfiles.userId, users.id)).where(and(eq(users.role, "provider"), eq(users.status, "active")));
  return (
    <>
      <PageHeader title="Missions" subtitle="Suivi des missions, retards, refus et réattributions." />
      <div className="mb-3 flex flex-wrap gap-2">
        <Link href="/admin/missions" className={`btn btn-sm ${!s ? "btn-green" : "btn-outline"}`}>Toutes</Link>
        {Object.entries(MISSION_STATUS).map(([k, v]) => <Link key={k} href={`/admin/missions?s=${k}`} className={`btn btn-sm ${s === k ? "btn-green" : "btn-outline"}`}>{v.label}</Link>)}
      </div>
      {rows.length === 0 ? <Empty>Aucune mission.</Empty> : (
        <Table>
          <thead><tr><th>Mission</th><th>Demande</th><th>Prestataire</th><th>Échéance</th><th>Coût</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map(({ m, ref, pname }) => {
              const late = m.dueDate && m.dueDate < new Date() && ["proposed", "accepted", "in_progress"].includes(m.status);
              return (
                <tr key={m.id}>
                  <td className="font-semibold">{m.title}{m.refusalReason && <span className="block text-xs font-normal text-red-600">Refus : {m.refusalReason}</span>}</td>
                  <td><Link href={`/admin/demandes/${m.requestId}`} className="font-mono text-xs text-brand underline">{ref}</Link></td>
                  <td>{pname || <span className="text-xs text-amber-700">Exception admin.</span>}</td>
                  <td>{fdate(m.dueDate)} {late && <span className="badge badge-red">Retard</span>}</td>
                  <td>{m.compensationMode === "exchange" ? "Échange" : fcfa(m.providerFee)}</td>
                  <td><StatusBadge meta={MISSION_STATUS} value={m.status} />{m.validatedAt && <span className="badge badge-green ml-1">Validée</span>}</td>
                  <td className="min-w-[220px]">
                    {m.status === "refused" && (
                      <ActionForm action={reassignMission} submit="Réattribuer" className="flex gap-1" btnClass="btn btn-outline btn-sm">
                        <input type="hidden" name="missionId" value={m.id} />
                        <select name="providerId" className="input">{provs.map((p) => <option key={p.id} value={p.id}>{p.name} · {PROVIDER_CATEGORIES[p.cat ?? "autre"]}</option>)}</select>
                      </ActionForm>
                    )}
                    {m.status === "completed" && !m.validatedAt && (
                      <ActionForm action={validateMission} submit="Valider la mission" btnClass="btn btn-green btn-sm"><input type="hidden" name="missionId" value={m.id} /></ActionForm>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
