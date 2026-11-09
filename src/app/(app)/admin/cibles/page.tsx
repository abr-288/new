import { count, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { requestItems } from "@/db/schema";
import { deleteTarget, saveTarget } from "@/app/actions/admin";
import { ActionForm } from "@/components/forms";
import { Check, Trash2 } from "lucide-react";
import { Empty, ICON_DEL, ICON_SAVE, PageHeader, Section } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { getTargets, type Target } from "@/lib/targets";

function TargetFields({ t }: { t?: Target }) {
  const key = t?.id ?? "new";
  return (
    <>
      {t && <input type="hidden" name="id" value={t.id} />}
      <div>
        <label className="label" htmlFor={`label-${key}`}>Nom de la cible</label>
        <input id={`label-${key}`} name="label" defaultValue={t?.label} className="input" placeholder="Ex. Orphelinat" required minLength={2} maxLength={60} />
      </div>
      <div>
        <label className="label" htmlFor={`desc-${key}`}>Description (facultatif)</label>
        <input id={`desc-${key}`} name="description" defaultValue={t?.description} className="input" placeholder="Ex. Structures d’accueil d’enfants" maxLength={200} />
      </div>
      <div>
        <label className="label" htmlFor={`active-${key}`}>Proposée aux donateurs</label>
        <select id={`active-${key}`} name="active" defaultValue={t?.active === false ? "off" : "on"} className="input">
          <option value="on">Oui</option>
          <option value="off">Non (masquée)</option>
        </select>
      </div>
    </>
  );
}

export default async function Page() {
  await requirePerm("catalog.manage");
  const [targets, usage] = await Promise.all([
    getTargets(),
    db.select({ target: requestItems.target, n: count() }).from(requestItems).where(isNotNull(requestItems.target)).groupBy(requestItems.target),
  ]);
  const used = (label: string) => usage.find((u) => u.target?.toLowerCase() === label.toLowerCase())?.n ?? 0;
  const visible = targets.filter((t) => t.active).length;

  return (
    <>
      <PageHeader
        title="Cibles des dons"
        subtitle="Définissez les cibles que les donateurs choisissent en ajoutant un don au panier (famille, école, orphelinat…). Une cible masquée n’est plus proposée mais reste affichée sur les demandes existantes. Chaque modification est auditée."
      />
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Section title={`Cibles (${visible} proposée${visible > 1 ? "s" : ""} sur ${targets.length})`}>
          {targets.length === 0 ? <Empty>Aucune cible : ajoutez-en une pour la proposer aux donateurs.</Empty> : (
            <ul className="space-y-3">
              {targets.map((t) => (
                <li key={t.id} className={`rounded-xl border border-slate-200 p-4 ${t.active ? "" : "bg-slate-50"}`}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-brand-dark">
                      🎯 {t.label}
                      {!t.active && <span className="badge badge-slate ml-2">Masquée</span>}
                    </p>
                    <span className="text-xs text-slate-500">Utilisée dans {used(t.label)} ligne{used(t.label) > 1 ? "s" : ""} de demande</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <ActionForm action={saveTarget} submit={<Check size={18} strokeWidth={2.5} />} submitTitle="Enregistrer la cible" pendingText="…" className="grid flex-1 items-end gap-3 sm:grid-cols-[1fr_1.4fr_auto_auto]" btnClass={ICON_SAVE}>
                      <TargetFields t={t} />
                    </ActionForm>
                    <ActionForm action={deleteTarget} submit={<Trash2 size={18} />} submitTitle="Supprimer la cible" pendingText="…" className="flex" btnClass={ICON_DEL}>
                      <input type="hidden" name="id" value={t.id} />
                    </ActionForm>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Ajouter une cible">
          <ActionForm action={saveTarget} submit="Ajouter la cible">
            <TargetFields />
          </ActionForm>
          <p className="mt-3 text-xs text-slate-500">Les cibles apparaissent dans le catalogue de dons, dans l’ordre de cette liste.</p>
        </Section>
      </div>
    </>
  );
}
