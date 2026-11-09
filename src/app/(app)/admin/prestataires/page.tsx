import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { providerProfiles, providerServices, reviews, users } from "@/db/schema";
import { verifyProvider } from "@/app/actions/admin";
import { PageHeader, Stars, Table } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { fcfa, PROVIDER_CATEGORIES } from "@/lib/format";

export default async function Page() {
  await requirePerm("providers.manage");
  const rows = await db.select({
    u: users, p: providerProfiles,
    rating: sql<number>`coalesce((select avg(rating) from ${reviews} where ${reviews.toUserId} = ${users.id}),0)::float`,
    count: sql<number>`(select count(*) from ${reviews} where ${reviews.toUserId} = ${users.id})::int`,
  }).from(providerProfiles).innerJoin(users, eq(users.id, providerProfiles.userId));
  const svcs = await db.select().from(providerServices).where(eq(providerServices.active, true));
  return (
    <>
      <PageHeader title="Prestataires" subtitle="Identification des prestataires, services proposés, coûts et notation. La vérification est décidée par l’administration." />
      <Table>
        <thead><tr><th>Prestataire</th><th>Catégorie</th><th>Zone</th><th>Services & coûts</th><th>Note</th><th>Vérifié</th></tr></thead>
        <tbody>
          {rows.map(({ u, p, rating, count }) => (
            <tr key={u.id}>
              <td className="font-semibold">{u.name}<br /><span className="font-mono text-xs font-normal text-slate-500">{u.phone}</span></td>
              <td>{PROVIDER_CATEGORIES[p.category]}</td><td>{u.zone}</td>
              <td className="text-xs">{svcs.filter((s) => s.providerId === u.id).map((s) => <div key={s.id}>{s.label} — {fcfa(s.unitCost)}/{s.unit}</div>)}</td>
              <td><Stars value={rating} /> <span className="text-xs text-slate-500">({count})</span></td>
              <td><form action={verifyProvider}><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="verified" value={p.verified ? "0" : "1"} /><button className={`btn btn-sm ${p.verified ? "btn-green" : "btn-outline"}`}>{p.verified ? "✔ Vérifié" : "Vérifier"}</button></form></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
