import { eq } from "drizzle-orm";
import { db } from "@/db";
import { providerProfiles, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { checkOtp, createSession, normalizePhone } from "@/lib/auth";
import { SELF_REGISTER_ROLES } from "@/lib/rbac";
import { awardTokens } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { phone?: string; code?: string };
  const phone = normalizePhone(body.phone ?? "");
  if (!phone || !body.code) return Response.json({ error: "invalid_request" }, { status: 400 });
  const res = await checkOtp(phone, String(body.code));
  if ("error" in res) return Response.json({ error: res.error }, { status: 401 });
  let [u] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  if (!u) {
    const role = (SELF_REGISTER_ROLES as readonly string[]).includes(res.meta?.role ?? "") ? res.meta!.role! : "donor";
    [u] = await db.insert(users).values({ phone, name: res.meta?.name ?? "", role }).returning();
    if (role === "provider") await db.insert(providerProfiles).values({ userId: u.id }).onConflictDoNothing();
    await awardTokens({ userId: u.id, eventKey: "signup", refType: "user", refId: u.id });
  }
  if (u.status !== "active") return Response.json({ error: "account_unavailable" }, { status: 403 });
  await createSession(u.id);
  await audit({ id: u.id, role: u.role }, "user.login", "user", u.id, { via: "api" });
  return Response.json({ ok: true, user: { id: u.id, name: u.name, role: u.role } });
}
