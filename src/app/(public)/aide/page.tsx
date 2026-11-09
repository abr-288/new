import { PageHero } from "@/components/PageHero";

export const metadata = { title: "Aide — Menewa Naya" };

const faq = [
  ["Comment me connecter ?", "Saisissez votre numéro de téléphone : un code à 6 chiffres (OTP) vous est envoyé par SMS. Il est valable 5 minutes (5 essais maximum)."],
  ["Comment faire un don ?", "Depuis votre espace : Catalogue → panier → cible du don → mode de paiement. Vous pouvez aussi créer un don personnel, une action ou un engagement récurrent."],
  ["Comment payer ?", "Les paiements automatiques (Mobile Money, cartes) seront intégrés prochainement. Pour l’instant, effectuez le paiement puis déclarez-le avec sa référence : l’administration le valide."],
  ["Pourquoi ma demande a été refusée ?", "Le motif est toujours indiqué sur la page de la demande. Vous pouvez contacter l’équipe pour plus d’informations."],
  ["Quand un don est-il « réalisé » ?", "Après remise effective, dépôt de preuves (photos, reçus, attestations) et contrôle administratif."],
  ["Que sont les Mena ?", "Des unités de récompense virtuelles gagnées par vos actions. Transfert et conversion monétaire sont désactivés jusqu’à validation juridique."],
  ["Comment signaler un problème ?", "Ouvrez un litige depuis la page de votre demande ; l’administration instruira le dossier."],
];

const api = [
  ["GET", "/api/health", "Public", "Vérifie l’état du service et de la base de données."],
  ["GET", "/api/v1/catalog", "Public", "Liste des dons et actions du catalogue (JSON)."],
  ["POST", "/api/v1/auth/request-otp", "Public", "Body JSON {phone, name?, role?} — envoie un code OTP par SMS."],
  ["POST", "/api/v1/auth/verify-otp", "Public", "Body JSON {phone, code} — ouvre une session (cookie httpOnly mn_session)."],
  ["GET", "/api/v1/me", "Session", "Profil de l’utilisateur connecté (rôle, permissions, solde Mena)."],
  ["GET", "/api/v1/requests", "Session", "Demandes du donateur connecté (toutes les demandes pour un admin autorisé)."],
  ["GET", "/api/files/{proof|receipt|dispute}/{id}", "Session + droits", "Téléchargement sécurisé d’un fichier après contrôle des droits."],
  ["GET", "/admin/statistiques/export", "stats.export", "Export CSV filtrable des demandes."],
];

export default function Page() {
  return (
    <>
      <PageHero eyebrow="Aide" title="Questions fréquentes" />
      <div className="mx-auto max-w-[900px] space-y-3 px-4 py-10">
        {faq.map(([q, a]) => (
          <details key={q} className="card group">
            <summary className="cursor-pointer font-semibold text-brand-dark">{q}</summary>
            <p className="mt-2 text-sm text-slate-600">{a}</p>
          </details>
        ))}
        <h2 className="pt-6 text-xl font-bold text-brand-dark">API (documentation)</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="tbl">
            <thead><tr><th>Méthode</th><th>Route</th><th>Accès</th><th>Description</th></tr></thead>
            <tbody>{api.map(([m, r, a, d]) => <tr key={r}><td className="font-mono text-xs font-bold">{m}</td><td className="font-mono text-xs">{r}</td><td>{a}</td><td>{d}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">Documentation technique complète : dossier <code>docs/</code> du dépôt.</p>
      </div>
    </>
  );
}
