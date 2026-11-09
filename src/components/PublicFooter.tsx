import Link from "next/link";
import { Logo } from "@/components/Logo";

const nav = [
  ["Accueil", "/"],
  ["Nos services", "/social-kitchen"],
  ["À propos", "/a-propos"],
  ["Partenaires", "/partenaires"],
  ["Actualités", "/actualites"],
  ["Contact", "/contact"],
];

export function PublicFooter() {
  return (
    <footer className="bg-brand text-white">
      <div className="mx-auto max-w-[1400px] px-4 pt-6 lg:px-9">
        <div className="flex flex-col items-center justify-between gap-5 lg:flex-row">
          <Link href="/" aria-label="Accueil">
            <Logo light size={50} />
          </Link>
          <nav className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-[11px] font-medium" aria-label="Pied de page">
            {nav.map(([l, h]) => (
              <Link key={l} href={h} className="hover:text-sun">{l}</Link>
            ))}
          </nav>
          <div className="flex gap-3" aria-label="Réseaux sociaux">
            {[
              ["f", "Facebook"],
              ["ig", "Instagram"],
              ["in", "LinkedIn"],
              ["▶", "YouTube"],
            ].map(([g, n]) => (
              <a key={n} href="#" aria-label={n} className="grid h-8 w-8 place-items-center rounded-full bg-white text-[11px] font-extrabold text-brand hover:bg-sun">
                {g}
              </a>
            ))}
          </div>
        </div>
        <div className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-white/20 py-4 text-[10px] lg:flex-row">
          <p>© {new Date().getFullYear()} Menewa Naya. Tous droits réservés.</p>
          <p className="flex flex-wrap items-center justify-center gap-x-3">
            <Link href="/legal/mentions-legales" className="hover:text-sun">Mentions légales</Link>
            <span>|</span>
            <Link href="/legal/confidentialite" className="hover:text-sun">Politique de confidentialité</Link>
            <span>|</span>
            <Link href="/legal/conditions" className="hover:text-sun">Conditions d’utilisation</Link>
            <span>|</span>
            <Link href="/aide" className="hover:text-sun">Aide</Link>
          </p>
          <p className="flex items-center gap-2">
            <span aria-hidden className="inline-block h-3 w-5 rounded-sm" style={{ background: "linear-gradient(#1a7a3c 0 20%,#f6d23b 20% 40%,#1a7a3c 40% 60%,#f6d23b 60% 80%,#1a7a3c 80%)" }} />
            Togo <span>|</span> Afrique <span>|</span> Diaspora
          </p>
        </div>
      </div>
      <div className="pattern-strip h-10" />
    </footer>
  );
}
