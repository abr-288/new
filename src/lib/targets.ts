import { getSetting } from "@/lib/settings";

/** Cible de don proposée aux donateurs (famille, école…), gérée dans Administration › Cibles. */
export type Target = { id: string; label: string; description: string; active: boolean };

export const TARGETS_KEY = "catalog.targets";

function isTarget(t: unknown): t is Target {
  return !!t && typeof t === "object" && typeof (t as Target).id === "string" && typeof (t as Target).label === "string";
}

export async function getTargets(): Promise<Target[]> {
  const v = await getSetting<unknown>(TARGETS_KEY);
  if (!Array.isArray(v)) return [];
  return v.filter(isTarget).map((t) => ({ id: t.id, label: t.label, description: t.description ?? "", active: t.active !== false }));
}

export const targetId = (label: string) =>
  label.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now().toString(36);
