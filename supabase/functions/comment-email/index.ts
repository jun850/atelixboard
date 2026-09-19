import { Webhook } from "npm:svix@1.45.1";

import { adminClient } from "../_shared/agentic.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const webhookResponse = async (request: Request) => {
  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secret) {
    return json(503, { error: "webhook_not_configured" });
  }
  const payload = await request.text();
  let event: Record<string, unknown>;
  try {
    event = new Webhook(secret).verify(payload, {
      "svix-id": request.headers.get("svix-id") || "",
      "svix-timestamp": request.headers.get("svix-timestamp") || "",
      "svix-signature": request.headers.get("svix-signature") || "",
    }) as Record<string, unknown>;
  } catch {
    return json(400, { error: "invalid_signature" });
  }
  const eventType = String(event.type || "");
  if (!["email.bounced", "email.complained"].includes(eventType)) {
    return json(200, { ok: true });
  }
  const data = (event.data || {}) as Record<string, unknown>;
  const recipients = Array.isArray(data.to) ? data.to.map(String) : [];
  if (recipients.length) {
    const reason = eventType === "email.complained" ? "complained" : "bounced";
    await adminClient()
      .from("boardy_email_suppressions")
      .upsert(
        recipients.map((email) => ({
          email: email.toLowerCase(),
          reason,
          provider_event_id: String(event.id || "") || null,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "email" },
      );
  }
  return json(200, { ok: true });
};

Deno.serve(async (request) => {
  const path = new URL(request.url).pathname;
  if (path.endsWith("/webhook")) {
    return webhookResponse(request);
  }
  if (
    request.method !== "POST" ||
    request.headers.get("x-boardy-worker-secret") !==
      Deno.env.get("COMMENT_EMAIL_WORKER_SECRET")
  ) {
    return json(401, { error: "unauthorized" });
  }
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return json(503, { error: "email_not_configured" });
  }
  const admin = adminClient();
  const now = new Date().toISOString();
  const { data: queued, error } = await admin
    .from("boardy_comment_email_outbox")
    .select("*")
    .in("status", ["pending", "failed"])
    .lte("available_at", now)
    .order("created_at")
    .limit(25);
  if (error) {
    return json(500, { error: "queue_unavailable" });
  }
  let sent = 0;
  for (const item of queued || []) {
    const claim = await admin
      .from("boardy_comment_email_outbox")
      .update({
        status: "sending",
        attempt_count: item.attempt_count + 1,
        updated_at: now,
      })
      .eq("id", item.id)
      .in("status", ["pending", "failed"])
      .select("id")
      .maybeSingle();
    if (!claim.data) {
      continue;
    }
    const { data: suppressed } = await admin
      .from("boardy_email_suppressions")
      .select("email")
      .eq("email", item.recipient_email)
      .maybeSingle();
    if (suppressed) {
      await admin
        .from("boardy_comment_email_outbox")
        .update({ status: "suppressed", updated_at: new Date().toISOString() })
        .eq("id", item.id);
      continue;
    }
    const appUrl = (
      Deno.env.get("BOARDY_APP_URL") || "https://boardy.sbs"
    ).replace(/\/$/, "");
    const commentUrl = `${appUrl}/app/boards/${item.scene_id}?comment=${item.thread_id}`;
    const payload = (item.payload || {}) as Record<string, unknown>;
    const actorName = escapeHtml(payload.actorName || "A teammate");
    const sceneTitle = escapeHtml(payload.sceneTitle || "Whiteboard");
    const excerpt = escapeHtml(
      payload.excerpt ||
        (payload.hasAttachment ? "Shared an image" : "New comment"),
    );
    const result = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${resendKey}`,
        "content-type": "application/json",
        "idempotency-key": `boardy-comment-${item.id}`,
      },
      body: JSON.stringify({
        from:
          Deno.env.get("BOARDY_COMMENT_FROM") ||
          "Boardy <notifications@atelix.app>",
        to: [item.recipient_email],
        subject: `${payload.actorName || "A teammate"} commented on ${
          payload.sceneTitle || "a whiteboard"
        }`,
        html: `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#1d2533"><h2 style="font-size:20px">${actorName} commented on ${sceneTitle}</h2><p style="line-height:1.6;color:#4a5568">${excerpt}</p><p><a href="${escapeHtml(
          commentUrl,
        )}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#2f6ce5;color:white;text-decoration:none">Open comment</a></p><p style="margin-top:32px;font-size:12px;color:#7b8494"><a href="${escapeHtml(
          `${commentUrl}&comments=settings`,
        )}">Manage comment notifications</a></p></div>`,
      }),
    });
    const responseBody = (await result.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (result.ok) {
      sent += 1;
      await admin
        .from("boardy_comment_email_outbox")
        .update({
          status: "sent",
          provider_message_id: String(responseBody.id || "") || null,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
    } else {
      const delayMinutes = Math.min(60, 2 ** Math.min(item.attempt_count, 6));
      await admin
        .from("boardy_comment_email_outbox")
        .update({
          status: "failed",
          last_error: String(
            responseBody.message || `HTTP ${result.status}`,
          ).slice(0, 500),
          available_at: new Date(
            Date.now() + delayMinutes * 60_000,
          ).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
    }
  }
  return json(200, { processed: queued?.length || 0, sent });
});
