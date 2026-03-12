export const EMPLOYEES_USER_ID_UNIQUE_INDEX = "uq_employees_user_id";
export const USER_TENANT_CONFLICT_MESSAGE =
  "Dieser Benutzer ist bereits einem Unternehmen zugeordnet.";

export class UserTenantConflictError extends Error {
  constructor(message = USER_TENANT_CONFLICT_MESSAGE) {
    super(message);
    this.name = "UserTenantConflictError";
  }
}

export function isUserTenantConflictError(
  error: unknown,
): error is UserTenantConflictError {
  return error instanceof Error && error.name === "UserTenantConflictError";
}

export function isUniqueConstraintError(error: unknown, constraint: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "constraint" in error &&
    (error as { code?: string }).code === "23505" &&
    (error as { constraint?: string }).constraint === constraint
  );
}

export function isUserTenantConflict(error: unknown) {
  return (
    isUserTenantConflictError(error) ||
    isUniqueConstraintError(error, EMPLOYEES_USER_ID_UNIQUE_INDEX)
  );
}
