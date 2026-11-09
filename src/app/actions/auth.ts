"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { checkOtp, createSession, destroySession, normalizePhone, startOtp } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { isAdminRole, SELF_REGISTER_ROLES } from "@/lib/rbac";
import { awardTokens } from "@/lib/tokens";
import { ensureSeed } from "@/lib/seed";
import { contactMessages } from "@/db/schema";
import { notifyAdmins } from "@/lib/audit";
import type { ActionState } from "@/components/forms";

export type AuthState = { step: "phone" | "code"; phone?: string; name?: string; role?: string; error?: string; devCode?: string } | null;

export async function authAction(_prev: AuthState, fd: FormData): Promise<AuthState> {
  await ensureSeed();
  const mode = fd.get("mode") === "register" ? "register" : "login";
  const intent = String(fd.get("intent") || "send");
  const phone = normalizePhone(String(fd.get("phone") || ""));
  const name = String(fd.get("name") || "").trim().slice(0, 80);
  const role = String(fd.get("role") || "donor");
  if (!phone) return { step: "phone", error: "Numéro invalide. Exemple : +228 90 00 00 00", name, role };

  const [existing] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);

  if (intent === "send") {
    if (mode === "register") {
      if (name.length < 2) return { step: "phone", error: "Veuillez indiquer votre nom.", name, role, phone };
      if (!(SELF_REGISTER_ROLES as readonly string[]).includes(role)) return { step: "phone", error: "Profil invalide.", name, role, phone };
      if (existing) return { step: "phone", error: "Ce numéro possède déjà un compte. Connectez-vous.", name, role, phone };
    } else if (!existing) {
      return { step: "phone", error: "Aucun compte pour ce numéro. Inscrivez-vous d'abord.", phone };
    }
    if (existing && existing.status !== "active") return { step: "phone", error: "Ce compte est suspendu ou archivé. Contactez l'administration.", phone };
    const r = await startOtp(phone, mode === "register" ? { name, role } : undefined);
    if ("error" in r) return { step: "phone", error: r.error, phone, name, role };
    return { step: "code", phone, name, role, devCode: r.devCode };
  }

  // vérification du code
  const code = String(fd.get("code") || "").replace(/\D/g, "");
  const res = await checkOtp(phone, code);
  if ("error" in res) return { step: "code", phone, name, role, error: res.error };

  let user = existing;
  if (!user) {
    const meta = res.meta;
    const safeRole = (SELF_REGISTER_ROLES as readonly string[]).includes(meta?.role ?? "") ? meta!.role! : "donor";
    [user] = await db.insert(users).values({ phone, name: meta?.name || "", role: safeRole }).returning();
    await audit({ id: user.id, role: user.role }, "user.register", "user", user.id);
    await awardTokens({ userId: user.id, eventKey: "signup", refType: "user", refId: user.id });
    if (safeRole === "provider") {
      const { providerProfiles } = await import("@/db/schema");
      await db.insert(providerProfiles).values({ userId: user.id }).onConflictDoNothing();
    }
  }
  if (user.status !== "active") return { step: "phone", error: "Compte indisponible.", phone };
  await createSession(user.id);
  await audit({ id: user.id, role: user.role }, "user.login", "user", user.id);
  redirect(isAdminRole(user.role) ? "/admin" : "/espace");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function contactAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const name = String(fd.get("name") || "").trim();
  const message = String(fd.get("message") || "").trim();
  const subject = String(fd.get("subject") || "").trim();
  if (name.length < 2 || message.length < 10 || subject.length < 3) return { error: "Merci de renseigner nom, sujet et message (10 caractères min.)." };
  await db.insert(contactMessages).values({
    name: name.slice(0, 100),
    email: String(fd.get("email") || "").slice(0, 120) || null,
    phone: String(fd.get("phone") || "").slice(0, 30) || null,
    subject: subject.slice(0, 150),
    message: message.slice(0, 3000),
  });
  await notifyAdmins("settings.manage", "contact", `Nouveau message de contact : ${subject}`, message.slice(0, 120), "/admin/parametres");
  return { ok: "Merci ! Votre message a bien été envoyé. Nous vous répondrons rapidement." };
}
