import { notFound } from "next/navigation";
import { RequestTracker } from "@/components/RequestTracker";

// Page d'aperçu TEMPORAIRE (développement uniquement, sans base de données). À supprimer après validation.
export const metadata = { title: "Aperçu — suivi de demande" };

const d = (day: number) => new Date(Date.UTC(2026, 10, day, 10));
const H = (...e: [string, number][]) => e.map(([status, day]) => ({ status, createdAt: d(day) }));

const CASES: { title: string; status: string; history: ReturnType<typeof H> }[] = [
  { title: "Soumise", status: "submitted", history: H(["submitted", 8]) },
  { title: "Infos demandées", status: "info_requested", history: H(["submitted", 8], ["info_requested", 9]) },
  { title: "Acceptée (comme sur la maquette)", status: "accepted", history: H(["submitted", 8], ["accepted", 8]) },
  { title: "En cours", status: "in_progress", history: H(["submitted", 8], ["accepted", 8], ["in_progress", 10]) },
  { title: "Réalisée / remise", status: "completed", history: H(["submitted", 8], ["accepted", 8], ["in_progress", 10], ["completed", 14]) },
  { title: "Clôturée", status: "closed", history: H(["submitted", 8], ["accepted", 8], ["in_progress", 10], ["completed", 14], ["closed", 15]) },
  { title: "Refusée", status: "rejected", history: H(["submitted", 8], ["rejected", 9]) },
  { title: "Annulée", status: "cancelled", history: H(["submitted", 8], ["cancelled", 9]) },
];

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-5xl space-y-6 bg-slate-50 p-4 lg:p-8">
      <h1 className="h-title">Aperçu du suivi de demande</h1>
      {CASES.map((c) => (
        <div key={c.status}>
          <p className="mb-2 text-sm text-slate-600">
            Statut : <strong>{c.title}</strong> · Donateur : <strong>Nouveau membre</strong>
          </p>
          <RequestTracker status={c.status} createdAt={d(8)} history={c.history} />
        </div>
      ))}
    </main>
  );
}
