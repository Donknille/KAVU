import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.ts";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
export const hasDatabaseConnection = Boolean(connectionString);

export const pool = connectionString
  ? new Pool({ connectionString })
  : (null as unknown as pg.Pool);

export const db = connectionString
  ? drizzle(pool, { schema })
  : (null as unknown as ReturnType<typeof drizzle>);

export async function pingDatabase() {
  if (!hasDatabaseConnection) {
    return false;
  }

  await pool.query("select 1");
  return true;
}
