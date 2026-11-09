import { AlertCircle, Check, X } from "lucide-react";
import { fdate, REQUEST_STATUS } from "@/lib/format";

type HistoryEntry = { status: string; createdAt: Date | string };
type StepState = "done" | "current" | "pending" | "warn" | "blocked";

// Libellés repris des statuts de demande (REQUEST_STATUS) pour rester cohérents avec le reste de l'interface.
const STEPS = (["submitted", "accepted", "in_progress", "completed", "closed"] as const).map((key) => ({ key, label: REQUEST_STATUS[key].label }));

const REACHED: Record<string, number> = { submitted: 0, info_requested: 0, accepted: 1, in_progress: 2, completed: 3, closed: 4 };

const SR_STATE: Record<StepState, string> = {
  done: "terminé",
  current: "étape actuelle",
  pending: "à venir",
  warn: "en attente d’informations",
  blocked: "interrompu",
};

/** Première date à laquelle la demande a pris ce statut. */
function firstDate(history: HistoryEntry[], status: string) {
  const dates = history.filter((h) => h.status === status).map((h) => new Date(h.createdAt).getTime());
  return dates.length ? new Date(Math.min(...dates)) : null;
}

function computeSteps(status: string, createdAt: Date | string, history: HistoryEntry[], updatedAt?: Date | string) {
  const steps = buildSteps(status, createdAt, history);
  // Étape actuelle sans trace dans l'historique : on affiche la date de dernière mise à jour de la demande.
  const live = steps.find((s) => s.state === "current" || s.state === "warn" || s.state === "blocked");
  if (live && !live.date && updatedAt) live.date = new Date(updatedAt);
  return steps;
}

function buildSteps(status: string, createdAt: Date | string, history: HistoryEntry[]) {
  const steps = STEPS.map((s, i) => ({
    ...s,
    state: "pending" as StepState,
    date: i === 0 ? new Date(createdAt) : firstDate(history, s.key),
    caption: null as string | null,
  }));

  // Demande interrompue (refus, annulation) ou en attente d'informations : l'étape « Confirmé » porte l'état.
  const interrupt: Record<string, [StepState, string]> = {
    info_requested: ["warn", REQUEST_STATUS.info_requested.label],
    rejected: ["blocked", REQUEST_STATUS.rejected.label],
    cancelled: ["blocked", REQUEST_STATUS.cancelled.label],
  };
  if (interrupt[status]) {
    const [state, caption] = interrupt[status];
    steps[0].state = "done";
    steps[1].state = state;
    steps[1].caption = caption;
    steps[1].date = firstDate(history, status);
    return steps;
  }

  const cur = REACHED[status] ?? 0;
  steps.forEach((s, i) => {
    if (i < cur || status === "closed") s.state = "done";
    else if (i === cur) s.state = "current";
    else s.date = null; // pas de date affichée pour une étape non atteinte
  });
  return steps;
}

const reached = (s: StepState) => s !== "pending";

/** Barre de progression d'une demande de don : Demandé → Confirmé → En cours → Remis → Clôturé. */
export function RequestTracker({ status, createdAt, updatedAt, history }: { status: string; createdAt: Date | string; updatedAt?: Date | string; history: HistoryEntry[] }) {
  const steps = computeSteps(status, createdAt, history, updatedAt);

  return (
    <section className="card mb-5 overflow-x-auto bg-[#fffdf8] px-3 py-5 sm:px-6" aria-label="Suivi de la demande">
      <ol className="grid min-w-[440px] grid-cols-5">
        {steps.map((s, i) => {
          const leftOn = reached(s.state);
          const rightOn = i < steps.length - 1 && reached(steps[i + 1].state);
          const isLive = s.state === "current" || s.state === "warn";
          return (
            <li key={s.key} className="relative flex flex-col items-center text-center" aria-current={isLive ? "step" : undefined}>
              {/* segments de liaison, séparés de la pastille par un léger espace */}
              {i > 0 && <span aria-hidden className={`absolute left-0 right-1/2 top-4 ml-1 mr-6 h-0.5 rounded-full ${leftOn ? "bg-brand" : "bg-brand-light/35"}`} />}
              {i < steps.length - 1 && <span aria-hidden className={`absolute left-1/2 right-0 top-4 ml-6 mr-1 h-0.5 rounded-full ${rightOn ? "bg-brand" : "bg-brand-light/35"}`} />}

              <span
                aria-hidden
                className={`relative z-10 grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${
                  s.state === "done"
                    ? "bg-brand text-white"
                    : s.state === "current"
                      ? "bg-sun text-ink ring-4 ring-sun/30"
                      : s.state === "warn"
                        ? "bg-amber-500 text-white ring-4 ring-amber-300/40"
                        : s.state === "blocked"
                          ? "bg-red-600 text-white ring-4 ring-red-200"
                          : "text-xs text-brand"
                }`}
              >
                {s.state === "done" ? <Check size={16} strokeWidth={3} /> : s.state === "blocked" ? <X size={16} strokeWidth={3} /> : s.state === "warn" ? <AlertCircle size={16} strokeWidth={2.5} /> : i + 1}
              </span>

              <span className={`mt-2 text-[11px] font-bold sm:text-sm ${s.state === "blocked" ? "text-red-700" : "text-brand-dark"}`}>
                {s.caption ?? s.label}
              </span>
              <span className="mt-0.5 text-[10px] text-slate-500 sm:text-xs">{s.date ? fdate(s.date) : "—"}</span>
              <span className="sr-only">{`Étape ${i + 1} sur ${steps.length} : ${SR_STATE[s.state]}`}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
