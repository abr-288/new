import { asc } from "drizzle-orm";
import { db } from "@/db";
import { catalogItems } from "@/db/schema";
import { saveCatalogItem } from "@/app/actions/admin";
import { ActionForm } from "@/components/forms";
import { PageHeader, Section } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { CATEGORIES, fcfa } from "@/lib/format";

function ItemFields({ i }: { i?: typeof catalogItems.$inferSelect }) {
  return (
    <>
      {i && <input type="hidden" name="id" value={i.id} />}
      <div className="grid gap-2 sm:grid-cols-[60px_1.5fr_1fr]">
        <input name="emoji" defaultValue={i?.emoji ?? "🎁"} className="input text-center" aria-label="Icône" />
        <input name="title" defaultValue={i?.title} className="input" placeholder="Intitulé" required />
        <select name="category" defaultValue={i?.category ?? "nourriture"} className="input">{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      <input name="description" defaultValue={i?.description ?? ""} className="input" placeholder="Description" />
      <div className="grid gap-2 sm:grid-cols-4">
        <div><label className="label">Prix (FCFA)</label><input name="unitPrice" type="number" min={0} defaultValue={i?.unitPrice} className="input" required /></div>
        <div><label className="label">Coût estimé</label><input name="costEstimate" type="number" min={0} defaultValue={i?.costEstimate ?? 0} className="input" /></div>
        <div><label className="label">Unité</label><input name="unit" defaultValue={i?.unit ?? "unité"} className="input" /></div>
        <div><label className="label">Visible</label><select name="active" defaultValue={i?.active === false ? "off" : "on"} className="input"><option value="on">Oui</option><option value="off">Non</option></select></div>
      </div>
    </>
  );
}

export default async function Page() {
  await requirePerm("catalog.manage");
  const items = await db.select().from(catalogItems).orderBy(asc(catalogItems.category), asc(catalogItems.title));
  return (
    <>
      <PageHeader title="Catalogue & tarifs" subtitle="Dons prédéfinis. Tous les tarifs sont provisoires et configurables ; chaque modification est auditée." />
      <Section title="Ajouter un don / une action">
        <ActionForm action={saveCatalogItem} submit="Ajouter"><ItemFields /></ActionForm>
      </Section>
      <div className="mt-5 space-y-2">
        {items.map((i) => (
          <details key={i.id} className={`card p-4 ${i.active ? "" : "opacity-60"}`}>
            <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm"><span>{i.emoji} <strong>{i.title}</strong> <span className="text-xs text-slate-500">· {CATEGORIES[i.category]}</span></span><span className="font-semibold text-brand">{fcfa(i.unitPrice)} <span className="text-xs font-normal text-slate-500">(coût {fcfa(i.costEstimate)})</span></span></summary>
            <ActionForm action={saveCatalogItem} submit="Enregistrer" className="mt-3 space-y-2"><ItemFields i={i} /></ActionForm>
          </details>
        ))}
      </div>
    </>
  );
}
