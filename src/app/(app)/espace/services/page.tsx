import Link from "next/link";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { providerProfiles, providerServices, reviews, serviceOrders, users } from "@/db/schema";
import { createServiceOrder } from "@/app/actions/provider";
import { ActionForm } from "@/components/forms";
import { Empty, PageHeader, Section, Stars, StatusBadge, Table } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { fcfa, fdate, ORDER_STATUS, PROVIDER_CATEGORIES } from "@/lib/format";
import { isAdminRole } from "@/lib/rbac";
import { redirect } from "next/navigation";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string; zone?: string }> }) {
  const u = await requireUser();
  if (isAdminRole(u.role)) redirect("/admin");
  const { q, cat, zone } = await searchParams;
  const orders = await db.select({ o: serviceOrders, cname: sql<string>`(select name from users where id = ${serviceOrders.clientId})`, pname: sql<string>`(select name from users where id = ${serviceOrders.providerId})` })
    .from(serviceOrders).where(or(eq(serviceOrders.clientId, u.id), eq(serviceOrders.providerId, u.id))).orderBy(desc(serviceOrders.id));

  const canOrder = ["donor", "client", "partner", "beneficiary", "provider"].includes(u.role);
  const conds = [eq(users.status, "active"), eq(users.role, "provider"), eq(providerProfiles.available, true)];
  if (cat) conds.push(eq(providerProfiles.category, cat));
  if (zone) conds.push(ilike(users.zone, `%${zone}%`));
  if (q) conds.push(or(ilike(users.name, `%${q}%`), ilike(providerProfiles.description, `%${q}%`))!);
  const provs = canOrder
    ? await db.select({
        id: users.id, name: users.name, zone: users.zone, category: providerProfiles.category, description: providerProfiles.description, verified: providerProfiles.verified,
        rating: sql<number>`coalesce((select avg(rating) from ${reviews} where ${reviews.toUserId} = ${users.id}),0)::float`,
        count: sql<number>`(select count(*) from ${reviews} where ${reviews.toUserId} = ${users.id})::int`,
      }).from(users).innerJoin(providerProfiles, eq(providerProfiles.userId, users.id)).where(and(...conds))
    : [];
  const svcs = await db.select().from(providerServices).where(eq(providerServices.active, true));

  return (
    <>
      <PageHeader title="Services communautaires" subtitle="Trouvez un prestataire local, négociez le prix ou un échange de services, suivez la prestation et notez." />
      <Section title="Mes demandes de services">
        {orders.length === 0 ? <Empty>Aucune demande de service.</Empty> : (
          <Table>
            <thead><tr><th>Service</th><th>{u.role === "provider" ? "Client" : "Prestataire"}</th><th>Prix</th><th>Date</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {orders.map(({ o, cname, pname }) => (
                <tr key={o.id}>
                  <td className="font-semibold">{o.title}</td>
                  <td>{o.providerId === u.id ? cname : pname}</td>
                  <td>{o.compensationMode === "exchange" ? "Échange" : fcfa(o.agreedPrice ?? o.proposedPrice)}</td>
                  <td>{fdate(o.createdAt)}</td>
                  <td><StatusBadge meta={ORDER_STATUS} value={o.status} /></td>
                  <td><Link href={`/espace/services/${o.id}`} className="btn btn-outline btn-sm">Ouvrir</Link></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      {canOrder && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-bold text-brand-dark">Rechercher un prestataire</h2>
          <form className="mb-4 flex flex-wrap gap-2">
            <input name="q" defaultValue={q} placeholder="Mot-clé…" className="input max-w-xs" />
            <select name="cat" defaultValue={cat ?? ""} className="input max-w-xs"><option value="">Toutes catégories</option>{Object.entries(PROVIDER_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <input name="zone" defaultValue={zone} placeholder="Zone" className="input max-w-[160px]" />
            <button className="btn btn-green">Rechercher</button>
          </form>
          <div className="grid gap-4 md:grid-cols-2">
            {provs.filter((p) => p.id !== u.id).map((p) => (
              <div key={p.id} className="card">
                <div className="flex items-start justify-between">
                  <div><p className="font-bold text-brand-dark">{p.name} {p.verified && <span className="badge badge-green">Vérifié</span>}</p><p className="text-xs text-slate-500">{PROVIDER_CATEGORIES[p.category]} · {p.zone}</p></div>
                  <div className="text-right"><Stars value={p.rating} /><p className="text-[11px] text-slate-500">{p.count} avis</p></div>
                </div>
                <p className="mt-2 text-sm text-slate-600">{p.description}</p>
                <ul className="mt-2 text-xs text-slate-600">{svcs.filter((s) => s.providerId === p.id).map((s) => <li key={s.id}>• {s.label} — {fcfa(s.unitCost)} / {s.unit}</li>)}</ul>
                <details className="mt-3">
                  <summary className="btn btn-yellow btn-sm cursor-pointer">Demander ce prestataire</summary>
                  <ActionForm action={createServiceOrder} submit="Envoyer la demande" className="mt-3 space-y-2" btnClass="btn btn-green btn-sm">
                    <input type="hidden" name="providerId" value={p.id} />
                    <input name="title" className="input" placeholder="Service demandé" required />
                    <textarea name="description" rows={2} className="input" placeholder="Détails" />
                    <div className="grid grid-cols-2 gap-2">
                      <select name="compensationMode" className="input"><option value="money">Paiement monétaire</option><option value="exchange">Échange de services</option></select>
                      <input name="price" type="number" min={0} step={500} className="input" placeholder="Prix proposé (FCFA)" />
                    </div>
                    <input name="exchangeDescription" className="input" placeholder="Si échange : engagements réciproques" />
                    <input name="zone" className="input" placeholder="Lieu / zone" />
                  </ActionForm>
                </details>
              </div>
            ))}
            {provs.length === 0 && <p className="text-sm text-slate-500">Aucun prestataire trouvé.</p>}
          </div>
        </div>
      )}
    </>
  );
}
