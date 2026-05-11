// Sentry must initialize before any other import so its HTTP and
// performance integrations can instrument modules at load time.
// This file is imported at the very top of server.ts and server/index.ts.
import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
        if (event.request.data && typeof event.request.data === "object") {
          const data = event.request.data as Record<string, unknown>;
          if ("password" in data) data.password = "[REDACTED]";
          if ("currentPassword" in data) data.currentPassword = "[REDACTED]";
          if ("newPassword" in data) data.newPassword = "[REDACTED]";
          if ("token" in data) data.token = "[REDACTED]";
        }
      }
      return event;
    },
  });
}

export { Sentry };
