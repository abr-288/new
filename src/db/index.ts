import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import v8 from "node:v8";

const databaseUrl = process.env.DATABASE_URL;
const isProd = process.env.NODE_ENV === "production";

if (!databaseUrl && isProd) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __menewaPglite?: PGlite;
};

function connect() {
  if (databaseUrl) {
    const pool = globalForDb.__arenaNextJsPostgresqlPool ?? new Pool({ connectionString: databaseUrl });
    if (!isProd) globalForDb.__arenaNextJsPostgresqlPool = pool;
    return drizzlePg(pool);
  }
  // Développement sans PostgreSQL : base embarquée PGlite stockée dans ./.pglite
  // (schéma créé par `npm run db:dev`). Jamais utilisée en production.
  // Compilation WebAssembly non optimisée : évite un manque de mémoire sur les postes modestes.
  v8.setFlagsFromString("--liftoff-only");
  v8.setFlagsFromString("--no-wasm-tier-up");
  const client = globalForDb.__menewaPglite ?? new PGlite(process.env.PGLITE_DIR || "./.pglite");
  globalForDb.__menewaPglite = client;
  return drizzlePglite(client) as unknown as ReturnType<typeof drizzlePg>;
}

export const db = connect();
