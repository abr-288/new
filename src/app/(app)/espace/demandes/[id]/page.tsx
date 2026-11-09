import { notFound } from "next/navigation";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { disputes, installments, missions, payments, proofs, requestHistory, requestItems, requests, reviews, users } from "@/db/schema";
import { answerInfoRequest, cancelRequest, declarePayment, openDispute, rateMission } from "@/app/actions/donor";
import { ActionForm } from "@/components/forms";
import { RequestTracker } from "@/components/RequestTracker";
import { PageHeader, Section, StatusBadge, Empty } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import {
  DISPUTE_STATUS, fcfa, fdate, fdatetime, KIND_LABEL, MISSION_STATUS, PAY_METHODS, PAYMENT_MODE, PAYMENT_STATUS, PROOF_TYPES, RECURRENCE, REQUEST_STATUS,
} from "@/lib/format";
import { ANNEX_LABELS } from "@/lib/requests";
import Link from "next/link";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireRole("donor", "client");
  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) notFound();
  // Le donateur ne consulte que ses propres demandes
  const [r] = await db.select().from(requests).where(and(eq(requests.id, id), eq(requests.userId, u.id))).limit(1);
  if (!r) notFound();

  const [items, history, inst, pays, pr, ms, ds, myReview] = await Promise.all([
    db.select().from(requestItems).where(eq(requestItems.requestId, id)),
    db.select().from(requestHistory).where(eq(requestHistory.requestId, id)).orderBy(desc(requestHistory.id)),
    db.select().from(installments).where(eq(installments.requestId, id)).orderBy(asc(installments.seq)),
    db.select().from(payments).where(and(eq(payments.requestId, id), eq(payments.direction, "in"), eq(payments.userId, u.id))).orderBy(asc(payments.id)),
    // uniquement les preuves validées et destinées au donateur
    db.select().from(proofs).where(and(eq(proofs.requestId, id), eq(proofs.status, "validated"), eq(proofs.visibleToDonor, true))).orderBy(desc(proofs.id)),
    db.select({ m: missions, pname: users.name }).from(missions).leftJoin(users, eq(users.id, missions.providerId)).where(eq(missions.requestId, id)),
    db.select().from(disputes).where(and(eq(disputes.requestId, id), eq(disputes.openedBy, u.id))),
    db.select().from(reviews).where(and(eq(reviews.kind, "mission"), eq(reviews.fromUserId, u.id), sql`${reviews.refId} in (select id from missions where request_id = ${id})`)),
  ]);
  const annex = r.annexServices ?? {};

  return (
    <>
      <PageHeader
        title={r.title}
        subtitle={`${r.ref} · ${KIND_LABEL[r.kind]} · créée le ${fdate(r.createdAt)}`}
      />
      <RequestTracker status={r.status} createdAt={r.createdAt} updatedAt={r.updatedAt} history={history} />

      {r.status === "rejected" && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><strong>Demande refusée.</strong> Motif : {r.rejectionReason}</div>
      )}
      {r.status === "info_requested" && (
        <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-semibold text-amber-900">L’équipe a besoin d’informations complémentaires :</p>
          <p className="mb-3 mt-1 text-amber-900">{r.infoRequest}</p>
          <ActionForm action={answerInfoRequest} submit="Envoyer ma réponse">
            <input type="hidden" name="requestId" value={id} />
            <textarea name="answer" rows={3} className="input" required />
          </ActionForm>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Section title="Détails">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-xs uppercase text-slate-500">Cible</dt><dd>{r.targetName || "—"} {r.targetZone && `(${r.targetZone})`}</dd></div>
              <div><dt className="text-xs uppercase text-slate-500">Montant total</dt><dd className="font-bold text-brand">{fcfa(r.totalAmount)}</dd></div>
              <div><dt className="text-xs uppercase text-slate-500">Paiement</dt><dd>{PAYMENT_MODE[r.paymentMode]}</dd></div>
              <div><dt className="text-xs uppercase text-slate-500">Fréquence</dt><dd>{RECURRENCE[r.recurrence]}{r.occurrences > 1 && ` × ${r.occurrences}`}</dd></div>
            </dl>
            {r.description && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">{r.description}</p>}
            <table className="tbl mt-4">
              <thead><tr><th>Article</th><th>Qté</th><th>Prix unitaire</th><th>Cible</th></tr></thead>
              <tbody>{items.map((i) => <tr key={i.id}><td>{i.label}</td><td>{i.quantity}</td><td>{fcfa(i.unitPrice)}</td><td>{i.target || "—"}</td></tr>)}</tbody>
            </table>
            {Object.keys(annex).length > 0 && (
              <p className="mt-3 text-sm"><strong>Services annexes :</strong> {Object.keys(ANNEX_LABELS).filter((k) => annex[k]).map((k) => ANNEX_LABELS[k]).join(", ") || "—"}
                {annex.packaging_notes ? ` · Packaging : ${annex.packaging_notes}` : ""}{annex.other ? ` · Autre : ${annex.other}` : ""}</p>
            )}
          </Section>

          <Section title="Preuves de remise">
            {pr.length === 0 ? <Empty>Aucune preuve disponible pour le moment. Elles apparaissent après contrôle de l’administration.</Empty> : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {pr.map((p) => (
                  <li key={p.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                    {p.mime.startsWith("image/") && <img src={`/api/files/proof/${p.id}`} alt={p.caption || p.fileName} className="mb-2 h-36 w-full rounded-lg object-cover" />}
                    <p className="font-semibold">{PROOF_TYPES[p.type]}</p>
                    <p className="text-xs text-slate-500">{p.caption || p.fileName}</p>
                    <a href={`/api/files/proof/${p.id}`} target="_blank" className="mt-1 inline-block text-xs font-semibold text-brand underline">Ouvrir / télécharger</a>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Paiements">
            {pays.length === 0 ? <Empty>Aucun paiement.</Empty> : (
              <div className="space-y-3">
                {pays.map((p) => (
                  <div key={p.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{p.note} — {fcfa(p.amountPlanned)}</span>
                      <StatusBadge meta={PAYMENT_STATUS} value={p.status} />
                    </div>
                    <p className="text-xs text-slate-500">Échéance : {fdate(p.dueDate)} · Payé : {fcfa(p.amountPaid)} · Reste dû : {fcfa(Math.max((p.amountValidated ?? p.amountPlanned) - p.amountPaid, 0))}{p.reference ? ` · Réf. ${p.reference}` : ""}{p.method ? ` · ${PAY_METHODS[p.method]}` : ""}</p>
                    {["planned", "declared"].includes(p.status) && (
                      <ActionForm action={declarePayment} submit={p.status === "declared" ? "Mettre à jour" : "Déclarer mon paiement"} className="mt-3 grid gap-2 sm:grid-cols-2" btnClass="btn btn-yellow btn-sm">
                        <input type="hidden" name="paymentId" value={p.id} />
                        <select name="method" className="input" defaultValue={p.method ?? "mobile_money"}>
                          {["mobile_money", "card", "bank", "cash"].map((m) => <option key={m} value={m}>{PAY_METHODS[m]}</option>)}
                        </select>
                        <input name="reference" defaultValue={p.reference ?? ""} className="input" placeholder="Référence de transaction" />
                        <input name="receipt" type="file" accept="image/*,application/pdf" className="input sm:col-span-2" aria-label="Reçu" />
                      </ActionForm>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {ms.length > 0 && (
            <Section title="Avancement de la réalisation">
              <ul className="space-y-2 text-sm">
                {ms.map(({ m, pname }) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
                    <span>{m.title}<br /><span className="text-xs text-slate-500">Prestataire : {pname || "Équipe Menewa"} · échéance {fdate(m.dueDate)}</span></span>
                    <StatusBadge meta={MISSION_STATUS} value={m.status} />
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <div className="space-y-5">
          {inst.length > 1 && (
            <Section title="Échéancier">
              <ul className="space-y-1 text-sm">
                {inst.map((i) => <li key={i.id} className="flex justify-between"><span>#{i.seq} · {fdate(i.dueDate)}</span><span>{fcfa(i.amount)} {i.status === "done" ? "✅" : "⏳"}</span></li>)}
              </ul>
            </Section>
          )}
          <Section title="Historique">
            <ol className="space-y-3 border-l-2 border-mint pl-4 text-sm">
              {history.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand" />
                  <StatusBadge meta={REQUEST_STATUS} value={h.status} />
                  <p className="mt-0.5">{h.note}</p>
                  <p className="text-xs text-slate-500">{fdatetime(h.createdAt)}</p>
                </li>
              ))}
            </ol>
          </Section>

          {["submitted", "info_requested"].includes(r.status) && (
            <Section title="Annuler">
              <ActionForm action={cancelRequest} submit="Annuler cette demande" btnClass="btn btn-danger btn-sm">
                <input type="hidden" name="requestId" value={id} />
                <p className="text-xs text-slate-500">Possible tant que la demande n’a pas été traitée.</p>
              </ActionForm>
            </Section>
          )}

          {["completed", "closed"].includes(r.status) && myReview.length === 0 && ms.some(({ m }) => m.validatedAt) && (
            <Section title="Noter le prestataire">
              <ActionForm action={rateMission} submit="Publier mon avis" btnClass="btn btn-yellow btn-sm">
                <input type="hidden" name="requestId" value={id} />
                <select name="rating" className="input" defaultValue="5">{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}{"☆".repeat(5 - n)} ({n}/5)</option>)}</select>
                <textarea name="comment" rows={2} className="input" placeholder="Votre commentaire" />
              </ActionForm>
            </Section>
          )}

          <Section title="Litiges">
            {ds.map((d) => (
              <Link key={d.id} href={`/espace/litiges/${d.id}`} className="mb-2 flex items-center justify-between rounded-xl bg-slate-50 p-2 text-sm hover:bg-mint">
                <span>{d.ref} — {d.subject}</span><StatusBadge meta={DISPUTE_STATUS} value={d.status} />
              </Link>
            ))}
            {!["cancelled", "rejected"].includes(r.status) && (
              <details className="text-sm">
                <summary className="cursor-pointer font-semibold text-brand">Signaler un problème</summary>
                <ActionForm action={openDispute} submit="Ouvrir un litige" btnClass="btn btn-outline btn-sm" className="mt-3 space-y-2">
                  <input type="hidden" name="requestId" value={id} />
                  <input name="subject" className="input" placeholder="Objet" required />
                  <textarea name="description" rows={3} className="input" placeholder="Décrivez le problème" required />
                </ActionForm>
              </details>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
