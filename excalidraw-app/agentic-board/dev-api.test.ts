import { Readable } from "node:stream";
import { EventEmitter } from "node:events";

import { LocalRuntime } from "../../scripts/agentic-board/local-runtime";

import { agenticBoardDevApi } from "../../scripts/agentic-board/dev-api";

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: async (token: string) =>
        token === "alice" || token === "bob"
          ? { data: { user: { id: token } }, error: null }
          : { data: { user: null }, error: { message: "invalid" } },
    },
  }),
}));

function harness() {
  let handler: any;
  const server = {
    httpServer: new EventEmitter(),
    middlewares: {
      use: (_: string, h: any) => {
        handler = h;
      },
    },
  };
  const plugin = agenticBoardDevApi({});
  (plugin.configureServer as Function)(server);
  return {
    close: () => server.httpServer.emit("close"),
    call: async (
      url: string,
      method = "GET",
      body?: unknown,
      token = "alice",
      origin = "http://localhost:3000",
    ) => {
      const req = Readable.from(body ? [JSON.stringify(body)] : []);
      Object.assign(req, {
        url,
        method,
        headers: {
          host: "localhost:3000",
          origin,
          "x-boardy-local": "1",
          authorization: `Bearer ${token}`,
        },
      });
      const res = new EventEmitter() as any;
      let status = 0;
      let result: any;
      res.writeHead = (value: number) => {
        status = value;
      };
      res.end = (value: string) => {
        result = JSON.parse(value);
        res.writableEnded = true;
      };
      await handler(req, res);
      return { status, body: result };
    },
  };
}
const request = (connectionId: string, requestId = "request-1234567890") => ({
  requestId,
  connectionId,
  model: "discovered-model",
  task: "board",
  templateId: "flowchart",
  prompt: "Example flow",
  context: { mode: "prompt_only", elements: [] },
  allowUnknown: true,
});
const content = {
  title: "Example",
  sections: Array.from({ length: 5 }, (_, i) => ({
    heading: `Step ${i}`,
    items: ["Example"],
  })),
  assumptions: [],
};

describe("local provider service boundary", () => {
  let h: ReturnType<typeof harness>;
  beforeEach(() => {
    h = harness();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (url: string) =>
          new Response(
            JSON.stringify(
              url.includes("/models")
                ? { data: [{ id: "discovered-model" }] }
                : {
                    output: [
                      {
                        content: [
                          {
                            type: "output_text",
                            text: JSON.stringify(content),
                          },
                        ],
                      },
                    ],
                  },
            ),
            { status: 200 },
          ),
      ),
    );
  });
  afterEach(() => {
    h.close();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it("rejects missing auth and foreign origins before provider calls", async () => {
    expect(
      (await h.call("/connections", "GET", undefined, "invalid")).status,
    ).toBe(401);
    expect(
      (
        await h.call(
          "/connections",
          "GET",
          undefined,
          "alice",
          "https://evil.invalid",
        )
      ).status,
    ).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps credentials out of descriptors and isolates users", async () => {
    const c = await h.call("/connections", "POST", {
      provider: "openai",
      key: "secret-user-key-value",
    });
    expect(c.status).toBe(200);
    expect(JSON.stringify(c.body)).not.toContain("secret-user-key");
    expect(
      (await h.call("/connections", "GET", undefined, "bob")).body.connections,
    ).toEqual([]);
    expect(
      (await h.call(`/connections/${c.body.id}`, "DELETE", undefined, "bob"))
        .status,
    ).toBe(404);
    expect(
      (await h.call("/generate", "POST", request(c.body.id), "bob")).body.error,
    ).toBe("CONNECTION_UNAVAILABLE");
  });
  it("honors the discovered exact model and never pays twice for a request ID", async () => {
    const c = await h.call("/connections", "POST", {
      provider: "openai",
      key: "secret-user-key-value",
    });
    const r = { ...request(c.body.id), reasoningEffort: "low" };
    expect((await h.call("/generate", "POST", r)).body.result.title).toBe(
      "Example",
    );
    expect((await h.call("/generate", "POST", r)).body.error).toBe(
      "DUPLICATE_REQUEST",
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    const sent = JSON.parse((fetch as any).mock.calls[1][1].body);
    expect(sent.model).toBe("discovered-model");
    expect(sent.tools).toBeUndefined();
    expect(sent.store).toBe(false);
    expect(sent.reasoning).toEqual({ effort: "low", summary: "none" });
  });
  it("does not replace a working credential when replacement discovery fails", async () => {
    const c = await h.call("/connections", "POST", {
      provider: "openai",
      key: "secret-user-key-value",
    });
    (fetch as any).mockResolvedValueOnce(
      new Response("do not expose provider secret", { status: 401 }),
    );
    const failed = await h.call(`/connections/${c.body.id}`, "PUT", {
      key: "bad-key-replacement",
    });
    expect(failed.body.error).toBe("CONNECTION_UNAVAILABLE");
    expect(JSON.stringify(failed.body)).not.toContain("provider secret");
    expect((await h.call("/connections")).body.connections[0].suffix).toBe(
      "alue",
    );
  });
  it("repairs invalid output once and bounds total output tokens", async () => {
    const c = await h.call("/connections", "POST", {
      provider: "openai",
      key: "secret-user-key-value",
    });
    (fetch as any).mockResolvedValueOnce(
      new Response(JSON.stringify({ output: [] }), { status: 200 }),
    );
    expect((await h.call("/generate", "POST", request(c.body.id))).status).toBe(
      200,
    );
    expect(fetch).toHaveBeenCalledTimes(3);
    const total = (fetch as any).mock.calls
      .slice(1)
      .reduce(
        (sum: number, call: any) =>
          sum + JSON.parse(call[1].body).max_output_tokens,
        0,
      );
    expect(total).toBeLessThanOrEqual(16000);
  });
  it("forgets all connections when the local session is cleared", async () => {
    await h.call("/connections", "POST", {
      provider: "openai",
      key: "secret-user-key-value",
    });
    await h.call("/session", "DELETE");
    expect((await h.call("/connections")).body.connections).toEqual([]);
  });
  it.each(["codex", "claude-code"] as const)(
    "connects %s without a key and runs only through its owned runtime",
    async (subscription) => {
      const runtime = {
        id: `local-${subscription}`,
        kind: subscription,
        login: vi.fn(async () => ({
          pending: true,
          url: "https://auth.openai.com/authorize",
        })),
        inspect: vi.fn(async () => ({
          account: {
            label: "member@example.com",
            authMode: "subscription",
            plan: "pro",
          },
          defaultModel: "discovered-model",
          models: [
            {
              id: "discovered-model",
              name: "Runtime model",
              compatible: true,
              outputLimit: null,
              isDefault: true,
            },
          ],
        })),
        generate: vi.fn(
          async (
            _model: string,
            _instructions: string,
            _prompt: string,
            _signal: AbortSignal,
            _reasoningEffort?: string,
          ) => JSON.stringify(content),
        ),
        dispose: vi.fn(async () => {}),
      };
      vi.spyOn(LocalRuntime, "create").mockResolvedValue(runtime as any);
      const connected = await h.call("/subscriptions", "POST", {
        subscription,
      });
      expect(connected.status).toBe(200);
      expect(connected.body.subscription).toBe(subscription);
      expect(connected.body.key).toBeUndefined();
      expect(runtime.generate).not.toHaveBeenCalled();
      expect(
        (
          await h.call(
            `/connections/${runtime.id}/refresh`,
            "POST",
            undefined,
            "bob",
          )
        ).status,
      ).toBe(404);
      expect(
        (await h.call(`/connections/${runtime.id}/refresh`, "POST")).status,
      ).toBe(200);
      const descriptor = (
        await h.call(`/connections/${runtime.id}/refresh`, "POST")
      ).body;
      expect(descriptor.account).toEqual({
        label: "member@example.com",
        authMode: "subscription",
        plan: "pro",
      });
      expect(descriptor.defaultModel).toBe("discovered-model");
      expect(
        (
          await h.call("/generate", "POST", {
            ...request(runtime.id),
            model: "invented-model",
          })
        ).body.error,
      ).toBe("MODEL_UNAVAILABLE");
      expect(
        (
          await h.call("/generate", "POST", {
            ...request(runtime.id),
            reasoningEffort: "low",
          })
        ).body.result,
      ).toEqual(content);
      expect(runtime.generate.mock.calls[0][0]).toBe("discovered-model");
      expect(runtime.generate.mock.calls[0][4]).toBe("low");
      expect(fetch).not.toHaveBeenCalled();
      await h.call(`/connections/${runtime.id}`, "DELETE");
      expect(runtime.dispose).toHaveBeenCalledTimes(1);
    },
  );
  it("keeps subscription auth errors private and cleans pending login on sign-out", async () => {
    const runtime = {
      id: "pending-runtime",
      login: vi.fn(async () => ({ pending: true })),
      inspect: vi.fn(async () => {
        throw new Error("SIGN_IN_REQUIRED");
      }),
      dispose: vi.fn(async () => {}),
    };
    vi.spyOn(LocalRuntime, "create").mockResolvedValue(runtime as any);
    await h.call("/subscriptions", "POST", { subscription: "codex" });
    expect(
      (await h.call(`/connections/${runtime.id}/refresh`, "POST")).body.error,
    ).toBe("SIGN_IN_REQUIRED");
    await h.call("/session", "DELETE");
    expect(runtime.dispose).toHaveBeenCalledTimes(1);
    expect((await h.call("/connections")).body.connections).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
