import type { ActionState } from "@/components/forms";

export const str = (fd: FormData, k: string, max = 2000) => String(fd.get(k) ?? "").trim().slice(0, max);
export const int = (fd: FormData, k: string, def = 0) => {
  const n = parseInt(String(fd.get(k) ?? "").replace(/\s/g, ""), 10);
  return Number.isFinite(n) ? n : def;
};
export const fail = (error: string): ActionState => ({ error });
export const done = (ok: string): ActionState => ({ ok });
export const fileOf = (fd: FormData, k: string) => {
  const f = fd.get(k);
  return f instanceof File ? f : null;
};
