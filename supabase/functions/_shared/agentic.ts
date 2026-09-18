import { createClient } from "npm:@supabase/supabase-js@2.116.0";

export type Provider = "openai" | "anthropic";
export type Model = {
  id: string;
  name: string;
  compatible: boolean | null;
  outputLimit: number | null;
};

const providerBase = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
};

export const adminClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

export const userClient = (authorization: string) =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

export async function authenticate(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.match(/^Bearer (.+)$/)?.[1];
  if (!token) {
    throw new Error("UNAUTHENTICATED");
  }
  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) {
    throw new Error("UNAUTHENTICATED");
  }
  return { admin, user: data.user, client: userClient(authorization) };
}

export function response(request: Request, status: number, body: unknown) {
  const configured = (Deno.env.get("BOARDY_ALLOWED_ORIGINS") || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origin = request.headers.get("origin") || "";
  const allowOrigin = configured.includes(origin)
    ? origin
    : /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    ? origin
    : configured[0] || "https://boardy.atelix.app";
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "access-control-allow-origin": allowOrigin,
      "access-control-allow-headers":
        "authorization, apikey, content-type, x-client-info",
      "access-control-allow-methods": "POST, OPTIONS",
      vary: "Origin",
    },
  });
}

export function providerHeaders(provider: Provider, key: string) {
  return provider === "openai"
    ? { authorization: `Bearer ${key}`, "content-type": "application/json" }
    : {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      };
}

export async function discoverModels(provider: Provider, key: string) {
  const models: Model[] = [];
  const seen = new Set<string>();
  let cursor = "";
  for (let page = 0; page < 30; page++) {
    const url = `${providerBase[provider]}/models${
      provider === "anthropic"
        ? `?limit=100${cursor ? `&after_id=${encodeURIComponent(cursor)}` : ""}`
        : ""
    }`;
    const result = await fetch(url, {
      headers: providerHeaders(provider, key),
      signal: AbortSignal.timeout(15000),
    });
    if (!result.ok) {
      throw new Error(
        result.status === 429 ? "RATE_LIMITED" : "CONNECTION_UNAVAILABLE",
      );
    }
    const payload = await result.json();
    if (!Array.isArray(payload.data)) {
      throw new Error("CONNECTION_UNAVAILABLE");
    }
    for (const item of payload.data) {
      if (typeof item.id !== "string" || seen.has(item.id)) {
        continue;
      }
      seen.add(item.id);
      models.push({
        id: item.id,
        name: item.display_name || item.id,
        compatible:
          provider === "anthropic"
            ? true
            : /^(text-embedding|whisper|tts|dall-e|sora|gpt-image|omni-moderation)/.test(
                item.id,
              )
            ? false
            : null,
        outputLimit:
          typeof item.max_tokens === "number" ? item.max_tokens : null,
      });
    }
    if (!payload.has_more) {
      return models.sort((a, b) => a.id.localeCompare(b.id));
    }
    if (
      provider !== "anthropic" ||
      !payload.last_id ||
      payload.last_id === cursor
    ) {
      throw new Error("CONNECTION_UNAVAILABLE");
    }
    cursor = payload.last_id;
  }
  throw new Error("LIMIT_EXCEEDED");
}

export function publicConnection(row: Record<string, unknown>) {
  return {
    id: row.id,
    provider: row.provider,
    suffix: row.key_suffix,
    models: row.models || [],
  };
}

export function errorCode(error: unknown) {
  const message =
    error instanceof Error ? error.message : "CONNECTION_UNAVAILABLE";
  return [
    "UNAUTHENTICATED",
    "CONNECTION_UNAVAILABLE",
    "MODEL_UNAVAILABLE",
    "MODEL_CATALOG_EXPIRED",
    "CAPABILITY_UNKNOWN",
    "RATE_LIMITED",
    "RUN_IN_PROGRESS",
    "DUPLICATE_REQUEST",
    "INVALID_OUTPUT",
    "LIMIT_EXCEEDED",
    "CANCELLED",
  ].includes(message)
    ? message
    : "CONNECTION_UNAVAILABLE";
}
