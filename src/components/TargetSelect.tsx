"use client";

import { useState } from "react";
import type { Target } from "@/lib/targets";

const CUSTOM = "__custom__";

/**
 * Liste déroulante des cibles définies par l'administration (Administration › Cibles).
 * `allowCustom` ajoute « Autre cible (personnalisée) », qui ouvre un champ libre : réservé aux donateurs.
 */
export function TargetSelect({
  name,
  targets,
  allowCustom = false,
  required = false,
  id,
  placeholder = "Choisir une cible",
  customPlaceholder = "Précisez la cible (ex. Famille Mensah)",
  defaultValue = "",
}: {
  name: string;
  targets: Target[];
  allowCustom?: boolean;
  required?: boolean;
  id?: string;
  placeholder?: string;
  customPlaceholder?: string;
  /** Cible pré-sélectionnée (ex. celle choisie dans le catalogue) ; reste modifiable. */
  defaultValue?: string;
}) {
  const known = targets.some((t) => t.label === defaultValue);
  const [value, setValue] = useState(known ? defaultValue : defaultValue && allowCustom ? CUSTOM : "");
  const custom = value === CUSTOM;
  return (
    <div>
      <select
        id={id}
        name={custom ? undefined : name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        required={required}
        className="input"
        aria-label={id ? undefined : "Cible du don"}
      >
        <option value="">{placeholder}</option>
        {targets.map((t) => (
          <option key={t.id} value={t.label} title={t.description || undefined}>
            {t.label}
          </option>
        ))}
        {allowCustom && <option value={CUSTOM}>Autre cible (personnalisée)…</option>}
      </select>
      {custom && (
        <input
          name={name}
          defaultValue={known ? "" : defaultValue}
          className="input mt-2"
          placeholder={customPlaceholder}
          required={required}
          minLength={2}
          maxLength={150}
          autoFocus
          aria-label="Cible personnalisée"
        />
      )}
    </div>
  );
}
