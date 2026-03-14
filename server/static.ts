import express, { type Express } from "express";
import fs from "fs";
import path from "path";

function isStaticAssetRequest(requestPath: string) {
  return path.extname(requestPath) !== "" || requestPath.startsWith("/assets/");
}

function acceptsHtml(acceptHeader: string | undefined) {
  return typeof acceptHeader === "string" && acceptHeader.includes("text/html");
}

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

  // Only SPA-style navigation requests should fall back to index.html.
  app.use("/{*path}", (req, res) => {
    if (isStaticAssetRequest(req.path) || !acceptsHtml(req.headers.accept)) {
      res.status(404).end();
      return;
    }

    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
