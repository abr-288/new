import { PageHero } from "@/components/PageHero";

export const metadata = { title: "Actualités — Menewa Naya" };

const news = [
  ["Lancement de la plateforme (version MVP)", "Dons du catalogue, demandes personnalisées, missions de prestataires et suivi des preuves sont disponibles."],
  ["Token Mena : règles d’attribution", "Les Mena récompensent les missions validées et les services rendus. Transferts et conversions restent désactivés en attente de validation juridique."],
  ["Paiements mobiles : à venir", "L’intégration des moyens de paiement adaptés au marché africain (Mobile Money, cartes) est prévue dans une prochaine version."],
];

export default function Page() {
  return (
    <>
      <PageHero eyebrow="Actualités" title="Les nouvelles de Menewa" />
      <div className="mx-auto max-w-[900px] space-y-4 px-4 py-10">
        {news.map(([t, d]) => (
          <article key={t} className="card">
            <h2 className="text-lg font-bold text-brand-dark">{t}</h2>
            <p className="mt-1 text-sm text-slate-600">{d}</p>
          </article>
        ))}
      </div>
    </>
  );
}
