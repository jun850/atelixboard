import { studioPublic } from "../_shared/studio-public.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const adminClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
const authenticate = async (request: Request) => {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new Error("UNAUTHENTICATED");
  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error("UNAUTHENTICATED");
  return { admin, user: data.user };
};
const response = (request: Request, status: number, body: unknown) => {
  const origin = request.headers.get("origin") || "";
  const allowed = [
    "https://boardy.sbs",
    "https://www.boardy.sbs",
    "https://atelixboard.vercel.app",
    ...(Deno.env.get("BOARDY_ALLOWED_ORIGINS") || "").split(","),
  ];
  const allowOrigin =
    allowed.includes(origin) ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ? origin
      : "https://boardy.sbs";
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "access-control-allow-origin": allowOrigin,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers":
        "authorization, apikey, content-type, x-client-info",
      vary: "Origin",
    },
  });
};
import {
  classifyTraffic,
  OWNER_EMAIL,
  OWNER_ID,
  publicContent,
  trackedPrompts,
} from "../_shared/discovery-content.ts";
import { studioMcp } from "../_shared/studio-mcp.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
const record = (request: Request, path: string) => {
  if (request.headers.get("dnt") === "1") return;
  const { kind, source } = classifyTraffic(
    request.headers.get("user-agent") || "",
    request.headers.get("referer") || "",
  );
  EdgeRuntime.waitUntil(
    Promise.resolve(
      adminClient().rpc("boardy_record_discovery", {
        p_path: path,
        p_kind: kind,
        p_source: source,
      }),
    )
      .then(({ error }) => {
        if (error) console.error("Discovery counter unavailable", error.code);
      })
      .catch(() => console.error("Discovery counter unavailable")),
  );
};
Deno.serve(async (request) => {
  const url = new URL(request.url);
  const path = url.searchParams.get("path") || "/learn";
  if (request.method === "OPTIONS") return response(request, 204, null);
  if (path === "/traffic" && request.method === "GET") {
    record(request, "/");
    return new Response(null, {
      status: 204,
      headers: { "cache-control": "no-store" },
    });
  }
  if (path === "/mcp") {
    const origin = request.headers.get("origin");
    if (
      origin &&
      !["https://boardy.sbs", "https://www.boardy.sbs"].includes(origin)
    )
      return new Response("Forbidden origin", { status: 403 });
    if (
      request.headers.has("mcp-protocol-version") &&
      !["2025-03-26", "2025-06-18"].includes(
        request.headers.get("mcp-protocol-version")!,
      )
    )
      return new Response("Unsupported protocol version", { status: 400 });
    if (request.method !== "POST")
      return new Response(null, { status: 405, headers: { Allow: "POST" } });
    if (Number(request.headers.get("content-length") || 0) > 16384)
      return new Response(null, { status: 413 });
    const text = await request.text();
    if (text.length > 16384) return new Response(null, { status: 413 });
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      return Response.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        },
        { status: 400 },
      );
    }
    let result;
    try { result = await studioMcp(adminClient(),payload); } catch { return Response.json({error:"Documentation unavailable"},{status:503}); }
    if (!result) return new Response(null, { status: 202 });
    if (!("error" in result)) record(request, "/mcp");
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  }
  if (request.method === "POST") {
    try {
      // No reliance on the email passed by the browser or editable user_metadata.
      const { admin, user } = await authenticate(request);
      if (
        user.id !== OWNER_ID ||
        user.email?.toLowerCase() !== OWNER_EMAIL ||
        !user.email_confirmed_at
      )
        return response(request, 403, { error: "Owner access required" });
      const text = await request.text();
      if (text.length > 24000)
        return response(request, 413, { error: "Request too large" });
      const body = JSON.parse(text);
      if (body.action === "save-check") {
        if (
          !Number.isInteger(body.promptIndex) ||
          !trackedPrompts[body.promptIndex] ||
          ![
            "ChatGPT",
            "Claude",
            "Gemini",
            "Perplexity",
            "Copilot",
            "Other",
          ].includes(body.engine) ||
          typeof body.answer !== "string" ||
          !body.answer.trim() ||
          body.answer.length > 20000
        )
          return response(request, 400, { error: "Invalid check" });
        let evidenceUrl: string | null = null;
        if (body.evidenceUrl) {
          try {
            const u = new URL(body.evidenceUrl);
            if (
              u.protocol !== "https:" ||
              u.username ||
              u.password ||
              u.href.length > 2000
            )
              throw new Error();
            evidenceUrl = u.href;
          } catch {
            return response(request, 400, {
              error: "Use a valid HTTPS evidence link",
            });
          }
        }
        const { error } = await admin.from("boardy_discovery_checks").insert({
          prompt_index: body.promptIndex,
          engine: body.engine,
          answer: body.answer.trim(),
          mentioned: /boardy\s+by\s+atelix|boardy\.sbs/i.test(body.answer),
          cited: /https?:\/\/(?:www\.)?boardy\.sbs(?:[/?#\s)\]]|$)/i.test(
            body.answer,
          ),
          evidence_url: evidenceUrl,
          recorded_by: user.id,
        });
        if (error) throw error;
        return response(request, 200, { saved: true });
      }
      if (body.action !== "overview")
        return response(request, 400, { error: "Unknown action" });
      const days = [7, 30, 90].includes(body.days) ? body.days : 30;
      const { data, error } = await admin.rpc("boardy_discovery_overview", {
        p_days: days,
      });
      if (error) throw error;
      return response(request, 200, {
        ...data,
        days,
        prompts: trackedPrompts,
        generatedAt: new Date().toISOString(),
        coverage:
          "Homepage, public guides, Markdown, AI manifest, sitemap, and MCP requests. Counts are requests, not unique people. Crawler identities are inferred from user agents and are unverified.",
      });
    } catch (error) {
      const unauthorized =
        error instanceof Error && error.message === "UNAUTHENTICATED";
      return response(request, unauthorized ? 401 : 503, {
        error: unauthorized
          ? "Sign in required"
          : "Discovery reporting is unavailable",
      });
    }
  }
  if (!["GET", "HEAD"].includes(request.method))
    return new Response(null, { status: 405 });
  let content;
  try { content = await studioPublic(adminClient(), path.replace(/\/$/, "") || "/", Math.max(0, Math.min(100000, Number(url.searchParams.get("page")) || 0))); }
  catch { return new Response("Content temporarily unavailable", {status:503}); }
  if (content.status === 200 && request.method === "GET")
    record(request, path.replace(/\/$/, ""));
  return new Response(request.method === "HEAD" ? null : content.body, {
    status: content.status,
    headers: {
      "content-type": content.type,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
});
