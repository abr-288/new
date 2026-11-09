import Link from "next/link";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { providerProfiles, providerServices, reviews, users } from "@/db/schema";
import { PageHero } from "@/components/PageHero";
import { Stars } from "@/components/ui";
import { PROVIDER_CATEGORIES } from "@/lib/format";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const metadata = { title: "Social Network — Menewa Naya" };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string }> }) {
  await ensureSeed();
  const { q, cat } = await searchParams;
  const conds = [eq(users.status, "active"), eq(users.role, "provider")];
  if (cat) conds.push(eq(providerProfiles.category, cat));
  if (q) conds.push(or(ilike(users.name, `%${q}%`), ilike(providerProfiles.description, `%${q}%`), ilike(users.zone, `%${q}%`))!);
  const rows = await db
    .select({
      id: users.id, name: users.name, zone: users.zone,
      category: providerProfiles.category, description: providerProfiles.description, verified: providerProfiles.verified,
      rating: sql<number>`coalesce((select avg(rating) from ${reviews} where ${reviews.toUserId} = ${users.id}),0)::float`,
      count: sql<number>`(select count(*) from ${reviews} where ${reviews.toUserId} = ${users.id})::int`,
    })
    .from(users)
    .innerJoin(providerProfiles, eq(providerProfiles.userId, users.id))
    .where(and(...conds));
  const svcs = await db.select().from(providerServices).where(eq(providerServices.active, true));
  return (
    <>
      <PageHero eyebrow="Menewa Social Network" title="Vos compétences, au service des autres">
        Trouvez un prestataire local et mettez-vous en relation. Connectez-vous pour demander un service et négocier le prix.
      </PageHero>
      <div className="mx-auto max-w-[1100px] px-4 py-8 lg:px-9">
        <form className="mb-6 flex flex-wrap gap-2">
          <input name="q" defaultValue={q} placeholder="Rechercher (nom, zone, compétence)…" className="input max-w-sm" />
          <select name="cat" defaultValue={cat ?? ""} className="input max-w-xs">
            <option value="">Toutes les catégories</option>
            {Object.entries(PROVIDER_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn btn-green">Rechercher</button>
        </form>
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => (
            <div key={r.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-brand-dark">{r.name || "Prestataire"} {r.verified && <span className="badge badge-green ml-1">Vérifié</span>}</p>
                  <p className="text-xs text-slate-500">{PROVIDER_CATEGORIES[r.category]} · {r.zone ?? "—"}</p>
                </div>
                <div className="text-right"><Stars value={r.rating} /><p className="text-[11px] text-slate-500">{r.count} avis</p></div>
              </div>
              <p className="mt-2 text-sm text-slate-600">{r.description}</p>
              <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">
                {svcs.filter((s) => s.providerId === r.id).map((s) => <li key={s.id}>{s.label}</li>)}
              </ul>
            </div>
          ))}
          {rows.length === 0 && <p className="text-sm text-slate-500">Aucun prestataire ne correspond à votre recherche.</p>}
        </div>
        <div className="mt-8 text-center"><Link href="/espace/services" className="btn btn-yellow px-8 py-3">Demander un service</Link></div>
      </div>
    </>
  );
}
