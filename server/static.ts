import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const candidatePaths = process.env.VERCEL
    ? [path.resolve(process.cwd(), "public"), path.resolve(process.cwd(), "dist", "public")]
    : [path.resolve(process.cwd(), "dist", "public"), path.resolve(process.cwd(), "public")];
  const distPath = candidatePaths.find((candidate) => fs.existsSync(candidate));

  if (!distPath) {
    throw new Error(
      `Could not find a build directory in ${candidatePaths.join(" or ")}, make sure to build the client first`,
    );
  }

  if (!process.env.VERCEL) {
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          const basename = path.basename(filePath);
          if (basename === "service-worker.js" || basename === "manifest.webmanifest") {
            res.setHeader("Cache-Control", "no-cache");
          }
        },
      }),
    );
  }

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
