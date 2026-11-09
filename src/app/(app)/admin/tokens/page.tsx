import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { tokenRules, tokenTransactions, users } from "@/db/schema";
import { adjustTokens, createTokenRule, decideTokenTx, deleteTokenRule, saveTokenRule } from "@/app/actions/admin";
import { ActionForm } from "@/components/forms";
import { Empty, PageHeader, Section, StatCard, StatusBadge, Table } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { fdatetime, TOKEN_STATUS } from "@/lib/format";
import { getSetting } from "@/lib/settings";
import { TOKEN_EVENTS } from "@/lib/tokens";
import { Check, Trash2 } from "lucide-react";
import { ICON_DEL, ICON_DEL_OFF, ICON_SAVE } from "@/components/ui";

export default async function Page() {
  const me = await requirePerm("tokens.manage");
  const [rules, txs, all, max] = await Promise.all([
    db.select().from(tokenRules).orderBy(tokenRules.id),
    db.select({ t: tokenTransactions, name: users.name, phone: users.phone }).from(tokenTransactions).innerJoin(users, eq(users.id, tokenTransactions.userId)).orderBy(desc(tokenTransactions.id)).limit(80),
    db.select({ id: users.id, name: users.name, phone: users.phone, bal: users.tokenBalance }).from(users),
    getSetting<number>("tokens.manual_adjust_max"),
  ]);
  const pending = txs.filter(({ t }) => t.status === "pending");
  const circulating = all.reduce((s, u) => s + u.bal, 0);
  const available = Object.entries(TOKEN_EVENTS).filter(([k]) => !rules.some((r) => r.eventKey === k));
  return (
    <>
      <PageHeader title="Token Mena" subtitle="Règles d’attribution, contrôle des opérations et suivi des transactions." />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Mena en circulation" value={circulating} />
        <StatCard label="Opérations en attente" value={pending.length} tone="amber" />
        <StatCard label="Plafond d’ajustement manuel" value={`${max} Mena`} tone="blue" hint="Au-delà : validation de l’administrateur principal" />
      </div>
      {pending.length > 0 && (
        <Section title="Opérations à valider (administrateur principal)">
          <ul className="divide-y divide-slate-100 text-sm">
            {pending.map(({ t, name, phone }) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span>{name || phone} · <strong>{t.amount}</strong> Mena · {t.type} — {t.reason}</span>
                {me.role === "admin" && t.createdBy !== me.id ? (
                  <span className="flex gap-2">
                    <form action={decideTokenTx}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="decision" value="approve" /><button className="btn btn-green btn-sm">Valider</button></form>
                    <form action={decideTokenTx}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="decision" value="reject" /><button className="btn btn-danger btn-sm">Rejeter</button></form>
                  </span>
                ) : <span className="text-xs text-slate-500">Validation réservée à un autre administrateur principal</span>}</li>
            ))}
          </ul>
        </Section>
      )}
      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1.7fr_1fr]">
        <Section title={`Règles d’attribution (${rules.filter((r) => r.active).length} active${rules.filter((r) => r.active).length > 1 ? "s" : ""} sur ${rules.length})`}>
          <ul className="space-y-3">
            {rules.map((r) => {
              const ev = TOKEN_EVENTS[r.eventKey];
              return (
                <li key={r.id} className={`rounded-xl border border-slate-200 p-4 ${r.active ? "" : "bg-slate-50"}`}>
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-brand-dark">
                        {r.label}
                        {!r.active && <span className="badge badge-slate ml-2">Désactivée</span>}
                        {ev?.base && <span className="badge badge-blue ml-2">Règle de base</span>}
                      </p>
                      <p className="text-xs text-slate-500">
                        Déclencheur : {ev?.label ?? r.eventKey} · Bénéficiaire : {ev?.who ?? "—"}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-emerald-700">+{r.amount} Mena{r.dailyCap > 0 ? ` · max ${r.dailyCap}/jour` : " · sans plafond"}</span>
                  </div>
                  <div className="flex items-end gap-2">
                  <ActionForm action={saveTokenRule} submit={<Check size={18} strokeWidth={2.5} />} submitTitle="Enregistrer la règle" pendingText="…" className="grid flex-1 items-end gap-3 sm:grid-cols-[110px_120px_1fr_auto]" btnClass={ICON_SAVE}>
                    <input type="hidden" name="id" value={r.id} />
                    <div className="sm:col-span-4"><label className="label" htmlFor={`rl-${r.id}`}>Intitulé affiché</label><input id={`rl-${r.id}`} name="label" defaultValue={r.label} className="input" required minLength={3} maxLength={120} /></div>
                    <div><label className="label" htmlFor={`ra-${r.id}`}>Mena</label><input id={`ra-${r.id}`} name="amount" type="number" min={0} max={1000} defaultValue={r.amount} className="input" /></div>
                    <div><label className="label" htmlFor={`rc-${r.id}`}>Plafond / jour</label><input id={`rc-${r.id}`} name="dailyCap" type="number" min={0} defaultValue={r.dailyCap} className="input" title="0 = illimité" /></div>
                    <label className="flex items-center gap-2 pb-2.5 text-sm"><input type="checkbox" name="active" defaultChecked={r.active} className="h-4 w-4 accent-brand" /> Active</label>
                  </ActionForm>
                  {ev?.base ? (
                    <button type="button" disabled className={ICON_DEL_OFF} title="Règle de base : elle ne peut pas être supprimée, désactivez-la" aria-label="Suppression impossible : règle de base">
                      <Trash2 size={18} />
                    </button>
                  ) : (
                    <ActionForm action={deleteTokenRule} submit={<Trash2 size={18} />} submitTitle="Supprimer la règle" pendingText="…" className="flex" btnClass={ICON_DEL}>
                      <input type="hidden" name="id" value={r.id} />
                    </ActionForm>
                  )}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-slate-500">Anti-fraude : une seule attribution par événement et par objet, plafonds quotidiens, aucune auto-attribution, 1 000 Mena maximum par règle. Chaque création, modification ou suppression est inscrite au journal d’audit. Plafond à 0 = illimité.</p>
        </Section>
        <div className="space-y-5 xl:sticky xl:top-20">
        <Section title="Créer une règle">
          {available.length === 0 ? (
            <Empty>Tous les événements de la plateforme ont déjà une règle. Modifiez ou réactivez les règles existantes.</Empty>
          ) : (
            <ActionForm action={createTokenRule} submit="Créer la règle">
              <div>
                <label className="label" htmlFor="new-event">Événement déclencheur</label>
                <select id="new-event" name="eventKey" className="input" required defaultValue="">
                  <option value="" disabled>Choisir un événement…</option>
                  {available.map(([k, ev]) => <option key={k} value={k}>{ev.label} — bénéficiaire : {ev.who}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="new-label">Intitulé affiché aux membres</label>
                <input id="new-label" name="label" className="input" placeholder="Ex. Preuve de remise validée" required minLength={3} maxLength={120} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label" htmlFor="new-amount">Mena attribués</label><input id="new-amount" name="amount" type="number" min={1} max={1000} defaultValue={10} className="input" required /></div>
                <div><label className="label" htmlFor="new-cap">Plafond / jour</label><input id="new-cap" name="dailyCap" type="number" min={0} defaultValue={0} className="input" /></div>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked className="h-4 w-4 accent-brand" /> Activer immédiatement</label>
            </ActionForm>
          )}
        </Section>
        <Section title="Ajustement manuel">
          <ActionForm action={adjustTokens} submit="Appliquer">
            <select name="userId" className="input">{all.map((u) => <option key={u.id} value={u.id}>{u.name || u.phone} ({u.bal} Mena)</option>)}</select>
            <input name="amount" type="number" className="input" placeholder="Montant (négatif pour retirer)" required />
            <input name="reason" className="input" placeholder="Motif (obligatoire)" required />
          </ActionForm>
        </Section>
        </div>
      </div>
      <div className="mt-5">
        <Section title="Transactions récentes">
          {txs.length === 0 ? <Empty>Aucune transaction.</Empty> : (
            <Table>
              <thead><tr><th>Date</th><th>Utilisateur</th><th>Type</th><th>Motif</th><th>Mena</th><th>Statut</th></tr></thead>
              <tbody>{txs.map(({ t, name, phone }) => <tr key={t.id}><td className="whitespace-nowrap text-xs">{fdatetime(t.createdAt)}</td><td>{name || phone}</td><td>{t.type}</td><td>{t.reason}</td><td className={t.amount > 0 ? "font-bold text-emerald-700" : "font-bold text-red-600"}>{t.amount}</td><td><StatusBadge meta={TOKEN_STATUS} value={t.status} /></td></tr>)}</tbody>
            </Table>
          )}
        </Section>
      </div>
    </>
  );
}
