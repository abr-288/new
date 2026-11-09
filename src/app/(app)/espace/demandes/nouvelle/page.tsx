import { createCustomRequest } from "@/app/actions/donor";
import { ActionForm } from "@/components/forms";
import { AnnexFields, ScheduleFields } from "@/components/RequestFields";
import { PageHeader, Section } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { annexPrices } from "@/lib/requests";
import { getTargets } from "@/lib/targets";
import { TargetSelect } from "@/components/TargetSelect";

export default async function Page() {
  const u = await requireRole("donor", "client");
  const prices = await annexPrices();
  const targets = (await getTargets()).filter((t) => t.active);
  return (
    <>
      <PageHeader title="Don personnel / action ou visite" subtitle="Définissez librement votre don ou l’acte à poser (visite, remise de message, action de bienfaisance…). L’équipe pourra ajuster le budget lors de l’examen." />
      <Section title="Ma demande">
        <ActionForm action={createCustomRequest} submit="Envoyer la demande">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Nature</label>
              <select name="kind" className="input">
                <option value="personnalise">Don selon mes spécificités</option>
                <option value="action">Acte à poser / visite à effectuer</option>
              </select>
            </div>
            <div><label className="label">Intitulé</label><input name="title" className="input" placeholder="Ex. Repas de fête pour l’orphelinat" required /></div>
          </div>
          <div><label className="label">Description détaillée</label><textarea name="description" rows={4} className="input" placeholder="Que souhaitez-vous offrir ou faire ? Pour qui ? Dans quelles conditions ?" /></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className="label" htmlFor="targetName">Cible du don</label><TargetSelect id="targetName" name="targetName" targets={targets} allowCustom={u.role === "donor"} required /></div>
            <div><label className="label" htmlFor="targetZone">Zone / ville</label><input id="targetZone" name="targetZone" className="input" /></div>
            <div><label className="label">Budget par échéance (FCFA)</label><input name="amount" type="number" min={500} step={500} className="input" required /></div>
          </div>
          <ScheduleFields />
          <AnnexFields prices={prices} />
        </ActionForm>
      </Section>
    </>
  );
}
