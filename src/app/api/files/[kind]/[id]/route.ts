import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { disputeMessages, disputes, missions, payments, proofs, requests } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { hasPerm } from "@/lib/rbac";
import { readStored } from "@/lib/storage";

export const dynamic = "force-dynamic";

const deny = () => new Response("Accès refusé", { status: 403 });

/** Téléchargement sécurisé : chaque fichier est servi après contrôle des droits côté serveur. */
export async function GET(_req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const u = await getCurrentUser();
  if (!u) return new Response("Non authentifié", { status: 401 });
  const { kind, id: rawId } = await params;
  const id = parseInt(rawId, 10);
  let path: string | null = null;
  let name = "fichier";
  let mime = "application/octet-stream";

  if (kind === "proof") {
    const [p] = await db.select().from(proofs).where(eq(proofs.id, id)).limit(1);
    if (!p) return new Response("Introuvable", { status: 404 });
    let allowed = hasPerm(u, "proofs.review") || p.uploadedBy === u.id;
    if (!allowed && p.missionId) {
      const [m] = await db.select().from(missions).where(eq(missions.id, p.missionId)).limit(1);
      allowed = m?.providerId === u.id;
    }
    if (!allowed) {
      const [r] = await db.select().from(requests).where(and(eq(requests.id, p.requestId), eq(requests.userId, u.id))).limit(1);
      allowed = !!r && p.status === "validated" && p.visibleToDonor;
    }
    if (!allowed) return deny();
    path = p.filePath; name = p.fileName; mime = p.mime;
  } else if (kind === "receipt") {
    const [p] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
    if (!p?.receiptPath) return new Response("Introuvable", { status: 404 });
    let allowed = hasPerm(u, "payments.manage") || p.userId === u.id;
    if (!allowed && p.requestId) {
      const [r] = await db.select().from(requests).where(and(eq(requests.id, p.requestId), eq(requests.userId, u.id))).limit(1);
      allowed = !!r && p.direction === "in";
    }
    if (!allowed) return deny();
    path = p.receiptPath; name = p.receiptName ?? "recu";
    mime = path.endsWith(".pdf") ? "application/pdf" : path.endsWith(".png") ? "image/png" : "image/jpeg";
  } else if (kind === "dispute") {
    const [m] = await db.select().from(disputeMessages).where(eq(disputeMessages.id, id)).limit(1);
    if (!m?.attachmentPath) return new Response("Introuvable", { status: 404 });
    const [d] = await db.select().from(disputes).where(eq(disputes.id, m.disputeId)).limit(1);
    if (!d || !(hasPerm(u, "disputes.manage") || d.openedBy === u.id || d.againstUserId === u.id)) return deny();
    path = m.attachmentPath; name = m.attachmentName ?? "piece";
    mime = path.endsWith(".pdf") ? "application/pdf" : path.endsWith(".png") ? "image/png" : "image/jpeg";
  } else return new Response("Type inconnu", { status: 404 });

  if (hasPerm(u, "proofs.review") || hasPerm(u, "payments.manage")) await audit(u, "file.download", kind, id);
  try {
    const buf = await readStored(path);
    if (path.endsWith(".mp4")) mime = "video/mp4";
    return new Response(new Uint8Array(buf), {
      headers: { "content-type": mime, "content-disposition": `inline; filename="${encodeURIComponent(name)}"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" },
    });
  } catch {
    return new Response("Fichier indisponible", { status: 404 });
  }
}
