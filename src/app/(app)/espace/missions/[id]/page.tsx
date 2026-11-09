import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { beneficiaries, missions, proofs, requestItems, requests } from "@/db/schema";
import { completeMission, respondMission, startMission, uploadProof } from "@/app/actions/provider";
import { ActionForm } from "@/components/forms";
import { Empty, PageHeader, Section, StatusBadge } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { fcfa, fdate, MISSION_STATUS, PROOF_STATUS, PROOF_TYPES } from "@/lib/format";
import { ANNEX_LABELS } from "@/lib/requests";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireRole("provider");
  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) notFound();
  const [m] = await db.select().from(missions).where(and(eq(missions.id, id), eq(missions.providerId, u.id))).limit(1);
  if (!m) notFound();
  const [r] = await db.select().from(requests).where(eq(requests.id, m.requestId)).limit(1);
  const items = await db.select().from(requestItems).where(eq(requestItems.requestId, m.requestId));
  const mine = await db.select().from(proofs).where(eq(proofs.missionId, id)).orderBy(desc(proofs.id));
  // Données du bénéficiaire : uniquement une fois la mission acceptée (besoin d'en connaître)
  const [ben] = r?.beneficiaryId && ["accepted", "in_progress"].includes(m.status)
    ? await db.select().from(beneficiaries).where(eq(beneficiaries.id, r.beneficiaryId)).limit(1)
    : [];
  const annex = (r?.annexServices ?? {}) as Record<string, unknown>;
  const active = ["accepted", "in_progress"].includes(m.status);

  return (
    <>
      <PageHeader title={m.title} subtitle={`Échéance : ${fdate(m.dueDate)}`} actions={<StatusBadge meta={MISSION_STATUS} value={m.status} />} />
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-5">
          <Section title="Informations nécessaires à l’exécution">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-xs uppercase text-slate-500">Don concerné</dt><dd>{r?.title}</dd></div>
              <div><dt className="text-xs uppercase text-slate-500">Cible / zone</dt><dd>{r?.targetName} {r?.targetZone && `· ${r.targetZone}`}</dd></div>
              <div><dt className="text-xs uppercase text-slate-500">Rémunération</dt><dd className="font-bold text-brand">{m.compensationMode === "exchange" ? "Échange de services" : fcfa(m.providerFee)}</dd></div>
              {m.compensationMode === "exchange" && <div><dt className="text-xs uppercase text-slate-500">Engagements réciproques</dt><dd>{m.exchangeDescription} ({m.exchangeStatus})</dd></div>}
            </dl>
            {m.instructions && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">{m.instructions}</p>}
            <ul className="mt-3 list-disc pl-5 text-sm">{items.map((i) => <li key={i.id}>{i.quantity} × {i.label}{i.target ? ` — ${i.target}` : ""}</li>)}</ul>
            {Object.keys(ANNEX_LABELS).some((k) => annex[k]) && <p className="mt-2 text-sm"><strong>Annexes demandées :</strong> {Object.keys(ANNEX_LABELS).filter((k) => annex[k]).map((k) => ANNEX_LABELS[k]).join(", ")} {annex.packaging_notes ? `· ${annex.packaging_notes}` : ""} {annex.other ? `· ${annex.other}` : ""}</p>}
            {ben ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
                <p className="font-semibold text-amber-900">Contact du bénéficiaire (confidentiel)</p>
                <p>{ben.fullName} · {ben.phone || "—"} · {ben.address || ben.zone || "—"}</p>
              </div>
            ) : m.status === "proposed" ? <p className="mt-3 text-xs text-slate-500">Les coordonnées du bénéficiaire sont communiquées après acceptation de la mission.</p> : null}
            {m.refusalReason && <p className="mt-3 text-sm text-red-700">Motif de refus : {m.refusalReason}</p>}
          </Section>

          <Section title="Preuves déposées">
            {mine.length === 0 ? <Empty>Aucune preuve.</Empty> : (
              <ul className="space-y-2 text-sm">
                {mine.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-2.5">
                    <span><a href={`/api/files/proof/${p.id}`} target="_blank" className="font-semibold text-brand underline">{PROOF_TYPES[p.type]}</a> — {p.caption || p.fileName}{p.rejectionReason && <span className="block text-xs text-red-600">Rejet : {p.rejectionReason}</span>}</span>
                    <StatusBadge meta={PROOF_STATUS} value={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-5">
          {m.status === "proposed" && (
            <Section title="Répondre à la proposition">
              <ActionForm action={respondMission} submit="Accepter la mission" className="space-y-2">
                <input type="hidden" name="missionId" value={id} /><input type="hidden" name="decision" value="accept" />
              </ActionForm>
              <hr className="my-4" />
              <ActionForm action={respondMission} submit="Refuser" btnClass="btn btn-danger btn-sm">
                <input type="hidden" name="missionId" value={id} /><input type="hidden" name="decision" value="refuse" />
                <textarea name="reason" rows={2} className="input" placeholder="Motif du refus (obligatoire)" required />
              </ActionForm>
            </Section>
          )}
          {m.status === "accepted" && (
            <Section title="Suivi"><ActionForm action={startMission} submit="Démarrer la mission"><input type="hidden" name="missionId" value={id} /></ActionForm></Section>
          )}
          {active && (
            <>
              <Section title="Déposer une preuve">
                <ActionForm action={uploadProof} submit="Envoyer la preuve" btnClass="btn btn-yellow btn-sm">
                  <input type="hidden" name="missionId" value={id} />
                  <select name="type" className="input">{Object.entries(PROOF_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  <input name="caption" className="input" placeholder="Légende (facultatif)" />
                  <input name="file" type="file" accept="image/*,application/pdf,video/mp4" required className="input" />
                  <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" name="hidden" /> Ne pas montrer au donateur (pièce comptable interne)</label>
                  <p className="text-xs text-slate-500">JPG, PNG, WEBP, PDF ou MP4 — 8 Mo max. Respectez le consentement des personnes photographiées.</p>
                </ActionForm>
              </Section>
              <Section title="Terminer la mission">
                <ActionForm action={completeMission} submit="Marquer comme terminée">
                  <input type="hidden" name="missionId" value={id} />
                  <p className="text-xs text-slate-500">Au moins une preuve est requise. L’administration contrôlera les preuves avant validation et rémunération.</p>
                </ActionForm>
              </Section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
