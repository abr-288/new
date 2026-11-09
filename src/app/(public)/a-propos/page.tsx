import Link from "next/link";
import { PageHero } from "@/components/PageHero";

export const metadata = { title: "À propos — Menewa Naya" };

export default function Page() {
  return (
    <>
      <PageHero eyebrow="À propos" title="Une plateforme de solidarité de proximité">
        Menewa Naya connecte donateurs, bénéficiaires, prestataires locaux et partenaires pour transformer chaque intention de don en action concrète, documentée et vérifiable.
      </PageHero>
      <div className="mx-auto max-w-[1100px] space-y-10 px-4 py-10 lg:px-9">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            ["Transparence", "Chaque don est suivi de bout en bout : demande, mission, preuves de remise (photos, reçus, factures, attestations) et clôture."],
            ["Proximité", "Des prestataires locaux (commerçants, traiteurs, transporteurs, officiants…) réalisent les actions au plus près des bénéficiaires."],
            ["Confiance", "Authentification par téléphone, contrôle des accès par rôle, journal d’audit et protection des données personnelles des bénéficiaires."],
          ].map(([t, d]) => (
            <div key={t} className="card border-t-4 border-t-sun">
              <h2 className="text-lg font-bold text-brand-dark">{t}</h2>
              <p className="mt-2 text-sm text-slate-600">{d}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl bg-mint p-6">
            <h2 className="text-xl font-bold text-brand-dark">Menewa Social Kitchen</h2>
            <p className="mt-2 text-sm">Catalogue de dons (packs alimentaires, bélier, volailles, habits, fournitures, équipements), dons personnalisés, actions et visites, engagements récurrents et campagnes de financement participatif.</p>
            <Link href="/social-kitchen" className="btn btn-green btn-sm mt-4">Découvrir</Link>
          </div>
          <div className="rounded-2xl bg-cream p-6">
            <h2 className="text-xl font-bold text-brand-dark">Menewa Social Network</h2>
            <p className="mt-2 text-sm">Services communautaires : trouvez un prestataire, négociez le prix ou un échange de services, suivez la prestation et notez le résultat. Gagnez des tokens <strong>Mena</strong> en rendant service.</p>
            <Link href="/social-network" className="btn btn-yellow btn-sm mt-4">Découvrir</Link>
          </div>
        </div>
        <div className="card">
          <h2 className="text-lg font-bold text-brand-dark">Token Mena et gamification</h2>
          <p className="mt-2 text-sm text-slate-600">Les Mena récompensent la participation (missions validées, services rendus, dons clôturés). Des badges et niveaux d’engagement valorisent les membres. Les transferts et conversions monétaires sont désactivés tant que leur cadre juridique et réglementaire n’est pas validé.</p>
        </div>
      </div>
    </>
  );
}
