export function LogoMark({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <circle cx="20" cy="13" r="7" fill="#0b5a3c" />
      <path d="M3 30 C3 19 14 21 20 28 C23 38 19 52 30 59 C12 57 3 46 3 30Z" fill="#0b5a3c" />
      <circle cx="46" cy="12" r="7" fill="#f6b53b" />
      <path d="M44 59 C29 48 27 38 33 32 C37 28 43 30 45 36 C49 28 60 30 60 38 C60 46 52 52 44 59Z" fill="#f6b53b" />
    </svg>
  );
}

export function Logo({ light = false, size = 56 }: { light?: boolean; size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="leading-none">
        <span className={`block text-[28px] font-extrabold tracking-tight ${light ? "text-white" : "text-brand"}`}>Menewa</span>
        <span className={`block pl-3 text-[19px] font-semibold ${light ? "text-sun" : "text-brand"}`}>Naya</span>
        <span className={`mt-0.5 block text-[10px] font-medium ${light ? "text-white/80" : "text-brand"}`}>
          Ensemble, on fait la différence.
        </span>
      </span>
    </span>
  );
}
