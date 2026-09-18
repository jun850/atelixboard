import {
  createHmac,
  createHash,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;
const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

type Revision = {
  id: string;
  createdAt: string;
  fileName: string;
  fileType: string;
  sha256: string;
  size: number;
};

type DocumentRecord = {
  id: string;
  ownerId: string;
  roomId: string | null;
  title: string;
  sourceType: string;
  currentRevisionId: string;
  createdAt: string;
  updatedAt: string;
  revisions: Revision[];
};

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
};

const readBody = async (req: IncomingMessage, limit = MAX_DOCUMENT_BYTES) => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > limit) {
      throw new Error("DOCUMENT_TOO_LARGE");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
};

const base64Url = (value: string | Buffer) =>
  (typeof value === "string" ? Buffer.from(value) : value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const jwt = (payload: unknown, secret: string) => {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encoded = base64Url(JSON.stringify(payload));
  const signature = base64Url(
    createHmac("sha256", secret).update(`${header}.${encoded}`).digest(),
  );
  return `${header}.${encoded}.${signature}`;
};

const sign = (value: string, secret: string) =>
  createHmac("sha256", secret).update(value).digest("hex");

const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

const extension = (name: string) =>
  path
    .extname(name)
    .slice(1)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const renderPdfPage = (filePath: string, page: number) =>
  new Promise<Buffer>((resolve, reject) => {
    execFile(
      "pdftocairo",
      [
        "-f",
        String(page),
        "-l",
        String(page),
        "-singlefile",
        "-png",
        "-scale-to-x",
        "1200",
        "-scale-to-y",
        "-1",
        filePath,
        "-",
      ],
      { encoding: null, maxBuffer: 12 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      },
    );
  });

export function documentDevApi(env: Record<string, string>): Plugin {
  const root = path.resolve(process.cwd(), "../.boardy-documents");
  const manifestPath = path.join(root, "manifest.json");
  const secret =
    env.DOCUMENT_SERVER_JWT_SECRET || "boardy-local-documents-change-me";
  const publicHost = env.BOARDY_DOCUMENT_PUBLIC_HOST || "host.docker.internal";
  const port = Number(env.VITE_APP_PORT || 3000);
  const documentServerUrl = env.VITE_ONLYOFFICE_URL || "http://localhost:8080";
  const records = new Map<string, DocumentRecord>();
  const sessions = new Map<string, { documentId: string; ownerId: string }>();
  const auth = createClient(
    env.VITE_SUPABASE_URL || "https://invalid.supabase.co",
    env.VITE_SUPABASE_PUBLISHABLE_KEY || "missing",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const persist = async () => {
    await mkdir(root, { recursive: true });
    await writeFile(
      manifestPath,
      JSON.stringify(Array.from(records.values()), null, 2),
      "utf8",
    );
  };

  const initialize = async () => {
    await mkdir(root, { recursive: true });
    try {
      const data = JSON.parse(await readFile(manifestPath, "utf8"));
      if (Array.isArray(data)) {
        data.forEach((record) => records.set(record.id, record));
      }
    } catch (error: any) {
      if (error?.code !== "ENOENT") {
        console.warn("Could not read the local document manifest", error);
      }
    }
  };

  const ready = initialize();
  const revisionPath = (documentId: string, revisionId: string) =>
    path.join(root, documentId, revisionId);

  const authenticate = async (req: IncomingMessage) => {
    if (req.headers["x-boardy-local-demo"] === "1") {
      return "local-demo";
    }
    const configured = Boolean(
      env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY,
    );
    const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!configured) {
      return "local-demo";
    }
    if (!bearer) {
      return null;
    }
    const { data, error } = await auth.auth.getUser(bearer);
    return error ? null : data.user?.id || null;
  };

  const originAllowed = (req: IncomingMessage) => {
    const host = req.headers.host || "";
    return (
      /^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host) &&
      (req.headers.origin === `http://${host}` ||
        (!req.headers.origin &&
          req.headers["sec-fetch-site"] === "same-origin")) &&
      req.headers["x-boardy-local"] === "1"
    );
  };

  return {
    name: "boardy-local-document-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__documents", async (req, res) => {
        await ready;
        const requestUrl = new URL(req.url || "/", "http://local");
        const parts = requestUrl.pathname.split("/").filter(Boolean);
        try {
          if (parts[0] === "public" && parts[2] === "content") {
            const documentId = parts[1];
            const revisionId = requestUrl.searchParams.get("revision") || "";
            const signature = requestUrl.searchParams.get("token") || "";
            if (
              !safeEqual(signature, sign(`${documentId}:${revisionId}`, secret))
            ) {
              json(res, 403, { error: "FORBIDDEN" });
              return;
            }
            const record = records.get(documentId);
            const revision = record?.revisions.find(
              (candidate) => candidate.id === revisionId,
            );
            if (!record || !revision) {
              json(res, 404, { error: "NOT_FOUND" });
              return;
            }
            const bytes = await readFile(revisionPath(documentId, revisionId));
            res.writeHead(200, {
              "Content-Type":
                MIME_TYPES[revision.fileType] || "application/octet-stream",
              "Content-Length": bytes.byteLength,
              "Cache-Control": "private, max-age=60",
            });
            res.end(bytes);
            return;
          }

          if (parts[0] === "callback" && req.method === "POST") {
            const session = sessions.get(parts[1]);
            if (!session) {
              json(res, 200, { error: 1 });
              return;
            }
            const body = JSON.parse(
              (await readBody(req, 1024 * 1024)).toString(),
            );
            if (![2, 6].includes(body.status)) {
              json(res, 200, { error: 0 });
              return;
            }
            const source = new URL(body.url);
            if (
              !["localhost", "127.0.0.1", "onlyoffice"].includes(
                source.hostname,
              )
            ) {
              json(res, 200, { error: 1 });
              return;
            }
            const response = await fetch(source, {
              signal: AbortSignal.timeout(30000),
            });
            if (!response.ok) {
              json(res, 200, { error: 1 });
              return;
            }
            const bytes = Buffer.from(await response.arrayBuffer());
            if (bytes.byteLength > MAX_DOCUMENT_BYTES) {
              json(res, 200, { error: 1 });
              return;
            }
            const record = records.get(session.documentId);
            if (!record) {
              json(res, 200, { error: 1 });
              return;
            }
            const fileType = extension(source.pathname) || record.sourceType;
            const revisionId = randomUUID();
            const fileName = `${path.parse(record.title).name}.${fileType}`;
            const revision: Revision = {
              id: revisionId,
              createdAt: new Date().toISOString(),
              fileName,
              fileType,
              sha256: createHash("sha256").update(bytes).digest("hex"),
              size: bytes.byteLength,
            };
            await mkdir(path.join(root, record.id), { recursive: true });
            await writeFile(revisionPath(record.id, revisionId), bytes);
            record.revisions.push(revision);
            record.currentRevisionId = revisionId;
            record.updatedAt = revision.createdAt;
            await persist();
            json(res, 200, { error: 0 });
            return;
          }

          if (!originAllowed(req)) {
            json(res, 403, { error: "FORBIDDEN" });
            return;
          }
          const ownerId = await authenticate(req);
          if (!ownerId) {
            json(res, 401, { error: "UNAUTHENTICATED" });
            return;
          }

          if (parts[0] === "upload" && req.method === "POST") {
            const rawName = String(req.headers["x-file-name"] || "document");
            const title = decodeURIComponent(rawName).slice(0, 240);
            const fileType = extension(title);
            if (!MIME_TYPES[fileType]) {
              json(res, 415, { error: "UNSUPPORTED_DOCUMENT" });
              return;
            }
            const bytes = await readBody(req);
            const documentId = randomUUID();
            const revisionId = randomUUID();
            const createdAt = new Date().toISOString();
            const revision: Revision = {
              id: revisionId,
              createdAt,
              fileName: title,
              fileType,
              sha256: createHash("sha256").update(bytes).digest("hex"),
              size: bytes.byteLength,
            };
            const record: DocumentRecord = {
              id: documentId,
              ownerId,
              roomId: req.headers["x-boardy-room-id"]?.toString() || null,
              title,
              sourceType: fileType,
              currentRevisionId: revisionId,
              createdAt,
              updatedAt: createdAt,
              revisions: [revision],
            };
            await mkdir(path.join(root, documentId), { recursive: true });
            await writeFile(revisionPath(documentId, revisionId), bytes);
            records.set(documentId, record);
            await persist();
            json(res, 201, record);
            return;
          }

          const record = records.get(parts[0]);
          if (!record || record.ownerId !== ownerId) {
            json(res, 404, { error: "NOT_FOUND" });
            return;
          }
          const revision = record.revisions.find(
            (candidate) => candidate.id === record.currentRevisionId,
          )!;

          if (parts[1] === "meta" && req.method === "GET") {
            json(res, 200, record);
            return;
          }
          if (parts[1] === "download" && req.method === "GET") {
            const requestedRevision =
              requestUrl.searchParams.get("revision") ||
              record.currentRevisionId;
            const selected = record.revisions.find(
              (candidate) => candidate.id === requestedRevision,
            );
            if (!selected) {
              json(res, 404, { error: "NOT_FOUND" });
              return;
            }
            const bytes = await readFile(revisionPath(record.id, selected.id));
            res.writeHead(200, {
              "Content-Type":
                MIME_TYPES[selected.fileType] || "application/octet-stream",
              "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
                selected.fileName,
              )}`,
              "Content-Length": bytes.byteLength,
              "Cache-Control": "no-store",
            });
            res.end(bytes);
            return;
          }
          if (parts[1] === "preview" && req.method === "GET") {
            if (revision.fileType !== "pdf") {
              json(res, 409, { error: "PDF_REQUIRED" });
              return;
            }
            const page = Number(requestUrl.searchParams.get("page"));
            if (!Number.isInteger(page) || page < 1 || page > 1000) {
              json(res, 400, { error: "INVALID_PAGE" });
              return;
            }
            const preview = await renderPdfPage(
              revisionPath(record.id, revision.id),
              page,
            );
            res.writeHead(200, {
              "Content-Type": "image/png",
              "Content-Length": preview.byteLength,
              "Cache-Control": "private, no-store",
            });
            res.end(preview);
            return;
          }
          if (parts[1] === "session" && req.method === "POST") {
            const sessionId = randomUUID();
            sessions.set(sessionId, { documentId: record.id, ownerId });
            const contentToken = sign(
              `${record.id}:${record.currentRevisionId}`,
              secret,
            );
            const hostBase = `http://${publicHost}:${port}/__documents`;
            const config = {
              document: {
                fileType: revision.fileType,
                key: `${record.id}-${record.currentRevisionId}`.replace(
                  /-/g,
                  "",
                ),
                title: revision.fileName,
                url: `${hostBase}/public/${record.id}/content?revision=${record.currentRevisionId}&token=${contentToken}`,
                permissions: {
                  chat: false,
                  comment: true,
                  copy: true,
                  download: true,
                  edit: true,
                  print: false,
                },
              },
              documentType: revision.fileType === "pdf" ? "pdf" : "word",
              editorConfig: {
                callbackUrl: `${hostBase}/callback/${sessionId}`,
                mode: "edit",
                customization: {
                  autosave: true,
                  forcesave: true,
                  compactHeader: true,
                  compactToolbar: true,
                  feedback: false,
                  help: false,
                  hideRightMenu: true,
                  hideRulers: true,
                  macros: false,
                  plugins: false,
                  toolbarHideFileName: true,
                  unit: "cm",
                  zoom: 80,
                  features: {
                    featuresTips: false,
                  },
                },
                user: { id: ownerId, name: "Boardy collaborator" },
              },
            };
            json(res, 200, {
              documentServerUrl,
              config: { ...config, token: jwt(config, secret) },
            });
            return;
          }
          if (parts[1] === "annotated" && req.method === "POST") {
            const bytes = await readBody(req);
            if (revision.fileType !== "pdf") {
              json(res, 409, { error: "PDF_REQUIRED" });
              return;
            }
            const revisionId = randomUUID();
            const createdAt = new Date().toISOString();
            const annotated: Revision = {
              id: revisionId,
              createdAt,
              fileName: `${path.parse(record.title).name}-annotated.pdf`,
              fileType: "pdf",
              sha256: createHash("sha256").update(bytes).digest("hex"),
              size: bytes.byteLength,
            };
            await writeFile(revisionPath(record.id, revisionId), bytes);
            record.revisions.push(annotated);
            record.currentRevisionId = revisionId;
            record.updatedAt = createdAt;
            await persist();
            json(res, 201, record);
            return;
          }
          json(res, 404, { error: "NOT_FOUND" });
        } catch (error: any) {
          json(res, error?.message === "DOCUMENT_TOO_LARGE" ? 413 : 500, {
            error: error?.message || "DOCUMENT_ERROR",
          });
        }
      });
    },
  };
}
