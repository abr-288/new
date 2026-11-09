import { notFound } from "next/navigation";
import { and, asc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { payments, serviceMessages, serviceOrders, users } from "@/db/schema";
import { postServiceMessage, serviceTransition } from "@/app/actions/provider";
import { ActionForm } from "@/components/forms";
import { PageHeader, Section, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { fcfa, fdatetime, ORDER_STATUS, PAYMENT_STATUS } from "@/lib/format";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) notFound();
  const [o] = await db.select().from(serviceOrders).where(and(eq(serviceOrders.id, id), or(eq(serviceOrders.clientId, u.id), eq(serviceOrders.providerId, u.id)))).limit(1);
  if (!o) notFound();
  const msgs = await db.select({ m: serviceMessages, name: users.name }).from(serviceMessages).innerJoin(users, eq(users.id, serviceMessages.authorId)).where(eq(serviceMessages.orderId, id)).orderBy(asc(serviceMessages.id));
  const pays = await db.select().from(payments).where(eq(payments.serviceOrderId, id));
  const isProv = o.providerId === u.id;
  const T = ({ action, label, cls = "btn btn-green btn-sm", children }: { action: string; label: string; cls?: string; children?: React.ReactNode }) => (
    <ActionForm action={serviceTransition} submit={label} btnClass={cls} className="space-y-2">
      <input type="hidden" name="orderId" value={id} /><input type="hidden" name="action" value={action} />{children}
    </ActionForm>
  );
  return (
    <>
      <PageHeader title={o.title} subtitle={o.description ?? undefined} actions={<StatusBadge meta={ORDER_STATUS} value={o.status} />} />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Section title="Négociation et échanges">
          <ul className="mb-4 max-h-96 space-y-2 overflow-y-auto">
            {msgs.map(({ m, name }) => (
              <li key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.authorId === u.id ? "ml-auto bg-mint" : "bg-slate-100"}`}>
                <p className="text-[11px] font-semibold text-slate-500">{name} · {fdatetime(m.createdAt)}</p>
                <p>{m.body}</p>
                {m.price != null && <p className="mt-1 font-bold text-brand">Proposition : {fcfa(m.price)}</p>}
              </li>
            ))}
          </ul>
          {["requested", "negotiating", "agreed", "in_progress"].includes(o.status) && (
            <ActionForm action={postServiceMessage} submit="Envoyer" className="space-y-2" btnClass="btn btn-outline btn-sm">
              <input type="hidden" name="orderId" value={id} />
              <textarea name="body" rows={2} className="input" placeholder="Votre message" />
              {["requested", "negotiating"].includes(o.status) && o.compensationMode === "money" && <input name="price" type="number" min={0} step={500} className="input" placeholder="Contre-proposition de prix (FCFA) — facultatif" />}
            </ActionForm>
          )}
        </Section>
        <div className="space-y-5">
          <Section title="Conditions">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt>Rémunération</dt><dd className="font-semibold">{o.compensationMode === "exchange" ? "Échange de services" : "Monétaire"}</dd></div>
              {o.compensationMode === "money" && <div className="flex justify-between"><dt>Prix {o.agreedPrice != null ? "convenu" : "en négociation"}</dt><dd className="font-bold text-brand">{fcfa(o.agreedPrice ?? o.proposedPrice)}</dd></div>}
              {o.compensationMode === "exchange" && <p className="rounded-lg bg-slate-50 p-2">{o.exchangeDescription}</p>}
              <div className="flex justify-between"><dt>Lieu</dt><dd>{o.zone ?? "—"}</dd></div>
            </dl>
            {pays.map((p) => <p key={p.id} className="mt-2 text-xs text-slate-500">Suivi financier : <StatusBadge meta={PAYMENT_STATUS} value={p.status} /> · payé {fcfa(p.amountPaid)}{p.mode === "exchange" && ` · exécution : ${p.exchangeStatus}`}</p>)}
          </Section>
          <Section title="Actions">
            <div className="space-y-3">
              {["requested", "negotiating"].includes(o.status) && <T action="accept" label="Accepter les termes" />}
              {["requested", "negotiating"].includes(o.status) && <T action="decline" label={isProv ? "Décliner" : "Annuler la demande"} cls="btn btn-danger btn-sm" />}
              {isProv && o.status === "agreed" && <T action="start" label="Démarrer la prestation" />}
              {isProv && o.status === "in_progress" && <T action="done" label="Marquer comme réalisée" />}
              {!isProv && o.status === "done" && (
                <T action="confirm" label="Confirmer et noter" cls="btn btn-yellow btn-sm">
                  <select name="rating" defaultValue="5" className="input">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}{"☆".repeat(5 - n)} ({n}/5)</option>)}</select>
                  <textarea name="comment" rows={2} className="input" placeholder="Votre avis" />
                </T>
              )}
              {["confirmed", "declined", "cancelled"].includes(o.status) && <p className="text-sm text-slate-500">Cette demande est terminée.</p>}
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
