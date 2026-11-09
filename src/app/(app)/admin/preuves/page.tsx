import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { proofs, requests, users } from "@/db/schema";
import { reviewProof } from "@/app/actions/admin";
import { ActionForm } from "@/components/forms";
import { Empty, PageHeader, Section, StatusBadge } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { fdatetime, PROOF_STATUS, PROOF_TYPES } from "@/lib/format";

export default async function Page() {
  await requirePerm("proofs.review");
  const rows = await db.select({ p: proofs, ref: requests.ref, up: users.name }).from(proofs).innerJoin(requests, eq(requests.id, proofs.requestId)).innerJoin(users, eq(users.id, proofs.uploadedBy)).orderBy(desc(proofs.id)).limit(100);
  const pending = rows.filter((r) => r.p.status === "pending");
  const done = rows.filter((r) => r.p.status !== "pending");
  return (
    <>
      <PageHeader title="Contrôle des preuves" subtitle="Valider ou rejeter les preuves de remise (photos, reçus, factures, attestations)." />
      <Section title={`À contrôler (${pending.length})`}>
        {pending.length === 0 ? <Empty>Aucune preuve en attente.</Empty> : (
          <div className="grid gap-4 md:grid-cols-2">
            {pending.map(({ p, ref, up }) => (
              <div key={p.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                {p.mime.startsWith("image/") && <img src={`/api/files/proof/${p.id}`} alt={p.fileName} className="mb-2 h-44 w-full rounded-lg object-cover" />}
                <p className="font-semibold">{PROOF_TYPES[p.type]} — {p.caption || p.fileName}</p>
                <p className="text-xs text-slate-500"><Link href={`/admin/demandes/${p.requestId}`} className="text-brand underline">{ref}</Link> · par {up} · {fdatetime(p.createdAt)} · <a className="underline" target="_blank" href={`/api/files/proof/${p.id}`}>ouvrir</a></p>
                <ActionForm action={reviewProof} submit="Valider" className="mt-2 space-y-2" btnClass="btn btn-green btn-sm">
                  <input type="hidden" name="proofId" value={p.id} /><input type="hidden" name="decision" value="validate" />
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="hide" /> Ne pas montrer au donateur</label>
                </ActionForm>
                <ActionForm action={reviewProof} submit="Rejeter" className="mt-2 flex gap-2" btnClass="btn btn-danger btn-sm">
                  <input type="hidden" name="proofId" value={p.id} /><input type="hidden" name="decision" value="reject" />
                  <input name="reason" className="input" placeholder="Motif du rejet" required />
                </ActionForm>
              </div>
            ))}
          </div>
        )}
      </Section>
      <div className="mt-5">
        <Section title="Historique des contrôles">
          <ul className="divide-y divide-slate-100 text-sm">
            {done.map(({ p, ref }) => <li key={p.id} className="flex items-center justify-between gap-2 py-2"><span>{ref} · {PROOF_TYPES[p.type]} — {p.fileName}{p.rejectionReason && <span className="text-xs text-red-600"> ({p.rejectionReason})</span>}</span><StatusBadge meta={PROOF_STATUS} value={p.status} /></li>)}
          </ul>
        </Section>
      </div>
    </>
  );
}
