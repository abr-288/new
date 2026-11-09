"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Menu, Search, User, X } from "lucide-react";
import { Logo } from "@/components/Logo";

const links = [
  { href: "/", label: "Accueil" },
  { href: "#services", label: "Nos services", dropdown: true },
  { href: "/a-propos", label: "À propos" },
  { href: "/partenaires", label: "Partenaires" },
  { href: "/actualites", label: "Actualités" },
  { href: "/contact", label: "Contact" },
];

const services = [
  { href: "/social-kitchen", label: "Menewa Social Kitchen", sub: "Faire un don, financer un besoin" },
  { href: "/social-network", label: "Menewa Social Network", sub: "Compétences et services de proximité" },
  { href: "/comment-ca-marche", label: "Comment ça marche", sub: "Les étapes pour agir ensemble" },
];

export function PublicHeader({ userName }: { userName?: string | null }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [dd, setDd] = useState(false);
  const active = (h: string) => (h === "/" ? path === "/" : !h.startsWith("#") && path.startsWith(h));

  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[74px] max-w-[1400px] items-center justify-between gap-4 px-4 lg:px-9">
        <Link href="/" aria-label="Menewa Naya — accueil">
          <Logo size={52} />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Navigation principale">
          {links.map((l) =>
            l.dropdown ? (
              <div key={l.label} className="relative" onMouseEnter={() => setDd(true)} onMouseLeave={() => setDd(false)}>
                <button className="flex items-center gap-1 text-[13px] font-medium text-ink hover:text-brand" onClick={() => setDd(!dd)}>
                  {l.label} <ChevronDown size={14} />
                </button>
                {dd && (
                  <div className="absolute left-0 top-full w-72 pt-3">
                    <div className="rounded-2xl border border-slate-100 bg-white p-2 shadow-xl">
                      {services.map((s) => (
                        <Link key={s.href} href={s.href} onClick={() => setDd(false)} className="block rounded-xl px-3 py-2.5 hover:bg-mint">
                          <span className="block text-sm font-semibold text-brand">{s.label}</span>
                          <span className="block text-xs text-slate-500">{s.sub}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={l.href}
                href={l.href}
                className={`border-b-2 py-1 text-[13px] font-medium transition hover:text-brand ${active(l.href) ? "border-sun text-brand" : "border-transparent text-ink"}`}
              >
                {l.label}
              </Link>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <Link href="/social-kitchen" aria-label="Rechercher" className="text-ink hover:text-brand">
            <Search size={18} />
          </Link>
          {userName ? (
            <Link href="/espace" className="btn btn-yellow btn-sm px-5">
              <User size={15} /> Mon espace
            </Link>
          ) : (
            <>
              <Link href="/connexion" className="btn btn-yellow btn-sm px-5">
                <User size={15} /> Se connecter
              </Link>
              <Link href="/inscription" className="btn btn-green btn-sm px-6">
                S’inscrire
              </Link>
            </>
          )}
        </div>

        <button className="rounded-lg p-2 lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-100 bg-white px-4 pb-5 lg:hidden">
          <nav className="flex flex-col py-2">
            {links
              .filter((l) => !l.dropdown)
              .map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="border-b border-slate-100 py-3 text-sm font-medium">
                  {l.label}
                </Link>
              ))}
            {services.map((s) => (
              <Link key={s.href} href={s.href} onClick={() => setOpen(false)} className="border-b border-slate-100 py-3 pl-4 text-sm text-brand">
                {s.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex gap-2">
            {userName ? (
              <Link href="/espace" className="btn btn-yellow flex-1">Mon espace</Link>
            ) : (
              <>
                <Link href="/connexion" className="btn btn-yellow flex-1">Se connecter</Link>
                <Link href="/inscription" className="btn btn-green flex-1">S’inscrire</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
