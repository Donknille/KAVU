import crypto from "crypto";
import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { isAuthenticated } from "../auth";
import { PREVIEW_MODE } from "../../preview";
import { LOCAL_UPLOADS_DIR, UPLOAD_PROVIDER } from "../../runtimeConfig";

const previewUploads = new Map<
  string,
  { body: Buffer; contentType: string }
>();

function ensureLocalUploadDir() {
  fs.mkdirSync(path.resolve(process.cwd(), LOCAL_UPLOADS_DIR), { recursive: true });
}

function getLocalUploadPaths(uploadId: string) {
  const baseDir = path.resolve(process.cwd(), LOCAL_UPLOADS_DIR);
  return {
    filePath: path.join(baseDir, `${uploadId}.bin`),
    metaPath: path.join(baseDir, `${uploadId}.json`),
  };
}

async function registerPreviewObjectStorageRoutes(app: Express) {
  app.post("/api/uploads/request-url", isAuthenticated, async (req, res) => {
    const { name, size, contentType } = req.body ?? {};
    if (!name) {
      return res.status(400).json({ error: "Missing required field: name" });
    }

    const uploadId = crypto.randomUUID();
    return res.json({
      uploadURL: `/api/uploads/local/${uploadId}`,
      objectPath: `/objects/local/${uploadId}`,
      metadata: { name, size, contentType },
    });
  });

  app.put(
    "/api/uploads/local/:id",
    isAuthenticated,
    express.raw({ type: "*/*", limit: "10mb" }),
    (req, res) => {
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
      const uploadId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      previewUploads.set(uploadId, {
        body,
        contentType: req.headers["content-type"] || "application/octet-stream",
      });
      res.status(200).end();
    },
  );

  app.get("/objects/local/:id", isAuthenticated, (req, res) => {
    const uploadId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const uploaded = previewUploads.get(uploadId);
    if (!uploaded) {
      return res.status(404).json({ error: "Object not found" });
    }

    res.setHeader("Content-Type", uploaded.contentType);
    return res.send(uploaded.body);
  });
}

function registerLocalDiskObjectStorageRoutes(app: Express) {
  ensureLocalUploadDir();

  app.post("/api/uploads/request-url", isAuthenticated, async (req, res) => {
    const { name, size, contentType } = req.body ?? {};
    if (!name) {
      return res.status(400).json({ error: "Missing required field: name" });
    }

    const uploadId = crypto.randomUUID();
    return res.json({
      uploadURL: `/api/uploads/local/${uploadId}`,
      objectPath: `/objects/local/${uploadId}`,
      metadata: { name, size, contentType },
    });
  });

  app.put(
    "/api/uploads/local/:id",
    isAuthenticated,
    express.raw({ type: "*/*", limit: "10mb" }),
    async (req, res) => {
      try {
        const uploadId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
        const { filePath, metaPath } = getLocalUploadPaths(uploadId);

        await fs.promises.writeFile(filePath, body);
        await fs.promises.writeFile(
          metaPath,
          JSON.stringify(
            {
              contentType: req.headers["content-type"] || "application/octet-stream",
            },
            null,
            2,
          ),
          "utf8",
        );

        res.status(200).end();
      } catch (error) {
        console.error("Error writing local upload:", error);
        res.status(500).json({ error: "Failed to store uploaded file" });
      }
    },
  );

  app.get("/objects/local/:id", isAuthenticated, async (req, res) => {
    try {
      const uploadId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { filePath, metaPath } = getLocalUploadPaths(uploadId);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Object not found" });
      }

      let contentType = "application/octet-stream";
      if (fs.existsSync(metaPath)) {
        const metadata = JSON.parse(await fs.promises.readFile(metaPath, "utf8")) as {
          contentType?: string;
        };
        if (metadata.contentType) {
          contentType = metadata.contentType;
        }
      }

      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "private, max-age=3600");
      return res.sendFile(filePath);
    } catch (error) {
      console.error("Error serving local object:", error);
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}

export function registerObjectStorageRoutes(app: Express): void {
  if (PREVIEW_MODE) {
    void registerPreviewObjectStorageRoutes(app);
    return;
  }

  if (UPLOAD_PROVIDER === "local") {
    registerLocalDiskObjectStorageRoutes(app);
    return;
  }

  const objectStorageService = new ObjectStorageService();

  app.post("/api/uploads/request-url", isAuthenticated, async (req, res) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  app.get(/^\/objects\/(.+)$/, isAuthenticated, async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}
