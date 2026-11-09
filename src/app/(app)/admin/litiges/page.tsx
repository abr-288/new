import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { disputes, users } from "@/db/schema";
import { Empty, PageHeader, StatusBadge, Table } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { DISPUTE_STATUS, fdate } from "@/lib/format";

export default async function Page() {
  await requirePerm("disputes.manage");
  const rows = await db.select({ d: disputes, oname: users.name }).from(disputes).innerJoin(users, eq(users.id, disputes.openedBy)).orderBy(desc(disputes.id));
  return (
    <>
      <PageHeader title="Litiges" subtitle="Parties, objet, pièces, responsable, échanges, décision et clôture." />
      {rows.length === 0 ? <Empty>Aucun litige.</Empty> : (
        <Table>
          <thead><tr><th>Réf.</th><th>Objet</th><th>Ouvert par</th><th>Date</th><th>Clôture</th><th>Statut</th></tr></thead>
          <tbody>{rows.map(({ d, oname }) => <tr key={d.id}><td className="font-mono text-xs">{d.ref}</td><td><Link href={`/admin/litiges/${d.id}`} className="font-semibold text-brand hover:underline">{d.subject}</Link></td><td>{oname}</td><td>{fdate(d.createdAt)}</td><td>{fdate(d.closedAt)}</td><td><StatusBadge meta={DISPUTE_STATUS} value={d.status} /></td></tr>)}</tbody>
        </Table>
      )}
    </>
  );
}
