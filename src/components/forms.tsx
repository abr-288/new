"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

export type ActionState = { ok?: string; error?: string } | null;
type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export function SubmitButton({
  children,
  className = "btn btn-green",
  pendingText = "Patientez…",
  title,
}: {
  children: ReactNode;
  className?: string;
  pendingText?: ReactNode;
  /** Nom accessible et info-bulle, indispensable pour un bouton ne contenant qu'une icône. */
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className} title={title} aria-label={title}>
      {pending ? pendingText : children}
    </button>
  );
}

/** Formulaire relié à une Server Action avec retour d'état (succès / erreur) en ligne. */
export function ActionForm({
  action,
  children,
  submit,
  submitTitle,
  pendingText,
  className = "space-y-3",
  btnClass = "btn btn-green",
  hideSubmit = false,
}: {
  action: Action;
  children?: ReactNode;
  submit?: ReactNode;
  submitTitle?: string;
  pendingText?: ReactNode;
  className?: string;
  btnClass?: string;
  hideSubmit?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && (
        <p role="alert" className="col-span-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="col-span-full rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.ok}
        </p>
      )}
      {!hideSubmit && (
        <SubmitButton className={btnClass} title={submitTitle} pendingText={pendingText}>
          {submit ?? "Enregistrer"}
        </SubmitButton>
      )}
    </form>
  );
}
