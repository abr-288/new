import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { disputeMessages, disputes, users } from "@/db/schema";
import { postDisputeMessage } from "@/app/actions/donor";
import { ActionForm } from "@/components/forms";
import { PageHeader, Section, StatusBadge } from "@/components/ui";
import { DISPUTE_STATUS, fdatetime } from "@/lib/format";

export async function DisputeView({ id, viewerId, children }: { id: number; viewerId: number; children?: React.ReactNode }) {
  const [d] = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
  if (!d) return null;
  const msgs = await db.select({ m: disputeMessages, name: users.name }).from(disputeMessages).innerJoin(users, eq(users.id, disputeMessages.authorId)).where(eq(disputeMessages.disputeId, id)).orderBy(asc(disputeMessages.id));
  const names = await db.select({ id: users.id, name: users.name, phone: users.phone }).from(users);
  const nm = (i: number | null) => (i ? names.find((n) => n.id === i)?.name || names.find((n) => n.id === i)?.phone : "—");
  return (
    <>
      <PageHeader title={`${d.ref} — ${d.subject}`} subtitle={`Ouvert le ${fdatetime(d.createdAt)}${d.closedAt ? ` · clos le ${fdatetime(d.closedAt)}` : ""}`} actions={<StatusBadge meta={DISPUTE_STATUS} value={d.status} />} />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Section title="Échanges">
          <p className="mb-3 rounded-xl bg-slate-50 p-3 text-sm">{d.description}</p>
          <ul className="mb-4 space-y-2">
            {msgs.map(({ m, name }) => (
              <li key={m.id} className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${m.authorId === viewerId ? "ml-auto bg-mint" : "bg-slate-100"}`}>
                <p className="text-[11px] font-semibold text-slate-500">{name} · {fdatetime(m.createdAt)}</p>
                <p>{m.body}</p>
                {m.attachmentPath && <a href={`/api/files/dispute/${m.id}`} target="_blank" className="text-xs font-semibold text-brand underline">📎 {m.attachmentName}</a>}
              </li>
            ))}
          </ul>
          {d.status !== "closed" && (
            <ActionForm action={postDisputeMessage} submit="Envoyer" btnClass="btn btn-outline btn-sm">
              <input type="hidden" name="disputeId" value={id} />
              <textarea name="body" rows={2} className="input" placeholder="Votre message" required />
              <input type="file" name="attachment" accept="image/*,application/pdf" className="input" />
            </ActionForm>
          )}
        </Section>
        <div className="space-y-5">
          <Section title="Parties et décision">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt>Demandeur</dt><dd>{nm(d.openedBy)}</dd></div>
              <div className="flex justify-between"><dt>Partie concernée</dt><dd>{nm(d.againstUserId)}</dd></div>
              <div className="flex justify-between"><dt>Responsable</dt><dd>{nm(d.responsibleId)}</dd></div>
            </dl>
            <p className="mt-3 rounded-xl bg-cream p-3 text-sm"><strong>Décision :</strong> {d.decision || "En attente"}</p>
          </Section>
          {children}
        </div>
      </div>
    </>
  );
}
