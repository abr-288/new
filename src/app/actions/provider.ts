"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { missions, payments, proofs, requests, serviceMessages, serviceOrders, reviews, users } from "@/db/schema";
import type { ActionState } from "@/components/forms";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { addHistory, audit, notify, notifyAdmins } from "@/lib/audit";
import { done, fail, fileOf, int, str } from "@/lib/form";
import { saveUpload } from "@/lib/storage";
import { hasPerm } from "@/lib/rbac";
import { awardTokens } from "@/lib/tokens";

const refresh = () => revalidatePath("/", "layout");

/* ───────── Missions (prestataire) ───────── */
export async function respondMission(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const id = int(fd, "missionId");
  const [m] = await db.select().from(missions).where(and(eq(missions.id, id), eq(missions.providerId, u.id))).limit(1);
  if (!m) return fail("Mission introuvable.");
  if (m.status !== "proposed") return fail("Cette mission a déjà reçu une réponse.");
  const decision = str(fd, "decision");
  const [r] = await db.select().from(requests).where(eq(requests.id, m.requestId)).limit(1);
  if (decision === "accept") {
    await db.update(missions).set({ status: "accepted", updatedAt: new Date() }).where(eq(missions.id, id));
    if (r && r.status === "accepted") await db.update(requests).set({ status: "in_progress", updatedAt: new Date() }).where(eq(requests.id, r.id));
    await addHistory(m.requestId, "in_progress", `Mission « ${m.title} » acceptée par le prestataire`, u.id);
    await notifyAdmins("missions.manage", "mission", `Mission acceptée : ${m.title}`, u.name, `/admin/missions`);
    await audit(u, "mission.accept", "mission", id);
    refresh();
    return done("Mission acceptée. Bonne réalisation !");
  }
  if (decision === "refuse") {
    const reason = str(fd, "reason", 600);
    if (reason.length < 5) return fail("Un motif de refus est obligatoire.");
    await db.update(missions).set({ status: "refused", refusalReason: reason, updatedAt: new Date() }).where(eq(missions.id, id));
    await addHistory(m.requestId, r?.status ?? "accepted", `Mission « ${m.title} » refusée : ${reason}`, u.id);
    await notifyAdmins("missions.manage", "mission", `Mission refusée : ${m.title}`, reason, `/admin/missions`);
    await audit(u, "mission.refuse", "mission", id, { reason });
    refresh();
    return done("Refus enregistré. L'administration pourra réattribuer la mission.");
  }
  return fail("Décision invalide.");
}

export async function startMission(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const id = int(fd, "missionId");
  const [m] = await db.select().from(missions).where(and(eq(missions.id, id), eq(missions.providerId, u.id), eq(missions.status, "accepted"))).limit(1);
  if (!m) return fail("Mission non démarrable.");
  await db.update(missions).set({ status: "in_progress", exchangeStatus: m.compensationMode === "exchange" ? "in_progress" : m.exchangeStatus, updatedAt: new Date() }).where(eq(missions.id, id));
  await addHistory(m.requestId, "in_progress", `Mission « ${m.title} » démarrée`, u.id);
  refresh();
  return done("Mission démarrée.");
}

export async function uploadProof(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await getCurrentUser();
  if (!u) return fail("Session expirée.");
  const missionId = int(fd, "missionId");
  let requestId = int(fd, "requestId");
  const type = str(fd, "type");
  if (!["photo", "video", "receipt", "invoice", "attestation"].includes(type)) return fail("Type de preuve invalide.");
  const isAdminUploader = hasPerm(u, "proofs.review");
  if (missionId) {
    const [m] = await db.select().from(missions).where(eq(missions.id, missionId)).limit(1);
    if (!m) return fail("Mission introuvable.");
    if (m.providerId !== u.id && !isAdminUploader) return fail("Accès refusé.");
    if (m.providerId === u.id && !["accepted", "in_progress", "completed"].includes(m.status)) return fail("Mission non active.");
    requestId = m.requestId;
  } else if (!isAdminUploader) return fail("Accès refusé.");
  if (!requestId) return fail("Demande introuvable.");
  const up = await saveUpload(fileOf(fd, "file"), "proofs");
  if (!up) return fail("Sélectionnez un fichier.");
  if ("error" in up) return fail(up.error);
  const [p] = await db.insert(proofs).values({
    requestId, missionId: missionId || null, type, filePath: up.path, fileName: up.name, mime: up.mime, size: up.size,
    caption: str(fd, "caption", 300) || null, uploadedBy: u.id, visibleToDonor: fd.get("hidden") ? false : true,
  }).returning();
  await audit(u, "proof.upload", "proof", p.id, { requestId, missionId, type });
  await notifyAdmins("proofs.review", "proof_review", "Nouvelle preuve à contrôler", up.name, "/admin/preuves");
  refresh();
  return done("Preuve déposée. Elle sera contrôlée par l'administration.");
}

export async function completeMission(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const id = int(fd, "missionId");
  const [m] = await db.select().from(missions).where(and(eq(missions.id, id), eq(missions.providerId, u.id), inArray(missions.status, ["accepted", "in_progress"]))).limit(1);
  if (!m) return fail("Mission introuvable ou déjà terminée.");
  const mine = await db.select({ id: proofs.id }).from(proofs).where(eq(proofs.missionId, id)).limit(1);
  if (!mine.length) return fail("Déposez au moins une preuve (photo, reçu, facture ou attestation) avant de terminer.");
  await db.update(missions).set({
    status: "completed", completedAt: new Date(), updatedAt: new Date(),
    exchangeStatus: m.compensationMode === "exchange" ? "done" : m.exchangeStatus,
  }).where(eq(missions.id, id));
  await addHistory(m.requestId, "in_progress", `Mission « ${m.title} » terminée — en attente de contrôle des preuves`, u.id);
  await notifyAdmins("proofs.review", "proof_review", `Mission terminée : ${m.title}`, "Preuves à contrôler", "/admin/preuves");
  await audit(u, "mission.complete", "mission", id);
  refresh();
  return done("Mission terminée. En attente du contrôle administratif.");
}

/* ───────── Services communautaires ───────── */
export async function createServiceOrder(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  if (u.role === "admin" || u.role === "subadmin") return fail("Les administrateurs ne peuvent pas commander.");
  const providerId = int(fd, "providerId");
  const [prov] = await db.select().from(users).where(and(eq(users.id, providerId), eq(users.role, "provider"), eq(users.status, "active"))).limit(1);
  if (!prov || prov.id === u.id) return fail("Prestataire invalide.");
  const title = str(fd, "title", 150);
  if (title.length < 4) return fail("Décrivez le service demandé.");
  const mode = str(fd, "compensationMode") === "exchange" ? "exchange" : "money";
  const price = Math.max(int(fd, "price"), 0);
  const ex = str(fd, "exchangeDescription", 600);
  if (mode === "exchange" && ex.length < 5) return fail("Décrivez les engagements réciproques de l'échange de services.");
  if (mode === "money" && price < 500) return fail("Proposez un prix (≥ 500 FCFA).");
  const [o] = await db.insert(serviceOrders).values({
    clientId: u.id, providerId, title, description: str(fd, "description", 1500), zone: str(fd, "zone", 100) || null,
    proposedPrice: price, compensationMode: mode, exchangeDescription: mode === "exchange" ? ex : null,
  }).returning();
  await db.insert(serviceMessages).values({ orderId: o.id, authorId: u.id, body: `Demande : ${title}`, price: mode === "money" ? price : null });
  await notify(providerId, "service", `Nouvelle demande de service : ${title}`, undefined, `/espace/services/${o.id}`);
  await audit(u, "service.order", "service_order", o.id);
  refresh();
  return done("Demande envoyée au prestataire. Suivez la négociation dans « Services communautaires ».");
}

async function loadOrder(id: number, userId: number) {
  const [o] = await db.select().from(serviceOrders).where(and(eq(serviceOrders.id, id), or(eq(serviceOrders.clientId, userId), eq(serviceOrders.providerId, userId)))).limit(1);
  return o;
}

export async function postServiceMessage(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const o = await loadOrder(int(fd, "orderId"), u.id);
  if (!o) return fail("Commande introuvable.");
  if (!["requested", "negotiating", "agreed", "in_progress"].includes(o.status)) return fail("Échanges clos.");
  const body = str(fd, "body", 1000);
  const rawPrice = str(fd, "price");
  const price = rawPrice ? int(fd, "price") : null;
  if (body.length < 2 && price == null) return fail("Message vide.");
  const canPrice = ["requested", "negotiating"].includes(o.status) && o.compensationMode === "money";
  if (price != null && !canPrice) return fail("Le prix ne peut plus être modifié.");
  await db.insert(serviceMessages).values({ orderId: o.id, authorId: u.id, body: body || `Nouvelle proposition de prix`, price: canPrice ? price : null });
  if (price != null && canPrice) await db.update(serviceOrders).set({ proposedPrice: price, status: "negotiating", updatedAt: new Date() }).where(eq(serviceOrders.id, o.id));
  const other = u.id === o.clientId ? o.providerId : o.clientId;
  await notify(other, "service", `Nouveau message — ${o.title}`, price != null ? `Proposition : ${price} FCFA` : body.slice(0, 100), `/espace/services/${o.id}`);
  refresh();
  return done("Message envoyé.");
}

export async function serviceTransition(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const o = await loadOrder(int(fd, "orderId"), u.id);
  if (!o) return fail("Commande introuvable.");
  const act = str(fd, "action");
  const isProv = o.providerId === u.id;
  const other = isProv ? o.clientId : o.providerId;
  const set = async (status: string, extra: Partial<typeof serviceOrders.$inferInsert> = {}) =>
    db.update(serviceOrders).set({ status, updatedAt: new Date(), ...extra }).where(eq(serviceOrders.id, o.id));

  if (act === "accept" && ["requested", "negotiating"].includes(o.status)) {
    const [last] = await db.select().from(serviceMessages).where(eq(serviceMessages.orderId, o.id)).orderBy(desc(serviceMessages.id)).limit(1);
    const lastPriceAuthor = (await db.select().from(serviceMessages).where(eq(serviceMessages.orderId, o.id)).orderBy(desc(serviceMessages.id))).find((m) => m.price != null)?.authorId ?? o.clientId;
    if (o.compensationMode === "money" && lastPriceAuthor === u.id) return fail("Vous ne pouvez pas accepter votre propre proposition : attendez la réponse de l'autre partie.");
    if (o.compensationMode === "exchange" && !isProv) return fail("Le prestataire doit accepter l'échange de services.");
    await set("agreed", { agreedPrice: o.compensationMode === "money" ? o.proposedPrice : null });
    await db.insert(payments).values({
      serviceOrderId: o.id, userId: o.clientId, direction: "in", kind: "service", mode: o.compensationMode,
      method: o.compensationMode === "exchange" ? "exchange" : null, amountPlanned: o.compensationMode === "money" ? o.proposedPrice : 0,
      exchangeDescription: o.exchangeDescription, exchangeStatus: o.compensationMode === "exchange" ? "pending" : null,
      note: `Service : ${o.title}`,
    });
    void last;
    await notify(other, "service", `Accord conclu : ${o.title}`, undefined, `/espace/services/${o.id}`);
    await audit(u, "service.agree", "service_order", o.id, { price: o.proposedPrice, mode: o.compensationMode });
  } else if (act === "decline" && ["requested", "negotiating"].includes(o.status)) {
    await set(isProv ? "declined" : "cancelled");
    await notify(other, "service", `Demande ${isProv ? "déclinée" : "annulée"} : ${o.title}`, undefined, `/espace/services/${o.id}`);
  } else if (act === "start" && isProv && o.status === "agreed") {
    await set("in_progress");
    await db.update(payments).set({ exchangeStatus: "in_progress" }).where(and(eq(payments.serviceOrderId, o.id), eq(payments.mode, "exchange")));
  } else if (act === "done" && isProv && o.status === "in_progress") {
    await set("done");
    await notify(o.clientId, "service", `Service réalisé — à confirmer : ${o.title}`, undefined, `/espace/services/${o.id}`);
  } else if (act === "confirm" && !isProv && o.status === "done") {
    const rating = int(fd, "rating");
    if (rating < 1 || rating > 5) return fail("Donnez une note de 1 à 5.");
    await set("confirmed");
    try {
      await db.insert(reviews).values({ kind: "service", refId: o.id, fromUserId: u.id, toUserId: o.providerId, rating, comment: str(fd, "comment", 800) || null });
    } catch {}
    await db.update(payments).set({ exchangeStatus: "done" }).where(and(eq(payments.serviceOrderId, o.id), eq(payments.mode, "exchange")));
    await awardTokens({ userId: o.providerId, eventKey: "service_confirmed", refType: "service_order", refId: o.id, actorId: u.id });
    await awardTokens({ userId: u.id, eventKey: "review_given", refType: "service_order", refId: o.id });
    await notify(o.providerId, "review", `Service confirmé — note ${rating}/5`, o.title, `/espace/services/${o.id}`);
  } else return fail("Action impossible dans l'état actuel.");
  refresh();
  return done("Mis à jour.");
}
