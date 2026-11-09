import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { requests } from "@/db/schema";
import { Empty, PageHeader, StatusBadge, Table } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { fcfa, fdate, KIND_LABEL, REQUEST_STATUS } from "@/lib/format";

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const u = await requireRole("donor", "client");
  const { status } = await searchParams;
  const rows = await db.select().from(requests).where(status ? and(eq(requests.userId, u.id), eq(requests.status, status)) : eq(requests.userId, u.id)).orderBy(desc(requests.id));
  return (
    <>
      <PageHeader title="Mes demandes" subtitle="Historique et suivi de vos dons, actions et engagements." actions={<Link href="/espace/demandes/nouvelle" className="btn btn-green btn-sm">+ Nouveau don personnel</Link>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/espace/demandes" className={`btn btn-sm ${!status ? "btn-green" : "btn-outline"}`}>Toutes</Link>
        {Object.entries(REQUEST_STATUS).map(([k, v]) => <Link key={k} href={`/espace/demandes?status=${k}`} className={`btn btn-sm ${status === k ? "btn-green" : "btn-outline"}`}>{v.label}</Link>)}
      </div>
      {rows.length === 0 ? <Empty>Aucune demande.</Empty> : (
        <Table>
          <thead><tr><th>Référence</th><th>Intitulé</th><th>Type</th><th>Montant</th><th>Date</th><th>Statut</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-xs">{r.ref}</td>
                <td><Link href={`/espace/demandes/${r.id}`} className="font-semibold text-brand hover:underline">{r.title}</Link></td>
                <td>{KIND_LABEL[r.kind]}</td>
                <td>{fcfa(r.totalAmount)}</td>
                <td>{fdate(r.createdAt)}</td>
                <td><StatusBadge meta={REQUEST_STATUS} value={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
