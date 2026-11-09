import { desc } from "drizzle-orm";
import { db } from "@/db";
import { beneficiaries } from "@/db/schema";
import { archiveBeneficiary, saveBeneficiary } from "@/app/actions/admin";
import { ActionForm } from "@/components/forms";
import { PageHeader, Section, Table } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fdate } from "@/lib/format";

export default async function Page() {
  const u = await requirePerm("beneficiaries.view");
  const rows = await db.select().from(beneficiaries).orderBy(desc(beneficiaries.id));
  await audit(u, "beneficiary.list_view", "beneficiary", undefined, { count: rows.length }); // accès aux données personnelles tracé
  return (
    <>
      <PageHeader title="Bénéficiaires" subtitle="Données personnelles sensibles : accès restreint et tracé dans le journal d’audit. Archivage uniquement." />
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Table>
          <thead><tr><th>Nom</th><th>Contact</th><th>Zone</th><th>Besoins</th><th>Créé</th><th></th></tr></thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className={b.archivedAt ? "opacity-50" : ""}>
                <td className="font-semibold">{b.fullName}{b.archivedAt && <span className="badge badge-slate ml-1">Archivé</span>}</td>
                <td className="text-xs">{b.phone}<br />{b.address}</td><td>{b.zone}</td><td className="text-xs">{b.needs}</td><td>{fdate(b.createdAt)}</td>
                <td><form action={archiveBeneficiary}><input type="hidden" name="id" value={b.id} />{b.archivedAt && <input type="hidden" name="restore" value="1" />}<button className="btn btn-outline btn-sm">{b.archivedAt ? "Restaurer" : "Archiver"}</button></form></td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Section title="Nouveau bénéficiaire">
          <ActionForm action={saveBeneficiary} submit="Enregistrer">
            <input name="fullName" className="input" placeholder="Nom complet" required />
            <input name="phone" className="input" placeholder="Téléphone" />
            <div className="grid grid-cols-2 gap-2"><input name="zone" className="input" placeholder="Zone" /><input name="address" className="input" placeholder="Adresse" /></div>
            <textarea name="needs" rows={2} className="input" placeholder="Besoins identifiés" />
            <label className="flex items-start gap-2 text-xs text-slate-600"><input type="checkbox" name="consent" className="mt-0.5 accent-[#0b5a3c]" /> Le bénéficiaire a consenti à la collecte et au traitement de ses données.</label>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
