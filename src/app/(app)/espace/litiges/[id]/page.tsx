import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { disputes } from "@/db/schema";
import { DisputeView } from "@/components/DisputeView";
import { requireUser } from "@/lib/auth";
import { hasPerm } from "@/lib/rbac";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) notFound();
  const [d] = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
  if (!d) notFound();
  if (d.openedBy !== u.id && d.againstUserId !== u.id && !hasPerm(u, "disputes.manage")) notFound();
  return <DisputeView id={id} viewerId={u.id} />;
}
