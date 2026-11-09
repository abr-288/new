import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { PrintButton } from "@/components/PrintButton";
import { PageHeader, StatCard, StatusBadge, Table } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { CATEGORIES, fcfa, fdate, REQUEST_STATUS } from "@/lib/format";
import { hasPerm } from "@/lib/rbac";
import { loadStats, type StatFilters } from "@/lib/stats";

export default async function Page({ searchParams }: { searchParams: Promise<StatFilters> }) {
  const u = await requirePerm("stats.view");
  const f = await searchParams;
  const { rows, kpi } = await loadStats(f);
  const provs = await db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.role, "provider")));
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <>
      <PageHeader title="Statistiques & rapports" subtitle="Filtrables par période, statut, catégorie, prestataire et zone." actions={
        <>
          <PrintButton />
          {hasPerm(u, "stats.export") && <a href={`/admin/statistiques/export?${qs}`} className="btn btn-green btn-sm no-print">⬇ Export CSV (tableur)</a>}
        </>
      } />
      <form className="card no-print mb-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div><label className="label">Du</label><input type="date" name="from" defaultValue={f.from} className="input" /></div>
        <div><label className="label">Au</label><input type="date" name="to" defaultValue={f.to} className="input" /></div>
        <div><label className="label">Statut</label><select name="status" defaultValue={f.status ?? ""} className="input"><option value="">Tous</option>{Object.entries(REQUEST_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
        <div><label className="label">Catégorie</label><select name="category" defaultValue={f.category ?? ""} className="input"><option value="">Toutes</option>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label className="label">Prestataire</label><select name="provider" defaultValue={f.provider ?? ""} className="input"><option value="">Tous</option>{provs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div><label className="label">Zone</label><input name="zone" defaultValue={f.zone} className="input" /></div>
        <div className="sm:col-span-3 lg:col-span-6"><button className="btn btn-green btn-sm">Appliquer les filtres</button></div>
      </form>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Demandes reçues" value={kpi.received} />
        <StatCard label="Acceptées / refusées" value={`${kpi.accepted} / ${kpi.rejected}`} hint={`Taux d’acceptation ${kpi.acceptanceRate.toFixed(0)} %`} tone="blue" />
        <StatCard label="Dons réalisés" value={kpi.realized} hint={`Taux de réalisation ${kpi.realizationRate.toFixed(0)} %`} />
        <StatCard label="Délai moyen de réalisation" value={`${kpi.avgDays.toFixed(1)} j`} tone="amber" />
        <StatCard label="Montant des demandes" value={fcfa(kpi.amount)} />
        <StatCard label="Dépenses documentées" value={fcfa(kpi.documented)} tone="amber" />
        <StatCard label="Missions en retard" value={kpi.late} tone={kpi.late ? "red" : "green"} />
      </div>
      <Table>
        <thead><tr><th>Réf.</th><th>Intitulé</th><th>Catégorie</th><th>Zone</th><th>Prestataire(s)</th><th>Montant</th><th>Date</th><th>Statut</th></tr></thead>
        <tbody>{rows.map(({ r, providers, late }) => <tr key={r.id}><td className="font-mono text-xs">{r.ref}</td><td>{r.title}</td><td>{CATEGORIES[r.category]}</td><td>{r.targetZone}</td><td>{providers || "—"} {late && <span className="badge badge-red">retard</span>}</td><td>{fcfa(r.totalAmount)}</td><td>{fdate(r.createdAt)}</td><td><StatusBadge meta={REQUEST_STATUS} value={r.status} /></td></tr>)}</tbody>
      </Table>
      <p className="mt-3 text-xs text-slate-500">Formats d’export (PDF, tableur) à valider : CSV disponible ; PDF via impression du navigateur.</p>
    </>
  );
}
