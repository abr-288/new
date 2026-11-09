import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { normalizePhone, startOtp } from "@/lib/auth";
import { SELF_REGISTER_ROLES } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { phone?: string; name?: string; role?: string };
  const phone = normalizePhone(body.phone ?? "");
  if (!phone) return Response.json({ error: "invalid_phone" }, { status: 400 });
  const [u] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  let meta: { name?: string; role?: string } | undefined;
  if (!u) {
    if (!body.name || body.name.length < 2) return Response.json({ error: "name_required_for_registration" }, { status: 400 });
    const role = (SELF_REGISTER_ROLES as readonly string[]).includes(body.role ?? "") ? body.role : "donor";
    meta = { name: body.name.slice(0, 80), role };
  } else if (u.status !== "active") return Response.json({ error: "account_unavailable" }, { status: 403 });
  const r = await startOtp(phone, meta);
  if ("error" in r) return Response.json({ error: r.error }, { status: 429 });
  return Response.json({ ok: true, ...(r.devCode ? { devCode: r.devCode } : {}) });
}
