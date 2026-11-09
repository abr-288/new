import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { tokenTransactions, userBadges } from "@/db/schema";
import { requestConversion, transferTokens } from "@/app/actions/donor";
import { ActionForm } from "@/components/forms";
import { Empty, PageHeader, Section, StatCard, StatusBadge, Table } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { BADGES, fdatetime, levelFor, TOKEN_LEVELS, TOKEN_STATUS } from "@/lib/format";
import { getSetting } from "@/lib/settings";

export default async function Page() {
  const u = await requireUser();
  const [txs, badges, canTransfer, canConvert] = await Promise.all([
    db.select().from(tokenTransactions).where(eq(tokenTransactions.userId, u.id)).orderBy(desc(tokenTransactions.id)).limit(50),
    db.select().from(userBadges).where(eq(userBadges.userId, u.id)),
    getSetting<boolean>("feature.token_transfer"),
    getSetting<boolean>("feature.token_conversion"),
  ]);
  const { cur, next } = levelFor(u.tokensEarned);
  const pct = next ? Math.round(((u.tokensEarned - cur.min) / (next.min - cur.min)) * 100) : 100;
  return (
    <>
      <PageHeader title="Token Mena" subtitle="Unité de récompense virtuelle : gagnez des Mena en rendant service et en participant." />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Solde" value={`${u.tokenBalance} Mena`} />
        <StatCard label="Total gagné" value={`${u.tokensEarned} Mena`} tone="blue" />
        <StatCard label="Niveau" value={cur.label} tone="amber" hint={next ? `Prochain : ${next.label} (${next.min} Mena)` : "Niveau maximal"} />
      </div>
      <div className="mb-5 card">
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-sun" style={{ width: `${pct}%` }} /></div>
        <p className="mt-2 text-xs text-slate-500">Niveaux : {TOKEN_LEVELS.map((l) => `${l.label} (${l.min}+)`).join(" · ")}</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Section title="Historique">
          {txs.length === 0 ? <Empty>Aucune opération.</Empty> : (
            <Table>
              <thead><tr><th>Date</th><th>Motif</th><th>Mena</th><th>Statut</th></tr></thead>
              <tbody>{txs.map((t) => (
                <tr key={t.id}><td className="whitespace-nowrap text-xs">{fdatetime(t.createdAt)}</td><td>{t.reason}</td>
                  <td className={`font-bold ${t.amount > 0 ? "text-emerald-700" : "text-red-600"}`}>{t.amount > 0 ? "+" : ""}{t.amount}</td><td><StatusBadge meta={TOKEN_STATUS} value={t.status} /></td></tr>
              ))}</tbody>
            </Table>
          )}
        </Section>
        <div className="space-y-5">
          <Section title="Badges">
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(BADGES).map(([k, b]) => {
                const has = badges.some((x) => x.code === k);
                return <div key={k} className={`rounded-xl border p-2 text-center text-xs ${has ? "border-sun bg-cream" : "border-slate-200 opacity-50"}`}><p className="font-semibold">{b.label}</p><p className="text-slate-500">{b.desc}</p></div>;
              })}
            </div>
          </Section>
          <Section title="Utiliser mes Mena">
            <p className="mb-3 text-sm text-slate-600">Offrez vos Mena en soutien symbolique à une campagne (page « Campagnes »). Les opérations ci-dessous sont soumises à validation juridique :</p>
            <fieldset disabled={!canTransfer} className={!canTransfer ? "opacity-60" : ""}>
              <p className="mb-1 text-sm font-semibold">Transférer à un membre {!canTransfer && <span className="badge badge-slate ml-1">Désactivé — validation juridique en attente</span>}</p>
              <ActionForm action={transferTokens} submit="Transférer" className="space-y-2" btnClass="btn btn-outline btn-sm">
                <input name="phone" className="input" placeholder="+228…" /><input name="amount" type="number" min={1} className="input" placeholder="Mena" />
              </ActionForm>
            </fieldset>
            <fieldset disabled={!canConvert} className={`mt-4 ${!canConvert ? "opacity-60" : ""}`}>
              <p className="mb-1 text-sm font-semibold">Convertir en monnaie {!canConvert && <span className="badge badge-slate ml-1">Désactivé — validation réglementaire en attente</span>}</p>
              <ActionForm action={requestConversion} submit="Demander la conversion" className="space-y-2" btnClass="btn btn-outline btn-sm">
                <input name="amount" type="number" min={1} className="input" placeholder="Mena" />
              </ActionForm>
            </fieldset>
          </Section>
        </div>
      </div>
    </>
  );
}
