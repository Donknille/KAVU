import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage.js";
import { getPreviewSessionUser, PREVIEW_MODE } from "../../preview.js";
import { pool } from "../../db.js";
import { storage } from "../../storage.js";
import { TtlCache } from "../../ttlCache.js";
import {
  APP_BASE_URL,
  AUTH_PROVIDER,
  COOKIE_SAME_SITE,
  COOKIE_SECURE,
  OIDC_CALLBACK_URL,
  OIDC_CLIENT_AUTH_METHOD,
  OIDC_CLIENT_ID,
  OIDC_CLIENT_SECRET,
  OIDC_ISSUER_URL,
  OIDC_POST_LOGOUT_REDIRECT_URL,
  OIDC_SIGNUP_HINT,
  OIDC_SCOPE,
  TRUST_PROXY,
} from "../../runtimeConfig.js";

declare module "express-session" {
  interface SessionData {
    returnTo?: string;
    localAuth?: {
      userId: string;
      kind: "employee_access" | "password";
    };
  }
}

function getOidcClientAuth() {
  switch (OIDC_CLIENT_AUTH_METHOD) {
    case "none":
      return client.None();
    case "client_secret_post":
      return client.ClientSecretPost(OIDC_CLIENT_SECRET);
    case "client_secret_basic":
    default:
      return client.ClientSecretBasic(OIDC_CLIENT_SECRET);
  }
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

class CachedSessionStore extends session.Store {
  private cache: TtlCache<string, any>;

  constructor(
    private readonly baseStore: session.Store,
    private readonly ttlMs: number,
    maxEntries = 500,
  ) {
    super();
    this.cache = new TtlCache<string, any>(maxEntries);
  }

  override get(sid: string, callback: (error?: any, session?: any | null) => void) {
    const cached = this.cache.get(sid);
    if (cached) {
      callback(undefined, cached);
      return;
    }

    this.baseStore.get(sid, (error, nextSession) => {
      if (!error && nextSession) {
        this.cache.set(sid, nextSession, this.ttlMs);
      }
      callback(error, nextSession);
    });
  }

  override set(sid: string, nextSession: any, callback?: (error?: any) => void) {
    this.baseStore.set(sid, nextSession, (error) => {
      if (!error) {
        this.cache.set(sid, nextSession, this.ttlMs);
      }
      callback?.(error);
    });
  }

  override destroy(sid: string, callback?: (error?: any) => void) {
    this.cache.delete(sid);
    this.baseStore.destroy(sid, callback);
  }

  override touch(sid: string, nextSession: any, callback?: () => void) {
    this.cache.set(sid, nextSession, this.ttlMs);
    if (typeof this.baseStore.touch === "function") {
      this.baseStore.touch(sid, nextSession, callback);
      return;
    }
    callback?.();
  }
}

const localAuthIdentityCache = new TtlCache<
  string,
  { found: boolean; user: ReturnType<typeof buildLocalSessionUser> | null }
>(500);
const localAuthIdentityTtlMs = parsePositiveInt(
  process.env.LOCAL_AUTH_CACHE_TTL_MS,
  5000,
);

export function invalidateLocalAuthIdentity(
  userId: string,
  kind?: "employee_access" | "password",
) {
  if (kind) {
    localAuthIdentityCache.delete(`${kind}:${userId}`);
    return;
  }

  localAuthIdentityCache.delete(`employee_access:${userId}`);
  localAuthIdentityCache.delete(`password:${userId}`);
}

const getOidcConfig = memoize(
  async () => {
    if (AUTH_PROVIDER === "replit") {
      if (!process.env.REPL_ID) {
        throw new Error("REPL_ID is required when AUTH_PROVIDER is set to replit");
      }

      return client.discovery(
        new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
        process.env.REPL_ID,
      );
    }

    if (!OIDC_ISSUER_URL || !OIDC_CLIENT_ID) {
      throw new Error(
        "OIDC_ISSUER_URL and OIDC_CLIENT_ID are required when AUTH_PROVIDER is set to oidc",
      );
    }

    const metadata = OIDC_CLIENT_SECRET
      ? { client_secret: OIDC_CLIENT_SECRET }
      : undefined;

    return client.discovery(
      new URL(OIDC_ISSUER_URL),
      OIDC_CLIENT_ID,
      metadata,
      getOidcClientAuth(),
    );
  },
  { maxAge: 3600 * 1000 },
);

export function getSession() {
  const sessionTtlMs = 7 * 24 * 60 * 60 * 1000;
  const sessionTtlSeconds = Math.floor(sessionTtlMs / 1000);
  const pgStore = connectPg(session);
  const isServerlessRuntime = Boolean(process.env.VERCEL);
  const sessionCacheTtlMs = parsePositiveInt(
    process.env.SESSION_STORE_CACHE_TTL_MS,
    isServerlessRuntime ? 15000 : 5000,
  );

  if (!pool) {
    throw new Error("DATABASE_URL is required to initialize the session store.");
  }

  const baseStore = new pgStore({
    pool,
    createTableIfMissing: !isServerlessRuntime,
    ttl: sessionTtlSeconds,
    tableName: "sessions",
    disableTouch: true,
    pruneSessionInterval: false,
  });
  const sessionStore = new CachedSessionStore(baseStore, sessionCacheTtlMs);

  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: COOKIE_SAME_SITE,
      maxAge: sessionTtlMs,
    },
  });
}

function buildLocalSessionUser(userId: string, kind: "employee_access" | "password") {
  return {
    claims: { sub: userId },
    access_token: `${kind}-local-session`,
    refresh_token: undefined,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    auth_method: kind,
  };
}

async function attachLocalSession(req: any) {
  const localSession = req.session?.localAuth;
  if (!localSession?.userId || req.user) {
    return;
  }

  const cacheKey = `${localSession.kind}:${localSession.userId}`;
  const cachedIdentity = localAuthIdentityCache.get(cacheKey);
  if (cachedIdentity) {
    if (!cachedIdentity.found) {
      delete req.session.localAuth;
      return;
    }

    req.user = cachedIdentity.user;
    req.isAuthenticated = () => true;
    return;
  }

  if (localSession.kind === "employee_access") {
    const employee = await storage.getEmployeeByUserId(localSession.userId);
    if (!employee || !employee.passwordHash || !employee.isActive) {
      localAuthIdentityCache.set(cacheKey, { found: false, user: null }, localAuthIdentityTtlMs);
      delete req.session.localAuth;
      return;
    }

    const localUser = buildLocalSessionUser(localSession.userId, localSession.kind);
    localAuthIdentityCache.set(cacheKey, { found: true, user: localUser }, localAuthIdentityTtlMs);
    req.user = localUser;
    req.isAuthenticated = () => true;
    return;
  }

  const user = await authStorage.getUser(localSession.userId);
  if (!user || !user.email || !user.passwordHash) {
    localAuthIdentityCache.set(cacheKey, { found: false, user: null }, localAuthIdentityTtlMs);
    delete req.session.localAuth;
    return;
  }

  const localUser = buildLocalSessionUser(localSession.userId, localSession.kind);
  localAuthIdentityCache.set(cacheKey, { found: true, user: localUser }, localAuthIdentityTtlMs);
  req.user = localUser;
  req.isAuthenticated = () => true;
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await authStorage.upsertUser({
    id: claims.sub,
    email: claims.email,
    firstName: claims.first_name,
    lastName: claims.last_name,
    profileImageUrl: claims.profile_image_url,
  });
}

function getGenericCallbackUrl() {
  if (OIDC_CALLBACK_URL) {
    return OIDC_CALLBACK_URL;
  }

  if (APP_BASE_URL) {
    return `${APP_BASE_URL}/api/callback`;
  }

  throw new Error(
    "OIDC_CALLBACK_URL or APP_BASE_URL is required when AUTH_PROVIDER is set to oidc",
  );
}

function getLocalAuthUserId() {
  return process.env.LOCAL_AUTH_USER_ID?.trim() || "local-admin-user";
}

function getLocalAuthClaims() {
  return {
    sub: getLocalAuthUserId(),
    email: process.env.LOCAL_AUTH_EMAIL?.trim() || "local-admin@kavu.local",
    first_name: process.env.LOCAL_AUTH_FIRST_NAME?.trim() || "Local",
    last_name: process.env.LOCAL_AUTH_LAST_NAME?.trim() || "Admin",
    profile_image_url: null,
  };
}

function getSafeNextPath(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  return value.startsWith("/") && !value.startsWith("//") ? value : undefined;
}

function getNextPathFromRequest(req: any) {
  return getSafeNextPath(req.query?.next);
}

function rememberReturnTo(req: any) {
  const nextPath = getNextPathFromRequest(req);
  if (nextPath && req.session) {
    req.session.returnTo = nextPath;
  }
  return nextPath;
}

export async function setupAuth(app: Express) {
  if (PREVIEW_MODE) {
    app.use("/api", (req: any, _res, next) => {
      req.user = getPreviewSessionUser();
      req.isAuthenticated = () => true;
      req.logout = (cb?: () => void) => cb?.();
      next();
    });

    app.get("/api/login", (req: any, res) => {
      res.redirect(getNextPathFromRequest(req) ?? "/");
    });

    app.get("/api/signup", (req: any, res) => {
      res.redirect(getNextPathFromRequest(req) ?? "/");
    });

    app.get("/api/callback", (_req, res) => {
      res.redirect("/");
    });

    app.get("/api/logout", (_req, res) => {
      res.redirect("/");
    });

    return;
  }

  app.set("trust proxy", TRUST_PROXY ? 1 : 0);
  app.use("/api", getSession());

  if (AUTH_PROVIDER === "local") {
    app.use("/api", async (req: any, _res, next) => {
      try {
        const claims = getLocalAuthClaims();
        await upsertUser(claims);
        req.user = {
          claims: { sub: claims.sub },
          access_token: "local-access-token",
          refresh_token: "local-refresh-token",
          expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
        };
        req.isAuthenticated = () => true;
        req.logout = (cb?: () => void) => cb?.();
        next();
      } catch (error) {
        next(error);
      }
    });

    app.get("/api/login", (req: any, res) => {
      res.redirect(getNextPathFromRequest(req) ?? "/");
    });

    app.get("/api/signup", (req: any, res) => {
      res.redirect(getNextPathFromRequest(req) ?? "/");
    });

    app.get("/api/callback", (_req, res) => {
      res.redirect("/");
    });

    app.get("/api/logout", (_req, res) => {
      res.redirect("/");
    });

    return;
  }

  if (AUTH_PROVIDER === "app") {
    app.use("/api", async (req: any, _res, next) => {
      try {
        await attachLocalSession(req);
        next();
      } catch (error) {
        next(error);
      }
    });

    app.get("/api/login", (req: any, res) => {
      res.redirect(getNextPathFromRequest(req) ?? "/");
    });

    app.get("/api/signup", (req: any, res) => {
      res.redirect(getNextPathFromRequest(req) ?? "/");
    });

    app.get("/api/callback", (_req, res) => {
      res.redirect("/");
    });

    app.get("/api/logout", (req: any, res) => {
      if (req.session?.localAuth) {
        return req.session.destroy(() => {
          res.redirect("/");
        });
      }

      return res.redirect("/");
    });

    return;
  }

  app.use("/api", passport.initialize());
  app.use("/api", passport.session());
  app.use("/api", async (req: any, _res, next) => {
    try {
      await attachLocalSession(req);
      next();
    } catch (error) {
      next(error);
    }
  });

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback,
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  if (AUTH_PROVIDER === "replit") {
    const config = await getOidcConfig();
    const registeredStrategies = new Set<string>();

    const ensureStrategy = (domain: string) => {
      const strategyName = `replitauth:${domain}`;
      if (!registeredStrategies.has(strategyName)) {
        const strategy = new Strategy(
          {
            name: strategyName,
            config,
            scope: "openid email profile offline_access",
            callbackURL: `https://${domain}/api/callback`,
          },
          verify,
        );
        passport.use(strategy);
        registeredStrategies.add(strategyName);
      }
    };

    app.get("/api/login", (req, res, next) => {
      rememberReturnTo(req);
      ensureStrategy(req.hostname);
      passport.authenticate(`replitauth:${req.hostname}`, {
        prompt: "login consent",
        scope: ["openid", "email", "profile", "offline_access"],
      })(req, res, next);
    });

    app.get("/api/signup", (req: any, res) => {
      const nextPath = getNextPathFromRequest(req);
      res.redirect(nextPath ? `/api/login?next=${encodeURIComponent(nextPath)}` : "/api/login");
    });

    app.get("/api/callback", (req, res, next) => {
      ensureStrategy(req.hostname);
      passport.authenticate(`replitauth:${req.hostname}`, {
        successReturnToOrRedirect: "/",
        failureRedirect: "/api/login",
      })(req, res, next);
    });

    app.get("/api/logout", (req, res) => {
      if (req.session?.localAuth) {
        return req.session.destroy(() => {
          res.redirect("/");
        });
      }

      req.logout(() => {
        res.redirect(
          client.buildEndSessionUrl(config, {
            client_id: process.env.REPL_ID!,
            post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
          }).href,
        );
      });
    });

    return;
  }

  const config = await getOidcConfig();
  const strategyName = "oidc";
  const oidcScope = OIDC_SCOPE.split(/\s+/).filter(Boolean);

  passport.use(
    strategyName,
    new Strategy(
      {
        name: strategyName,
        config,
        scope: OIDC_SCOPE,
        callbackURL: getGenericCallbackUrl(),
      },
      verify,
    ),
  );

  app.get("/api/login", (req, res, next) => {
    rememberReturnTo(req);
    passport.authenticate(strategyName, {
      prompt: "login",
      scope: oidcScope,
    })(req, res, next);
  });

  app.get("/api/signup", (req, res, next) => {
    rememberReturnTo(req);
    const authOptions = {
      prompt: "login",
      scope: oidcScope,
      ...(OIDC_SIGNUP_HINT ? { screen_hint: OIDC_SIGNUP_HINT } : {}),
    };

    passport.authenticate(strategyName, authOptions)(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(strategyName, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    if (req.session?.localAuth) {
      return req.session.destroy(() => {
        res.redirect("/");
      });
    }

    req.logout(() => {
      res.redirect(OIDC_POST_LOGOUT_REDIRECT_URL);
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (PREVIEW_MODE) {
    (req as any).user = getPreviewSessionUser();
    return next();
  }

  const user = req.user as any;

  const isAuth = typeof req.isAuthenticated === "function" ? req.isAuthenticated() : false;
  if (!isAuth || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch {
    return res.status(401).json({ message: "Unauthorized" });
  }
};
