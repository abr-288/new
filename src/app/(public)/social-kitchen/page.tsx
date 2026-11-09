import Link from "next/link";
import { and, eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { catalogItems, listings } from "@/db/schema";
import { PageHero } from "@/components/PageHero";
import { CATEGORIES, fcfa, LISTING_TYPES } from "@/lib/format";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const metadata = { title: "Social Kitchen — Menewa Naya" };

export default async function Page() {
  await ensureSeed();
  const items = await db.select().from(catalogItems).where(eq(catalogItems.active, true)).orderBy(asc(catalogItems.category), asc(catalogItems.title));
  const camp = await db.select().from(listings).where(and(eq(listings.status, "published")));
  return (
    <>
      <PageHero eyebrow="Menewa Social Kitchen" title="Le don qui devient action">
        Choisissez un don prédéfini, définissez la quantité et la cible, ou créez votre propre action de bienfaisance. Tarifs provisoires, configurables par l’administration.
      </PageHero>
      <div className="mx-auto max-w-[1100px] space-y-10 px-4 py-10 lg:px-9">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <div key={i.id} className="card flex flex-col">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-mint text-2xl">{i.emoji}</span>
                <div>
                  <p className="font-bold text-brand-dark">{i.title}</p>
                  <p className="text-xs text-slate-500">{CATEGORIES[i.category] ?? i.category}</p>
                </div>
              </div>
              <p className="mt-3 flex-1 text-sm text-slate-600">{i.description}</p>
              <p className="mt-3 text-lg font-bold text-brand">{fcfa(i.unitPrice)} <span className="text-xs font-normal text-slate-500">/ {i.unit}</span></p>
            </div>
          ))}
        </div>
        {camp.length > 0 && (
          <div>
            <h2 className="mb-3 text-xl font-bold text-brand-dark">Campagnes et actions de nos partenaires</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {camp.map((c) => (
                <div key={c.id} className="card">
                  <span className="badge badge-amber">{LISTING_TYPES[c.type]}</span>
                  <p className="mt-2 font-bold text-brand-dark">{c.title}</p>
                  <p className="text-sm text-slate-600">{c.description}</p>
                  {c.goalAmount > 0 && (
                    <div className="mt-3">
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-brand" style={{ width: `${Math.min(100, (c.raisedAmount / c.goalAmount) * 100)}%` }} /></div>
                      <p className="mt-1 text-xs text-slate-500">{fcfa(c.raisedAmount)} collectés sur {fcfa(c.goalAmount)}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="text-center">
          <Link href="/espace/catalogue" className="btn btn-green px-8 py-3">Faire un don</Link>
        </div>
      </div>
    </>
  );
}
