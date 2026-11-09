import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { listingContributions, listings, users } from "@/db/schema";
import { confirmContribution, moderateListing } from "@/app/actions/admin";
import { ActionForm } from "@/components/forms";
import { Empty, PageHeader, Section, StatusBadge } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { fcfa, fdate, LISTING_STATUS, LISTING_TYPES, PAY_METHODS } from "@/lib/format";

export default async function Page() {
  await requirePerm("listings.moderate");
  const rows = await db.select({ l: listings, oname: users.name, org: users.organization }).from(listings).innerJoin(users, eq(users.id, listings.ownerId)).orderBy(desc(listings.id));
  const contribs = await db.select({ c: listingContributions, uname: users.name, title: listings.title }).from(listingContributions).innerJoin(users, eq(users.id, listingContributions.userId)).innerJoin(listings, eq(listings.id, listingContributions.listingId)).where(eq(listingContributions.status, "declared"));
  return (
    <>
      <PageHeader title="Publications partenaires & campagnes" subtitle="Modération des dons, actions solidaires et campagnes de financement participatif ; confirmation des contributions." />
      <Section title={`Contributions à confirmer (${contribs.length})`}>
        {contribs.length === 0 ? <Empty>Aucune contribution en attente.</Empty> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {contribs.map(({ c, uname, title }) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span><strong>{fcfa(c.amount)}</strong> — {uname} → {title}<br /><span className="text-xs text-slate-500">{PAY_METHODS[c.method ?? ""]} · réf. {c.reference || "—"} · {fdate(c.createdAt)}</span></span>
                <span className="flex gap-2">
                  <ActionForm action={confirmContribution} submit="Confirmer" btnClass="btn btn-green btn-sm" className=""><input type="hidden" name="id" value={c.id} /><input type="hidden" name="decision" value="confirm" /></ActionForm>
                  <ActionForm action={confirmContribution} submit="Rejeter" btnClass="btn btn-danger btn-sm" className=""><input type="hidden" name="id" value={c.id} /><input type="hidden" name="decision" value="reject" /></ActionForm>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <div className="mt-5 space-y-3">
        {rows.map(({ l, oname, org }) => (
          <div key={l.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><span className="badge badge-amber mr-2">{LISTING_TYPES[l.type]}</span><strong>{l.title}</strong> <span className="text-xs text-slate-500">· {org || oname}</span></div>
              <StatusBadge meta={LISTING_STATUS} value={l.status} />
            </div>
            <p className="mt-1 text-sm text-slate-600">{l.description}</p>
            <p className="text-xs text-slate-500">Objectif {fcfa(l.goalAmount)} · collecté {fcfa(l.raisedAmount)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {l.status !== "published" && <ActionForm action={moderateListing} submit="Publier" btnClass="btn btn-green btn-sm" className=""><input type="hidden" name="id" value={l.id} /><input type="hidden" name="decision" value="publish" /></ActionForm>}
              {l.status === "published" && <ActionForm action={moderateListing} submit="Clore" btnClass="btn btn-outline btn-sm" className=""><input type="hidden" name="id" value={l.id} /><input type="hidden" name="decision" value="close" /></ActionForm>}
              {l.status === "pending" && (
                <ActionForm action={moderateListing} submit="Refuser" btnClass="btn btn-danger btn-sm" className="flex gap-2"><input type="hidden" name="id" value={l.id} /><input type="hidden" name="decision" value="reject" /><input name="reason" className="input" placeholder="Motif" /></ActionForm>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
