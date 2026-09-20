import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { OWNER_EMAIL, OWNER_ID } from "../_shared/discovery-content.ts";
import {
  normalizeDoc,
  safeUrl,
  validateResult,
  SKILL_VERSION,
  FORMATS,
} from "../_shared/studio-core.ts";
const db = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
const hash = async (s: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
const secret = () => crypto.randomUUID() + crypto.randomUUID();
function checked(r: any) {
  if (r.error)
    throw Error(
      r.error.code === "23505" ? "This item already exists" : r.error.message,
    );
  return r.data;
}
const uuid = (s: any) => {
  if (typeof s !== "string" || !/^[a-f0-9-]{36}$/i.test(s))
    throw Error("Invalid ID");
  return s;
};
const str = (s: any, max = 200) =>
  String(s || "")
    .trim()
    .slice(0, max);
Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  const allowed = [
    "https://boardy.sbs",
    "https://www.boardy.sbs",
    "https://atelixboard.vercel.app",
    ...(Deno.env.get("BOARDY_ALLOWED_ORIGINS") || "").split(","),
  ];
  const cors = {
    "access-control-allow-origin":
      allowed.includes(origin) ||
      /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
        ? origin
        : "https://boardy.sbs",
    "access-control-allow-headers":
      "authorization,apikey,content-type,x-client-info,x-boardy-worker",
    "access-control-allow-methods": "POST,OPTIONS",
    "cache-control": "no-store",
    vary: "Origin",
  };
  const send = (data: any, status = 200) =>
    Response.json(data, { status, headers: cors });
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return send({ error: "Method not allowed" }, 405);
  try {
    const raw = await req.text();
    if (raw.length > 300000) return send({ error: "Request too large" }, 413);
    const b = JSON.parse(raw);
    const admin = db();
    if (b.action === "pair") {
      if (typeof b.code !== "string" || b.code.length !== 36)
        return send({ error: "Invalid pairing code" }, 400);
      const token = secret();
      const id = checked(
        await admin.rpc("boardy_studio_pair", {
          p_hash: await hash(b.code),
          p_token_hash: await hash(token),
        }),
      );
      return send({ id, token });
    }
    const workerToken = req.headers.get("x-boardy-worker");
    if (workerToken) {
      const w = checked(
        await admin
          .from("boardy_studio_workers")
          .select("id")
          .eq("token_hash", await hash(workerToken))
          .eq("revoked", false)
          .maybeSingle(),
      );
      if (!w) return send({ error: "Worker revoked or not paired" }, 403);
      if (b.action === "heartbeat") {
        const status = {
          connected: b.status?.connected === true,
          models: Array.isArray(b.status?.models)
            ? b.status.models.slice(0, 100)
            : [],
          limits: b.status?.limits || null,
          message: str(b.status?.message, 500),
        };
        checked(
          await admin
            .from("boardy_studio_workers")
            .update({ status, heartbeat_at: new Date().toISOString() })
            .eq("id", w.id),
        );
        let active = false;
        if (b.jobId) {
          const rows = checked(
            await admin
              .from("boardy_studio_jobs")
              .update({
                lease_until: new Date(Date.now() + 180000).toISOString(),
              })
              .eq("id", uuid(b.jobId))
              .eq("worker_id", w.id)
              .eq("lease_token", uuid(b.lease))
              .eq("state", "running")
              .gt("lease_until", new Date().toISOString())
              .select("id"),
          );
          active = rows.length > 0;
        }
        return send({ active });
      }
      if (b.action === "claim")
        return send({
          job: checked(
            await admin.rpc("boardy_studio_claim", { p_worker: w.id }),
          ),
        });
      if (b.action === "finish") {
        const j = checked(
          await admin
            .from("boardy_studio_jobs")
            .select("kind,input")
            .eq("id", uuid(b.jobId))
            .eq("worker_id", w.id)
            .eq("lease_token", uuid(b.lease))
            .single(),
        );
        const result = b.error
          ? null
          : {
              ...validateResult(j.kind, b.result, j.input),
              artifacts: Array.isArray(b.result?.artifacts)
                ? b.result.artifacts.slice(0, 100)
                : [],
            };
        checked(
          await admin.rpc("boardy_studio_finish", {
            p_worker: w.id,
            p_job: b.jobId,
            p_lease: b.lease,
            p_result: result,
            p_error: b.error ? str(b.error, 1000) : null,
          }),
        );
        return send({ saved: true });
      }
      return send({ error: "Worker action forbidden" }, 403);
    }
    const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return send({ error: "Sign in required" }, 401);
    const auth = await admin.auth.getUser(token);
    const user = auth.data.user;
    if (auth.error || !user) return send({ error: "Sign in required" }, 401);
    if (
      user.id !== OWNER_ID ||
      user.email?.toLowerCase() !== OWNER_EMAIL ||
      !user.email_confirmed_at
    )
      return send({ error: "Owner access required" }, 403);
    const days = [7, 30, 90].includes(b.days) ? b.days : 30;
    if (b.action === "bootstrap") {
      const results = await Promise.all([
        admin.rpc("boardy_studio_stats", { p_days: days }),
        admin.from("boardy_studio_settings").select("value").single(),
        admin
          .from("boardy_studio_workers")
          .select("id,name,revoked,status,heartbeat_at")
          .order("created_at", { ascending: false })
          .limit(10),
        admin
          .from("boardy_studio_personas")
          .select("*")
          .order("name")
          .limit(100),
      ]);
      const [stats, settings, workers, personas] = results.map(checked);
      return send({ stats, settings: settings.value, workers, personas });
    }
    const tables: Record<string, string> = {
      prompts: "boardy_studio_prompts",
      articles: "boardy_studio_articles",
      knowledge: "boardy_studio_knowledge",
      jobs: "boardy_studio_jobs",
      runs: "boardy_studio_runs",
      revisions: "boardy_studio_revisions",
    };
    if (b.action === "list") {
      const table = tables[b.entity];
      if (!table) throw Error("Invalid library");
      const page = Math.max(0, Math.floor(Number(b.page) || 0));
      const fields: Record<string, string> = {
        articles:
          "id,prompt_id,slug,title,description,format,version,has_draft,published_at,created_at,updated_at",
        jobs: "id,kind,state,error,created_at,finished_at,input",
        knowledge: "id,name,source_url,approved,version,updated_at",
        prompts: "*",
        runs: "*",
        revisions: "*",
      };
      let q = admin
        .from(table)
        .select(fields[b.entity], { count: "exact" })
        .order(b.entity === "knowledge" ? "updated_at" : "created_at", {
          ascending: false,
        })
        .order("id", { ascending: false })
        .range(page * 25, page * 25 + 24);
      if (b.search && ["prompts", "articles", "knowledge"].includes(b.entity))
        q = q.ilike(
          b.entity === "prompts"
            ? "text"
            : b.entity === "articles"
            ? "title"
            : "name",
          `%${str(b.search, 100).replace(/[%_]/g, "")}%`,
        );
      if (b.entity === "prompts") {
        q = q.eq("archived", false);
        if (b.filter === "tracked") q = q.eq("tracked", true);
      }
      if (b.entity === "articles" && b.filter === "published")
        q = q.not("published", "is", null);
      if (b.entity === "articles" && b.filter === "draft")
        q = q.eq("has_draft", true);
      if (b.entity === "revisions") q = q.eq("entity_id", uuid(b.id));
      if (b.entity === "runs" && b.id) q = q.eq("prompt_id", uuid(b.id));
      const r = await q;
      const rows = checked(r);
      let performance: any[] = [];
      if (b.entity === "articles" && rows.length)
        performance = checked(
          await admin.rpc("boardy_studio_performance", {
            p_ids: rows.map((r: any) => r.id),
            p_days: days,
          }),
        );
      if (b.entity === "prompts" && rows.length)
        performance = checked(
          await admin.rpc("boardy_studio_prompt_performance", {
            p_ids: rows.map((r: any) => r.id),
            p_days: days,
          }),
        );
      return send({ rows, total: r.count, performance });
    }
    if (b.action === "get") {
      if (!tables[b.entity]) throw Error("Invalid entity");
      return send({
        item: checked(
          await admin
            .from(tables[b.entity])
            .select("*")
            .eq("id", uuid(b.id))
            .single(),
        ),
      });
    }
    if (b.action === "pair-create") {
      const code = crypto.randomUUID();
      checked(
        await admin.from("boardy_studio_workers").insert({
          name: str(b.name || "My Mac"),
          pairing_hash: await hash(code),
          pairing_expires: new Date(Date.now() + 600000).toISOString(),
        }),
      );
      return send({ code, expiresIn: 600 });
    }
    if (b.action === "revoke") {
      checked(
        await admin
          .from("boardy_studio_workers")
          .update({ revoked: true, token_hash: null })
          .eq("id", uuid(b.id)),
      );
      return send({ saved: true });
    }
    if (b.action === "settings") {
      const current = checked(
        await admin.from("boardy_studio_settings").select("value").single(),
      ).value;
      const value = {
        ...current,
        ...(typeof b.paused === "boolean" ? { paused: b.paused } : {}),
        ...(typeof b.model === "string" ? { model: str(b.model, 150) } : {}),
        ...(b.name ? { name: str(b.name) } : {}),
      };
      checked(
        await admin
          .from("boardy_studio_settings")
          .update({ value })
          .eq("id", true),
      );
      return send({ saved: true });
    }
    if (b.action === "persona-save") {
      const data = { name: str(b.name), description: str(b.description, 3000) };
      if (!data.name) throw Error("Name required");
      checked(
        await admin
          .from("boardy_studio_personas")
          .upsert({ ...data, ...(b.id ? { id: uuid(b.id) } : {}) }),
      );
      return send({ saved: true });
    }
    if (b.action === "save") {
      const table = tables[b.entity];
      if (!["prompts", "articles", "knowledge"].includes(b.entity))
        throw Error("Invalid entity");
      let value: any;
      if (b.entity === "prompts") {
        value = {
          text: str(b.text, 2000),
          topic: str(b.topic),
          persona: str(b.persona),
          journey: str(b.journey, 500),
          sources: (b.sources || []).map((s: any) => safeUrl(s)),
        };
        if (value.text.length < 5) throw Error("Prompt is too short");
      }
      if (b.entity === "knowledge")
        value = {
          name: str(b.name),
          body: str(b.body, 50000),
          source_url: b.source_url ? safeUrl(b.source_url) : null,
          approved: b.approved === true,
        };
      if (b.entity === "articles") {
        value = {
          title: str(b.title),
          description: str(b.description, 500),
          doc: normalizeDoc(b.doc),
        };
        if (!value.title) throw Error("Title required");
        if (!b.id)
          value = {
            ...value,
            slug: str(b.slug, 100) || "guide-" + crypto.randomUUID(),
            format: FORMATS.includes(b.format) ? b.format : "explainer",
          };
      }
      let r = b.id
        ? await admin
            .from(table)
            .update(value)
            .eq("id", uuid(b.id))
            .eq("version", Number(b.version))
            .select("*")
        : await admin.from(table).insert(value).select("*");
      const rows = checked(r);
      if (!rows.length)
        return send({ error: "This item changed. Reload before saving." }, 409);
      return send({ item: rows[0] });
    }
    if (b.action === "track") {
      const ids = (b.ids || []).slice(0, 100).map(uuid);
      checked(
        await admin
          .from("boardy_studio_prompts")
          .update({ tracked: b.tracked === true })
          .in("id", ids),
      );
      return send({ saved: true });
    }
    if (b.action === "publish") {
      if (!Array.isArray(b.items) || !b.items.length || b.items.length > 100)
        throw Error("Select 1–100 articles");
      checked(
        await admin.rpc("boardy_studio_publish", {
          p_items: b.items.map((i: any) => ({
            id: uuid(i.id),
            version: Number(i.version),
          })),
          p_publish: b.publish !== false,
        }),
      );
      return send({ saved: true });
    }
    if (b.action === "cancel") {
      checked(
        await admin
          .from("boardy_studio_jobs")
          .update({ state: "cancelled", finished_at: new Date().toISOString() })
          .eq("id", uuid(b.id))
          .in("state", ["queued", "running"]),
      );
      return send({ saved: true });
    }
    if (b.action === "retry") {
      const j = checked(
        await admin
          .from("boardy_studio_jobs")
          .select("kind,input")
          .eq("id", uuid(b.id))
          .in("state", ["failed", "interrupted", "cancelled"])
          .single(),
      );
      checked(
        await admin.from("boardy_studio_jobs").insert({
          kind: j.kind,
          input: j.input,
          request_key: uuid(b.requestKey),
        }),
      );
      return send({ saved: true });
    }
    if (b.action === "enqueue") {
      if (
        !["research", "prompts", "article", "review", "check"].includes(b.kind)
      )
        throw Error("Invalid workflow");
      const cfg = checked(
        await admin.from("boardy_studio_settings").select("value").single(),
      ).value;
      if (!cfg.model) throw Error("Connect Codex and select a model first");
      const base: any = {
        model: cfg.model,
        skillVersion: SKILL_VERSION,
        topic: str(b.topic, 1000),
        count: Math.max(1, Math.min(25, Number(b.count) || 10)),
        format: FORMATS.includes(b.format) ? b.format : "explainer",
      };
      if (b.kind !== "check")
        base.knowledge = checked(
          await admin
            .from("boardy_studio_knowledge")
            .select("id,name,body,source_url,version")
            .eq("approved", true)
            .order("updated_at", { ascending: false })
            .limit(100),
        );
      if (["article", "review"].includes(b.kind) && !base.knowledge.length)
        throw Error("Approve product knowledge before writing");
      if (b.kind === "review") {
        const article = checked(
          await admin
            .from("boardy_studio_articles")
            .select("*")
            .eq("id", uuid(b.articleId))
            .single(),
        );
        base.article = {
          id: article.id,
          title: article.title,
          doc: article.doc,
          version: article.version,
        };
      }
      const ids = ["article", "check"].includes(b.kind)
        ? (b.ids || []).slice(0, 25).map(uuid)
        : [];
      let inputs = [base];
      if (["article", "check"].includes(b.kind)) {
        if (!ids.length) throw Error("Select prompts");
        const prompts = checked(
          await admin.from("boardy_studio_prompts").select("*").in("id", ids),
        );
        inputs = prompts.map((p: any) =>
          b.kind === "check"
            ? {
                model: cfg.model,
                skillVersion: SKILL_VERSION,
                prompt: p.text,
                promptId: p.id,
                promptVersion: p.version,
                search: true,
              }
            : {
                ...base,
                promptId: p.id,
                prompt: p.text,
                promptVersion: p.version,
                slugSuffix: crypto.randomUUID().slice(0, 8),
              },
        );
      }
      checked(
        await admin.rpc("boardy_studio_enqueue", {
          p_key: uuid(b.requestKey),
          p_kind: b.kind,
          p_inputs: inputs,
        }),
      );
      return send({ queued: inputs.length });
    }
    return send({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error(
      "Studio request failed",
      e instanceof Error ? e.message : "unknown",
    );
    return send(
      { error: e instanceof Error ? e.message : "Request failed" },
      400,
    );
  }
});
