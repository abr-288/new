import { cookies, headers } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { otpCodes, sessions, users } from "@/db/schema";
import { hasPerm, isAdminRole, type Perm } from "@/lib/rbac";
import { OTP_DEV_MODE, sendSms } from "@/lib/sms";

export type SessionUser = typeof users.$inferSelect;

const COOKIE = "mn_session";
const SESSION_DAYS = 14;
const OTP_TTL_MIN = 5;
const OTP_SECRET = process.env.OTP_SECRET || "menewa-naya-dev-secret-change-me";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const hashOtp = (phone: string, code: string) => sha256(`${OTP_SECRET}:${phone}:${code}`);

export function normalizePhone(raw: string): string | null {
  let p = raw.replace(/[\s().-]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (!p.startsWith("+")) p = /^\d{8}$/.test(p) ? "+228" + p : "+" + p; // indicatif Togo par défaut
  return /^\+\d{8,15}$/.test(p) ? p : null;
}

export async function startOtp(phone: string, meta?: { name?: string; role?: string }) {
  const since = new Date(Date.now() - 10 * 60 * 1000);
  const recent = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), gte(otpCodes.createdAt, since)));
  if ((recent[0]?.n ?? 0) >= 3) return { error: "Trop de demandes de code. Réessayez dans quelques minutes." };
  const code = String(randomInt(100000, 1000000));
  await db.insert(otpCodes).values({
    phone,
    codeHash: hashOtp(phone, code),
    meta: meta ?? null,
    expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60 * 1000),
  });
  await sendSms(phone, `Menewa Naya : votre code de vérification est ${code}. Valable ${OTP_TTL_MIN} minutes.`);
  return { ok: true as const, devCode: OTP_DEV_MODE ? code : undefined };
}

export async function checkOtp(phone: string, code: string) {
  const [row] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), isNull(otpCodes.consumedAt), gt(otpCodes.expiresAt, new Date())))
    .orderBy(desc(otpCodes.id))
    .limit(1);
  if (!row) return { error: "Code expiré ou introuvable. Demandez un nouveau code." };
  if (row.attempts >= 5) return { error: "Trop de tentatives. Demandez un nouveau code." };
  await db.update(otpCodes).set({ attempts: row.attempts + 1 }).where(eq(otpCodes.id, row.id));
  const a = Buffer.from(hashOtp(phone, code.trim()));
  const b = Buffer.from(row.codeHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { error: "Code incorrect." };
  await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, row.id));
  return { ok: true as const, meta: row.meta };
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  const h = await headers();
  await db.insert(sessions).values({
    id: sha256(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000),
    userAgent: (h.get("user-agent") || "").slice(0, 200),
  });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha256(token)));
  jar.delete(COOKIE);
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row || row.user.status !== "active") return null;
  return row.user;
});

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) redirect("/connexion");
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (!isAdminRole(u.role)) redirect("/espace");
  return u;
}

export async function requirePerm(perm: Perm) {
  const u = await requireUser();
  if (!isAdminRole(u.role)) redirect("/espace");
  if (!hasPerm(u, perm)) redirect("/admin?denied=" + encodeURIComponent(perm));
  return u;
}

export async function requireRole(...roles: string[]) {
  const u = await requireUser();
  if (!roles.includes(u.role)) redirect(isAdminRole(u.role) ? "/admin" : "/espace");
  return u;
}

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") || "").split(",")[0].trim() || null;
}
