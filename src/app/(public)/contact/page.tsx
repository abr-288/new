import { Mail, MapPin, Phone } from "lucide-react";
import { contactAction } from "@/app/actions/auth";
import { ActionForm } from "@/components/forms";
import { PageHero } from "@/components/PageHero";

export const metadata = { title: "Contact — Menewa Naya" };

export default function Page() {
  return (
    <>
      <PageHero eyebrow="Contact" title="Écrivez-nous">
        Une question, un partenariat, un besoin ? Notre équipe vous répond.
      </PageHero>
      <div className="mx-auto grid max-w-[1100px] gap-6 px-4 py-10 md:grid-cols-[1fr_300px] lg:px-9">
        <div className="card">
          <ActionForm action={contactAction} submit="Envoyer le message">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label">Nom</label><input name="name" className="input" required /></div>
              <div><label className="label">Téléphone</label><input name="phone" className="input" /></div>
            </div>
            <div><label className="label">E-mail</label><input name="email" type="email" className="input" /></div>
            <div><label className="label">Sujet</label><input name="subject" className="input" required /></div>
            <div><label className="label">Message</label><textarea name="message" rows={5} className="input" required /></div>
          </ActionForm>
        </div>
        <aside className="space-y-3 text-sm">
          <div className="card flex gap-3"><MapPin className="text-brand" /><span>Lomé, Togo<br /><span className="text-xs text-slate-500">Adresse à confirmer</span></span></div>
          <div className="card flex gap-3"><Phone className="text-brand" /><span>+228 90 00 00 00<br /><span className="text-xs text-slate-500">Numéro à confirmer</span></span></div>
          <div className="card flex gap-3"><Mail className="text-brand" /><span>contact@menewa-naya.org<br /><span className="text-xs text-slate-500">Adresse à confirmer</span></span></div>
        </aside>
      </div>
    </>
  );
}
