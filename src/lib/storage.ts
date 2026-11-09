import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Stockage privé hors de /public : l'accès passe obligatoirement par /api/files (contrôle des droits).
const ROOT = process.env.STORAGE_DIR || path.join(process.cwd(), "storage");
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "video/mp4": "mp4",
};

export type Saved = { path: string; name: string; mime: string; size: number };

export async function saveUpload(file: File | null, folder: string): Promise<Saved | { error: string } | null> {
  if (!file || typeof file === "string" || file.size === 0) return null;
  const ext = ALLOWED[file.type];
  if (!ext) return { error: "Format non autorisé (JPG, PNG, WEBP, PDF ou MP4)." };
  if (file.size > MAX_BYTES) return { error: "Fichier trop volumineux (8 Mo maximum)." };
  const dir = path.join(ROOT, folder);
  await fs.mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return { path: `${folder}/${name}`, name: file.name.slice(0, 120), mime: file.type, size: file.size };
}

export async function readStored(rel: string) {
  const full = path.normalize(path.join(ROOT, rel));
  if (!full.startsWith(path.normalize(ROOT))) throw new Error("Chemin invalide");
  return fs.readFile(full);
}
