import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, notifications, requestHistory, users } from "@/db/schema";
import { clientIp } from "@/lib/auth";
import { hasPerm, type Perm } from "@/lib/rbac";
import { sendSms } from "@/lib/sms";

type Actor = { id: number; role: string } | null;

/** Journal d'audit : toute action critique / décision administrative. */
export async function audit(
  actor: Actor,
  action: string,
  entity?: string,
  entityId?: string | number,
  details?: Record<string, unknown>,
) {
  let ip: string | null = null;
  try {
    ip = await clientIp();
  } catch {}
  await db.insert(auditLogs).values({
    actorId: actor?.id ?? null,
    actorRole: actor?.role ?? null,
    action,
    entity,
    entityId: entityId != null ? String(entityId) : null,
    details,
    ip,
  });
}

const SMS_TYPES = new Set([
  "request_new",
  "request_decision",
  "info_requested",
  "mission_proposed",
  "due_soon",
  "proof_review",
  "request_closed",
]);

/** Notification multicanale selon les préférences de l'utilisateur (in-app, SMS ; e-mail à brancher). */
export async function notify(userId: number, type: string, title: string, body?: string, link?: string) {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return;
  if (u.notifPrefs.inapp !== false) {
    await db.insert(notifications).values({ userId, type, title, body, link });
  }
  if (u.notifPrefs.sms && SMS_TYPES.has(type)) {
    await sendSms(u.phone, `Menewa Naya : ${title}`);
  }
}

export async function notifyAdmins(perm: Perm, type: string, title: string, body?: string, link?: string) {
  const admins = await db
    .select()
    .from(users)
    .where(and(inArray(users.role, ["admin", "subadmin"]), eq(users.status, "active")));
  for (const a of admins) if (hasPerm(a, perm)) await notify(a.id, type, title, body, link);
}

export async function addHistory(requestId: number, status: string, note: string | null, actorId: number | null) {
  await db.insert(requestHistory).values({ requestId, status, note, actorId });
}
