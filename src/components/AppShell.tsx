"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Bell, LogOut, Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { logoutAction } from "@/app/actions/auth";

export type NavItem = { href: string; label: string; icon: string };

export function AppShell({
  nav,
  userName,
  roleLabel,
  unread,
  children,
  admin,
}: {
  nav: NavItem[];
  userName: string;
  roleLabel: string;
  unread: number;
  children: ReactNode;
  admin: boolean;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (h: string) => (h === "/espace" || h === "/admin" ? path === h : path.startsWith(h));

  const side = (
    <div className="flex h-full flex-col bg-brand-dark text-white">
      <Link href="/" className="block px-5 py-5"><Logo light size={44} /></Link>
      <p className="px-5 pb-2 text-[10px] font-semibold uppercase tracking-widest text-sun">{admin ? "Administration" : "Mon espace"}</p>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4" aria-label="Menu de l'espace">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition ${isActive(n.href) ? "bg-sun text-ink" : "text-white/85 hover:bg-white/10"}`}
          >
            <span aria-hidden className="w-5 text-center">{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="pattern-strip h-4" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block no-print">{side}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72">{side}</div>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur no-print">
          <button className="rounded-lg p-2 lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X /> : <Menu />}
          </button>
          <div className="hidden text-sm text-slate-500 lg:block">{admin ? "Espace d’administration" : "Bienvenue sur Menewa Naya"}</div>
          <div className="flex items-center gap-3">
            <Link href="/espace/notifications" className="relative rounded-full p-2 hover:bg-mint" aria-label="Notifications">
              <Bell size={20} />
              {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unread}</span>}
            </Link>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight">{userName}</p>
              <p className="text-[11px] text-slate-500">{roleLabel}</p>
            </div>
            <form action={logoutAction}>
              <button className="btn btn-outline btn-sm" title="Se déconnecter"><LogOut size={14} /> <span className="hidden sm:inline">Quitter</span></button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
