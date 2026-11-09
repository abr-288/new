"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  beneficiaries, catalogItems, disputes, installments, listingContributions, listings, missions, payments, providerProfiles,
  proofs, requests, settings, tokenRules, tokenTransactions, users,
} from "@/db/schema";
import type { ActionState } from "@/components/forms";
import { getCurrentUser } from "@/lib/auth";
import { addHistory, audit, notify } from "@/lib/audit";
import { done, fail, fileOf, int, str } from "@/lib/form";
import { hasPerm, PERMISSIONS, ROLES, type Perm } from "@/lib/rbac";
import { saveUpload } from "@/lib/storage";
import { DEFAULT_SETTINGS, getSetting } from "@/lib/settings";
import { getTargets, targetId, TARGETS_KEY, type Target } from "@/lib/targets";
import { applyTokenDelta, awardTokens, TOKEN_EVENTS } from "@/lib/tokens";

const refresh = () => revalidatePath("/", "layout");
async function guard(perm: Perm) {
  const u = await getCurrentUser();
  return u && hasPerm(u, perm) ? u : null;
}
const NOPE = fail("Permission insuffisante pour cette action.");

/* ───────── Demandes ───────── */
export async function decideRequest(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await guard("requests.manage");
  if (!u) return NOPE;
  const id = int(fd, "requestId");
  const [r] = await db.select().from(requests).where(eq(requests.id, id)).limit(1);
  if (!r) return fail("Demande introuvable.");
  if (r.status !== "submitted") return fail("Seules les demandes « Soumises » peuvent faire l'objet d'une décision.");
  const decision = str(fd, "decision");
  const msg = str(fd, "message", 1000);
  if (decision === "reject") {
    if (msg.length < 5) return fail("Le motif de refus est obligatoire.");
    await db.update(requests).set({ status: "rejected", rejectionReason: msg, updatedAt: new Date() }).where(eq(requests.id, id));
    await db.update(payments).set({ status: "cancelled" }).where(and(eq(payments.requestId, id), inArray(payments.status, ["planned", "declared"])));
    await addHistory(id, "rejected", `Refusée : ${msg}`, u.id);
    await notify(r.userId, "request_decision", `Votre demande ${r.ref} a été refusée`, msg, `/espace/demandes/${id}`);
  } else if (decision === "info") {
    if (msg.length < 5) return fail("Précisez l'information demandée.");
    await db.update(requests).set({ status: "info_requested", infoRequest: msg, updatedAt: new Date() }).where(eq(requests.id, id));
    await addHistory(id, "info_requested", `Information demandée : ${msg}`, u.id);
    await notify(r.userId, "info_requested", `Informations demandées pour ${r.ref}`, msg, `/espace/demandes/${id}`);
  } else if (decision === "accept") {
    const newAmount = int(fd, "newAmount");
    if (newAmount > 0 && newAmount !== r.amountPerOccurrence) {
      const total = newAmount * r.occurrences;
      await db.update(requests).set({ amountPerOccurrence: newAmount, totalAmount: total }).where(eq(requests.id, id));
      await db.update(installments).set({ amount: newAmount }).where(eq(installments.requestId, id));
      const pays = await db.select().from(payments).where(and(eq(payments.requestId, id), eq(payments.direction, "in"), eq(payments.status, "planned")));
      for (const p of pays) await db.update(payments).set({ amountPlanned: r.paymentMode === "echeance" ? newAmount : total }).where(eq(payments.id, p.id));
    }
    await db.update(requests).set({ status: "accepted", rejectionReason: null, updatedAt: new Date() }).where(eq(requests.id, id));
    await addHistory(id, "accepted", msg ? `Acceptée : ${msg}` : "Acceptée par l'administration", u.id);
    await notify(r.userId, "request_decision", `Votre demande ${r.ref} a été acceptée`, msg || undefined, `/espace/demandes/${id}`);
  } else return fail("Décision invalide.");
  await audit(u, `request.${decision}`, "request", id, { message: msg });
  refresh();
  return done("Décision enregistrée et notifiée au donateur.");
}

export async function linkBeneficiary(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await guard("requests.manage");
  if (!u) return NOPE;
  const id = int(fd, "requestId");
  const bid = int(fd, "beneficiaryId");
  await db.update(requests).set({ beneficiaryId: bid || null, updatedAt: new Date() }).where(eq(requests.id, id));
  await audit(u, "request.link_beneficiary", "request", id, { beneficiaryId: bid });
  refresh();
  return done("Bénéficiaire associé.");
}

export async function updateFinance(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await guard("payments.manage");
  if (!u) return NOPE;
  const id = int(fd, "requestId");
  const exec = Math.max(int(fd, "executionBudget"), 0);
  const other = Math.max(int(fd, "otherFees"), 0);
  await db.update(requests).set({ executionBudget: exec, otherFees: other, updatedAt: new Date() }).where(eq(requests.id, id));
  await audit(u, "request.finance_update", "request", id, { executionBudget: exec, otherFees: other });
  refresh();
  return done("Budget d'exécution et frais mis à jour.");
}

export async function markInstallmentDone(fd: FormData) {
  const u = await guard("requests.manage");
  if (!u) return;
  const id = int(fd, "id");
  const [i] = await db.update(installments).set({ status: "done" }).where(eq(installments.id, id)).returning();
  if (i) {
    await addHistory(i.requestId, "in_progress", `Échéance ${i.seq} réalisée`, u.id);
    await audit(u, "installment.done", "installment", id);
  }
  refresh();
}

export async function markRequestCompleted(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await guard("requests.manage");
  if (!u) return NOPE;
  const id = int(fd, "requestId");
  const [r] = await db.select().from(requests).where(eq(requests.id, id)).limit(1);
  if (!r) return fail("Demande introuvable.");
  if (!["accepted", "in_progress"].includes(r.status)) return fail("La demande doit être acceptée ou en cours.");
  const min = (await getSetting<number>("proofs.min_validated")) ?? 1;
  const accepted = (await getSetting<string[]>("proofs.accepted_types")) ?? ["photo", "attestation", "receipt"];
  const [pv] = await db.select({ n: count() }).from(proofs).where(and(eq(proofs.requestId, id), eq(proofs.status, "validated"), inArray(proofs.type, accepted)));
  if (pv.n < min) return fail(`Un don ne peut être déclaré réalisé sans preuve de remise validée (${pv.n}/${min} requise(s)).`);
  const ms = await db.select().from(missions).where(and(eq(missions.requestId, id), inArray(missions.status, ["proposed", "accepted", "in_progress"])));
  if (ms.length) return fail("Des missions ne sont pas encore terminées.");
  const pending = await db.select({ id: installments.id }).from(installments).where(and(eq(installments.requestId, id), eq(installments.status, "planned")));
  if (pending.length) return fail(`${pending.length} échéance(s) restent à réaliser.`);
  await db.update(requests).set({ status: "completed", completedAt: new Date(), updatedAt: new Date() }).where(eq(requests.id, id));
  await addHistory(id, "completed", "Don déclaré réalisé après contrôle des preuves", u.id);
  await audit(u, "request.completed", "request", id);
  await notify(r.userId, "request_decision", `Votre don ${r.ref} est réalisé`, "Consultez les preuves de remise.", `/espace/demandes/${id}`);
  refresh();
  return done("Don déclaré réalisé.");
}

export async function closeRequest(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await guard("requests.manage");
  if (!u) return NOPE;
  const id = int(fd, "requestId");
  const [r] = await db.select().from(requests).where(eq(requests.id, id)).limit(1);
  if (!r || r.status !== "completed") return fail("Seule une demande réalisée peut être clôturée.");
  await db.update(requests).set({ status: "closed", closedAt: new Date(), updatedAt: new Date() }).where(eq(requests.id, id));
  await addHistory(id, "closed", "Don clôturé", u.id);
  await audit(u, "request.closed", "request", id);
  await notify(r.userId, "request_closed", `Clôture du don ${r.ref}`, "Merci pour votre générosité ! Vous pouvez noter le prestataire.", `/espace/demandes/${id}`);
  await awardTokens({ userId: r.userId, eventKey: "request_closed", refType: "request", refId: id, actorId: u.id });
  refresh();
  return done("Don clôturé. Tokens attribués au donateur selon les règles.");
}

/* ───────── Missions ───────── */
export async function createMission(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await guard("missions.manage");
  if (!u) return NOPE;
  const requestId = int(fd, "requestId");
  const [r] = await db.select().from(requests).where(eq(requests.id, requestId)).limit(1);
  if (!r) return fail("Demande introuvable.");
  if (!["accepted", "in_progress"].includes(r.status)) return fail("Une mission doit être rattachée à une demande acceptée.");
  const providerId = int(fd, "providerId");
  const exception = str(fd, "exceptionReason", 500);
  if (!providerId && exception.length < 10) return fail("Désignez un prestataire, ou documentez l'exception administrative (10 caractères min.).");
  if (providerId) {
    const [pv] = await db.select().from(users).where(and(eq(users.id, providerId), eq(users.role, "provider"), eq(users.status, "active"))).limit(1);
    if (!pv) return fail("Prestataire invalide.");
  }
  const title = str(fd, "title", 200);
  if (title.length < 4) return fail("Intitulé de mission requis.");
  const mode = str(fd, "compensationMode") === "exchange" ? "exchange" : "money";
  const fee = Math.max(int(fd, "providerFee"), 0);
  const ex = str(fd, "exchangeDescription", 600);
  if (mode === "exchange" && ex.length < 5) return fail("Décrivez les engagements réciproques de l'échange de services.");
  const due = str(fd, "dueDate");
  const [m] = await db.insert(missions).values({
    requestId, providerId: providerId || null, title, instructions: str(fd, "instructions", 1500), dueDate: due ? new Date(due) : null,
    providerFee: mode === "money" ? fee : 0, compensationMode: mode, exchangeDescription: mode === "exchange" ? ex : null,
    exceptionReason: !providerId ? exception : null, status: providerId ? "proposed" : "accepted", createdBy: u.id,
  }).returning();
  if (providerId) {
    await db.insert(payments).values({
      requestId, missionId: m.id, userId: providerId, direction: "out", kind: "prestation", mode, method: mode === "exchange" ? "exchange" : null,
      amountPlanned: mode === "money" ? fee : 0, exchangeDescription: mode === "exchange" ? ex : null, exchangeStatus: mode === "exchange" ? "pending" : null,
      note: `Rémunération mission #${m.id}`,
    });
    await notify(providerId, "mission_proposed", `Nouvelle mission proposée : ${title}`, undefined, `/espace/missions/${m.id}`);
  }
  await addHistory(requestId, r.status, `Mission créée : ${title}${providerId ? "" : " (exception administrative)"}`, u.id);
  await audit(u, "mission.create", "mission", m.id, { requestId, providerId, exception: exception || undefined });
  refresh();
  return done("Mission créée.");
}

export async function cancelMission(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await guard("missions.manage");
  if (!u) return NOPE;
  const id = int(fd, "missionId");
  const reason = str(fd, "reason", 500);
  if (reason.length < 5) return fail("Indiquez le motif de l’annulation (5 caractères min.).");
  const [m] = await db.select().from(missions).where(eq(missions.id, id)).limit(1);
  if (!m) return fail("Mission introuvable.");
  if (!["proposed", "accepted", "in_progress"].includes(m.status)) return fail("Seule une mission proposée, acceptée ou en cours peut être annulée.");
  await db.update(missions).set({ status: "cancelled", refusalReason: `Annulée par l’administration : ${reason}`, updatedAt: new Date() }).where(eq(missions.id, id));
  await db.update(payments).set({ status: "cancelled" }).where(and(eq(payments.missionId, id), eq(payments.direction, "out"), eq(payments.status, "planned")));
  const [r] = await db.select({ status: requests.status }).from(requests).where(eq(requests.id, m.requestId)).limit(1);
  await addHistory(m.requestId, r?.status ?? "accepted", `Mission « ${m.title} » annulée : ${reason}`, u.id);
  await audit(u, "mission.cancel", "mission", id, { reason });
  if (m.providerId) await notify(m.providerId, "mission", `Mission annulée : ${m.title}`, reason, `/espace/missions/${id}`);
  refresh();
  return done("Mission annulée.");
}

export async function reassignMission(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await guard("missions.manage");
  if (!u) return NOPE;
  const id = int(fd, "missionId");
  const providerId = int(fd, "providerId");
  const [m] = await db.select().from(missions).where(eq(missions.id, id)).limit(1);
  if (!m) return fail("Mission introuvable.");
  if (!["refused", "proposed", "accepted"].includes(m.status)) return fail("Cette mission ne peut pas être réattribuée.");
  const [pv] = await db.select().from(users).where(and(eq(users.id, providerId), eq(users.role, "provider"), eq(users.status, "active"))).limit(1);
  if (!pv) return fail("Prestataire invalide.");
  await db.update(missions).set({ providerId, status: "proposed", reassignedFrom: m.providerId, refusalReason: null, exceptionReason: null, updatedAt: new Date() }).where(eq(missions.id, id));
  await db.update(payments).set({ userId: providerId }).where(and(eq(payments.missionId, id), eq(payments.direction, "out")));
  await addHistory(m.requestId, "accepted", `Mission « ${m.title} » réattribuée à ${pv.name || pv.phone}`, u.id);
  await audit(u, "mission.reassign", "mission", id, { from: m.providerId, to: providerId, reason: m.refusalReason });
  await notify(providerId, "mission_proposed", `Nouvelle mission proposée : ${m.title}`, undefined, `/espace/missions/${id}`);
  refresh();
  return done("Mission réattribuée.");
}

export async function validateMission(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await guard("proofs.review");
  if (!u) return NOPE;
  const id = int(fd, "missionId");
  const [m] = await db.select().from(missions).where(eq(missions.id, id)).limit(1);
  if (!m || m.status !== "completed") return fail("Mission non terminée.");
  if (m.validatedAt) return fail("Déjà validée.");
  const [pv] = await db.select({ n: count() }).from(proofs).where(and(eq(proofs.missionId, id), eq(proofs.status, "validated")));
  if (pv.n < 1) return fail("Au moins une preuve validée est nécessaire pour valider la mission.");
  await db.update(missions).set({ validatedAt: new Date(), updatedAt: new Date() }).where(eq(missions.id, id));
  await db.update(payments).set({ status: "validated", amountValidated: m.providerFee }).where(and(eq(payments.missionId, id), eq(payments.direction, "out"), eq(payments.status, "planned")));
  await addHistory(m.requestId, "in_progress", `Mission « ${m.title} » validée`, u.id);
  await audit(u, "mission.validate", "mission", id);
  if (m.providerId) {
    await notify(m.providerId, "mission", `Mission validée : ${m.title}`, "Votre rémunération est validée.", `/espace/missions/${id}`);
    await awardTokens({ userId: m.providerId, eventKey: "mission_validated", refType: "mission", refId: id, actorId: u.id });
  }
  refresh();
  return done("Mission validée, rémunération validée et tokens attribués.");
}

/* ───────── Preuves ───────── */
export async function reviewProof(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await guard("proofs.review");
  if (!u) return NOPE;
  const id = int(fd, "proofId");
  const [p] = await db.select().from(proofs).where(eq(proofs.id, id)).limit(1);
  if (!p) return fail("Preuve introuvable.");
  const decision = str(fd, "decision");
  const reason = str(fd, "reason", 500);
  if (decision === "reject" && reason.length < 5) return fail("Motif de rejet obligatoire.");
  if (!["validate", "reject"].includes(decision)) return fail("Décision invalide.");
  await db.update(proofs).set({
    status: decision === "validate" ? "validated" : "rejected", rejectionReason: decision === "reject" ? reason : null, reviewedBy: u.id, reviewedAt: new Date(),
    visibleToDonor: fd.get("hide") ? false : p.visibleToDonor,
  }).where(eq(proofs.id, id));
  await audit(u, `proof.${decision}`, "proof", id, { reason: reason || undefined });
  await notify(p.uploadedBy, "proof_review", decision === "validate" ? "Preuve validée" : "Preuve rejetée", reason || p.fileName, p.missionId ? `/espace/missions/${p.missionId}` : undefined);
  if (decision === "validate" && p.visibleToDonor) {
    const [r] = await db.select().from(requests).where(eq(requests.id, p.requestId)).limit(1);
    if (r && r.userId !== p.uploadedBy) await notify(r.userId, "proof_review", `Nouvelle preuve disponible — ${r.ref}`, undefined, `/espace/demandes/${r.id}`);
  }
  if (decision === "validate") await awardTokens({ userId: p.uploadedBy, eventKey: "proof_validated", refType: "proof", refId: id, actorId: u.id });
  refresh();
  return done(decision === "validate" ? "Preuve validée." : "Preuve rejetée.");
}

/* ───────── Paiements ───────── */
export async function updatePayment(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await guard("payments.manage");
  if (!u) return NOPE;
  const id = int(fd, "paymentId");
  const [p] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  if (!p) return fail("Paiement introuvable.");
  const status = str(fd, "status");
  if (!["planned", "declared", "validated", "partial", "paid", "cancelled"].includes(status)) return fail("Statut invalide.");
  const validated = fd.get("amountValidated") ? Math.max(int(fd, "amountValidated"), 0) : p.amountValidated;
  const paid = Math.max(int(fd, "amountPaid", p.amountPaid), 0);
  const ceiling = validated ?? p.amountPlanned;
  if (p.mode === "money" && paid > ceiling) return fail("Le montant payé ne peut excéder le montant validé / prévu.");
  const up = await saveUpload(fileOf(fd, "receipt"), "receipts");
  if (up && "error" in up) return fail(up.error);
  await db.update(payments).set({
    status, amountValidated: validated, amountPaid: paid, reference: str(fd, "reference", 100) || p.reference, note: str(fd, "note", 400) || p.note,
    exchangeStatus: str(fd, "exchangeStatus") || p.exchangeStatus,
    ...(status === "paid" ? { paidAt: new Date() } : {}),
    ...(up && !("error" in up) ? { receiptPath: up.path, receiptName: up.name } : {}),
  }).where(eq(payments.id, id));
  await audit(u, "payment.update", "payment", id, { status, validated, paid });
  if (p.direction === "in" && p.requestId && ["paid", "validated"].includes(status)) {
    await notify(p.userId, "payment", status === "paid" ? "Paiement confirmé" : "Paiement validé", `${paid || ceiling} FCFA`, `/espace/demandes/${p.requestId}`);
  }
  if (p.direction === "out" && status === "paid") await notify(p.userId, "payment", "Votre rémunération a été réglée", undefined, "/espace/paiements");
  refresh();
  return done("Paiement mis à jour.");
}

/* ───────── Litiges ───────── */
export async function updateDispute(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await guard("disputes.manage");
  if (!u) return NOPE;
  const id = int(fd, "disputeId");
  const [d] = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
  if (!d) return fail("Litige introuvable.");
  const status = str(fd, "status");
  const decision = str(fd, "decision", 2000);
  if (!["open", "investigating", "resolved", "closed"].includes(status)) return fail("Statut invalide.");
  if (["resolved", "closed"].includes(status) && decision.length < 10) return fail("Une décision motivée est requise pour résoudre ou clore un litige.");
  const responsible = int(fd, "responsibleId") || null;
  await db.update(disputes).set({ status, decision: decision || d.decision, responsibleId: responsible, closedAt: status === "closed" ? new Date() : null }).where(eq(disputes.id, id));
  await audit(u, "dispute.update", "dispute", id, { status, responsible });
  for (const t of [d.openedBy, d.againstUserId]) if (t) await notify(t, "dispute", `Litige ${d.ref} : ${status === "closed" ? "clos" : "mis à jour"}`, decision.slice(0, 100) || undefined, `/espace/litiges/${id}`);
  refresh();
  return done("Litige mis à jour.");
}

/* ───────── Utilisateurs, rôles ───────── */
export async function setUserStatus(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await guard("users.manage");
  if (!u) return NOPE;
  const id = int(fd, "userId");
  const status = str(fd, "status");
  if (!["active", "suspended", "archived"].includes(status)) return fail("Statut invalide.");
  if (id === u.id) return fail("Vous ne pouvez pas modifier votre propre statut.");
  const [t] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!t) return fail("Utilisateur introuvable.");
  if (t.role === "admin" && u.role !== "admin") return fail("Seul un administrateur principal peut modifier un administrateur.");
  await db.update(users).set({ status }).where(eq(users.id, id));
  await audit(u, "user.status", "user", id, { status });
  refresh();
  return done("Statut mis à jour (archivage : aucune suppression définitive).");
}

export async function setUserRole(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await guard("roles.manage");
  if (!u) return NOPE;
  const id = int(fd, "userId");
  const role = str(fd, "role");
  if (!ROLES[role]) return fail("Rôle invalide.");
  const perms = fd.getAll("perm").map(String).filter((p) => p in PERMISSIONS);
  const [t] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!t) return fail("Utilisateur introuvable.");
  if (t.id === u.id && role !== "admin") return fail("Vous ne pouvez pas retirer votre propre rôle d'administrateur.");
  if (t.role === "admin" && role !== "admin") {
    const [n] = await db.select({ n: count() }).from(users).where(and(eq(users.role, "admin"), eq(users.status, "active")));
    if (n.n <= 1) return fail("Impossible : il doit rester au moins un administrateur actif.");
  }
  await db.update(users).set({ role, permissions: role === "subadmin" ? perms : [] }).where(eq(users.id, id));
  if (role === "provider") await db.insert(providerProfiles).values({ userId: id }).onConflictDoNothing();
  await audit(u, "user.role", "user", id, { from: t.role, to: role, permissions: perms });
  refresh();
  return done("Rôle et permissions enregistrés.");
}

export async function verifyProvider(fd: FormData) {
  const u = await guard("providers.manage");
  if (!u) return;
  const id = int(fd, "userId");
  const v = fd.get("verified") === "1";
  await db.update(providerProfiles).set({ verified: v }).where(eq(providerProfiles.userId, id));
  await audit(u, v ? "provider.verify" : "provider.unverify", "user", id);
  refresh();
}

/* ───────── Catalogue ───────── */
export async function saveCatalogItem(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await guard("catalog.manage");
  if (!u) return NOPE;
  const id = int(fd, "id");
  const title = str(fd, "title", 120);
  const price = int(fd, "unitPrice");
  if (title.length < 3 || price < 0) return fail("Intitulé et prix valides requis.");
  const vals = {
    title, category: str(fd, "category") || "autre", kind: str(fd, "category") === "action" ? "action" : "don", description: str(fd, "description", 500),
    unitPrice: price, costEstimate: Math.max(int(fd, "costEstimate"), 0), unit: str(fd, "unit", 30) || "unité", emoji: str(fd, "emoji", 4) || "🎁", active: fd.get("active") !== "off",
  };
  if (id) {
    await db.update(catalogItems).set(vals).where(eq(catalogItems.id, id));
    await audit(u, "catalog.update", "catalog_item", id, { price, cost: vals.costEstimate });
  } else {
    const slug = title.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now().toString(36);
    const [c] = await db.insert(catalogItems).values({ ...vals, slug }).returning();
    await audit(u, "catalog.create", "catalog_item", c.id);
  }
  refresh();
  return done("Catalogue mis à jour.");
}

export async function toggleCatalogItem(fd: FormData) {
  const u = await guard("catalog.manage");
  if (!u) return;
  const id = int(fd, "id");
  await db.update(catalogItems).set({ active: fd.get("active") === "1" }).where(eq(catalogItems.id, id));
  await audit(u, "catalog.toggle", "catalog_item", id);
  refresh();
}

/* ───────── Tokens ───────── */
export async function saveTokenRule(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await guard("tokens.manage");
  if (!u) return NOPE;
  const id = int(fd, "id");
  const amount = Math.max(int(fd, "amount"), 0);
  const label = str(fd, "label", 120);
  if (amount > 1000) return fail("Montant par événement limité à 1000 Mena (anti-fraude).");
  if (label.length < 3) return fail("L’intitulé de la règle doit contenir au moins 3 caractères.");
  const [before] = await db.select().from(tokenRules).where(eq(tokenRules.id, id)).limit(1);
  if (!before) return fail("Règle introuvable.");
  const dailyCap = Math.max(int(fd, "dailyCap"), 0);
  const active = !!fd.get("active");
  await db.update(tokenRules).set({ label, amount, dailyCap, active }).where(eq(tokenRules.id, id));
  await audit(u, "tokens.rule_update", "token_rule", id, { from: { label: before.label, amount: before.amount, dailyCap: before.dailyCap, active: before.active }, to: { label, amount, dailyCap, active } });
  refresh();
  return done("Règle enregistrée.");
}

export async function createTokenRule(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await guard("tokens.manage");
  if (!u) return NOPE;
  const eventKey = str(fd, "eventKey");
  const label = str(fd, "label", 120);
  const amount = int(fd, "amount");
  const dailyCap = Math.max(int(fd, "dailyCap"), 0);
  if (!TOKEN_EVENTS[eventKey]) return fail("Choisissez un événement de la liste.");
  if (label.length < 3) return fail("L’intitulé de la règle doit contenir au moins 3 caractères.");
  if (amount < 1 || amount > 1000) return fail("Le montant doit être compris entre 1 et 1000 Mena (anti-fraude).");
  const [exists] = await db.select({ id: tokenRules.id }).from(tokenRules).where(eq(tokenRules.eventKey, eventKey)).limit(1);
  if (exists) return fail("Une règle existe déjà pour cet événement : modifiez-la plutôt.");
  const [r] = await db.insert(tokenRules).values({ eventKey, label, amount, dailyCap, active: !!fd.get("active") }).returning();
  await audit(u, "tokens.rule_create", "token_rule", r.id, { eventKey, amount, dailyCap });
  refresh();
  return done("Règle créée : elle s’appliquera aux prochains événements.");
}

export async function deleteTokenRule(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await guard("tokens.manage");
  if (!u) return NOPE;
  const id = int(fd, "id");
  const [r] = await db.select().from(tokenRules).where(eq(tokenRules.id, id)).limit(1);
  if (!r) return fail("Règle introuvable.");
  if (TOKEN_EVENTS[r.eventKey]?.base) return fail("Une règle de base ne peut pas être supprimée : désactivez-la.");
  await db.delete(tokenRules).where(eq(tokenRules.id, id));
  await audit(u, "tokens.rule_delete", "token_rule", id, { eventKey: r.eventKey, amount: r.amount });
  refresh();
  return done("Règle supprimée.");
}

/* ───────── Cibles des dons ───────── */
async function writeTargets(userId: number, list: Target[]) {
  const now = new Date();
  await db.insert(settings)
    .values({ key: TARGETS_KEY, value: list, description: DEFAULT_SETTINGS[TARGETS_KEY].description, updatedBy: userId, updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value: list, updatedBy: userId, updatedAt: now } });
}

export async function saveTarget(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await guard("catalog.manage");
  if (!u) return NOPE;
  const id = str(fd, "id", 80);
  const label = str(fd, "label", 60);
  const description = str(fd, "description", 200);
  const active = fd.get("active") !== "off";
  if (label.length < 2) return fail("Le nom de la cible doit contenir au moins 2 caractères.");
  const list = await getTargets();
  if (list.some((t) => t.id !== id && t.label.toLowerCase() === label.toLowerCase())) return fail("Une cible porte déjà ce nom.");
  if (id) {
    const i = list.findIndex((t) => t.id === id);
    if (i < 0) return fail("Cible introuvable.");
    const before = list[i];
    list[i] = { ...before, label, description, active };
    await writeTargets(u.id, list);
    await audit(u, "target.update", "target", id, { from: before, to: list[i] });
  } else {
    const t: Target = { id: targetId(label), label, description, active };
    await writeTargets(u.id, [...list, t]);
    await audit(u, "target.create", "target", t.id, { label });
  }
  refresh();
  return done(id ? "Cible enregistrée." : "Cible ajoutée.");
}

export async function deleteTarget(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await guard("catalog.manage");
  if (!u) return NOPE;
  const id = str(fd, "id", 80);
  const list = await getTargets();
  const t = list.find((x) => x.id === id);
  if (!t) return fail("Cible introuvable.");
  await writeTargets(u.id, list.filter((x) => x.id !== id));
  await audit(u, "target.delete", "target", id, { label: t.label });
  refresh();
  return done("Cible supprimée.");
}

export async function adjustTokens(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await guard("tokens.manage");
  if (!u) return NOPE;
  const target = int(fd, "userId");
  const amount = int(fd, "amount");
  const reason = str(fd, "reason", 300);
  if (!amount || reason.length < 5) return fail("Montant et motif (5 caractères min.) requis.");
  if (target === u.id) return fail("Vous ne pouvez pas ajuster votre propre solde.");
  const [t] = await db.select().from(users).where(eq(users.id, target)).limit(1);
  if (!t) return fail("Utilisateur introuvable.");
  if (amount < 0 && t.tokenBalance + amount < 0) return fail("Le solde ne peut pas devenir négatif.");
  const max = (await getSetting<number>("tokens.manual_adjust_max")) ?? 500;
  const needsApproval = Math.abs(amount) > max && u.role !== "admin";
  await db.insert(tokenTransactions).values({
    userId: target, amount, type: "adjust", reason, status: needsApproval ? "pending" : "approved", createdBy: u.id,
  });
  if (!needsApproval) await applyTokenDelta(target, amount, true);
  await audit(u, "tokens.adjust", "user", target, { amount, reason, pending: needsApproval });
  if (!needsApproval) await notify(target, "tokens", `${amount > 0 ? "+" : ""}${amount} Mena : ${reason}`, undefined, "/espace/tokens");
  refresh();
  return done(needsApproval ? "Ajustement au-dessus du plafond : en attente de validation de l'administrateur principal." : "Ajustement appliqué.");
}

export async function decideTokenTx(fd: FormData) {
  const u = await getCurrentUser();
  if (!u || u.role !== "admin") return; // validation réservée à l'administrateur principal
  const id = int(fd, "id");
  const ok = fd.get("decision") === "approve";
  const [t] = await db.select().from(tokenTransactions).where(and(eq(tokenTransactions.id, id), eq(tokenTransactions.status, "pending"))).limit(1);
  if (!t || t.createdBy === u.id) return;
  await db.update(tokenTransactions).set({ status: ok ? "approved" : "rejected" }).where(eq(tokenTransactions.id, id));
  if (t.type === "adjust" && ok) await applyTokenDelta(t.userId, t.amount, true);
  if (t.type === "conversion" && !ok) await applyTokenDelta(t.userId, -t.amount, false); // restitution
  await audit(u, ok ? "tokens.approve" : "tokens.reject", "token_tx", id, { amount: t.amount });
  await notify(t.userId, "tokens", `Opération Mena ${ok ? "validée" : "rejetée"}`, t.reason ?? undefined, "/espace/tokens");
  refresh();
}

/* ───────── Paramètres ───────── */
export async function saveSetting(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await guard("settings.manage");
  if (!u) return NOPE;
  const key = str(fd, "key");
  const raw = str(fd, "value", 2000);
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return fail("Valeur JSON invalide (ex. 15, true, \"texte\", {\"a\":1}).");
  }
  const [cur] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  if (!cur) return fail("Paramètre inconnu.");
  if (key.startsWith("feature.") && typeof value !== "boolean") return fail("Un interrupteur de fonctionnalité doit valoir true ou false.");
  if (key.startsWith("feature.") && value === true && u.role !== "admin") return fail("Seul l'administrateur principal peut activer une fonctionnalité soumise à validation juridique.");
  await db.update(settings).set({ value, updatedBy: u.id, updatedAt: new Date() }).where(eq(settings.key, key));
  await audit(u, "settings.update", "setting", key, { from: cur.value, to: value });
  refresh();
  return done("Paramètre enregistré.");
}

/* ───────── Publications partenaires ───────── */
export async function moderateListing(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await guard("listings.moderate");
  if (!u) return NOPE;
  const id = int(fd, "id");
  const decision = str(fd, "decision");
  const reason = str(fd, "reason", 400);
  const [l] = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
  if (!l) return fail("Publication introuvable.");
  if (decision === "reject" && reason.length < 5) return fail("Motif de refus requis.");
  const status = decision === "publish" ? "published" : decision === "close" ? "closed" : "rejected";
  await db.update(listings).set({ status, rejectionReason: status === "rejected" ? reason : null }).where(eq(listings.id, id));
  await audit(u, `listing.${status}`, "listing", id, { reason: reason || undefined });
  await notify(l.ownerId, "listing", `Publication « ${l.title} » : ${status === "published" ? "publiée" : status === "closed" ? "close" : "refusée"}`, reason || undefined, "/espace/publications");
  if (status === "published") await awardTokens({ userId: l.ownerId, eventKey: "listing_published", refType: "listing", refId: id, actorId: u.id });
  refresh();
  return done("Décision enregistrée.");
}

export async function confirmContribution(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await guard("listings.moderate");
  if (!u) return NOPE;
  const id = int(fd, "id");
  const ok = str(fd, "decision") === "confirm";
  const [c] = await db.select().from(listingContributions).where(and(eq(listingContributions.id, id), eq(listingContributions.status, "declared"))).limit(1);
  if (!c) return fail("Contribution introuvable ou déjà traitée.");
  await db.update(listingContributions).set({ status: ok ? "confirmed" : "rejected" }).where(eq(listingContributions.id, id));
  if (ok) await db.update(listings).set({ raisedAmount: sql`${listings.raisedAmount} + ${c.amount}` }).where(eq(listings.id, c.listingId));
  await audit(u, ok ? "contribution.confirm" : "contribution.reject", "contribution", id, { amount: c.amount });
  await notify(c.userId, "payment", ok ? "Contribution confirmée — merci !" : "Contribution non validée", `${c.amount} FCFA`, "/espace/campagnes");
  if (ok) await awardTokens({ userId: c.userId, eventKey: "contribution_confirmed", refType: "contribution", refId: id, actorId: u.id });
  refresh();
  return done(ok ? "Contribution confirmée." : "Contribution rejetée.");
}

/* ───────── Bénéficiaires ───────── */
export async function saveBeneficiary(_p: ActionState, fd: FormData): Promise<ActionState> {
  const u = await guard("beneficiaries.view");
  if (!u) return NOPE;
  const name = str(fd, "fullName", 120);
  if (name.length < 2) return fail("Nom requis.");
  if (!fd.get("consent")) return fail("Le consentement du bénéficiaire à la collecte de ses données est requis.");
  const [b] = await db.insert(beneficiaries).values({
    fullName: name, phone: str(fd, "phone", 30) || null, zone: str(fd, "zone", 100) || null, address: str(fd, "address", 200) || null,
    needs: str(fd, "needs", 500) || null, consent: true, createdBy: u.id,
  }).returning();
  await audit(u, "beneficiary.create", "beneficiary", b.id);
  refresh();
  return done("Bénéficiaire enregistré.");
}

export async function archiveBeneficiary(fd: FormData) {
  const u = await guard("beneficiaries.view");
  if (!u) return;
  const id = int(fd, "id");
  await db.update(beneficiaries).set({ archivedAt: fd.get("restore") ? null : new Date() }).where(eq(beneficiaries.id, id));
  await audit(u, fd.get("restore") ? "beneficiary.restore" : "beneficiary.archive", "beneficiary", id);
  refresh();
}

export async function goTo(fd: FormData) {
  redirect(str(fd, "to") || "/admin");
}
void asc;
