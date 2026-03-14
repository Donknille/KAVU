import express, { type Express } from "express";
import fs from "fs";
import path from "path";

type ViteManifestEntry = {
  file?: string;
  css?: string[];
  isEntry?: boolean;
};

type ViteManifest = Record<string, ViteManifestEntry>;

function isStaticAssetRequest(requestPath: string) {
  return path.extname(requestPath) !== "" || requestPath.startsWith("/assets/");
}

function acceptsHtml(acceptHeader: string | undefined) {
  return typeof acceptHeader === "string" && acceptHeader.includes("text/html");
}

function loadViteManifest(distPath: string): ViteManifest | null {
  const manifestPath = path.resolve(distPath, ".vite", "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as ViteManifest;
}

function findMainEntryAsset(distPath: string, requestPath: string, manifest: ViteManifest | null) {
  if (!requestPath.startsWith("/assets/") || !manifest) {
    return null;
  }

  const assetPath = requestPath.replace(/^\/+/, "");
  const requestedExt = path.extname(assetPath);
  const mainEntry =
    manifest["src/main.tsx"] ??
    Object.values(manifest).find((entry) => entry.isEntry && entry.file?.startsWith("assets/"));

  if (!mainEntry) {
    return null;
  }

  if (requestedExt === ".js" && mainEntry.file) {
    return path.resolve(distPath, mainEntry.file);
  }

  if (requestedExt === ".css" && mainEntry.css?.[0]) {
    return path.resolve(distPath, mainEntry.css[0]);
  }

  return null;
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

  const manifest = loadViteManifest(distPath);

  app.use(
    express.static(distPath, {
      setHeaders: (res, filePath) => {
        const basename = path.basename(filePath);
        if (
          basename === "service-worker.js" ||
          basename === "manifest.webmanifest" ||
          basename === "index.html"
        ) {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }),
  );

  app.use("/assets", (req, res, next) => {
    const fallbackPath = findMainEntryAsset(distPath, `/assets${req.path}`, manifest);

    if (!fallbackPath || !fs.existsSync(fallbackPath)) {
      next();
      return;
    }

    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(fallbackPath);
  });

  // Only SPA-style navigation requests should fall back to index.html.
  app.use("/{*path}", (req, res) => {
    if (isStaticAssetRequest(req.path) || !acceptsHtml(req.headers.accept)) {
      res.status(404).end();
      return;
    }

    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
