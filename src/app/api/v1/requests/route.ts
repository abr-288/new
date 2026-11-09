import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { requests } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { hasPerm } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await getCurrentUser();
  if (!u) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const canAll = hasPerm(u, "requests.manage");
  if (!canAll && !["donor", "client"].includes(u.role)) return Response.json({ error: "forbidden" }, { status: 403 });
  const q = db
    .select({
      id: requests.id, ref: requests.ref, title: requests.title, kind: requests.kind, status: requests.status, rejectionReason: requests.rejectionReason,
      totalAmount: requests.totalAmount, createdAt: requests.createdAt,
    })
    .from(requests);
  const rows = await (canAll ? q : q.where(eq(requests.userId, u.id))).orderBy(desc(requests.id)).limit(200);
  return Response.json({ items: rows });
}
