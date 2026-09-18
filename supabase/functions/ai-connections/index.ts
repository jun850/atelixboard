import {
  authenticate,
  discoverModels,
  errorCode,
  publicConnection,
  response,
} from "../_shared/agentic.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return response(request, 204, {});
  }
  try {
    const { admin, user } = await authenticate(request);
    const envelope = await request.json();
    const path = String(envelope.path || "");
    const method = String(envelope.method || "GET").toUpperCase();
    const body = envelope.body || {};
    const parts = path.split("/").filter(Boolean);

    if (parts[0] !== "connections") {
      throw new Error("CONNECTION_UNAVAILABLE");
    }
    if (method === "GET" && parts.length === 1) {
      const { data, error } = await admin
        .from("ai_connections")
        .select("id, provider, key_suffix, models")
        .eq("user_id", user.id)
        .order("created_at");
      if (error) {
        throw error;
      }
      return response(request, 200, {
        connections: (data || []).map(publicConnection),
      });
    }

    const id = parts[1] || crypto.randomUUID();
    if (method === "DELETE" && parts[1]) {
      const { error } = await admin.rpc("agentic_delete_connection", {
        connection_id: id,
        owner_id: user.id,
      });
      if (error) {
        throw error;
      }
      return response(request, 200, {});
    }

    if (method === "POST" && parts[2] === "refresh") {
      const { data, error } = await admin.rpc(
        "agentic_read_connection_secret",
        {
          connection_id: id,
          owner_id: user.id,
        },
      );
      if (error || !data?.[0]) {
        throw new Error("CONNECTION_UNAVAILABLE");
      }
      const stored = data[0];
      const models = await discoverModels(stored.provider, stored.secret);
      const { data: updated, error: updateError } = await admin
        .from("ai_connections")
        .update({
          models,
          models_refreshed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id, provider, key_suffix, models")
        .single();
      if (updateError) {
        throw updateError;
      }
      return response(request, 200, publicConnection(updated));
    }

    if (!["POST", "PUT"].includes(method)) {
      throw new Error("CONNECTION_UNAVAILABLE");
    }
    if (
      !["openai", "anthropic"].includes(body.provider) ||
      typeof body.key !== "string"
    ) {
      throw new Error("CONNECTION_UNAVAILABLE");
    }
    if (method === "POST") {
      const { count, error: countError } = await admin
        .from("ai_connections")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (countError) {
        throw countError;
      }
      if ((count || 0) >= 8) {
        throw new Error("LIMIT_EXCEEDED");
      }
    }
    const models = await discoverModels(body.provider, body.key);
    const suffix = body.key.slice(-4);
    const rpc =
      method === "PUT"
        ? admin.rpc("agentic_replace_connection_secret", {
            connection_id: id,
            owner_id: user.id,
            connection_key: body.key,
            connection_suffix: suffix,
            discovered_models: models,
          })
        : admin.rpc("agentic_store_connection_secret", {
            connection_id: id,
            owner_id: user.id,
            connection_provider: body.provider,
            connection_label:
              body.provider === "openai" ? "OpenAI API" : "Claude API",
            connection_key: body.key,
            connection_suffix: suffix,
            discovered_models: models,
          });
    const { data, error } = await rpc;
    if (error || !data) {
      throw error || new Error("CONNECTION_UNAVAILABLE");
    }
    return response(request, 200, publicConnection(data));
  } catch (error) {
    const code = errorCode(error);
    return response(request, code === "UNAUTHENTICATED" ? 401 : 400, {
      error: code,
    });
  }
});
