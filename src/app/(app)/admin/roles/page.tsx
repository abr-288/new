import { desc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { setUserRole } from "@/app/actions/admin";
import { ActionForm } from "@/components/forms";
import { PageHeader } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { PERMISSIONS, ROLES } from "@/lib/rbac";

export default async function Page() {
  const me = await requirePerm("roles.manage");
  const rows = await db.select().from(users).orderBy(desc(users.role), desc(users.id)).limit(300);
  return (
    <>
      <PageHeader title="Rôles & permissions" subtitle="Réservé à l’administrateur principal. Un administrateur secondaire ne peut effectuer que les actions couvertes par ses permissions actives (contrôlées côté serveur)." />
      <div className="space-y-2">
        {rows.map((u) => (
          <details key={u.id} className="card p-4">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
              <span><strong>{u.name || u.phone}</strong> <span className="font-mono text-xs text-slate-500">{u.phone}</span></span>
              <span className="badge badge-blue">{ROLES[u.role]}{u.role === "subadmin" && ` · ${u.permissions.length} permission(s)`}</span>
            </summary>
            <ActionForm action={setUserRole} submit="Enregistrer" className="mt-3 space-y-3">
              <input type="hidden" name="userId" value={u.id} />
              <select name="role" defaultValue={u.role} className="input max-w-sm" disabled={u.id === me.id}>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              {u.id === me.id && <input type="hidden" name="role" value={u.role} />}
              <div>
                <p className="label">Permissions (administrateur secondaire uniquement)</p>
                <div className="grid gap-1 sm:grid-cols-2">
                  {(Object.entries(PERMISSIONS) as [string, string][]).filter(([k]) => k !== "roles.manage").map(([k, l]) => (
                    <label key={k} className="flex items-start gap-2 text-sm"><input type="checkbox" name="perm" value={k} defaultChecked={u.permissions.includes(k)} className="mt-1 accent-[#0b5a3c]" /> {l}</label>
                  ))}
                </div>
              </div>
            </ActionForm>
          </details>
        ))}
      </div>
    </>
  );
}
