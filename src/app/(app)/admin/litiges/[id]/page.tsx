import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { disputes, users } from "@/db/schema";
import { updateDispute } from "@/app/actions/admin";
import { ActionForm } from "@/components/forms";
import { DisputeView } from "@/components/DisputeView";
import { Section } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { DISPUTE_STATUS } from "@/lib/format";
import Link from "next/link";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const u = await requirePerm("disputes.manage");
  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) notFound();
  const [d] = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
  if (!d) notFound();
  const admins = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.role, ["admin", "subadmin"]));
  return (
    <DisputeView id={id} viewerId={u.id}>
      <Section title="Traitement">
        {d.requestId && <p className="mb-2 text-sm"><Link className="text-brand underline" href={`/admin/demandes/${d.requestId}`}>Voir la demande associée</Link></p>}
        <ActionForm action={updateDispute} submit="Enregistrer">
          <input type="hidden" name="disputeId" value={id} />
          <select name="status" defaultValue={d.status} className="input">{Object.entries(DISPUTE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          <select name="responsibleId" defaultValue={d.responsibleId ?? 0} className="input"><option value="0">Responsable : —</option>{admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
          <textarea name="decision" rows={3} defaultValue={d.decision ?? ""} className="input" placeholder="Décision motivée (obligatoire pour résoudre / clore)" />
        </ActionForm>
      </Section>
    </DisputeView>
  );
}
