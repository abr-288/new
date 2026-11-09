import Link from "next/link";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { setUserStatus } from "@/app/actions/admin";
import { ActionForm } from "@/components/forms";
import { PageHeader, StatusBadge, Table } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { fdate, USER_STATUS } from "@/lib/format";
import { ROLES } from "@/lib/rbac";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const me = await requirePerm("users.manage");
  const { q, role } = await searchParams;
  const conds = [];
  if (role) conds.push(eq(users.role, role));
  if (q) conds.push(or(ilike(users.name, `%${q}%`), ilike(users.phone, `%${q}%`)));
  const rows = await db.select().from(users).where(conds.length ? and(...conds) : undefined).orderBy(desc(users.id)).limit(300);
  return (
    <>
      <PageHeader title="Utilisateurs" subtitle="Donateurs, clients, prestataires, partenaires, bénéficiaires et administrateurs. Archivage plutôt que suppression." actions={<Link href="/admin/roles" className="btn btn-outline btn-sm">Rôles & permissions</Link>} />
      <form className="mb-3 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} className="input max-w-xs" placeholder="Nom ou téléphone" />
        <select name="role" defaultValue={role ?? ""} className="input max-w-xs"><option value="">Tous les rôles</option>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button className="btn btn-green btn-sm">Filtrer</button>
      </form>
      <Table>
        <thead><tr><th>Nom</th><th>Téléphone</th><th>Rôle</th><th>Zone</th><th>Mena</th><th>Inscrit</th><th>Statut</th><th>Action</th></tr></thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td className="font-semibold">{u.name || "—"}</td><td className="font-mono text-xs">{u.phone}</td><td>{ROLES[u.role]}</td><td>{u.zone}</td><td>{u.tokenBalance}</td><td>{fdate(u.createdAt)}</td>
              <td><StatusBadge meta={USER_STATUS} value={u.status} /></td>
              <td>{u.id !== me.id && (
                <ActionForm action={setUserStatus} submit="OK" className="flex gap-1" btnClass="btn btn-outline btn-sm">
                  <input type="hidden" name="userId" value={u.id} />
                  <select name="status" defaultValue={u.status} className="input py-1 text-xs">{Object.entries(USER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
                </ActionForm>
              )}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
