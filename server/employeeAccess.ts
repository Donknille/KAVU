import { randomBytes, randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "./passwords.js";

const COMPANY_ACCESS_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function randomFromAlphabet(length: number, alphabet: string) {
  const bytes = randomBytes(length);
  let output = "";

  for (let index = 0; index < length; index += 1) {
    output += alphabet[bytes[index] % alphabet.length];
  }

  return output;
}

function slugifySegment(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

export function normalizeCompanyAccessCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizeEmployeeLoginId(value: string) {
  return slugifySegment(value).slice(0, 80);
}

export function buildEmployeeLoginCandidates(firstName: string, lastName: string, explicit?: string | null) {
  const candidates = new Set<string>();
  const manual = explicit ? normalizeEmployeeLoginId(explicit) : "";
  const first = normalizeEmployeeLoginId(firstName);
  const last = normalizeEmployeeLoginId(lastName);

  if (manual) {
    candidates.add(manual);
  }

  if (first && last) {
    candidates.add(`${first}.${last}`.slice(0, 80));
    candidates.add(`${first}${last}`.slice(0, 80));
    candidates.add(`${first}.${last.slice(0, 1)}`.slice(0, 80));
  }

  if (first) {
    candidates.add(first);
  }

  if (last) {
    candidates.add(last);
  }

  candidates.add(`mitarbeiter.${randomFromAlphabet(4, "23456789abcdefghijklmnopqrstuvwxyz").toLowerCase()}`);
  return [...candidates].filter(Boolean);
}

export function generateCompanyAccessCode() {
  return randomFromAlphabet(8, COMPANY_ACCESS_CODE_ALPHABET);
}

export function generateTemporaryPassword() {
  return randomFromAlphabet(12, TEMP_PASSWORD_ALPHABET);
}

export function createLocalUserId() {
  return randomUUID();
}

export function hashEmployeePassword(password: string) {
  return hashPassword(password);
}

export function verifyEmployeePassword(password: string, passwordHash: string) {
  return verifyPassword(password, passwordHash);
}
