import { chooseAssistantModel } from "./active-connection";

import type { Connection } from "./protocol";

const connection = (
  provider: Connection["provider"],
  subscription: Connection["subscription"],
  models: Connection["models"],
): Connection => ({
  id: `${provider}-connection`,
  provider,
  subscription,
  suffix: "test",
  defaultModel: models[0]?.id,
  models,
});

describe("assistant model selection", () => {
  it("routes Codex diagram work to Luna at the lowest supported effort", () => {
    const result = chooseAssistantModel(
      connection("openai", "codex", [
        {
          id: "gpt-6-astra",
          name: "Astra",
          compatible: true,
          outputLimit: null,
        },
        {
          id: "gpt-5.6-luna",
          name: "Luna",
          compatible: true,
          outputLimit: null,
          reasoningEfforts: ["low", "medium"],
        },
      ]),
      "gpt-6-astra",
      "economy",
    );
    expect(result).toMatchObject({
      model: { id: "gpt-5.6-luna" },
      reasoningEffort: "low",
    });
  });

  it("routes Claude diagram work to Haiku without enabling extended thinking", () => {
    const result = chooseAssistantModel(
      connection("anthropic", "claude-code", [
        {
          id: "claude-opus",
          name: "Opus",
          compatible: true,
          outputLimit: null,
        },
        {
          id: "claude-haiku",
          name: "Haiku",
          compatible: true,
          outputLimit: null,
        },
      ]),
      "claude-opus",
      "economy",
    );
    expect(result).toEqual({
      model: expect.objectContaining({ id: "claude-haiku" }),
    });
  });

  it("falls back to the configured default when an economy model is absent", () => {
    const result = chooseAssistantModel(
      connection("openai", "codex", [
        {
          id: "available-default",
          name: "Available default",
          compatible: true,
          outputLimit: null,
        },
      ]),
      "available-default",
      "economy",
    );
    expect(result?.model.id).toBe("available-default");
  });
});
