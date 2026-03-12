import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";
import { getPreviewSessionUser, PREVIEW_MODE } from "../../preview";
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
} from "../../runtimeConfig";

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
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: COOKIE_SAME_SITE,
      maxAge: sessionTtl,
    },
  });
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
    app.use((req: any, _res, next) => {
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

  if (AUTH_PROVIDER === "local") {
    app.use(async (req: any, _res, next) => {
      try {
        const claims = getLocalAuthClaims();
        await upsertUser(claims);
        req.user = {
          claims: { sub: claims.sub },
          access_token: "local-access-token",
          refresh_token: "local-refresh-token",
          expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
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

  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

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

  if (!req.isAuthenticated() || !user?.expires_at) {
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
