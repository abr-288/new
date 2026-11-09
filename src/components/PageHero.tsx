import type { ReactNode } from "react";

export function PageHero({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-r from-mint via-white to-cream">
      <div className="mx-auto max-w-[1100px] px-4 py-12 lg:px-9">
        {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand">{eyebrow}</p>}
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-brand-dark sm:text-4xl">{title}</h1>
        {children && <div className="mt-3 max-w-2xl text-[15px] text-slate-700">{children}</div>}
      </div>
      <div className="pattern-strip h-3" />
    </section>
  );
}
