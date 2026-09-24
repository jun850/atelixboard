import { supabase } from "../supabase/client";
const messages: Record<string, string> = {
  RUNTIME_UNAVAILABLE:
    "The local runtime could not start. This build requires Codex 0.154.0 or Claude Code 2.1.226. Check the local testing guide.",
  SIGN_IN_REQUIRED:
    "Finish signing in through the official runtime, then click Test / refresh.",
  UNAUTHENTICATED: "Sign in to Boardy before connecting a provider.",
  CONNECTION_UNAVAILABLE:
    "Connection unavailable. Reconnect your subscription or check your API key.",
  MODEL_UNAVAILABLE:
    "That model is unavailable. Refresh models and choose again.",
  MODEL_CATALOG_EXPIRED: "Refresh models before starting this run.",
  CAPABILITY_UNKNOWN:
    "Confirm the unverified model capability before trying it.",
  RATE_LIMITED: "Your provider has rate-limited this request. Try again later.",
  RUN_IN_PROGRESS: "A run is already active. Stop it or wait for it to finish.",
  DUPLICATE_REQUEST:
    "This request already ran. Start a new generation explicitly.",
  INVALID_OUTPUT:
    "The model did not return a valid draft after one repair. Try a simpler request.",
  LIMIT_EXCEEDED:
    "This request is too large. Reduce the prompt or selected context.",
  CANCELLED: "Generation stopped or reached its generation deadline.",
  PRO_REQUIRED: "Upgrade to Boardy Pro to use the Assistant.",
  FORBIDDEN:
    "You do not have access to this action. Refresh the board or ask its owner to check your access.",
  REVISION_CONFLICT: "This changed in another tab. Refresh and try again.",
  BILLING_UNAVAILABLE:
    "Subscription status is temporarily unavailable. Try again shortly.",
};
export async function localApi<T>(
  ownerWindow: Window,
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    throw new Error(messages.UNAUTHENTICATED);
  }
  if (!import.meta.env.DEV) {
    const functionName =
      path === "generate" || path === "cancel"
        ? "ai-generate"
        : "ai-connections";
    const { data: result, error } = await supabase.functions.invoke(
      functionName,
      {
        body: { path, method, body },
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      },
    );
    if (error) {
      const code = (result as { error?: string } | null)?.error;
      throw new Error(
        (code && messages[code]) ||
          "The provider request failed. Check the connection and selected model, then retry.",
      );
    }
    return result as T;
  }
  const response = await ownerWindow.fetch(`/__agentic/${path}`, {
    method,
    signal,
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json",
      "X-Boardy-Local": "1",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(
      messages[result.error] ||
        "The provider request failed. Check the connection and selected model, then retry.",
    );
  }
  return result;
}

export async function cloudApi<T>(
  functionName: "ai-templates" | "scene-assets" | "scenes" | "workspace",
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    throw new Error(messages.UNAUTHENTICATED);
  }
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: { path, method, body },
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
    },
  });
  if (error) {
    const responseError = await (error as { context?: Response }).context
      ?.json?.()
      .catch(() => null);
    const code =
      (responseError as { error?: string } | null)?.error ||
      (data as { error?: string } | null)?.error;
    throw new Error(
      code === "PRO_REQUIRED"
        ? code
        : (code && messages[code]) ||
          "Cloud data could not be updated. Try again.",
    );
  }
  return data as T;
}
