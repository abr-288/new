import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { hasPerm } from "@/lib/rbac";
import { loadStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET(req: Request) {
  const u = await getCurrentUser();
  if (!u || !hasPerm(u, "stats.export")) return new Response("Accès refusé", { status: 403 });
  const sp = new URL(req.url).searchParams;
  const f = Object.fromEntries(["from", "to", "status", "category", "provider", "zone"].map((k) => [k, sp.get(k) ?? undefined]));
  const { rows } = await loadStats(f);
  const head = ["Référence", "Intitulé", "Type", "Catégorie", "Zone", "Prestataires", "Montant FCFA", "Budget exécution", "Autres frais", "Statut", "Créée le"];
  const lines = rows.map(({ r, providers }) => [r.ref, r.title, r.kind, r.category, r.targetZone, providers, r.totalAmount, r.executionBudget, r.otherFees, r.status, r.createdAt.toISOString().slice(0, 10)].map(esc).join(";"));
  await audit(u, "report.export", "report", "requests", { filters: f, rows: rows.length });
  return new Response("\ufeff" + [head.map(esc).join(";"), ...lines].join("\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="menewa-rapport-demandes.csv"' },
  });
}
