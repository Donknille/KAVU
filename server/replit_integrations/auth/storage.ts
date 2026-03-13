import { users, type User, type UpsertUser } from "../../../shared/models/auth.js";
import { db } from "../../db.js";
import { eq } from "drizzle-orm";

function normalizeUserEmail(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createPasswordUser(user: {
    email: string;
    passwordHash: string;
    firstName?: string | null;
    lastName?: string | null;
  }): Promise<User>;
  updateUserPassword(id: string, passwordHash: string): Promise<User | undefined>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const normalizedEmail = normalizeUserEmail(email);
    if (!normalizedEmail) {
      return undefined;
    }

    const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const normalizedUserData = {
      ...userData,
      email: normalizeUserEmail(userData.email),
    };

    const [user] = await db
      .insert(users)
      .values(normalizedUserData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...normalizedUserData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async createPasswordUser(user: {
    email: string;
    passwordHash: string;
    firstName?: string | null;
    lastName?: string | null;
  }) {
    const [createdUser] = await db
      .insert(users)
      .values({
        email: normalizeUserEmail(user.email),
        passwordHash: user.passwordHash,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        profileImageUrl: null,
      })
      .returning();
    return createdUser;
  }

  async updateUserPassword(id: string, passwordHash: string) {
    const [updatedUser] = await db
      .update(users)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }
}

export const authStorage = new AuthStorage();
