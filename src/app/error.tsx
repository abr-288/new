"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-b from-cream to-white px-4 text-center">
      <div>
        <p className="font-hand text-5xl text-sun-dark">Oups…</p>
        <h1 className="mt-2 text-2xl font-bold text-brand-dark">Une erreur est survenue</h1>
        <p className="mt-2 text-sm text-slate-600">Nos équipes ont été informées. Vous pouvez réessayer ou revenir à l’accueil.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={reset} className="btn btn-green">Réessayer</button>
          <a href="/" className="btn btn-outline">Accueil</a>
        </div>
      </div>
    </main>
  );
}
