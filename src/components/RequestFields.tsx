import { ANNEX_LABELS } from "@/lib/requests";
import { fcfa, PAYMENT_MODE, RECURRENCE } from "@/lib/format";

export function ScheduleFields({ allowRecurrence = true }: { allowRecurrence?: boolean }) {
  return (
    <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
      <legend className="px-2 text-sm font-bold text-brand-dark">Échéancier et paiement</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Fréquence</label>
          <select name="recurrence" className="input" defaultValue="none" disabled={!allowRecurrence}>
            {Object.entries(RECURRENCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Nombre d’échéances</label>
          <input name="occurrences" type="number" min={2} max={60} defaultValue={3} className="input" />
        </div>
        <div>
          <label className="label">Date de début</label>
          <input name="startDate" type="date" className="input" />
        </div>
      </div>
      <div>
        <label className="label">Mode de paiement</label>
        <select name="paymentMode" className="input" defaultValue="immediate">
          {Object.entries(PAYMENT_MODE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Don ponctuel : paiement immédiat. Engagement récurrent : préfinancement (tout payé d’avance) ou paiement à chaque échéance. Le règlement s’effectue via Mobile Money / virement et est validé par l’administration (intégration automatique à venir).
        </p>
      </div>
    </fieldset>
  );
}

export function AnnexFields({ prices }: { prices: Record<string, number> }) {
  return (
    <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
      <legend className="px-2 text-sm font-bold text-brand-dark">Services annexes (optionnels)</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(ANNEX_LABELS).map(([k, l]) => (
          <label key={k} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <input type="checkbox" name={`annex_${k}`} className="h-4 w-4 accent-[#0b5a3c]" />
            <span className="flex-1">{l}</span>
            <span className="text-xs font-semibold text-brand">+{fcfa(prices[k] ?? 0)}</span>
          </label>
        ))}
      </div>
      <div>
        <label className="label">Critères de personnalisation du packaging</label>
        <input name="annex_packaging_notes" className="input" placeholder="Couleurs, message, emballage cadeau…" />
      </div>
      <div>
        <label className="label">Autre spécificité à demander</label>
        <input name="annex_other" className="input" placeholder="Toute autre demande particulière" />
      </div>
      <p className="text-xs text-slate-500">Tarifs provisoires, configurables par l’administration.</p>
    </fieldset>
  );
}
