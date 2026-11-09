import { count } from "drizzle-orm";
import { db } from "@/db";
import {
  catalogItems,
  listings,
  providerProfiles,
  providerServices,
  settings,
  tokenRules,
  users,
  missions,
  beneficiaries,
  reviews,
} from "@/db/schema";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { createRequest } from "@/lib/requests";

let seeding: Promise<void> | null = null;

export function ensureSeed() {
  if (!seeding) {
    seeding = run().catch((e) => {
      console.error("[seed] échec", e);
      seeding = null;
    });
  }
  return seeding;
}

async function run() {
  for (const [key, v] of Object.entries(DEFAULT_SETTINGS)) {
    await db.insert(settings).values({ key, value: v.value, description: v.description }).onConflictDoNothing();
  }
  const rules = [
    { eventKey: "signup", label: "Bienvenue sur Menewa Naya", amount: 20, dailyCap: 0 },
    { eventKey: "mission_validated", label: "Mission validée", amount: 50, dailyCap: 200 },
    { eventKey: "service_confirmed", label: "Service rendu confirmé", amount: 30, dailyCap: 150 },
    { eventKey: "request_closed", label: "Don clôturé", amount: 20, dailyCap: 100 },
    { eventKey: "review_given", label: "Avis publié", amount: 5, dailyCap: 15 },
  ];
  for (const r of rules) await db.insert(tokenRules).values(r).onConflictDoNothing();

  const [{ n }] = await db.select({ n: count() }).from(users);
  if (n > 0) return;

  const mk = async (phone: string, name: string, role: string, extra: Partial<typeof users.$inferInsert> = {}) =>
    (await db.insert(users).values({ phone, name, role, zone: "Lomé", ...extra }).returning())[0];

  const admin = await mk("+22890000001", "Administrateur Menewa", "admin");
  await mk("+22890000006", "Admin Modération", "subadmin", {
    permissions: ["requests.manage", "proofs.review", "stats.view", "missions.manage"],
  });
  const donor = await mk("+22890000002", "Koffi Amegah", "donor", { tokenBalance: 20, tokensEarned: 20 });
  const p1 = await mk("+22890000003", "Yao Traiteur & Co", "provider");
  const p2 = await mk("+22890000007", "Abalo Transport", "provider");
  const p3 = await mk("+22890000008", "Père Kodjo (officiant)", "provider");
  const partner = await mk("+22890000004", "ONG Éducation pour Tous", "partner", { organization: "Éducation pour Tous" });
  const benUser = await mk("+22890000005", "Ama Mensah", "beneficiary", { zone: "Kpalimé" });

  await db.insert(providerProfiles).values([
    { userId: p1.id, category: "traiteur", description: "Préparation et distribution de repas pour événements solidaires.", zone: "Lomé", verified: true },
    { userId: p2.id, category: "transport", description: "Transport de colis et de dons vers l'intérieur du pays.", zone: "Lomé", verified: true },
    { userId: p3.id, category: "officiant", description: "Bénédictions, prières et accompagnement spirituel.", zone: "Lomé", verified: false },
  ]);
  await db.insert(providerServices).values([
    { providerId: p1.id, label: "Repas pour 50 personnes", category: "traiteur", unitCost: 60000, unit: "prestation" },
    { providerId: p1.id, label: "Distribution de packs alimentaires", category: "traiteur", unitCost: 8000, unit: "livraison" },
    { providerId: p2.id, label: "Transport Lomé → Kpalimé", category: "transport", unitCost: 25000, unit: "trajet" },
    { providerId: p3.id, label: "Bénédiction / prière de remise", category: "officiant", unitCost: 5000, unit: "intervention" },
  ]);

  await db.insert(catalogItems).values([
    { slug: "pack-alimentaire-famille", title: "Pack alimentaire famille", category: "nourriture", description: "Riz, huile, haricots, farine, sel, tomate — pour une famille pendant un mois.", unitPrice: 15000, costEstimate: 12000, unit: "pack", emoji: "🍚" },
    { slug: "pack-alimentaire-enfant", title: "Pack repas enfants", category: "nourriture", description: "Repas équilibrés pour 10 enfants pendant une semaine.", unitPrice: 8000, costEstimate: 6500, unit: "pack", emoji: "🥣" },
    { slug: "belier", title: "Bélier", category: "betail", description: "Un bélier pour une fête ou une famille dans le besoin.", unitPrice: 85000, costEstimate: 72000, unit: "tête", emoji: "🐏" },
    { slug: "lot-volailles", title: "Lot de 5 volailles", category: "volaille", description: "Cinq poulets pour démarrer un petit élevage ou partager un repas.", unitPrice: 25000, costEstimate: 20000, unit: "lot", emoji: "🐓" },
    { slug: "habits-enfant", title: "Habits pour enfant", category: "habits", description: "Tenue complète (haut, bas, sous-vêtements).", unitPrice: 12000, costEstimate: 9500, unit: "tenue", emoji: "👕" },
    { slug: "habits-adulte", title: "Habits pour adulte", category: "habits", description: "Tenue complète pour adulte.", unitPrice: 15000, costEstimate: 12000, unit: "tenue", emoji: "👗" },
    { slug: "kit-scolaire", title: "Kit de fournitures scolaires", category: "fournitures", description: "Cahiers, stylos, ardoise, sac.", unitPrice: 7500, costEstimate: 6000, unit: "kit", emoji: "🎒" },
    { slug: "lampe-solaire", title: "Lampe solaire", category: "equipements", description: "Éclairage autonome pour étudier le soir.", unitPrice: 6000, costEstimate: 4500, unit: "unité", emoji: "💡" },
    { slug: "matelas", title: "Matelas", category: "equipements", description: "Matelas neuf pour une personne.", unitPrice: 20000, costEstimate: 16000, unit: "unité", emoji: "🛏️" },
    { slug: "visite-personne", title: "Visite à une personne", category: "action", kind: "action", description: "Un bénévole rend visite à une personne âgée, malade ou isolée.", unitPrice: 5000, costEstimate: 3000, unit: "visite", emoji: "🤝" },
    { slug: "acte-a-poser", title: "Acte à poser (message / cadeau remis)", category: "action", kind: "action", description: "Remise d'un message ou d'un cadeau de votre part à une cible.", unitPrice: 4000, costEstimate: 2500, unit: "acte", emoji: "💌" },
  ]);

  await db.insert(listings).values([
    { ownerId: partner.id, type: "crowdfunding", title: "Cantine de l'école de Kpalimé", description: "Financer les repas quotidiens de 120 élèves pendant un trimestre.", zone: "Kpalimé", goalAmount: 1500000, raisedAmount: 420000, status: "published", endsAt: new Date(Date.now() + 60 * 86400000) },
    { ownerId: partner.id, type: "action", title: "Distribution de kits scolaires", description: "Rentrée solidaire : distribution de kits dans 3 écoles rurales.", zone: "Plateaux", status: "published" },
  ]);

  const [ben] = await db
    .insert(beneficiaries)
    .values({ fullName: "Famille Mensah", phone: "+22890111222", zone: "Kpalimé", address: "Quartier Agbonou", needs: "Aide alimentaire mensuelle", consent: true, userId: benUser.id, createdBy: admin.id })
    .returning();

  const r = await createRequest({
    userId: donor.id,
    kind: "catalogue",
    title: "Pack alimentaire famille ×2",
    category: "nourriture",
    targetName: "Famille Mensah",
    targetZone: "Kpalimé",
    items: [{ label: "Pack alimentaire famille", quantity: 2, unitPrice: 15000, costEstimate: 12000, target: "Famille" }],
    paymentMode: "immediate",
    recurrence: "none",
  });
  const { requests } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  await db.update(requests).set({ status: "accepted", beneficiaryId: ben.id }).where(eq(requests.id, r.id));
  await db.insert(missions).values({
    requestId: r.id,
    providerId: p1.id,
    title: "Livrer 2 packs alimentaires à la famille Mensah",
    instructions: "Remise en main propre, photo avec la famille (avec consentement) et reçu signé.",
    dueDate: new Date(Date.now() + 5 * 86400000),
    providerFee: 8000,
    createdBy: admin.id,
  });
  await db.insert(reviews).values({ kind: "mission", refId: 0, fromUserId: donor.id, toUserId: p1.id, rating: 5, comment: "Service impeccable et très humain." });
}
