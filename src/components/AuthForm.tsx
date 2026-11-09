"use client";

import { useActionState } from "react";
import Link from "next/link";
import { authAction, type AuthState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/forms";

const ROLE_OPTIONS = [
  ["donor", "Donateur — je veux faire un don"],
  ["client", "Client — je cherche un service"],
  ["provider", "Prestataire — j'offre mes compétences"],
  ["partner", "Partenaire — ONG, entreprise, association"],
  ["beneficiary", "Bénéficiaire — je suis soutenu(e)"],
];

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [state, action] = useActionState<AuthState, FormData>(authAction, null);
  const step = state?.step ?? "phone";

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="intent" value={step === "code" ? "verify" : "send"} />
      {step === "code" && (
        <>
          <input type="hidden" name="phone" value={state?.phone ?? ""} />
          <input type="hidden" name="name" value={state?.name ?? ""} />
          <input type="hidden" name="role" value={state?.role ?? ""} />
        </>
      )}

      {step === "phone" && (
        <>
          {mode === "register" && (
            <>
              <div>
                <label className="label" htmlFor="name">Nom complet</label>
                <input id="name" name="name" defaultValue={state?.name} className="input" placeholder="Ex. Koffi Amegah" required minLength={2} />
              </div>
              <div>
                <label className="label" htmlFor="role">Je m’inscris en tant que</label>
                <select id="role" name="role" defaultValue={state?.role || "donor"} className="input">
                  {ROLE_OPTIONS.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div>
            <label className="label" htmlFor="phone">Numéro de téléphone</label>
            <input id="phone" name="phone" defaultValue={state?.phone} inputMode="tel" autoComplete="tel" className="input" placeholder="+228 90 00 00 00" required />
            <p className="mt-1 text-xs text-slate-500">Un code de vérification (OTP) vous sera envoyé par SMS.</p>
          </div>
        </>
      )}

      {step === "code" && (
        <div>
          <p className="mb-3 rounded-xl bg-mint px-3 py-2 text-sm text-brand-dark">
            Code envoyé au <strong>{state?.phone}</strong>.
          </p>
          {state?.devCode && (
            <p className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Mode démonstration (aucune passerelle SMS configurée) — votre code : <strong className="font-mono text-lg">{state.devCode}</strong>
            </p>
          )}
          <label className="label" htmlFor="code">Code à 6 chiffres</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="input text-center font-mono text-xl tracking-[0.4em]" required autoFocus />
        </div>
      )}

      {state?.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <SubmitButton className="btn btn-green w-full py-3">
        {step === "code" ? "Valider et accéder" : "Recevoir mon code"}
      </SubmitButton>

      <p className="text-center text-sm text-slate-600">
        {mode === "login" ? (
          <>Pas encore de compte ? <Link href="/inscription" className="font-semibold text-brand underline">S’inscrire</Link></>
        ) : (
          <>Déjà inscrit ? <Link href="/connexion" className="font-semibold text-brand underline">Se connecter</Link></>
        )}
      </p>
    </form>
  );
}
