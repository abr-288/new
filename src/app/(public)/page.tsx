import Link from "next/link";
import {
  ArrowRight, BookOpen, Building2, CreditCard, Globe, HandHeart, Handshake, Heart, Landmark, Leaf,
  Network, Search, TrendingUp, User, Users,
} from "lucide-react";
import { ensureSeed } from "@/lib/seed";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

function Corner({ className = "" }: { className?: string }) {
  return (
    <>
      <div className={`absolute bg-sun [clip-path:polygon(100%_0,100%_100%,0_100%)] ${className}`} />
      <div className={`pattern-strip absolute [clip-path:polygon(100%_28%,100%_100%,28%_100%)] ${className}`} />
    </>
  );
}

function Hand({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`font-hand leading-[1.05] ${className}`}>
      {children}
      <svg viewBox="0 0 160 10" className="mt-1 h-2 w-36" aria-hidden>
        <path d="M2 7 C40 1 100 1 158 3" stroke="#f6b53b" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
    </p>
  );
}

export default async function Home() {
  await ensureSeed();
  const stats = await getSetting<{ beneficiaries: string; partners: string; gifts: string; members: string }>("public.stats");

  return (
    <>
      {/* HERO */}
      <section className="relative isolate overflow-hidden bg-[#fffdf8]">
        <img src="/images/hero.jpg" alt="Une femme togolaise souriante en tenue wax" className="absolute inset-y-0 right-0 -z-10 h-full w-full object-cover object-[60%_25%] lg:w-[68%]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#fffdf8] via-[#fffdf8]/85 to-[#fffdf8]/10 lg:via-[#fffdf8]/60 lg:to-transparent" />
        <div className="absolute inset-y-0 right-0 -z-10 hidden w-1/3 bg-gradient-to-l from-black/35 to-transparent lg:block" />
        <div className="mx-auto flex min-h-[340px] max-w-[1400px] items-center px-4 py-10 lg:px-9">
          <div className="max-w-[520px]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-dark">
              Solidarité <span className="mx-2">•</span> Partage <span className="mx-2">•</span> Impact
            </p>
            <h1 className="mt-5 text-[40px] font-extrabold leading-[1.05] tracking-tight text-[#1c3a2c] sm:text-5xl">
              Ensemble,<br />on fait la différence.
            </h1>
            <p className="mt-5 max-w-md text-[13.5px] leading-relaxed text-ink">
              Menewa est une <strong>plateforme solidaire</strong> qui connecte les personnes, les compétences et les ressources pour répondre aux besoins concrets des communautés du Togo, d’Afrique et de la diaspora.
            </p>
            <Link href="/a-propos" className="btn btn-yellow btn-sm mt-6 px-6 py-2.5">
              Découvrir Menewa <ArrowRight size={14} />
            </Link>
          </div>
          <Hand className="absolute right-[4%] top-[18%] hidden rotate-[-7deg] text-[28px] font-medium text-white drop-shadow-lg lg:block">
            Plus de solidarité,<br />plus d’opportunités,<br />plus d’impact.
          </Hand>
        </div>
        <Corner className="bottom-0 right-0 h-24 w-72 lg:h-28 lg:w-80" />
      </section>

      {/* DEUX UNIVERS */}
      <section className="mx-auto grid max-w-[1400px] gap-5 px-4 py-5 lg:grid-cols-2 lg:px-7">
        <article className="relative isolate flex min-h-[232px] overflow-hidden rounded-2xl bg-gradient-to-r from-[#e3f1e8] to-[#f3faf5] p-6">
          <img src="/images/kitchen.jpg" alt="Un enfant souriant tenant un bol de nourriture" className="absolute inset-y-0 right-0 -z-10 h-full w-[46%] object-cover object-[center_30%]" />
          <div className="absolute inset-y-0 right-0 -z-10 w-[46%] bg-gradient-to-r from-[#f3faf5] via-[#f3faf5]/30 to-transparent" />
          <div className="flex gap-4">
            <span className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-full bg-brand text-sun"><HandHeart size={38} /></span>
            <div className="max-w-[300px]">
              <h2 className="text-[26px] font-bold leading-[1.1] text-brand-dark">Menewa<br /><span className="text-brand">Social Kitchen</span></h2>
              <p className="mt-3 text-[13px] font-bold italic text-brand">Le don qui devient action.</p>
              <p className="mt-3 text-[12.5px] leading-relaxed">Faites un don, financez un besoin, contribuez à des projets solidaires et suivez l’impact de votre engagement.</p>
              <Link href="/social-kitchen" className="btn btn-green btn-sm mt-4 px-6">Faire un don <ArrowRight size={14} /></Link>
            </div>
          </div>
          <Corner className="bottom-0 right-0 h-20 w-28" />
        </article>

        <article className="relative isolate flex min-h-[232px] overflow-hidden rounded-2xl bg-gradient-to-r from-[#fff3d6] to-[#fffaf0] p-6">
          <img src="/images/network.jpg" alt="Un homme travaillant sur ordinateur portable" className="absolute inset-y-0 right-0 -z-10 h-full w-[40%] object-cover object-[center_20%]" />
          <div className="absolute inset-y-0 right-0 -z-10 w-[40%] bg-gradient-to-r from-[#fffaf0] via-[#fffaf0]/30 to-transparent" />
          <div className="flex gap-4">
            <span className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-full bg-sun text-brand-dark"><Users size={38} /></span>
            <div className="max-w-[320px]">
              <h2 className="text-[26px] font-bold leading-[1.1] text-brand-dark">Menewa<br /><span className="text-brand">Social Network</span></h2>
              <p className="mt-3 text-[13px] font-bold italic leading-snug text-brand">Vos compétences,<br />au service des autres.</p>
              <p className="mt-3 text-[12.5px] leading-relaxed">Proposez vos compétences, trouvez une personne ou une organisation pour répondre à un besoin.</p>
              <Link href="/social-network" className="btn btn-yellow btn-sm mt-4 px-6">Rejoindre le réseau <ArrowRight size={14} /></Link>
            </div>
          </div>
          <Corner className="bottom-0 right-0 h-20 w-28" />
        </article>
      </section>

      {/* CHIFFRES */}
      <section className="mx-auto max-w-[1400px] px-4 lg:px-7">
        <div className="grid items-center gap-4 rounded-2xl bg-[#e9f3ed] px-6 py-5 sm:grid-cols-2 lg:grid-cols-[repeat(4,1fr)_1.2fr]">
          {[
            [Users, stats.beneficiaries, "Bénéficiaires soutenus"],
            [Handshake, stats.partners, "Partenaires engagés"],
            [Heart, stats.gifts, "Dons et contributions"],
            [Network, stats.members, "Membres sur le réseau"],
          ].map(([I, v, l], i) => {
            const Icon = I as typeof Users;
            return (
              <div key={i} className="flex items-center gap-3 lg:border-r lg:border-brand/15">
                <Icon size={40} className="text-brand" strokeWidth={1.8} />
                <div>
                  <p className="text-xl font-bold text-brand-dark">{v as string}</p>
                  <p className="text-[11px] text-slate-600">{l as string}</p>
                </div>
              </div>
            );
          })}
          <Hand className="rotate-[-4deg] text-center text-[22px] font-medium text-brand-dark">Des actions concrètes<br />pour un impact durable.</Hand>
        </div>
      </section>

      {/* PARTENAIRES */}
      <section className="relative mx-auto mt-6 max-w-[1400px] px-4 py-6 lg:px-9">
        <div className="grid items-center gap-6 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <p className="text-xs font-semibold text-brand-dark">Nos partenaires</p>
            <h2 className="mt-1 text-2xl font-bold text-brand-dark">Ensemble pour un plus grand impact</h2>
            <p className="mt-3 max-w-sm text-[12.5px] text-slate-600">Nous collaborons avec des associations, ONG, entreprises, institutions et mécènes qui partagent notre vision.</p>
            <Link href="/partenaires" className="btn btn-green btn-sm mt-5 px-5">Découvrir nos partenaires <ArrowRight size={14} /></Link>
          </div>
          <ul className="grid grid-cols-2 gap-y-4 text-center sm:grid-cols-5">
            {[
              [Leaf, "ONG\nSOLIDAIRE"],
              [Globe, "FONDATION\nAFRIQUE"],
              [Building2, "Entreprises\nengagées"],
              [Landmark, "Gouvernement\ndu Togo"],
              [Users, "Diaspora\nsolidaire"],
            ].map(([I, l], i) => {
              const Icon = I as typeof Users;
              return (
                <li key={i} className="px-2 text-slate-500 sm:border-l sm:border-slate-200 sm:first:border-0">
                  <Icon size={38} className="mx-auto" strokeWidth={1.5} />
                  <p className="mt-2 whitespace-pre-line text-[11px] font-medium leading-tight">{l as string}</p>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="pattern-strip absolute bottom-3 right-0 hidden h-28 w-5 lg:block" aria-hidden />
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section className="mx-auto max-w-[1400px] px-4 pb-10 pt-2 lg:px-9">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-dark">Comment ça marche ?</p>
            <h2 className="mt-1 text-2xl font-bold text-brand-dark">3 étapes pour agir ensemble</h2>
          </div>
          <Link href="/comment-ca-marche" className="hidden items-center gap-2 text-[11px] font-medium text-brand-dark hover:text-brand sm:flex">
            Voir tous les services <ArrowRight size={14} />
          </Link>
        </div>

        <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-0">
          {[
            {
              color: "green", Icon: HandHeart, title: "Menewa Social Kitchen", sub: "Donner, financer, suivre",
              steps: [[Heart, "Choisissez un besoin\nou faites un don"], [CreditCard, "Sélectionnez votre\nmode de contribution"], [TrendingUp, "Suivez l’impact\nde votre action"]],
              cta: "Accéder à la Social Kitchen", href: "/social-kitchen",
            },
            {
              color: "yellow", Icon: Users, title: "Menewa Social Network", sub: "Proposer, chercher, collaborer",
              steps: [[User, "Créez votre profil\n(compétence ou besoin)"], [Search, "Trouvez la bonne\npersonne ou ressource"], [Network, "Échangez, collaborez,\nfaites grandir l’impact"]],
              cta: "Accéder au Social Network", href: "/social-network",
            },
          ].map((col, ci) => (
            <div key={ci} className={ci === 1 ? "lg:border-l lg:border-slate-200 lg:pl-9" : "lg:pr-9"}>
              <div className="flex items-center gap-4">
                <span className={`grid h-16 w-16 place-items-center rounded-full ${col.color === "green" ? "bg-brand text-sun" : "bg-sun text-brand-dark"}`}>
                  <col.Icon size={32} />
                </span>
                <div>
                  <h3 className="text-xl font-bold text-brand-dark">{col.title}</h3>
                  <p className="text-sm font-medium text-brand-dark">{col.sub}</p>
                </div>
              </div>
              <ol className="mt-6 grid grid-cols-3 gap-2">
                {col.steps.map(([I, t], i) => {
                  const Icon = I as typeof Users;
                  return (
                    <li key={i} className="relative flex flex-col items-center px-1 text-center sm:border-r sm:border-slate-200 sm:last:border-0">
                      <span className="relative">
                        <span className={`grid h-14 w-14 place-items-center rounded-full ${col.color === "green" ? "bg-[#e3f1e8] text-brand" : "bg-[#fff0cf] text-sun-dark"}`}>
                          <Icon size={26} />
                        </span>
                        <span className={`absolute -left-4 top-1 grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-white ${col.color === "green" ? "bg-brand" : "bg-sun"}`}>{i + 1}</span>
                      </span>
                      <p className="mt-3 whitespace-pre-line text-[11.5px] leading-snug text-slate-700">{t as string}</p>
                    </li>
                  );
                })}
              </ol>
              <Link href={col.href} className={`btn btn-sm mt-6 px-6 py-3 ${col.color === "green" ? "btn-green" : "btn-yellow"}`}>
                {col.cta} <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* TÉMOIGNAGES */}
      <section className="bg-brand text-white">
        <div className="mx-auto grid max-w-[1400px] lg:grid-cols-[210px_1fr_300px]">
          <img src="/images/man.jpg" alt="Koffi A., partenaire de Menewa" className="hidden h-full min-h-[140px] w-full object-cover object-[center_20%] lg:block" />
          <div className="grid gap-6 px-6 py-6 md:grid-cols-2 md:gap-0">
            <div className="md:pr-8">
              <p className="text-sm font-bold">Ils nous font confiance</p>
              <div className="mt-2 flex gap-3">
                <span className="font-serif text-5xl leading-none text-sun">“</span>
                <div>
                  <p className="text-[11.5px] leading-relaxed text-white/90">Grâce à Menewa, nous avons pu financer la cantine de notre école. C’est un vrai soulagement pour les enfants et pour toute la communauté.</p>
                  <p className="mt-3 text-[11px] font-bold">Koffi A.</p>
                  <p className="text-[10.5px] text-white/80">Association Éducation pour Tous – Lomé</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 md:border-l md:border-white/20 md:pl-8">
              <img src="/images/woman.jpg" alt="Aminata B." className="h-14 w-14 shrink-0 rounded-full border-2 border-sun object-cover" />
              <span className="font-serif text-5xl leading-none text-sun">“</span>
              <div>
                <p className="text-[11.5px] leading-relaxed text-white/90">J’ai trouvé des missions qui correspondent à mes compétences. Menewa m’a permis de mettre mon savoir-faire au service des autres.</p>
                <p className="mt-3 text-[11px] font-bold">Aminata B.</p>
                <p className="text-[10.5px] text-white/80">Membre du réseau – Diaspora</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center bg-sun px-6 py-6 text-brand-dark">
            <Hand className="rotate-[-5deg] text-[26px] font-bold">La solidarité<br />n’a pas de frontières.</Hand>
          </div>
        </div>
      </section>
    </>
  );
}

void BookOpen;
