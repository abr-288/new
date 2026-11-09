import { eq } from "drizzle-orm";
import { db } from "@/db";
import { installments, payments, requestItems, requests } from "@/db/schema";
import { addHistory, notify, notifyAdmins } from "@/lib/audit";
import { getSetting } from "@/lib/settings";

export const ANNEX_LABELS: Record<string, string> = {
  packaging: "Personnalisation du packaging",
  officiant: "Intervention d'un officiant religieux",
  photos: "Prises de photos",
  video: "Reportage photo / vidéo",
};

export async function annexPrices() {
  return (await getSetting<Record<string, number>>("annex.prices")) ?? {};
}

function addPeriod(d: Date, rec: string, i: number) {
  const r = new Date(d);
  if (rec === "weekly") r.setDate(r.getDate() + 7 * i);
  else if (rec === "monthly") r.setMonth(r.getMonth() + i);
  else if (rec === "quarterly") r.setMonth(r.getMonth() + 3 * i);
  return r;
}

export type NewRequest = {
  userId: number;
  kind: "catalogue" | "personnalise" | "action" | "recurrent";
  title: string;
  description?: string;
  category: string;
  targetName?: string;
  targetZone?: string;
  items: { catalogItemId?: number; label: string; quantity: number; unitPrice: number; costEstimate?: number; target?: string }[];
  paymentMode: "immediate" | "prefinance" | "echeance";
  recurrence: "none" | "weekly" | "monthly" | "quarterly";
  occurrences?: number;
  startDate?: Date;
  annex?: Record<string, unknown>;
  annexCost?: number;
  partnerId?: number;
};

export async function createRequest(p: NewRequest) {
  const recurrence = p.recurrence;
  const occurrences = recurrence === "none" ? 1 : Math.min(Math.max(p.occurrences ?? 2, 2), 60);
  const itemsTotal = p.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const perOcc = itemsTotal + (p.annexCost ?? 0);
  const total = perOcc * occurrences;
  const start = p.startDate && !isNaN(p.startDate.getTime()) ? p.startDate : new Date();
  const paymentMode = recurrence === "none" ? "immediate" : p.paymentMode === "immediate" ? "prefinance" : p.paymentMode;
  const costEst = p.items.reduce((s, i) => s + i.quantity * (i.costEstimate ?? 0), 0) * occurrences;

  const [req] = await db
    .insert(requests)
    .values({
      ref: "tmp-" + Math.random().toString(36).slice(2),
      userId: p.userId,
      kind: p.kind,
      title: p.title,
      description: p.description,
      category: p.category,
      targetName: p.targetName,
      targetZone: p.targetZone,
      partnerId: p.partnerId,
      amountPerOccurrence: perOcc,
      occurrences,
      totalAmount: total,
      paymentMode,
      recurrence,
      startDate: start,
      annexServices: p.annex,
      annexCost: (p.annexCost ?? 0) * occurrences,
      executionBudget: costEst,
    })
    .returning();
  const ref = `MN-${new Date().getFullYear()}-${String(req.id).padStart(5, "0")}`;
  await db.update(requests).set({ ref }).where(eq(requests.id, req.id));

  if (p.items.length)
    await db.insert(requestItems).values(p.items.map((i) => ({ ...i, requestId: req.id, costEstimate: i.costEstimate ?? 0 })));

  const inst = [];
  for (let i = 0; i < occurrences; i++) {
    inst.push({ requestId: req.id, seq: i + 1, dueDate: addPeriod(start, recurrence, i), amount: perOcc });
  }
  const insts = await db.insert(installments).values(inst).returning();

  if (paymentMode === "echeance") {
    await db.insert(payments).values(
      insts.map((it) => ({
        requestId: req.id,
        installmentId: it.id,
        userId: p.userId,
        direction: "in",
        kind: "don",
        amountPlanned: it.amount,
        dueDate: it.dueDate,
        note: `Échéance ${it.seq}/${occurrences}`,
      })),
    );
  } else {
    await db.insert(payments).values({
      requestId: req.id,
      userId: p.userId,
      direction: "in",
      kind: "don",
      amountPlanned: total,
      dueDate: new Date(),
      note: paymentMode === "prefinance" ? `Préfinancement de ${occurrences} échéance(s)` : "Paiement immédiat",
    });
  }

  await addHistory(req.id, "submitted", "Demande créée par le donateur", p.userId);
  await notifyAdmins("requests.manage", "request_new", `Nouvelle demande ${ref}`, p.title, `/admin/demandes/${req.id}`);
  await notify(p.userId, "request_new", `Demande ${ref} enregistrée`, "Elle sera examinée par notre équipe.", `/espace/demandes/${req.id}`);
  return { id: req.id, ref };
}
