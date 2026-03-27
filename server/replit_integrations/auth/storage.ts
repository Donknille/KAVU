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
  getUserById(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByVerifyToken(token: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createPasswordUser(user: {
    email: string;
    passwordHash: string;
    firstName?: string | null;
    lastName?: string | null;
    emailVerified?: boolean;
    emailVerifyToken?: string;
    emailVerifyExpires?: Date;
  }): Promise<User>;
  updateUserPassword(id: string, passwordHash: string): Promise<User | undefined>;
  markEmailVerified(id: string): Promise<void>;
  setVerifyToken(id: string, token: string, expires: Date): Promise<void>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  setPasswordResetToken(id: string, token: string, expires: Date): Promise<void>;
  clearPasswordResetToken(id: string): Promise<void>;
  deleteUser(id: string): Promise<boolean>;
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

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByVerifyToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.emailVerifyToken, token));
    return user;
  }

  async createPasswordUser(user: {
    email: string;
    passwordHash: string;
    firstName?: string | null;
    lastName?: string | null;
    emailVerified?: boolean;
    emailVerifyToken?: string;
    emailVerifyExpires?: Date;
  }) {
    const [createdUser] = await db
      .insert(users)
      .values({
        email: normalizeUserEmail(user.email),
        passwordHash: user.passwordHash,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        profileImageUrl: null,
        emailVerified: user.emailVerified ?? false,
        emailVerifyToken: user.emailVerifyToken ?? null,
        emailVerifyExpires: user.emailVerifyExpires ?? null,
      })
      .returning();
    return createdUser;
  }

  async markEmailVerified(id: string): Promise<void> {
    await db.update(users).set({
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyExpires: null,
      updatedAt: new Date(),
    }).where(eq(users.id, id));
  }

  async setVerifyToken(id: string, token: string, expires: Date): Promise<void> {
    await db.update(users).set({
      emailVerifyToken: token,
      emailVerifyExpires: expires,
      updatedAt: new Date(),
    }).where(eq(users.id, id));
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
  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.passwordResetToken, token));
    return user;
  }

  async setPasswordResetToken(id: string, token: string, expires: Date): Promise<void> {
    await db.update(users).set({
      passwordResetToken: token,
      passwordResetExpires: expires,
      updatedAt: new Date(),
    }).where(eq(users.id, id));
  }

  async clearPasswordResetToken(id: string): Promise<void> {
    await db.update(users).set({
      passwordResetToken: null,
      passwordResetExpires: null,
      updatedAt: new Date(),
    }).where(eq(users.id, id));
  }

  async deleteUser(id: string): Promise<boolean> {
    const [deleted] = await db.delete(users).where(eq(users.id, id)).returning();
    return !!deleted;
  }
}

export const authStorage = new AuthStorage();
