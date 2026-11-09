import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { markNotificationsRead } from "@/app/actions/donor";
import { Empty, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { fdatetime } from "@/lib/format";

export default async function Page() {
  const u = await requireUser();
  const rows = await db.select().from(notifications).where(eq(notifications.userId, u.id)).orderBy(desc(notifications.id)).limit(100);
  return (
    <>
      <PageHeader title="Notifications" subtitle="Nouvelles demandes, décisions, missions, échéances, preuves, clôtures…" actions={<form action={markNotificationsRead}><button className="btn btn-outline btn-sm">Tout marquer comme lu</button></form>} />
      {rows.length === 0 ? <Empty>Aucune notification.</Empty> : (
        <ul className="space-y-2">
          {rows.map((n) => (
            <li key={n.id} className={`card flex items-start justify-between gap-3 p-4 ${n.readAt ? "" : "border-l-4 border-l-sun bg-cream/40"}`}>
              <div>
                <p className="text-sm font-semibold">{n.title}</p>
                {n.body && <p className="text-sm text-slate-600">{n.body}</p>}
                <p className="mt-1 text-xs text-slate-500">{fdatetime(n.createdAt)}</p>
              </div>
              {n.link && <Link href={n.link} className="btn btn-outline btn-sm">Voir</Link>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
