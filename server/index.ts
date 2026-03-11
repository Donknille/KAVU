import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase } from "./seed";
import { PREVIEW_MODE } from "./preview";
import {
  assertRuntimeConfig,
  AUTH_PROVIDER,
  LOCAL_UPLOADS_DIR,
  UPLOAD_PROVIDER,
} from "./runtimeConfig";
import { pingDatabase } from "./db";

// Sicherstellen, dass alle nötigen Umgebungsvariablen da sind
assertRuntimeConfig();

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Sicherheits-Header (CSP deaktiviert für einfacheres Deployment)
app.use(helmet({
  contentSecurityPolicy: false,
}));

// Rate Limiting: Verhindert, dass der Server überlastet wird
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

// Health-Checks für Render.com
app.get("/healthz", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    previewMode: PREVIEW_MODE,
    authProvider: AUTH_PROVIDER,
    uploadProvider: UPLOAD_PROVIDER,
  });
});

// Prüft, ob Datenbank und Upload-Ordner bereit sind
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

    if (UPLOAD_PROVIDER === "local") {
      try {
        const uploadDir = path.resolve(process.cwd(), LOCAL_UPLOADS_DIR);
        await fsp.mkdir(uploadDir, { recursive: true });
        await fsp.access(uploadDir, fs.constants.W_OK);
        checks.push({ name: "uploads", ok: true, detail: uploadDir });
      } catch (error) {
        checks.push({
          name: "uploads",
          ok: false,
          detail: error instanceof Error ? error.message : "Upload directory is not writable",
        });
      }
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

// Hilfsfunktion für saubere Logs
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Logging-Middleware für API-Anfragen
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

// Haupt-Startsequenz
(async () => {
  // Routen registrieren
  await registerRoutes(httpServer, app);

  // Datenbank mit Startdaten befüllen (Seed)
  try {
    await seedDatabase();
  } catch (err) {
    console.error("Seed error:", err);
  }

  // Zentraler Fehler-Handler
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // Frontend ausliefern: In Produktion statisch, sonst via Vite (Development)
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Den Server auf dem von Render zugewiesenen Port starten
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
      log(`auth provider: ${AUTH_PROVIDER}, upload provider: ${UPLOAD_PROVIDER}`);
      log(`serving on port ${port}`);
    },
  );
})();
