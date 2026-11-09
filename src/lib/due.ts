import { and, eq, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { installments, requests } from "@/db/schema";
import { notify, notifyAdmins } from "@/lib/audit";
import { fdate } from "@/lib/format";
import { getSetting } from "@/lib/settings";

/** Notifie les échéances proches (idempotent : une notification par échéance). */
export async function runDueScan() {
  const days = (await getSetting<number>("requests.late_alert_days")) ?? 3;
  const limit = new Date(Date.now() + days * 86400000);
  const due = await db
    .select({ i: installments, r: requests })
    .from(installments)
    .innerJoin(requests, eq(requests.id, installments.requestId))
    .where(and(eq(installments.status, "planned"), isNull(installments.notifiedAt), lte(installments.dueDate, limit)));
  for (const { i, r } of due) {
    if (!["accepted", "in_progress", "submitted"].includes(r.status)) continue;
    await notify(r.userId, "due_soon", `Échéance proche — ${r.ref}`, `Échéance ${i.seq} le ${fdate(i.dueDate)}`, `/espace/demandes/${r.id}`);
    await notifyAdmins("requests.manage", "due_soon", `Échéance proche — ${r.ref}`, `Échéance ${i.seq} le ${fdate(i.dueDate)}`, `/admin/demandes/${r.id}`);
    await db.update(installments).set({ notifiedAt: new Date() }).where(eq(installments.id, i.id));
  }
  return due.length;
}
