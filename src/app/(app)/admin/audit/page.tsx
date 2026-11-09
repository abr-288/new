import { and, desc, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { PageHeader, Table } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { fdatetime } from "@/lib/format";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; actor?: string }> }) {
  await requirePerm("audit.view");
  const { q, actor } = await searchParams;
  const conds = [];
  if (q) conds.push(ilike(auditLogs.action, `%${q}%`));
  if (actor) conds.push(eq(auditLogs.actorId, parseInt(actor, 10) || 0));
  const rows = await db.select({ a: auditLogs, name: users.name, phone: users.phone }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorId)).where(conds.length ? and(...conds) : undefined).orderBy(desc(auditLogs.id)).limit(300);
  return (
    <>
      <PageHeader title="Journal d’audit" subtitle="Actions critiques et décisions administratives, horodatées et non modifiables depuis l’interface." />
      <form className="mb-3 flex gap-2"><input name="q" defaultValue={q} className="input max-w-xs" placeholder="Action (ex. request.reject)" /><button className="btn btn-green btn-sm">Filtrer</button></form>
      <Table>
        <thead><tr><th>Date</th><th>Acteur</th><th>Action</th><th>Objet</th><th>Détails</th><th>IP</th></tr></thead>
        <tbody>
          {rows.map(({ a, name, phone }) => (
            <tr key={a.id}>
              <td className="whitespace-nowrap text-xs">{fdatetime(a.createdAt)}</td>
              <td>{name || phone || "système"}<br /><span className="text-xs text-slate-500">{a.actorRole}</span></td>
              <td className="font-mono text-xs font-semibold">{a.action}</td>
              <td className="text-xs">{a.entity} {a.entityId && `#${a.entityId}`}</td>
              <td className="max-w-xs break-words text-xs text-slate-600">{a.details ? JSON.stringify(a.details) : ""}</td>
              <td className="text-xs">{a.ip}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
