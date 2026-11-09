import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { missions } from "@/db/schema";
import { Empty, PageHeader, StatusBadge, Table } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { fcfa, fdate, MISSION_STATUS } from "@/lib/format";

export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const u = await requireRole("provider");
  const { s } = await searchParams;
  const all = await db.select().from(missions).where(eq(missions.providerId, u.id)).orderBy(desc(missions.id));
  const tabs: [string, string, string[]][] = [
    ["", "Toutes", []],
    ["proposed", "Proposées", ["proposed"]],
    ["accepted", "Acceptées", ["accepted"]],
    ["in_progress", "En cours", ["in_progress"]],
    ["done", "Terminées / historique", ["completed", "refused", "cancelled"]],
  ];
  const f = tabs.find((t) => t[0] === (s ?? ""))?.[2] ?? [];
  const rows = f.length ? all.filter((m) => f.includes(m.status)) : all;
  return (
    <>
      <PageHeader title="Mes missions" subtitle="Vous ne voyez que les missions qui vous sont attribuées." />
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map(([k, l]) => <Link key={k} href={k ? `/espace/missions?s=${k}` : "/espace/missions"} className={`btn btn-sm ${(s ?? "") === k ? "btn-green" : "btn-outline"}`}>{l}</Link>)}
      </div>
      {rows.length === 0 ? <Empty>Aucune mission.</Empty> : (
        <Table>
          <thead><tr><th>Mission</th><th>Échéance</th><th>Rémunération</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {rows.map((m) => {
              const late = m.dueDate && m.dueDate < new Date() && ["proposed", "accepted", "in_progress"].includes(m.status);
              return (
                <tr key={m.id}>
                  <td className="font-semibold">{m.title}</td>
                  <td>{fdate(m.dueDate)} {late && <span className="badge badge-red">En retard</span>}</td>
                  <td>{m.compensationMode === "exchange" ? "Échange de services" : fcfa(m.providerFee)}</td>
                  <td><StatusBadge meta={MISSION_STATUS} value={m.status} />{m.validatedAt && <span className="badge badge-green ml-1">Validée</span>}</td>
                  <td><Link href={`/espace/missions/${m.id}`} className="btn btn-outline btn-sm">Détail</Link></td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
