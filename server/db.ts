import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
const isServerlessRuntime = Boolean(process.env.VERCEL);

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const databasePoolMax = parsePositiveInt(process.env.DATABASE_POOL_MAX, isServerlessRuntime ? 1 : 3);
const databaseIdleTimeoutMs = parsePositiveInt(
  process.env.DATABASE_IDLE_TIMEOUT_MS,
  isServerlessRuntime ? 5000 : 10000,
);
const databaseConnectTimeoutMs = parsePositiveInt(
  process.env.DATABASE_CONNECT_TIMEOUT_MS,
  5000,
);
const databaseMaxUses = parsePositiveInt(process.env.DATABASE_MAX_USES, 7500);

export const hasDatabaseConnection = Boolean(connectionString);

if (!connectionString) {
  console.log("WARNUNG: DATABASE_URL fehlt in den Umgebungsvariablen!");
}

export const pool = connectionString
  ? new Pool({
      connectionString,
      // Kleine, begrenzte Pools vermeiden Überlastung im Supabase Session Pooler.
      max: databasePoolMax,
      idleTimeoutMillis: databaseIdleTimeoutMs,
      connectionTimeoutMillis: databaseConnectTimeoutMs,
      maxUses: databaseMaxUses,
      allowExitOnIdle: isServerlessRuntime,
    })
  : (null as unknown as pg.Pool);

export const db = connectionString
  ? drizzle(pool, { schema })
  : (null as unknown as ReturnType<typeof drizzle>);

export async function pingDatabase() {
  if (!hasDatabaseConnection || !pool) {
    throw new Error("Datenbank-Verbindung ist nicht konfiguriert (DATABASE_URL fehlt).");
  }

  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Datenbank-Ping fehlgeschlagen:", error);
    throw error;
  }
}
