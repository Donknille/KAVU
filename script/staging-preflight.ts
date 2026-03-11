import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { hasDatabaseConnection, pingDatabase } from "../server/db.ts";
import {
  APP_BASE_URL,
  AUTH_PROVIDER,
  COOKIE_SECURE,
  getRuntimeConfigIssues,
  LOCAL_UPLOADS_DIR,
  TRUST_PROXY,
  UPLOAD_PROVIDER,
} from "../server/runtimeConfig.ts";
import { PREVIEW_MODE } from "../server/preview.ts";

async function main() {
  const issues = getRuntimeConfigIssues();
  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");

  console.log("KAVU staging preflight");
  console.log(`previewMode=${PREVIEW_MODE}`);
  console.log(`authProvider=${AUTH_PROVIDER}`);
  console.log(`uploadProvider=${UPLOAD_PROVIDER}`);
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

  if (UPLOAD_PROVIDER === "local") {
    const uploadDir = path.resolve(process.cwd(), LOCAL_UPLOADS_DIR);
    await fsp.mkdir(uploadDir, { recursive: true });
    await fsp.access(uploadDir, fs.constants.W_OK);
    console.log(`uploads writable: ${uploadDir}`);
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
