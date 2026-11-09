import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { payments, users } from "@/db/schema";
import { updatePayment } from "@/app/actions/admin";
import { ActionForm } from "@/components/forms";
import { Empty, PageHeader, StatusBadge } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { fcfa, fdate, PAY_METHODS, PAYMENT_STATUS } from "@/lib/format";

export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string; d?: string }> }) {
  await requirePerm("payments.manage");
  const { s, d } = await searchParams;
  let rows = await db.select({ p: payments, uname: users.name, uphone: users.phone }).from(payments).innerJoin(users, eq(users.id, payments.userId)).orderBy(desc(payments.id)).limit(200);
  if (s) rows = rows.filter((r) => r.p.status === s);
  if (d) rows = rows.filter((r) => r.p.direction === d);
  const sum = (f: (p: (typeof rows)[number]["p"]) => number) => rows.reduce((t, r) => t + f(r.p), 0);
  return (
    <>
      <PageHeader title="Paiements & échanges de services" subtitle="Montants prévus, validés, payés et restant dus ; justificatifs et références de transaction." />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/paiements" className={`btn btn-sm ${!s && !d ? "btn-green" : "btn-outline"}`}>Tous</Link>
        <Link href="/admin/paiements?d=in" className={`btn btn-sm ${d === "in" ? "btn-green" : "btn-outline"}`}>Encaissements</Link>
        <Link href="/admin/paiements?d=out" className={`btn btn-sm ${d === "out" ? "btn-green" : "btn-outline"}`}>Rémunérations</Link>
        {["declared", "validated", "partial", "paid"].map((k) => <Link key={k} href={`/admin/paiements?s=${k}`} className={`btn btn-sm ${s === k ? "btn-green" : "btn-outline"}`}>{PAYMENT_STATUS[k].label}</Link>)}
      </div>
      <p className="mb-3 text-sm text-slate-600">Prévu : <strong>{fcfa(sum((p) => p.amountPlanned))}</strong> · Payé : <strong>{fcfa(sum((p) => p.amountPaid))}</strong></p>
      {rows.length === 0 ? <Empty>Aucun paiement.</Empty> : (
        <div className="space-y-3">
          {rows.map(({ p, uname, uphone }) => (
            <details key={p.id} className="card p-4">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
                <span><strong>{p.direction === "in" ? "↘" : "↗"} {p.note || p.kind}</strong> · {uname || uphone} · {p.mode === "exchange" ? "Échange de services" : `${fcfa(p.amountPlanned)} prévu`}{p.requestId && <> · <Link href={`/admin/demandes/${p.requestId}`} className="text-brand underline">demande</Link></>}</span>
                <span className="flex items-center gap-2"><span className="text-xs text-slate-500">Éch. {fdate(p.dueDate)} · payé {fcfa(p.amountPaid)}</span><StatusBadge meta={PAYMENT_STATUS} value={p.status} /></span>
              </summary>
              <div className="mt-3 text-xs text-slate-500">Moyen : {PAY_METHODS[p.method ?? ""] ?? "—"} · Réf. : {p.reference || "—"} {p.receiptPath && <a href={`/api/files/receipt/${p.id}`} target="_blank" className="font-semibold text-brand underline">· Justificatif</a>}{p.exchangeDescription && <p>Échange : {p.exchangeDescription} ({p.exchangeStatus})</p>}</div>
              <ActionForm action={updatePayment} submit="Enregistrer" className="mt-3 grid gap-2 sm:grid-cols-3" btnClass="btn btn-green btn-sm">
                <input type="hidden" name="paymentId" value={p.id} />
                <div><label className="label">Montant validé</label><input name="amountValidated" type="number" min={0} defaultValue={p.amountValidated ?? p.amountPlanned} className="input" /></div>
                <div><label className="label">Montant payé</label><input name="amountPaid" type="number" min={0} defaultValue={p.amountPaid} className="input" /></div>
                <div><label className="label">Statut</label><select name="status" defaultValue={p.status} className="input">{Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
                <div><label className="label">Référence</label><input name="reference" defaultValue={p.reference ?? ""} className="input" /></div>
                {p.mode === "exchange" && <div><label className="label">Exécution de l’échange</label><select name="exchangeStatus" defaultValue={p.exchangeStatus ?? "pending"} className="input"><option value="pending">À faire</option><option value="in_progress">En cours</option><option value="done">Réalisé</option></select></div>}
                <div><label className="label">Facture / reçu</label><input name="receipt" type="file" accept="image/*,application/pdf" className="input" /></div>
                <div className="sm:col-span-3"><label className="label">Note</label><input name="note" defaultValue={p.note ?? ""} className="input" /></div>
              </ActionForm>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
