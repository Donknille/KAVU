import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
// WICHTIG: Die Endung .ts beim Import entfernen, damit Node/TypeScript keine Probleme bekommt
import * as schema from "../shared/schema";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

// Prüfung, ob die URL überhaupt da ist
export const hasDatabaseConnection = Boolean(connectionString);

if (!connectionString) {
  console.log("WARNUNG: DATABASE_URL fehlt in den Umgebungsvariablen!");
}

export const pool = connectionString
  ? new Pool({ 
      connectionString,
      // Hilft gegen Verbindungsabbrüche bei Cloud-Datenbanken (wie Supabase)
      connectionTimeoutMillis: 5000 
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
      client.release(); // Verbindung immer wieder freigeben!
    }
  } catch (error) {
    console.error("Datenbank-Ping fehlgeschlagen:", error);
    throw error;
  }
}
