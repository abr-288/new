"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  cartItems, catalogItems, disputeMessages, disputes, listingContributions, listings, missions, notifications,
  payments, providerProfiles, providerServices, requests, reviews, tokenTransactions, users,
} from "@/db/schema";
import type { ActionState } from "@/components/forms";
import { requireUser } from "@/lib/auth";
import { addHistory, audit, notify, notifyAdmins } from "@/lib/audit";
import { annexPrices, ANNEX_LABELS, createRequest } from "@/lib/requests";
import { done, fail, fileOf, int, str } from "@/lib/form";
import { saveUpload } from "@/lib/storage";
import { getSetting } from "@/lib/settings";
import { applyTokenDelta, awardTokens } from "@/lib/tokens";
import { hasPerm, isRequester } from "@/lib/rbac";

const refresh = () => revalidatePath("/", "layout");

/* ───────── Panier ───────── */
export async function addToCart(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  if (!isRequester(u.role)) return fail("Action réservée aux donateurs et clients.");
  const id = int(fd, "catalogItemId");
  const qty = Math.min(Math.max(int(fd, "quantity", 1), 1), 500);
  const [item] = await db.select().from(catalogItems).where(and(eq(catalogItems.id, id), eq(catalogItems.active, true))).limit(1);
  if (!item) return fail("Article introuvable.");
  await db.insert(cartItems).values({ userId: u.id, catalogItemId: id, quantity: qty, target: str(fd, "target", 150) || null });
  refresh();
  return done(`${item.title} ajouté au panier.`);
}

export async function removeCartItem(fd: FormData) {
  const u = await requireUser();
  await db.delete(cartItems).where(and(eq(cartItems.id, int(fd, "id")), eq(cartItems.userId, u.id)));
  refresh();
}

function parseAnnex(fd: FormData, prices: Record<string, number>) {
  const annex: Record<string, unknown> = {};
  let cost = 0;
  for (const k of Object.keys(ANNEX_LABELS)) {
    if (fd.get(`annex_${k}`)) {
      annex[k] = true;
      cost += prices[k] ?? 0;
    }
  }
  const crit = str(fd, "annex_packaging_notes", 500);
  if (crit) annex.packaging_notes = crit;
  const other = str(fd, "annex_other", 500);
  if (other) annex.other = other;
  return { annex: Object.keys(annex).length ? annex : undefined, cost };
}

function schedule(fd: FormData) {
  const recurrence = (["none", "weekly", "monthly", "quarterly"].includes(str(fd, "recurrence")) ? str(fd, "recurrence") : "none") as "none" | "weekly" | "monthly" | "quarterly";
  const pm = (["immediate", "prefinance", "echeance"].includes(str(fd, "paymentMode")) ? str(fd, "paymentMode") : "immediate") as "immediate" | "prefinance" | "echeance";
  const sd = str(fd, "startDate");
  return { recurrence, paymentMode: pm, occurrences: int(fd, "occurrences", 2), startDate: sd ? new Date(sd) : undefined };
}

export async function checkoutCart(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  if (!isRequester(u.role)) return fail("Action réservée aux donateurs et clients.");
  const rows = await db
    .select({ c: cartItems, i: catalogItems })
    .from(cartItems)
    .innerJoin(catalogItems, eq(catalogItems.id, cartItems.catalogItemId))
    .where(eq(cartItems.userId, u.id));
  if (!rows.length) return fail("Votre panier est vide.");
  const targetName = str(fd, "targetName", 150);
  if (!targetName) return fail("Veuillez préciser la cible du don (personne, famille, école, orphelinat…).");
  const { annex, cost } = parseAnnex(fd, await annexPrices());
  const items = rows.map((r) => ({
    catalogItemId: r.i.id, label: r.i.title, quantity: r.c.quantity, unitPrice: r.i.unitPrice, costEstimate: r.i.costEstimate, target: r.c.target ?? undefined,
  }));
  const allAction = rows.every((r) => r.i.kind === "action");
  const sch = schedule(fd);
  const r = await createRequest({
    userId: u.id,
    kind: sch.recurrence !== "none" ? "recurrent" : allAction ? "action" : "catalogue",
    title: items.length === 1 ? `${items[0].label} ×${items[0].quantity}` : `${items[0].label} et ${items.length - 1} autre(s) don(s)`,
    description: str(fd, "description", 1500),
    category: rows[0].i.category,
    targetName,
    targetZone: str(fd, "targetZone", 100),
    items,
    annex,
    annexCost: cost,
    ...sch,
  });
  await db.delete(cartItems).where(eq(cartItems.userId, u.id));
  await audit(u, "request.create", "request", r.id, { via: "cart" });
  refresh();
  redirect(`/espace/demandes/${r.id}`);
}

export async function createCustomRequest(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  if (!isRequester(u.role)) return fail("Action réservée aux donateurs et clients.");
  const title = str(fd, "title", 150);
  const amount = int(fd, "amount");
  const targetName = str(fd, "targetName", 150);
  if (title.length < 3) return fail("Indiquez un intitulé.");
  if (!targetName) return fail("Indiquez la cible (personne, famille, structure…).");
  if (amount < 500) return fail("Le budget minimal est de 500 FCFA.");
  const kind = str(fd, "kind") === "action" ? "action" : "personnalise";
  const { annex, cost } = parseAnnex(fd, await annexPrices());
  const sch = schedule(fd);
  const r = await createRequest({
    userId: u.id,
    kind: sch.recurrence !== "none" ? "recurrent" : kind,
    title,
    description: str(fd, "description", 2000),
    category: kind === "action" ? "action" : "autre",
    targetName,
    targetZone: str(fd, "targetZone", 100),
    items: [{ label: title, quantity: 1, unitPrice: amount, target: targetName }],
    annex,
    annexCost: cost,
    ...sch,
  });
  await audit(u, "request.create", "request", r.id, { via: "custom" });
  refresh();
  redirect(`/espace/demandes/${r.id}`);
}

export async function cancelRequest(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const id = int(fd, "requestId");
  const [r] = await db.select().from(requests).where(and(eq(requests.id, id), eq(requests.userId, u.id))).limit(1);
  if (!r) return fail("Demande introuvable.");
  if (!["submitted", "info_requested"].includes(r.status)) return fail("Cette demande ne peut plus être annulée (déjà traitée).");
  await db.update(requests).set({ status: "cancelled", updatedAt: new Date() }).where(eq(requests.id, id));
  await db.update(payments).set({ status: "cancelled" }).where(and(eq(payments.requestId, id), inArray(payments.status, ["planned", "declared"])));
  await addHistory(id, "cancelled", "Annulée par le donateur", u.id);
  await audit(u, "request.cancel", "request", id);
  refresh();
  return done("Demande annulée.");
}

export async function answerInfoRequest(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const id = int(fd, "requestId");
  const [r] = await db.select().from(requests).where(and(eq(requests.id, id), eq(requests.userId, u.id))).limit(1);
  if (!r || r.status !== "info_requested") return fail("Aucune information n'est attendue.");
  const answer = str(fd, "answer", 1500);
  if (answer.length < 3) return fail("Saisissez votre réponse.");
  await db.update(requests).set({ status: "submitted", updatedAt: new Date() }).where(eq(requests.id, id));
  await addHistory(id, "submitted", `Réponse du donateur : ${answer}`, u.id);
  await notifyAdmins("requests.manage", "request_new", `Réponse reçue pour ${r.ref}`, answer.slice(0, 100), `/admin/demandes/${id}`);
  refresh();
  return done("Réponse envoyée.");
}

/* ───────── Paiements ───────── */
export async function declarePayment(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const id = int(fd, "paymentId");
  const [p] = await db.select().from(payments).where(and(eq(payments.id, id), eq(payments.userId, u.id), eq(payments.direction, "in"))).limit(1);
  if (!p) return fail("Paiement introuvable.");
  if (!["planned", "declared"].includes(p.status)) return fail("Ce paiement ne peut plus être modifié.");
  const method = str(fd, "method");
  const reference = str(fd, "reference", 100);
  if (!["mobile_money", "card", "bank", "cash"].includes(method)) return fail("Choisissez un moyen de paiement.");
  if (method !== "cash" && reference.length < 4) return fail("Indiquez la référence de transaction.");
  const up = await saveUpload(fileOf(fd, "receipt"), "receipts");
  if (up && "error" in up) return fail(up.error);
  await db.update(payments).set({
    status: "declared", method, reference,
    ...(up && !("error" in up) ? { receiptPath: up.path, receiptName: up.name } : {}),
  }).where(eq(payments.id, id));
  await audit(u, "payment.declare", "payment", id, { method, reference });
  await notifyAdmins("payments.manage", "payment", "Paiement déclaré à valider", `Référence ${reference || "—"}`, "/admin/paiements");
  refresh();
  return done("Paiement déclaré. Il sera validé par l'administration après vérification.");
}

/* ───────── Litiges ───────── */
export async function openDispute(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const requestId = int(fd, "requestId");
  const [r] = await db.select().from(requests).where(eq(requests.id, requestId)).limit(1);
  if (!r) return fail("Demande introuvable.");
  const [m] = await db.select().from(missions).where(and(eq(missions.requestId, requestId), eq(missions.providerId, u.id))).limit(1);
  if (r.userId !== u.id && !m) return fail("Accès refusé.");
  const subject = str(fd, "subject", 150);
  const description = str(fd, "description", 2000);
  if (subject.length < 4 || description.length < 10) return fail("Précisez l'objet et la description du litige.");
  const against = r.userId === u.id ? (await db.select().from(missions).where(eq(missions.requestId, requestId)).limit(1))[0]?.providerId ?? null : r.userId;
  const [d] = await db.insert(disputes).values({
    ref: "tmp-" + Math.random().toString(36).slice(2), requestId, missionId: m?.id, openedBy: u.id, againstUserId: against, subject, description,
  }).returning();
  await db.update(disputes).set({ ref: `LT-${new Date().getFullYear()}-${String(d.id).padStart(4, "0")}` }).where(eq(disputes.id, d.id));
  await addHistory(requestId, r.status, `Litige ouvert : ${subject}`, u.id);
  await audit(u, "dispute.open", "dispute", d.id, { requestId });
  await notifyAdmins("disputes.manage", "dispute", `Nouveau litige : ${subject}`, undefined, `/admin/litiges/${d.id}`);
  refresh();
  return done("Litige enregistré. L'administration va l'examiner.");
}

export async function postDisputeMessage(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const id = int(fd, "disputeId");
  const [d] = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
  if (!d) return fail("Litige introuvable.");
  const isParty = d.openedBy === u.id || d.againstUserId === u.id;
  if (!isParty && !hasPerm(u, "disputes.manage")) return fail("Accès refusé.");
  if (d.status === "closed") return fail("Ce litige est clos.");
  const body = str(fd, "body", 2000);
  if (body.length < 2) return fail("Message vide.");
  const up = await saveUpload(fileOf(fd, "attachment"), "disputes");
  if (up && "error" in up) return fail(up.error);
  await db.insert(disputeMessages).values({
    disputeId: id, authorId: u.id, body,
    ...(up && !("error" in up) ? { attachmentPath: up.path, attachmentName: up.name } : {}),
  });
  for (const t of [d.openedBy, d.againstUserId, d.responsibleId]) if (t && t !== u.id) await notify(t, "dispute", `Nouveau message — litige ${d.ref}`, body.slice(0, 100), `/espace/litiges/${id}`);
  refresh();
  return done("Message envoyé.");
}

/* ───────── Avis / gamification ───────── */
export async function rateMission(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const requestId = int(fd, "requestId");
  const [r] = await db.select().from(requests).where(and(eq(requests.id, requestId), eq(requests.userId, u.id))).limit(1);
  if (!r || !["completed", "closed"].includes(r.status)) return fail("Vous pourrez noter une fois le don réalisé.");
  const [m] = await db.select().from(missions).where(and(eq(missions.requestId, requestId), sql`${missions.validatedAt} is not null`)).limit(1);
  if (!m || !m.providerId) return fail("Aucune mission validée à noter.");
  const rating = int(fd, "rating");
  if (rating < 1 || rating > 5) return fail("Note de 1 à 5 requise.");
  try {
    await db.insert(reviews).values({ kind: "mission", refId: m.id, fromUserId: u.id, toUserId: m.providerId, rating, comment: str(fd, "comment", 800) || null });
  } catch {
    return fail("Vous avez déjà noté cette mission.");
  }
  await awardTokens({ userId: u.id, eventKey: "review_given", refType: "mission", refId: m.id });
  await notify(m.providerId, "review", `Nouvel avis : ${rating}/5`, str(fd, "comment", 100), "/espace/missions");
  refresh();
  return done("Merci pour votre avis !");
}

/* ───────── Campagnes & publications ───────── */
export async function createListing(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  if (u.role !== "partner") return fail("Réservé aux partenaires.");
  const type = str(fd, "type");
  if (!["don", "action", "crowdfunding"].includes(type)) return fail("Type invalide.");
  const title = str(fd, "title", 150);
  if (title.length < 4) return fail("Intitulé trop court.");
  const goal = int(fd, "goalAmount");
  if (type === "crowdfunding" && goal < 10000) return fail("Un objectif de financement (≥ 10 000 FCFA) est requis.");
  const ends = str(fd, "endsAt");
  const [l] = await db.insert(listings).values({
    ownerId: u.id, type, title, description: str(fd, "description", 2000), zone: str(fd, "zone", 100), goalAmount: type === "crowdfunding" ? goal : 0,
    endsAt: ends ? new Date(ends) : null,
  }).returning();
  await audit(u, "listing.create", "listing", l.id);
  await notifyAdmins("listings.moderate", "listing", `Publication à modérer : ${title}`, undefined, "/admin/publications");
  refresh();
  return done("Publication envoyée en modération.");
}

export async function contribute(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const id = int(fd, "listingId");
  const amount = int(fd, "amount");
  const [l] = await db.select().from(listings).where(and(eq(listings.id, id), eq(listings.status, "published"))).limit(1);
  if (!l) return fail("Campagne introuvable.");
  if (amount < 500) return fail("Contribution minimale : 500 FCFA.");
  const method = str(fd, "method");
  if (!["mobile_money", "card", "bank", "cash"].includes(method)) return fail("Choisissez un moyen de paiement.");
  await db.insert(listingContributions).values({ listingId: id, userId: u.id, amount, method, reference: str(fd, "reference", 100) || null });
  await notifyAdmins("listings.moderate", "payment", `Contribution à confirmer (${l.title})`, `${amount} FCFA`, "/admin/publications");
  refresh();
  return done("Contribution enregistrée. Elle sera comptabilisée après confirmation du paiement.");
}

export async function supportListingMena(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const id = int(fd, "listingId");
  const amount = int(fd, "amount");
  const [l] = await db.select().from(listings).where(and(eq(listings.id, id), eq(listings.status, "published"))).limit(1);
  if (!l) return fail("Campagne introuvable.");
  if (amount < 1) return fail("Montant invalide.");
  const [me] = await db.select().from(users).where(eq(users.id, u.id));
  if (me.tokenBalance < amount) return fail("Solde de Mena insuffisant.");
  await db.transaction(async (tx) => {
    await tx.insert(tokenTransactions).values({ userId: u.id, amount: -amount, type: "spend", reason: `Soutien symbolique : ${l.title}`, refType: "listing", refId: id });
    await tx.update(users).set({ tokenBalance: sql`${users.tokenBalance} - ${amount}` }).where(eq(users.id, u.id));
    await tx.update(listings).set({ menaSupport: sql`${listings.menaSupport} + ${amount}` }).where(eq(listings.id, id));
  });
  refresh();
  return done(`Merci ! ${amount} Mena offerts en soutien symbolique à la campagne.`);
}

/* ───────── Tokens : transfert / conversion (désactivables) ───────── */
export async function transferTokens(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  if (!(await getSetting<boolean>("feature.token_transfer"))) return fail("Les transferts de Mena sont désactivés (validation juridique en attente).");
  const amount = int(fd, "amount");
  const phone = str(fd, "phone", 20).replace(/\s/g, "");
  const [to] = await db.select().from(users).where(and(eq(users.phone, phone), eq(users.status, "active"))).limit(1);
  if (!to || to.id === u.id) return fail("Destinataire invalide.");
  if (amount < 1 || amount > 1000) return fail("Montant invalide (1 à 1000).");
  const [me] = await db.select().from(users).where(eq(users.id, u.id));
  if (me.tokenBalance < amount) return fail("Solde insuffisant.");
  await db.transaction(async (tx) => {
    await tx.insert(tokenTransactions).values([
      { userId: u.id, amount: -amount, type: "transfer_out", reason: `Transfert vers ${to.name || to.phone}`, createdBy: u.id },
      { userId: to.id, amount, type: "transfer_in", reason: `Transfert de ${me.name || me.phone}`, createdBy: u.id },
    ]);
    await tx.update(users).set({ tokenBalance: sql`${users.tokenBalance} - ${amount}` }).where(eq(users.id, u.id));
    await tx.update(users).set({ tokenBalance: sql`${users.tokenBalance} + ${amount}` }).where(eq(users.id, to.id));
  });
  await audit(u, "tokens.transfer", "user", to.id, { amount });
  await notify(to.id, "tokens", `+${amount} Mena reçus`, undefined, "/espace/tokens");
  refresh();
  return done("Transfert effectué.");
}

export async function requestConversion(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  if (!(await getSetting<boolean>("feature.token_conversion"))) return fail("La conversion des Mena est désactivée (validation juridique et réglementaire en attente).");
  const rate = await getSetting<number>("tokens.conversion_rate_xof");
  if (!rate || rate <= 0) return fail("Le taux de conversion n'est pas défini.");
  const amount = int(fd, "amount");
  const [me] = await db.select().from(users).where(eq(users.id, u.id));
  if (amount < 1 || me.tokenBalance < amount) return fail("Montant invalide ou solde insuffisant.");
  await db.transaction(async (tx) => {
    await tx.insert(tokenTransactions).values({ userId: u.id, amount: -amount, type: "conversion", reason: `Demande de conversion (${amount * rate} FCFA)`, status: "pending" });
    await tx.update(users).set({ tokenBalance: sql`${users.tokenBalance} - ${amount}` }).where(eq(users.id, u.id));
  });
  await notifyAdmins("tokens.manage", "tokens", "Demande de conversion de Mena à valider", undefined, "/admin/tokens");
  refresh();
  return done("Demande de conversion enregistrée, en attente de validation.");
}

/* ───────── Profil & notifications ───────── */
export async function updateProfile(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const name = str(fd, "name", 80);
  if (name.length < 2) return fail("Nom trop court.");
  await db.update(users).set({
    name, email: str(fd, "email", 120) || null, zone: str(fd, "zone", 100) || null, organization: str(fd, "organization", 120) || null, bio: str(fd, "bio", 600) || null,
    notifPrefs: { inapp: !!fd.get("inapp"), sms: !!fd.get("sms"), email: !!fd.get("email_pref") },
  }).where(eq(users.id, u.id));
  if (u.role === "provider") {
    const cat = str(fd, "category");
    await db.insert(providerProfiles).values({ userId: u.id, category: cat || "autre", description: str(fd, "description", 800), zone: str(fd, "zone", 100), available: !!fd.get("available") })
      .onConflictDoUpdate({ target: providerProfiles.userId, set: { category: cat || "autre", description: str(fd, "description", 800), zone: str(fd, "zone", 100), available: !!fd.get("available") } });
  }
  refresh();
  return done("Profil mis à jour.");
}

export async function addProviderService(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  if (u.role !== "provider") return fail("Réservé aux prestataires.");
  const label = str(fd, "label", 150);
  if (label.length < 3) return fail("Intitulé requis.");
  await db.insert(providerServices).values({
    providerId: u.id, label, category: str(fd, "category") || "autre", unitCost: Math.max(int(fd, "unitCost"), 0), unit: str(fd, "unit", 40) || "prestation", description: str(fd, "description", 400) || null,
  });
  refresh();
  return done("Service ajouté.");
}

export async function removeProviderService(fd: FormData) {
  const u = await requireUser();
  await db.update(providerServices).set({ active: false }).where(and(eq(providerServices.id, int(fd, "id")), eq(providerServices.providerId, u.id)));
  refresh();
}

export async function markNotificationsRead() {
  const u = await requireUser();
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, u.id), sql`${notifications.readAt} is null`));
  refresh();
}

void count; void desc;
