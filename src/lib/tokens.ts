import { and, count, eq, gte, sql, avg } from "drizzle-orm";
import { db } from "@/db";
import {
  missions,
  requests,
  reviews,
  tokenRules,
  tokenTransactions,
  userBadges,
  users,
} from "@/db/schema";
import { notify } from "@/lib/audit";
import { BADGES } from "@/lib/format";

/**
 * Attribution automatique de Mena selon les règles configurées.
 * Contrôles anti-fraude : règle active, compte actif, anti-doublon (refKey unique),
 * plafond quotidien par événement, interdiction de s'auto-attribuer des Mena.
 */
export async function awardTokens(p: {
  userId: number;
  eventKey: string;
  refType?: string;
  refId?: number;
  actorId?: number | null;
  reason?: string;
}) {
  const [rule] = await db.select().from(tokenRules).where(eq(tokenRules.eventKey, p.eventKey)).limit(1);
  if (!rule || !rule.active || rule.amount <= 0) return null;
  if (p.actorId && p.actorId === p.userId) return null;
  const [u] = await db.select().from(users).where(eq(users.id, p.userId)).limit(1);
  if (!u || u.status !== "active") return null;
  const refKey = p.refType ? `${p.eventKey}:${p.refType}:${p.refId}:${p.userId}` : null;
  if (refKey) {
    const [dup] = await db.select({ id: tokenTransactions.id }).from(tokenTransactions).where(eq(tokenTransactions.refKey, refKey));
    if (dup) return null;
  }
  if (rule.dailyCap > 0) {
    const startDay = new Date();
    startDay.setHours(0, 0, 0, 0);
    const [s] = await db
      .select({ t: sql<number>`coalesce(sum(${tokenTransactions.amount}),0)::int` })
      .from(tokenTransactions)
      .where(
        and(
          eq(tokenTransactions.userId, p.userId),
          eq(tokenTransactions.eventKey, p.eventKey),
          eq(tokenTransactions.status, "approved"),
          gte(tokenTransactions.createdAt, startDay),
        ),
      );
    if ((s?.t ?? 0) + rule.amount > rule.dailyCap) return null;
  }
  try {
    await db.transaction(async (tx) => {
      await tx.insert(tokenTransactions).values({
        userId: p.userId,
        amount: rule.amount,
        type: "earn",
        eventKey: p.eventKey,
        reason: p.reason ?? rule.label,
        refType: p.refType,
        refId: p.refId,
        refKey,
        createdBy: p.actorId ?? null,
      });
      await tx
        .update(users)
        .set({
          tokenBalance: sql`${users.tokenBalance} + ${rule.amount}`,
          tokensEarned: sql`${users.tokensEarned} + ${rule.amount}`,
        })
        .where(eq(users.id, p.userId));
    });
  } catch {
    return null; // doublon concurrent
  }
  await notify(p.userId, "tokens", `+${rule.amount} Mena : ${rule.label}`, undefined, "/espace/tokens");
  await refreshBadges(p.userId);
  return rule.amount;
}

/** Applique une opération (positive ou négative) validée sur le solde. */
export async function applyTokenDelta(userId: number, delta: number, earned: boolean) {
  await db
    .update(users)
    .set({
      tokenBalance: sql`${users.tokenBalance} + ${delta}`,
      ...(earned && delta > 0 ? { tokensEarned: sql`${users.tokensEarned} + ${delta}` } : {}),
    })
    .where(eq(users.id, userId));
}

export async function refreshBadges(userId: number) {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u) return;
  const [g] = await db
    .select({ n: count() })
    .from(requests)
    .where(and(eq(requests.userId, userId), eq(requests.status, "closed")));
  const [m] = await db
    .select({ n: count() })
    .from(missions)
    .where(and(eq(missions.providerId, userId), sql`${missions.validatedAt} is not null`));
  const [r] = await db
    .select({ n: count(), a: avg(reviews.rating) })
    .from(reviews)
    .where(eq(reviews.toUserId, userId));
  const codes: string[] = [];
  if (g.n >= 1) codes.push("first_gift");
  if (g.n >= 5) codes.push("generous");
  if (g.n >= 20) codes.push("patron");
  if (m.n >= 1) codes.push("first_mission");
  if (m.n >= 10) codes.push("elite_provider");
  if (r.n >= 3 && Number(r.a) >= 4.5) codes.push("five_stars");
  if (u.tokensEarned >= 1000) codes.push("ambassador");
  for (const code of codes) {
    const ins = await db.insert(userBadges).values({ userId, code }).onConflictDoNothing().returning();
    if (ins.length) await notify(userId, "badge", `Nouveau badge : ${BADGES[code].label}`, BADGES[code].desc, "/espace/tokens");
  }
}

/**
 * Événements de la plateforme pouvant déclencher une attribution de Mena.
 * Une règle (Administration › Token Mena) associe un montant et un plafond à l'un de ces événements.
 * `base` : règle créée à l'installation, qui peut être désactivée mais pas supprimée.
 */
export const TOKEN_EVENTS: Record<string, { label: string; who: string; base?: boolean }> = {
  signup: { label: "Inscription sur la plateforme", who: "Nouveau membre", base: true },
  mission_validated: { label: "Mission validée par l’administration", who: "Prestataire", base: true },
  service_confirmed: { label: "Service communautaire confirmé par le client", who: "Prestataire", base: true },
  request_closed: { label: "Don clôturé", who: "Donateur", base: true },
  review_given: { label: "Avis publié après une mission ou un service", who: "Donateur ou client", base: true },
  proof_validated: { label: "Preuve de remise validée par l’administration", who: "Auteur de la preuve (prestataire)" },
  contribution_confirmed: { label: "Contribution à une campagne confirmée", who: "Donateur" },
  listing_published: { label: "Publication partenaire publiée après modération", who: "Partenaire" },
};
