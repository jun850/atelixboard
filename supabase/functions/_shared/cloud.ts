import { response } from "./agentic.ts";

export const MAX_SCENE_BYTES = 10 * 1024 * 1024;

export function cloudError(error: unknown) {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string"
      ? error.message
      : String(error);
  if (raw.includes("revision_conflict")) {
    return "REVISION_CONFLICT";
  }
  if (raw.includes("revision_not_found")) {
    return "REVISION_NOT_FOUND";
  }
  if (raw.includes("pro_required")) {
    return "PRO_REQUIRED";
  }
  if (raw.includes("billing_unavailable")) {
    return "BILLING_UNAVAILABLE";
  }
  if (raw.includes("forbidden")) {
    return "FORBIDDEN";
  }
  if (raw.includes("unauthenticated")) {
    return "UNAUTHENTICATED";
  }
  if (raw.includes("not_found")) {
    return "NOT_FOUND";
  }
  if (raw.includes("limit")) {
    return "LIMIT_EXCEEDED";
  }
  if (raw.includes("invalid_email")) {
    return "INVALID_EMAIL";
  }
  return "CLOUD_STORAGE_ERROR";
}

export function cloudErrorResponse(request: Request, error: unknown) {
  const code = cloudError(error);
  const status =
    code === "UNAUTHENTICATED"
      ? 401
      : code === "FORBIDDEN"
      ? 403
      : code === "PRO_REQUIRED"
      ? 402
      : code === "BILLING_UNAVAILABLE"
      ? 503
      : code === "NOT_FOUND" || code === "REVISION_NOT_FOUND"
      ? 404
      : code === "REVISION_CONFLICT"
      ? 409
      : 400;
  return response(request, status, { error: code });
}

export function requireRequestId(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{16,100}$/.test(value)) {
    throw new Error("invalid_request_id");
  }
  return value;
}

export function requireUuid(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new Error("invalid_uuid");
  }
  return value;
}

export async function encodeScene(document: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(document));
  if (!bytes.length || bytes.length > MAX_SCENE_BYTES) {
    throw new Error("limit");
  }
  const compressed = await new Response(
    new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip")),
  ).arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", compressed);
  const sha256 = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return {
    bytes,
    compressed: new Uint8Array(compressed),
    sha256,
  };
}

export async function decodeScene(blob: Blob) {
  const stream = blob.stream().pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(stream).text();
  return JSON.parse(text);
}

export const sceneResponse = (
  request: Request,
  status: number,
  body: unknown,
) => response(request, status, body);
