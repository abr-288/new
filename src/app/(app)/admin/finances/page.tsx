import Link from "next/link";
import { desc, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { missions, providerProfiles, providerServices, requests, users } from "@/db/schema";
import { PageHeader, Section, StatCard, Table } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { margin } from "@/lib/finance";
import { fcfa, PROVIDER_CATEGORIES } from "@/lib/format";
import { getSetting } from "@/lib/settings";

export default async function Page() {
  await requirePerm("finances.view");
  const rs = await db.select().from(requests).where(notInArray(requests.status, ["rejected", "cancelled"])).orderBy(desc(requests.id)).limit(100);
  const ms = rs.length ? await db.select().from(missions).where(inArray(missions.requestId, rs.map((r) => r.id))) : [];
  const target = (await getSetting<number>("finance.platform_margin_pct")) ?? 0;
  const rows = rs.map((r) => {
    const fees = ms.filter((m) => m.requestId === r.id && !["refused", "cancelled"].includes(m.status));
    const f = fees.reduce((s, m) => s + m.providerFee, 0);
    return { r, f, actors: fees.length, mg: margin(r, f) };
  });
  const rev = rows.reduce((s, x) => s + x.r.totalAmount, 0);
  const cost = rows.reduce((s, x) => s + x.mg.cost, 0);
  const gross = rev - cost;
  const dir = await db.select({ u: users, p: providerProfiles }).from(providerProfiles).innerJoin(users, eq(users.id, providerProfiles.userId));
  const svcs = await db.select().from(providerServices);
  return (
    <>
      <PageHeader title="Finances & marges" subtitle="Marge brute = contribution − (budget d’exécution + frais prestataires + autres frais)." />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Contributions" value={fcfa(rev)} />
        <StatCard label="Coûts totaux" value={fcfa(cost)} tone="amber" />
        <StatCard label="Marge brute" value={fcfa(gross)} tone={gross < 0 ? "red" : "green"} />
        <StatCard label="Taux de marge" value={`${rev ? ((gross / rev) * 100).toFixed(1) : 0} %`} hint={`Cible provisoire : ${target} %`} tone="blue" />
      </div>
      <Table>
        <thead><tr><th>Demande</th><th>Contribution</th><th>Budget d’exéc.</th><th>Frais prestataires</th><th>Autres</th><th>Marge brute</th><th>%</th><th>Acteurs</th></tr></thead>
        <tbody>
          {rows.map(({ r, f, actors, mg }) => (
            <tr key={r.id}>
              <td><Link href={`/admin/demandes/${r.id}`} className="font-semibold text-brand hover:underline">{r.ref}</Link><span className="block text-xs text-slate-500">{r.title}</span></td>
              <td>{fcfa(r.totalAmount)}</td><td>{fcfa(r.executionBudget)}</td><td>{fcfa(f)}</td><td>{fcfa(r.otherFees)}</td>
              <td className={mg.gross < 0 ? "font-bold text-red-600" : "font-bold text-brand"}>{fcfa(mg.gross)}</td>
              <td className={mg.pct < target ? "text-amber-600" : ""}>{mg.pct.toFixed(1)} %</td>
              <td className="text-xs">Donateur + {actors} prestataire(s){r.partnerId ? " + partenaire" : ""}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="mt-6">
        <Section title="Répertoire des prestataires, partenaires et coûts">
          <Table>
            <thead><tr><th>Prestataire</th><th>Catégorie</th><th>Services et coûts unitaires</th></tr></thead>
            <tbody>
              {dir.map(({ u, p }) => (
                <tr key={u.id}><td className="font-semibold">{u.name}</td><td>{PROVIDER_CATEGORIES[p.category]}</td>
                  <td className="text-xs">{svcs.filter((s) => s.providerId === u.id && s.active).map((s) => `${s.label} — ${fcfa(s.unitCost)}/${s.unit}`).join(" · ") || "—"}</td></tr>
              ))}
            </tbody>
          </Table>
        </Section>
      </div>
    </>
  );
}
