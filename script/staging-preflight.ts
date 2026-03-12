import { hasDatabaseConnection, pingDatabase } from "../server/db.ts";
import {
  APP_BASE_URL,
  AUTH_PROVIDER,
  COOKIE_SECURE,
  getRuntimeConfigIssues,
  INVITATION_EMAIL_FROM,
  INVITATION_EMAIL_PROVIDER,
  INVITATION_EMAIL_REPLY_TO,
  TRUST_PROXY,
} from "../server/runtimeConfig.ts";
import { PREVIEW_MODE } from "../server/preview.ts";

async function main() {
  const issues = getRuntimeConfigIssues();
  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");

  console.log("KAVU staging preflight");
  console.log(`previewMode=${PREVIEW_MODE}`);
  console.log(`authProvider=${AUTH_PROVIDER}`);
  console.log(`invitationEmailProvider=${INVITATION_EMAIL_PROVIDER}`);
  console.log(`invitationEmailFrom=${INVITATION_EMAIL_FROM ?? "-"}`);
  console.log(`invitationEmailReplyTo=${INVITATION_EMAIL_REPLY_TO ?? "-"}`);
  console.log(`appBaseUrl=${APP_BASE_URL ?? "-"}`);
  console.log(`trustProxy=${TRUST_PROXY}`);
  console.log(`cookieSecure=${COOKIE_SECURE}`);

  if (PREVIEW_MODE) {
    console.error(
      "\nPreview mode is still active. Disable LOCAL_PREVIEW and provide real staging env vars before running the staging preflight."
    );
    process.exitCode = 1;
    return;
  }

  if (errors.length > 0) {
    console.error("\nConfiguration errors:");
    for (const issue of errors) {
      console.error(`- ${issue.field}: ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  if (warnings.length > 0) {
    console.warn("\nConfiguration warnings:");
    for (const issue of warnings) {
      console.warn(`- ${issue.field}: ${issue.message}`);
    }
  }

  if (!hasDatabaseConnection) {
    throw new Error("DATABASE_URL is not configured for a real staging database.");
  }

  await pingDatabase();
  console.log("database reachable");
  console.log("preflight passed");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
