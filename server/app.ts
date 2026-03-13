import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { pingDatabase } from "./db.js";
import { PREVIEW_MODE } from "./preview.js";
import { registerRoutes } from "./routes.js";
import { seedDatabase } from "./seed.js";
import { serveStatic } from "./static.js";
import { assertRuntimeConfig, AUTH_PROVIDER } from "./runtimeConfig.js";

assertRuntimeConfig();

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Zu viele Anfragen, bitte warten." },
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Zu viele Anmeldeversuche, bitte warten." },
});

app.use("/api/", apiLimiter);
app.use("/api/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/login/password", authLimiter);
app.use("/api/auth/employee-login", authLimiter);
app.use("/api/setup", authLimiter);

app.use(
  express.json({
    limit: "5mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

app.get("/healthz", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    previewMode: PREVIEW_MODE,
    authProvider: AUTH_PROVIDER,
  });
});

async function getReadinessState() {
  const checks: Array<{ name: string; ok: boolean; detail?: string }> = [];

  if (PREVIEW_MODE) {
    checks.push({ name: "preview", ok: true, detail: "local preview mode" });
  } else {
    try {
      await pingDatabase();
      checks.push({ name: "database", ok: true });
    } catch (error) {
      checks.push({
        name: "database",
        ok: false,
        detail: error instanceof Error ? error.message : "Database ping failed",
      });
    }
  }

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}

app.get("/readyz", async (_req, res) => {
  const readiness = await getReadinessState();
  res.status(readiness.ok ? 200 : 503).json(readiness);
});

app.get("/api/ready", async (_req, res) => {
  const readiness = await getReadinessState();
  res.status(readiness.ok ? 200 : 503).json(readiness);
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const requestPath = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (requestPath.startsWith("/api")) {
      log(`${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

let bootstrapPromise: Promise<void> | null = null;

async function bootstrapApp() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await registerRoutes(httpServer, app);

      try {
        await seedDatabase();
      } catch (error) {
        console.error("Seed error:", error);
      }

      app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";

        console.error("Internal Server Error:", err);

        if (res.headersSent) {
          return next(err);
        }

        return res.status(status).json({ message });
      });

      if (process.env.NODE_ENV === "production") {
        serveStatic(app);
      } else if (!process.env.VERCEL) {
        const { setupVite } = await import("./vite.js");
        await setupVite(httpServer, app);
      }
    })().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  return bootstrapPromise;
}

app.use(async (_req, _res, next) => {
  try {
    await bootstrapApp();
    next();
  } catch (error) {
    next(error);
  }
});

export async function startServer() {
  await bootstrapApp();

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      ...(process.platform === "win32" ? {} : { reusePort: true }),
    },
    () => {
      if (PREVIEW_MODE) {
        log("running in local preview mode");
      }
      log(`auth provider: ${AUTH_PROVIDER}`);
      log(`serving on port ${port}`);
    },
  );
}

export { app, httpServer, bootstrapApp };
export default app;
