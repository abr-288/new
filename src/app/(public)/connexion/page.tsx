import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";
import { OTP_DEV_MODE } from "@/lib/sms";
import { isAdminRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connexion — Menewa Naya" };

const DEMOS = [
  ["Administrateur", "+228 90 00 00 01"],
  ["Admin secondaire", "+228 90 00 00 06"],
  ["Donateur", "+228 90 00 00 02"],
  ["Prestataire", "+228 90 00 00 03"],
  ["Partenaire", "+228 90 00 00 04"],
  ["Bénéficiaire", "+228 90 00 00 05"],
];

export default async function Page() {
  await ensureSeed();
  const u = await getCurrentUser();
  if (u) redirect(isAdminRole(u.role) ? "/admin" : "/espace");
  return (
    <section className="bg-gradient-to-b from-mint to-white px-4 py-12">
      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[1fr_320px]">
        <div className="card p-7">
          <h1 className="text-2xl font-bold text-brand-dark">Se connecter</h1>
          <p className="mb-5 mt-1 text-sm text-slate-600">Accédez à votre espace avec votre numéro de téléphone.</p>
          <AuthForm mode="login" />
        </div>
        {OTP_DEV_MODE && (
          <aside className="card h-fit bg-cream text-sm">
            <h2 className="font-bold text-brand-dark">Comptes de démonstration</h2>
            <p className="mb-2 mt-1 text-xs text-slate-600">Visible uniquement en mode démonstration (OTP affiché à l’écran).</p>
            <ul className="space-y-1">
              {DEMOS.map(([l, p]) => (
                <li key={p} className="flex justify-between gap-2"><span>{l}</span><span className="font-mono text-xs">{p}</span></li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </section>
  );
}
