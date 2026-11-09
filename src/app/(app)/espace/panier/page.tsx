import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cartItems, catalogItems } from "@/db/schema";
import { checkoutCart, removeCartItem } from "@/app/actions/donor";
import { ActionForm } from "@/components/forms";
import { AnnexFields, ScheduleFields } from "@/components/RequestFields";
import { Empty, PageHeader, Section } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { fcfa } from "@/lib/format";
import { annexPrices } from "@/lib/requests";
import { getTargets } from "@/lib/targets";
import { TargetSelect } from "@/components/TargetSelect";

export default async function Page() {
  const u = await requireRole("donor", "client");
  const rows = await db.select({ c: cartItems, i: catalogItems }).from(cartItems).innerJoin(catalogItems, eq(catalogItems.id, cartItems.catalogItemId)).where(eq(cartItems.userId, u.id));
  const total = rows.reduce((s, r) => s + r.c.quantity * r.i.unitPrice, 0);
  const prices = await annexPrices();
  const targets = (await getTargets()).filter((t) => t.active);
  // Cible déjà choisie dans le catalogue : la première renseignée parmi les articles du panier
  const cartTarget = rows.find(({ c }) => c.target)?.c.target ?? "";
  return (
    <>
      <PageHeader title="Mon panier" subtitle="Vérifiez vos dons, précisez la cible et validez : une demande sera créée et examinée par l’équipe." />
      {rows.length === 0 ? (
        <Empty>Votre panier est vide. <Link href="/espace/catalogue" className="font-semibold text-brand underline">Parcourir le catalogue</Link></Empty>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <Section title="Articles">
            <ul className="divide-y divide-slate-100 text-sm">
              {rows.map(({ c, i }) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="text-2xl">{i.emoji}</span>
                  <span className="flex-1">
                    <strong>{i.title}</strong><br />
                    <span className="text-xs text-slate-500">{c.quantity} × {fcfa(i.unitPrice)}{c.target ? ` · cible : ${c.target}` : ""}</span>
                  </span>
                  <span className="font-semibold">{fcfa(c.quantity * i.unitPrice)}</span>
                  <form action={removeCartItem}><input type="hidden" name="id" value={c.id} /><button className="text-xs text-red-600 hover:underline" aria-label="Retirer">Retirer</button></form>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-base font-bold text-brand-dark"><span>Total (hors annexes)</span><span>{fcfa(total)}</span></p>
          </Section>
          <Section title="Valider ma demande">
            <ActionForm action={checkoutCart} submit="Envoyer la demande">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="label" htmlFor="targetName">Cible du don</label><TargetSelect id="targetName" name="targetName" targets={targets} allowCustom={u.role === "donor"} defaultValue={cartTarget} required /></div>
                <div><label className="label" htmlFor="targetZone">Zone / ville</label><input id="targetZone" name="targetZone" className="input" placeholder="Ex. Kpalimé" /></div>
              </div>
              <div><label className="label">Précisions</label><textarea name="description" rows={2} className="input" placeholder="Informations utiles pour la remise" /></div>
              <ScheduleFields />
              <AnnexFields prices={prices} />
            </ActionForm>
          </Section>
        </div>
      )}
    </>
  );
}
