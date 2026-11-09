import { eq } from "drizzle-orm";
import { db } from "@/db";
import { providerProfiles, providerServices, reviews } from "@/db/schema";
import { addProviderService, removeProviderService, updateProfile } from "@/app/actions/donor";
import { ActionForm } from "@/components/forms";
import { Empty, PageHeader, Section } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { fcfa, PROVIDER_CATEGORIES } from "@/lib/format";
import { ROLES } from "@/lib/rbac";

export default async function Page() {
  const u = await requireUser();
  const [pp] = u.role === "provider" ? await db.select().from(providerProfiles).where(eq(providerProfiles.userId, u.id)) : [];
  const svcs = u.role === "provider" ? await db.select().from(providerServices).where(eq(providerServices.providerId, u.id)) : [];
  const rv = u.role === "provider" ? await db.select().from(reviews).where(eq(reviews.toUserId, u.id)) : [];
  return (
    <>
      <PageHeader title="Profil & paramètres du compte" subtitle={`${ROLES[u.role]} · ${u.phone}`} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Informations personnelles">
          <ActionForm action={updateProfile}>
            <div><label className="label">Nom complet</label><input name="name" defaultValue={u.name} className="input" required /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label">E-mail</label><input name="email" type="email" defaultValue={u.email ?? ""} className="input" /></div>
              <div><label className="label">Zone / ville</label><input name="zone" defaultValue={u.zone ?? ""} className="input" /></div>
            </div>
            {(u.role === "partner") && <div><label className="label">Organisation</label><input name="organization" defaultValue={u.organization ?? ""} className="input" /></div>}
            {u.role === "provider" && (
              <>
                <div><label className="label">Catégorie de prestataire</label><select name="category" defaultValue={pp?.category ?? "autre"} className="input">{Object.entries(PROVIDER_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label className="label">Présentation de vos services</label><textarea name="description" defaultValue={pp?.description ?? ""} rows={3} className="input" /></div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="available" defaultChecked={pp?.available ?? true} className="accent-[#0b5a3c]" /> Disponible pour de nouvelles missions</label>
              </>
            )}
            <div><label className="label">À propos</label><textarea name="bio" defaultValue={u.bio ?? ""} rows={2} className="input" /></div>
            <fieldset className="rounded-xl border border-slate-200 p-3">
              <legend className="px-1 text-xs font-bold uppercase text-slate-500">Canaux de notification</legend>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="inapp" defaultChecked={u.notifPrefs.inapp} className="accent-[#0b5a3c]" /> Dans l’application</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="sms" defaultChecked={u.notifPrefs.sms} className="accent-[#0b5a3c]" /> SMS (événements importants)</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="email_pref" defaultChecked={u.notifPrefs.email} className="accent-[#0b5a3c]" /> E-mail (canal à brancher)</label>
            </fieldset>
          </ActionForm>
        </Section>
        {u.role === "provider" && (
          <div className="space-y-5">
            <Section title="Mes services et tarifs">
              {svcs.filter((s) => s.active).length === 0 ? <Empty>Aucun service renseigné.</Empty> : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {svcs.filter((s) => s.active).map((s) => (
                    <li key={s.id} className="flex items-center justify-between py-2"><span>{s.label}<br /><span className="text-xs text-slate-500">{fcfa(s.unitCost)} / {s.unit}</span></span>
                      <form action={removeProviderService}><input type="hidden" name="id" value={s.id} /><button className="text-xs text-red-600 hover:underline">Retirer</button></form></li>
                  ))}
                </ul>
              )}
              <ActionForm action={addProviderService} submit="Ajouter" className="mt-4 space-y-2" btnClass="btn btn-yellow btn-sm">
                <input name="label" className="input" placeholder="Intitulé du service" required />
                <div className="grid grid-cols-3 gap-2"><select name="category" className="input">{Object.entries(PROVIDER_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><input name="unitCost" type="number" min={0} className="input" placeholder="Coût" /><input name="unit" className="input" placeholder="Unité" /></div>
              </ActionForm>
            </Section>
            <Section title={`Avis reçus (${rv.length})`}>
              {rv.length === 0 ? <Empty>Pas encore d’avis.</Empty> : <ul className="space-y-2 text-sm">{rv.slice(0, 8).map((r) => <li key={r.id}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)} — {r.comment}</li>)}</ul>}
            </Section>
          </div>
        )}
      </div>
    </>
  );
}
