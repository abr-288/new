import { notFound } from "next/navigation";
import { PageHero } from "@/components/PageHero";

const pages: Record<string, { title: string; body: string[] }> = {
  "mentions-legales": {
    title: "Mentions légales",
    body: ["Éditeur : Menewa Naya — forme juridique, siège social et numéro d’enregistrement à compléter.", "Hébergeur : à compléter.", "Ces informations doivent être validées par l’organisation avant la mise en production."],
  },
  confidentialite: {
    title: "Politique de confidentialité",
    body: [
      "Nous collectons uniquement les données nécessaires : numéro de téléphone, nom, zone, historique des demandes.",
      "Les données personnelles des bénéficiaires ne sont visibles que par les personnes qui en ont besoin pour accomplir leur mission.",
      "Les actions critiques sont enregistrées dans un journal d’audit. Les éléments financiers sont archivés, jamais supprimés définitivement sans contrôle.",
      "Texte juridique définitif (durées de conservation, droits d’accès et de rectification, autorité de contrôle) à valider.",
    ],
  },
  conditions: {
    title: "Conditions d’utilisation",
    body: ["L’utilisation de la plateforme implique le respect des règles de la communauté et l’exactitude des informations fournies.", "Les tokens Mena sont des unités de récompense virtuelles sans valeur monétaire garantie ; leur transfert ou conversion est désactivé jusqu’à validation juridique.", "Conditions complètes à valider par un conseil juridique."],
  },
};

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = pages[slug];
  if (!p) notFound();
  return (
    <>
      <PageHero title={p.title} />
      <div className="mx-auto max-w-[800px] space-y-4 px-4 py-10 text-sm leading-relaxed text-slate-700">
        {p.body.map((b, i) => <p key={i}>{b}</p>)}
      </div>
    </>
  );
}
