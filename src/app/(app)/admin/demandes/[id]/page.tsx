import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { beneficiaries, disputes, installments, missions, payments, proofs, providerProfiles, requestHistory, requestItems, requests, users } from "@/db/schema";
import { CheckCircle2, XCircle } from "lucide-react";
import { cancelMission, closeRequest, createMission, decideRequest, linkBeneficiary, markInstallmentDone, markRequestCompleted, reassignMission, updateFinance } from "@/app/actions/admin";
import { uploadProof } from "@/app/actions/provider";
import { ActionForm } from "@/components/forms";
import { RequestTracker } from "@/components/RequestTracker";
import { PageHeader, Section, StatusBadge } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { margin } from "@/lib/finance";
import {
  DISPUTE_STATUS, fcfa, fdate, fdatetime, KIND_LABEL, MISSION_STATUS, PAYMENT_MODE, PAYMENT_STATUS, PROOF_STATUS, PROOF_TYPES, RECURRENCE, REQUEST_STATUS, PROVIDER_CATEGORIES,
} from "@/lib/format";
import { ANNEX_LABELS } from "@/lib/requests";
import { audit } from "@/lib/audit";
import { getSetting } from "@/lib/settings";
import { hasPerm } from "@/lib/rbac";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const u = await requirePerm("requests.manage");
  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) notFound();
  const [row] = await db.select({ r: requests, dname: users.name, dphone: users.phone }).from(requests).innerJoin(users, eq(users.id, requests.userId)).where(eq(requests.id, id)).limit(1);
  if (!row) notFound();
  const { r } = row;
  const canBen = hasPerm(u, "beneficiaries.view");
  const [items, history, inst, pays, prs, ms, ds, provs, bens, target] = await Promise.all([
    db.select().from(requestItems).where(eq(requestItems.requestId, id)),
    db.select().from(requestHistory).where(eq(requestHistory.requestId, id)).orderBy(desc(requestHistory.id)),
    db.select().from(installments).where(eq(installments.requestId, id)).orderBy(asc(installments.seq)),
    db.select().from(payments).where(eq(payments.requestId, id)).orderBy(asc(payments.id)),
    db.select().from(proofs).where(eq(proofs.requestId, id)).orderBy(desc(proofs.id)),
    db.select({ m: missions, pname: users.name }).from(missions).leftJoin(users, eq(users.id, missions.providerId)).where(eq(missions.requestId, id)),
    db.select().from(disputes).where(eq(disputes.requestId, id)),
    db.select({ id: users.id, name: users.name, cat: providerProfiles.category }).from(users).leftJoin(providerProfiles, eq(providerProfiles.userId, users.id)).where(and(eq(users.role, "provider"), eq(users.status, "active"))),
    canBen ? db.select().from(beneficiaries).where(isNull(beneficiaries.archivedAt)) : Promise.resolve([]),
    r.beneficiaryId && canBen ? db.select().from(beneficiaries).where(eq(beneficiaries.id, r.beneficiaryId)) : Promise.resolve([]),
  ]);
  if (target[0]) await audit(u, "beneficiary.view", "beneficiary", target[0].id, { via: `request ${r.ref}` });
  const fees = ms.filter(({ m }) => !["refused", "cancelled"].includes(m.status)).reduce((s, { m }) => s + m.providerFee, 0);
  const mg = margin(r, fees);
  const targetPct = (await getSetting<number>("finance.platform_margin_pct")) ?? 0;
  const annex = (r.annexServices ?? {}) as Record<string, unknown>;
  const canFin = hasPerm(u, "finances.view");

  // Conditions pour déclarer le don réalisé (mêmes règles que l'action markRequestCompleted)
  const minProofs = (await getSetting<number>("proofs.min_validated")) ?? 1;
  const proofTypes = (await getSetting<string[]>("proofs.accepted_types")) ?? ["photo", "attestation", "receipt"];
  const okProofs = prs.filter((p) => p.status === "validated" && proofTypes.includes(p.type)).length;
  const openMissions = ms.filter(({ m }) => ["proposed", "accepted", "in_progress"].includes(m.status));
  const pendingInst = inst.filter((i) => i.status === "planned");
  const MISSION_WAIT: Record<string, string> = {
    proposed: "attend que le prestataire accepte la mission depuis son espace",
    accepted: "acceptée : le prestataire doit la démarrer, déposer une preuve puis la terminer",
    in_progress: "en cours : le prestataire doit déposer une preuve puis la terminer",
  };
  const checks = [
    {
      ok: okProofs >= minProofs,
      label: `Preuve de remise validée (${okProofs}/${minProofs})`,
      help: okProofs >= minProofs ? null : `Types acceptés : ${proofTypes.map((t) => PROOF_TYPES[t] ?? t).join(", ")}. Faites contrôler les preuves déposées ou déposez-en une ci-contre.`,
    },
    {
      ok: openMissions.length === 0,
      label: openMissions.length === 0 ? "Missions terminées" : `${openMissions.length} mission(s) non terminée(s)`,
      help: openMissions.length === 0 ? null : openMissions.map(({ m, pname }) => `« ${m.title} » (${pname ?? "sans prestataire"}) ${MISSION_WAIT[m.status]}. Sinon, réattribuez-la ou annulez-la.`).join(" "),
    },
    {
      ok: pendingInst.length === 0,
      label: `Échéances réalisées (${inst.length - pendingInst.length}/${inst.length})`,
      help: pendingInst.length === 0 ? null : "Marquez chaque échéance comme « Réalisée » dans l’échéancier ci-dessous.",
    },
  ];
  const ready = checks.every((c) => c.ok);

  return (
    <>
      <PageHeader title={r.title} subtitle={`${r.ref} · ${KIND_LABEL[r.kind]} · ${fdatetime(r.createdAt)}`} />
      <RequestTracker status={r.status} createdAt={r.createdAt} updatedAt={r.updatedAt} history={history} />
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Section title="Demande">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-xs uppercase text-slate-500">Donateur</dt><dd>{row.dname || "—"} · {row.dphone}</dd></div>
              <div><dt className="text-xs uppercase text-slate-500">Cible déclarée</dt><dd>{r.targetName} {r.targetZone && `(${r.targetZone})`}</dd></div>
              <div><dt className="text-xs uppercase text-slate-500">Montant</dt><dd className="font-bold text-brand">{fcfa(r.totalAmount)} <span className="text-xs font-normal text-slate-500">({fcfa(r.amountPerOccurrence)} × {r.occurrences})</span></dd></div>
              <div><dt className="text-xs uppercase text-slate-500">Paiement / fréquence</dt><dd>{PAYMENT_MODE[r.paymentMode]} · {RECURRENCE[r.recurrence]}</dd></div>
            </dl>
            {r.description && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">{r.description}</p>}
            <ul className="mt-3 list-disc pl-5 text-sm">{items.map((i) => <li key={i.id}>{i.quantity} × {i.label} ({fcfa(i.unitPrice)}){i.target ? ` — ${i.target}` : ""}</li>)}</ul>
            {Object.keys(ANNEX_LABELS).some((k) => annex[k]) && <p className="mt-2 text-sm"><strong>Annexes :</strong> {Object.keys(ANNEX_LABELS).filter((k) => annex[k]).map((k) => ANNEX_LABELS[k]).join(", ")} {annex.packaging_notes ? `· ${annex.packaging_notes}` : ""} {annex.other ? `· ${annex.other}` : ""}</p>}
            {r.rejectionReason && <p className="mt-2 text-sm text-red-700">Motif de refus : {r.rejectionReason}</p>}
            {r.infoRequest && r.status === "info_requested" && <p className="mt-2 text-sm text-amber-800">Information demandée : {r.infoRequest}</p>}
          </Section>

          <Section title="Missions">
            {ms.length === 0 && <p className="text-sm text-slate-500">Aucune mission.</p>}
            <ul className="mb-4 space-y-2 text-sm">
              {ms.map(({ m, pname }) => (
                <li key={m.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{m.title}</span><StatusBadge meta={MISSION_STATUS} value={m.status} />
                  </div>
                  <p className="text-xs text-slate-500">{pname || "Aucun prestataire (exception : " + m.exceptionReason + ")"} · échéance {fdate(m.dueDate)} · {m.compensationMode === "exchange" ? `échange : ${m.exchangeDescription}` : fcfa(m.providerFee)}</p>
                  {m.refusalReason && <p className="text-xs text-red-600">Refus : {m.refusalReason}</p>}
                  {["refused", "proposed"].includes(m.status) && (
                    <ActionForm action={reassignMission} submit="Réattribuer" className="mt-2 flex gap-2" btnClass="btn btn-outline btn-sm">
                      <input type="hidden" name="missionId" value={m.id} />
                      <select name="providerId" className="input">{provs.map((p) => <option key={p.id} value={p.id}>{p.name} ({PROVIDER_CATEGORIES[p.cat ?? "autre"]})</option>)}</select>
                    </ActionForm>
                  )}
                  {["proposed", "accepted", "in_progress"].includes(m.status) && hasPerm(u, "missions.manage") && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-semibold text-red-600">Annuler la mission</summary>
                      <ActionForm action={cancelMission} submit="Confirmer l’annulation" className="mt-2 flex flex-wrap gap-2" btnClass="btn btn-danger btn-sm">
                        <input type="hidden" name="missionId" value={m.id} />
                        <input name="reason" className="input flex-1" placeholder="Motif (obligatoire)" required minLength={5} aria-label="Motif de l’annulation" />
                      </ActionForm>
                    </details>
                  )}
                </li>
              ))}
            </ul>
            {["accepted", "in_progress"].includes(r.status) && (
              <details>
                <summary className="btn btn-yellow btn-sm cursor-pointer">+ Créer une mission</summary>
                <ActionForm action={createMission} submit="Créer la mission" className="mt-3 space-y-2">
                  <input type="hidden" name="requestId" value={id} />
                  <input name="title" className="input" placeholder="Intitulé de la mission" required />
                  <textarea name="instructions" rows={2} className="input" placeholder="Instructions d’exécution" />
                  <select name="providerId" className="input"><option value="0">— Aucun (exception administrative documentée) —</option>{provs.map((p) => <option key={p.id} value={p.id}>{p.name} ({PROVIDER_CATEGORIES[p.cat ?? "autre"]})</option>)}</select>
                  <input name="exceptionReason" className="input" placeholder="Si aucun prestataire : justification de l’exception" />
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input name="dueDate" type="date" className="input" />
                    <select name="compensationMode" className="input"><option value="money">Paiement monétaire</option><option value="exchange">Échange de services</option></select>
                    <input name="providerFee" type="number" min={0} className="input" placeholder="Coût prestataire (FCFA)" />
                  </div>
                  <input name="exchangeDescription" className="input" placeholder="Si échange : engagements réciproques" />
                </ActionForm>
              </details>
            )}
          </Section>

          <Section title="Preuves de remise">
            {prs.length === 0 ? <p className="text-sm text-slate-500">Aucune preuve déposée.</p> : (
              <ul className="space-y-1 text-sm">{prs.map((p) => <li key={p.id} className="flex items-center justify-between gap-2"><a className="text-brand underline" target="_blank" href={`/api/files/proof/${p.id}`}>{PROOF_TYPES[p.type]} — {p.caption || p.fileName}</a><StatusBadge meta={PROOF_STATUS} value={p.status} /></li>)}</ul>
            )}
            <p className="mt-2 text-xs"><Link href="/admin/preuves" className="font-semibold text-brand underline">Contrôler les preuves →</Link></p>
            {hasPerm(u, "proofs.review") && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-brand">Déposer une preuve (exception administrative)</summary>
                <ActionForm action={uploadProof} submit="Déposer" className="mt-2 space-y-2" btnClass="btn btn-outline btn-sm">
                  <input type="hidden" name="requestId" value={id} />
                  <select name="type" className="input">{Object.entries(PROOF_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  <input name="caption" className="input" placeholder="Légende" /><input name="file" type="file" required className="input" />
                </ActionForm>
              </details>
            )}
          </Section>

          {hasPerm(u, "payments.manage") && (
            <Section title="Paiements liés" actions={<Link href="/admin/paiements" className="text-xs font-semibold text-brand">Gérer</Link>}>
              <ul className="space-y-1 text-sm">
                {pays.map((p) => <li key={p.id} className="flex items-center justify-between gap-2"><span>{p.direction === "in" ? "↘ Encaissement" : "↗ Rémunération"} · {p.note} · {p.mode === "exchange" ? "échange de services" : fcfa(p.amountPlanned)}</span><StatusBadge meta={PAYMENT_STATUS} value={p.status} /></li>)}
              </ul>
            </Section>
          )}
        </div>

        <div className="space-y-5">
          {r.status === "submitted" && (
            <Section title="Décision administrative">
              <ActionForm action={decideRequest} submit="Accepter la demande" className="space-y-2">
                <input type="hidden" name="requestId" value={id} /><input type="hidden" name="decision" value="accept" />
                <input name="newAmount" type="number" min={0} className="input" placeholder={`Ajuster le montant par échéance (actuel : ${r.amountPerOccurrence})`} />
                <input name="message" className="input" placeholder="Commentaire (facultatif)" />
              </ActionForm>
              <hr className="my-3" />
              <ActionForm action={decideRequest} submit="Demander des informations" btnClass="btn btn-outline btn-sm">
                <input type="hidden" name="requestId" value={id} /><input type="hidden" name="decision" value="info" />
                <textarea name="message" rows={2} className="input" placeholder="Information demandée au donateur" required />
              </ActionForm>
              <hr className="my-3" />
              <ActionForm action={decideRequest} submit="Refuser" btnClass="btn btn-danger btn-sm">
                <input type="hidden" name="requestId" value={id} /><input type="hidden" name="decision" value="reject" />
                <textarea name="message" rows={2} className="input" placeholder="Motif du refus (obligatoire, consultable par le donateur)" required />
              </ActionForm>
            </Section>
          )}

          {["accepted", "in_progress"].includes(r.status) && (
            <Section title="Déclarer le don réalisé">
              <ul className="mb-3 space-y-2 text-sm">
                {checks.map((c) => (
                  <li key={c.label} className="flex gap-2">
                    {c.ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" aria-label="Condition remplie" /> : <XCircle size={18} className="mt-0.5 shrink-0 text-red-600" aria-label="Condition non remplie" />}
                    <span>
                      <span className={c.ok ? "text-slate-700" : "font-semibold text-red-700"}>{c.label}</span>
                      {c.help && <span className="block text-xs text-slate-500">{c.help}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <ActionForm action={markRequestCompleted} submit="Déclarer réalisé" hideSubmit={!ready}>
                <input type="hidden" name="requestId" value={id} />
                {!ready && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Le bouton « Déclarer réalisé » apparaîtra quand toutes les conditions seront remplies. Ensuite, vous pourrez clôturer le don.</p>}
              </ActionForm>
            </Section>
          )}
          {r.status === "completed" && (
            <Section title="Clôture"><ActionForm action={closeRequest} submit="Clôturer le don"><input type="hidden" name="requestId" value={id} /></ActionForm></Section>
          )}

          {inst.length > 0 && (
            <Section title="Échéancier">
              <ul className="space-y-1 text-sm">
                {inst.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2"><span>#{i.seq} · {fdate(i.dueDate)} · {fcfa(i.amount)}</span>
                    {i.status === "done" ? <span>✅</span> : ["accepted", "in_progress"].includes(r.status) ? <form action={markInstallmentDone}><input type="hidden" name="id" value={i.id} /><button className="btn btn-outline btn-sm">Réalisée</button></form> : <span>⏳</span>}</li>
                ))}
              </ul>
            </Section>
          )}

          {canFin && (
            <Section title="Finances & marge brute">
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between"><dt>Contribution du donateur</dt><dd>{fcfa(r.totalAmount)}</dd></div>
                <div className="flex justify-between"><dt>− Budget d’exécution</dt><dd>{fcfa(r.executionBudget)}</dd></div>
                <div className="flex justify-between"><dt>− Frais prestataires</dt><dd>{fcfa(fees)}</dd></div>
                <div className="flex justify-between"><dt>− Autres frais</dt><dd>{fcfa(r.otherFees)}</dd></div>
                <div className={`flex justify-between border-t pt-1 font-bold ${mg.gross < 0 ? "text-red-600" : "text-brand"}`}><dt>Marge brute</dt><dd>{fcfa(mg.gross)} ({mg.pct.toFixed(1)} %)</dd></div>
                <p className="text-xs text-slate-500">Cible provisoire : {targetPct} %</p>
              </dl>
              {hasPerm(u, "payments.manage") && (
                <ActionForm action={updateFinance} submit="Mettre à jour" className="mt-3 grid grid-cols-2 gap-2" btnClass="btn btn-outline btn-sm">
                  <input type="hidden" name="requestId" value={id} />
                  <input name="executionBudget" type="number" min={0} defaultValue={r.executionBudget} className="input" aria-label="Budget d'exécution" />
                  <input name="otherFees" type="number" min={0} defaultValue={r.otherFees} className="input" aria-label="Autres frais" />
                </ActionForm>
              )}
            </Section>
          )}

          <Section title="Bénéficiaire">
            {!canBen ? <p className="text-sm text-slate-500">Données personnelles masquées (permission requise).</p> : (
              <>
                {target[0] ? <p className="mb-2 text-sm"><strong>{target[0].fullName}</strong> · {target[0].phone} · {target[0].zone}</p> : <p className="mb-2 text-sm text-slate-500">Aucun bénéficiaire associé.</p>}
                <ActionForm action={linkBeneficiary} submit="Associer" className="flex gap-2" btnClass="btn btn-outline btn-sm">
                  <input type="hidden" name="requestId" value={id} />
                  <select name="beneficiaryId" defaultValue={r.beneficiaryId ?? 0} className="input"><option value="0">—</option>{bens.map((b) => <option key={b.id} value={b.id}>{b.fullName} ({b.zone})</option>)}</select>
                </ActionForm>
              </>
            )}
          </Section>

          {ds.length > 0 && (
            <Section title="Litiges">{ds.map((d) => <Link key={d.id} href={`/admin/litiges/${d.id}`} className="mb-1 flex items-center justify-between rounded-lg bg-slate-50 p-2 text-sm"><span>{d.ref} — {d.subject}</span><StatusBadge meta={DISPUTE_STATUS} value={d.status} /></Link>)}</Section>
          )}

          <Section title="Historique">
            <ol className="space-y-2 border-l-2 border-mint pl-4 text-sm">
              {history.map((h) => <li key={h.id}><StatusBadge meta={REQUEST_STATUS} value={h.status} /> <span className="text-xs text-slate-500">{fdatetime(h.createdAt)}</span><p>{h.note}</p></li>)}
            </ol>
          </Section>
        </div>
      </div>
    </>
  );
}
