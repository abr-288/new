import Link from "next/link";
import { PageHero } from "@/components/PageHero";

export const metadata = { title: "Comment ça marche — Menewa Naya" };

const flows = [
  { t: "Donateur / Client", c: "green", steps: ["Créez votre compte avec votre numéro (OTP SMS).", "Choisissez dans le catalogue, créez un don personnel, une action ou un engagement récurrent.", "Payez (immédiat, préfinancement ou à chaque échéance) et suivez votre demande.", "Consultez les preuves de remise validées, clôturez et notez."] },
  { t: "Prestataire", c: "yellow", steps: ["Inscrivez-vous et décrivez vos services et tarifs.", "Recevez des missions proposées : acceptez ou refusez avec motif.", "Suivez la mission, déposez les preuves (photos, reçus, factures).", "Après validation administrative : paiement ou échange de services, tokens Mena et avis."] },
  { t: "Partenaire", c: "green", steps: ["Publiez des dons, actions solidaires ou campagnes de financement participatif.", "L’équipe Menewa modère et publie.", "Suivez les contributions reçues et l’avancement."] },
  { t: "Administration", c: "yellow", steps: ["Examine chaque demande : acceptation, refus motivé ou demande d’information.", "Attribue les missions, contrôle les preuves et les paiements.", "Gère litiges, statistiques, rôles, règles de tokens et journal d’audit."] },
];

export default function Page() {
  return (
    <>
      <PageHero eyebrow="Fonctionnement" title="3 étapes pour agir ensemble">
        Un parcours simple, sécurisé et traçable pour chaque profil.
      </PageHero>
      <div className="mx-auto grid max-w-[1100px] gap-5 px-4 py-10 md:grid-cols-2 lg:px-9">
        {flows.map((f) => (
          <div key={f.t} className={`card border-l-4 ${f.c === "green" ? "border-l-brand" : "border-l-sun"}`}>
            <h2 className="text-lg font-bold text-brand-dark">{f.t}</h2>
            <ol className="mt-3 space-y-2 text-sm">
              {f.steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${f.c === "green" ? "bg-brand" : "bg-sun"}`}>{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <div className="pb-12 text-center">
        <Link href="/inscription" className="btn btn-green px-8">Créer mon compte</Link>
      </div>
    </>
  );
}
