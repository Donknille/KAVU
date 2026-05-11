import { eq } from "drizzle-orm";
import { db } from "../../db.js";
import { users } from "../../../shared/models/auth.js";
import { employees } from "../../../shared/schema.js";

export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export function isLocked(lockedUntil: Date | null | undefined): boolean {
  if (!lockedUntil) return false;
  return new Date(lockedUntil) > new Date();
}

function nextLockedUntil(currentAttempts: number): Date | null {
  if (currentAttempts < MAX_FAILED_LOGIN_ATTEMPTS) return null;
  return new Date(Date.now() + LOCKOUT_DURATION_MS);
}

export async function recordUserFailedLogin(userId: string): Promise<void> {
  const [user] = await db
    .select({ failed: users.failedLoginAttempts })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) return;
  const attempts = (user.failed ?? 0) + 1;
  await db
    .update(users)
    .set({
      failedLoginAttempts: attempts,
      lockedUntil: nextLockedUntil(attempts),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function recordUserSuccessfulLogin(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function recordEmployeeFailedLogin(employeeId: string): Promise<void> {
  const [employee] = await db
    .select({ failed: employees.failedLoginAttempts })
    .from(employees)
    .where(eq(employees.id, employeeId));
  if (!employee) return;
  const attempts = (employee.failed ?? 0) + 1;
  await db
    .update(employees)
    .set({
      failedLoginAttempts: attempts,
      lockedUntil: nextLockedUntil(attempts),
      updatedAt: new Date(),
    })
    .where(eq(employees.id, employeeId));
}

export async function recordEmployeeSuccessfulLogin(employeeId: string): Promise<void> {
  await db
    .update(employees)
    .set({
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(employees.id, employeeId));
}

/** Ensure a minimum response time. Mitigates timing side channels that would
 *  reveal whether the lockout path or a real password check executed. */
export async function ensureMinResponseTime(startMs: number, minMs = 200): Promise<void> {
  const elapsed = Date.now() - startMs;
  if (elapsed < minMs) {
    await new Promise((resolve) => setTimeout(resolve, minMs - elapsed));
  }
}
