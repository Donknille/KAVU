import { sql } from "drizzle-orm";
import { db } from "../db.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface TenantContext {
  companyId: string;
  userId?: string | null;
}

/**
 * Run a callback in a transaction with Postgres GUC variables set so that
 * future RLS policies can read them via `app.current_company_id()` and
 * `app.current_user_id()`.
 *
 * The `set_config(..., true)` form is transaction-local, so every query the
 * callback issues against `tx` (not `db`!) sees the tenant context and the
 * setting is automatically discarded when the transaction ends.
 *
 * STATUS: pilot. Not yet wired into every storage method. Only methods that
 * explicitly call this helper are tenant-context aware. See
 * docs/implementation-plan.md T-103 for the migration plan.
 */
export async function withTenantContext<T>(
  context: TenantContext,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.current_company_id', ${context.companyId}, true)`,
    );
    if (context.userId) {
      await tx.execute(
        sql`SELECT set_config('app.current_user_id', ${context.userId}, true)`,
      );
    }
    return fn(tx);
  });
}
