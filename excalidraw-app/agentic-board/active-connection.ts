import { supabase } from "../supabase/client";

import { localApi } from "./client";
import { defaultAssistantPreferences } from "./protocol";

import type { AssistantPreferences, Connection, Model } from "./protocol";

export type ActiveAssistantConnection = {
  connection: Connection;
  model: Model;
  reasoningEffort?: string;
};

export type AssistantModelStrategy = "default" | "economy";

const lowestReasoningEffort = (model: Model) =>
  ["none", "minimal", "low"].find((effort) =>
    model.reasoningEfforts?.includes(effort),
  );

export function chooseAssistantModel(
  connection: Connection,
  preferredModel: string,
  strategy: AssistantModelStrategy = "default",
): Pick<ActiveAssistantConnection, "model" | "reasoningEffort"> | null {
  const compatible = connection.models.filter(
    (candidate) => candidate.compatible !== false,
  );
  const economyPattern =
    connection.subscription === "claude-code" ||
    connection.provider === "anthropic"
      ? /haiku/i
      : /luna/i;
  const model =
    (strategy === "economy"
      ? compatible.find(
          (candidate) =>
            economyPattern.test(candidate.id) ||
            economyPattern.test(candidate.name),
        )
      : undefined) ||
    compatible.find((candidate) => candidate.id === preferredModel) ||
    compatible.find((candidate) => candidate.id === connection.defaultModel) ||
    compatible.find((candidate) => candidate.isDefault) ||
    compatible[0];
  const reasoningEffort = model ? lowestReasoningEffort(model) : undefined;
  return model
    ? {
        model,
        ...(strategy === "economy" && reasoningEffort
          ? { reasoningEffort }
          : {}),
      }
    : null;
}

const storedPreferences = (
  ownerWindow: Window,
  owner: string,
): AssistantPreferences | null => {
  try {
    return JSON.parse(
      ownerWindow.localStorage.getItem(
        `boardy-assistant-preferences-${owner}`,
      ) || "null",
    );
  } catch {
    return null;
  }
};

export async function resolveActiveAssistantConnection(
  ownerWindow: Window,
  strategy: AssistantModelStrategy = "default",
): Promise<ActiveAssistantConnection> {
  const { data } = await supabase.auth.getSession();
  const owner = data.session?.user.id;
  if (!owner) {
    throw new Error("Sign in to Boardy before using AI tools.");
  }

  let preferences = storedPreferences(ownerWindow, owner);
  if (!preferences) {
    const { data: row } = await supabase
      .from("ai_user_preferences")
      .select("default_connection_id, default_model")
      .eq("user_id", owner)
      .maybeSingle();
    preferences = {
      ...defaultAssistantPreferences,
      defaultConnectionId: row?.default_connection_id || "",
      defaultModel: row?.default_model || "",
    };
  }

  const { connections } = await localApi<{ connections: Connection[] }>(
    ownerWindow,
    "connections",
  );
  const connection =
    connections.find(
      (candidate) =>
        candidate.id === preferences?.defaultConnectionId &&
        candidate.models.length,
    ) || connections.find((candidate) => candidate.models.length);
  if (!connection) {
    throw new Error(
      "Connect and refresh a model in Assistant settings before using this tool.",
    );
  }

  const selection = chooseAssistantModel(
    connection,
    preferences?.defaultModel || "",
    strategy,
  );
  if (!selection) {
    throw new Error(
      "Choose a compatible default model in Assistant settings before using this tool.",
    );
  }
  return { connection, ...selection };
}
