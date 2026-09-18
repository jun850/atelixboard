import {
  templates,
  validateContent,
} from "../../../excalidraw-app/agentic-board/catalog.ts";
import {
  authenticate,
  errorCode,
  providerHeaders,
  response,
} from "../_shared/agentic.ts";

const cleanJson = (value: string) =>
  JSON.parse(
    value
      .trim()
      .replace(/^```(?:json|html)?\s*/i, "")
      .replace(/\s*```$/, ""),
  );

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return response(request, 204, {});
  }
  let admin: any;
  let userId = "";
  let requestId = "";
  try {
    const authenticated = await authenticate(request);
    admin = authenticated.admin;
    userId = authenticated.user.id;
    const envelope = await request.json();
    if (envelope.path === "cancel") {
      await admin
        .from("ai_generation_requests")
        .update({ status: "cancelled", finished_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("status", "running");
      return response(request, 200, {});
    }
    if (envelope.path !== "generate" || envelope.method !== "POST") {
      throw new Error("INVALID_OUTPUT");
    }
    const input = envelope.body;
    requestId = input?.requestId;
    const template = templates.find((item) => item.id === input?.templateId);
    if (
      !template ||
      typeof requestId !== "string" ||
      !/^[\w-]{16,80}$/.test(requestId) ||
      typeof input.connectionId !== "string" ||
      typeof input.model !== "string" ||
      input.model.length > 200 ||
      !["board", "ui"].includes(input.task) ||
      typeof input.prompt !== "string" ||
      !input.prompt.trim() ||
      [...input.prompt].length > 16000 ||
      !["prompt_only", "selection", "whole_board"].includes(
        input.context?.mode,
      ) ||
      !Array.isArray(input.context?.elements) ||
      input.context.elements.length > 300
    ) {
      throw new Error("LIMIT_EXCEEDED");
    }
    const encoded = new TextEncoder().encode(
      JSON.stringify([input.context, input.previous]),
    );
    if (encoded.length > 256 * 1024) {
      throw new Error("LIMIT_EXCEEDED");
    }

    const { data: secretRows, error: secretError } = await admin.rpc(
      "agentic_read_connection_secret",
      { connection_id: input.connectionId, owner_id: userId },
    );
    const stored = secretRows?.[0];
    if (secretError || !stored) {
      throw new Error("CONNECTION_UNAVAILABLE");
    }
    const model = stored.models.find(
      (item: { id: string }) => item.id === input.model,
    );
    if (!model) {
      throw new Error("MODEL_UNAVAILABLE");
    }
    if (model.compatible === false) {
      throw new Error("MODEL_UNAVAILABLE");
    }
    if (model.compatible === null && input.allowUnknown !== true) {
      throw new Error("CAPABILITY_UNKNOWN");
    }
    if (
      !stored.models_refreshed_at ||
      Date.now() - new Date(stored.models_refreshed_at).getTime() >
        24 * 60 * 60 * 1000
    ) {
      throw new Error("MODEL_CATALOG_EXPIRED");
    }

    await admin
      .from("ai_generation_requests")
      .update({ status: "failed", finished_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "running")
      .lt("created_at", new Date(Date.now() - 2 * 60 * 1000).toISOString());

    const { error: runError } = await admin
      .from("ai_generation_requests")
      .insert({
        request_id: requestId,
        user_id: userId,
        connection_id: input.connectionId,
        status: "running",
      });
    if (runError) {
      const { data: existing } = await admin
        .from("ai_generation_requests")
        .select("request_id")
        .eq("user_id", userId)
        .eq("request_id", requestId)
        .maybeSingle();
      throw new Error(existing ? "DUPLICATE_REQUEST" : "RUN_IN_PROGRESS");
    }

    const context =
      input.context.mode === "prompt_only"
        ? "No board context was shared."
        : JSON.stringify(input.context.elements);
    const outputInstruction =
      input.task === "ui"
        ? 'Return only JSON shaped as {"html":"a complete static HTML document"}. Use HTML and CSS only. No scripts, external assets, tracking, forms that submit, or network requests.'
        : `Return only JSON shaped as {"title":"...","sections":[{"heading":"...","items":["..."]}],"assumptions":["..."]}. Return exactly ${
            template.headings.length
          } sections in this order: ${JSON.stringify(
            template.headings,
          )}. Keep each section to at most 6 items. Mark assumptions clearly; do not invent evidence.`;
    const providerPrompt = [
      "You are Boardy, a privacy-conscious visual-work assistant.",
      outputInstruction,
      `User request: ${input.prompt}`,
      `Selected context mode: ${input.context.mode}`,
      `Sanitized native context: ${context}`,
      input.previous
        ? `Previous draft to refine: ${JSON.stringify(input.previous)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const provider = stored.provider as "openai" | "anthropic";
    const providerResponse = await fetch(
      provider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: providerHeaders(provider, stored.secret),
        body: JSON.stringify(
          provider === "openai"
            ? {
                model: input.model,
                messages: [{ role: "user", content: providerPrompt }],
                response_format: { type: "json_object" },
                max_completion_tokens: 4096,
              }
            : {
                model: input.model,
                max_tokens: 4096,
                messages: [{ role: "user", content: providerPrompt }],
              },
        ),
        signal: AbortSignal.timeout(90000),
      },
    );
    if (!providerResponse.ok) {
      throw new Error(
        providerResponse.status === 429 ? "RATE_LIMITED" : "INVALID_OUTPUT",
      );
    }
    const payload = await providerResponse.json();
    const raw =
      provider === "openai"
        ? payload.choices?.[0]?.message?.content
        : payload.content?.find(
            (part: { type: string }) => part.type === "text",
          )?.text;
    if (typeof raw !== "string") {
      throw new Error("INVALID_OUTPUT");
    }
    const parsed = cleanJson(raw);
    const result =
      input.task === "board" ? validateContent(parsed, template) : parsed;
    if (
      input.task === "ui" &&
      (typeof result?.html !== "string" ||
        !/<html[\s>]/i.test(result.html) ||
        !/<\/html\s*>/i.test(result.html) ||
        new TextEncoder().encode(result.html).length > 256 * 1024)
    ) {
      throw new Error("INVALID_OUTPUT");
    }
    const { data: run } = await admin
      .from("ai_generation_requests")
      .select("status")
      .eq("user_id", userId)
      .eq("request_id", requestId)
      .single();
    if (run?.status === "cancelled") {
      throw new Error("CANCELLED");
    }
    await admin
      .from("ai_generation_requests")
      .update({ status: "complete", finished_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("request_id", requestId);
    return response(request, 200, { result });
  } catch (error) {
    if (admin && userId && requestId) {
      await admin
        .from("ai_generation_requests")
        .update({
          status: errorCode(error) === "CANCELLED" ? "cancelled" : "failed",
          finished_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("request_id", requestId)
        .eq("status", "running");
    }
    const code = errorCode(error);
    return response(request, code === "UNAUTHENTICATED" ? 401 : 400, {
      error: code,
    });
  }
});
