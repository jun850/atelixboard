import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import {
  RuntimeProcess,
  runtimeEnvironment,
  safeAuthUrl,
} from "../../scripts/agentic-board/local-runtime";

describe("local runtime transport", () => {
  let child: any;
  let runtime: RuntimeProcess;
  beforeEach(() => {
    child = Object.assign(new EventEmitter(), {
      stdin: new PassThrough(),
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: vi.fn(),
    });
  });
  afterEach(() => {
    runtime?.close();
    vi.restoreAllMocks();
  });
  it("decodes split RPC responses and keeps notifications separate", async () => {
    runtime = new RuntimeProcess(
      "codex",
      [],
      "/tmp/test",
      "codex",
      () => child,
    );
    const requested = runtime.request("model/list");
    const request = JSON.parse(child.stdin.read().toString());
    const response = JSON.stringify({ id: request.id, result: { data: [] } });
    child.stdout.write(response.slice(0, 15));
    child.stdout.write(`${response.slice(15)}\n`);
    await expect(requested).resolves.toEqual({ data: [] });
  });
  it("rejects server tool requests and all pending calls", async () => {
    runtime = new RuntimeProcess(
      "codex",
      [],
      "/tmp/test",
      "codex",
      () => child,
    );
    const requested = runtime.request("model/list");
    child.stdout.write(
      `${JSON.stringify({
        id: "tool",
        method: "item/commandExecution/requestApproval",
        params: {},
      })}\n`,
    );
    await expect(requested).rejects.toThrow("RUNTIME_UNAVAILABLE");
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  });
  it("decodes Claude control responses without accepting tool approvals", async () => {
    runtime = new RuntimeProcess(
      "claude",
      [],
      "/tmp/test",
      "claude-code",
      () => child,
    );
    const requested = runtime.request("initialize", { hooks: {} });
    const request = JSON.parse(child.stdin.read().toString());
    expect(request.request.subtype).toBe("initialize");
    child.stdout.write(
      `${JSON.stringify({
        type: "control_response",
        response: {
          subtype: "success",
          request_id: request.request_id,
          response: { models: [] },
        },
      })}\n`,
    );
    await expect(requested).resolves.toEqual({ models: [] });
    child.stdout.write(
      `${JSON.stringify({
        type: "control_request",
        request_id: "approval",
        request: { subtype: "can_use_tool" },
      })}\n`,
    );
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  });
  it("does not forward runtime errors containing credentials", async () => {
    runtime = new RuntimeProcess(
      "codex",
      [],
      "/tmp/test",
      "codex",
      () => child,
    );
    const requested = runtime.request("account/read");
    const request = JSON.parse(child.stdin.read().toString());
    child.stdout.write(
      `${JSON.stringify({
        id: request.id,
        error: { message: "secret-access-token" },
      })}\n`,
    );
    await expect(requested).rejects.toThrow(/^RUNTIME_UNAVAILABLE$/);
  });
});

describe("local credential boundaries", () => {
  it("does not inherit keys or runtime/provider overrides", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "secret");
    vi.stubEnv("OPENAI_API_KEY", "secret");
    vi.stubEnv("CLAUDE_CODE_OAUTH_TOKEN", "secret");
    vi.stubEnv("HTTPS_PROXY", "https://evil.invalid");
    try {
      const env = runtimeEnvironment("/tmp/isolated");
      expect(JSON.stringify(env)).not.toContain("secret");
      expect(env.HTTPS_PROXY).toBeUndefined();
      expect(env.CODEX_HOME).toBe("/tmp/isolated/codex");
      expect(env.CLAUDE_CONFIG_DIR).toBe("/tmp/isolated/claude");
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it.each([
    "http://auth.openai.com/login",
    "https://auth.openai.com.evil.invalid/login",
    "https://user:secret@auth.openai.com/login",
    "https://auth.openai.com:8443/login",
    // eslint-disable-next-line no-script-url -- rejected attack fixture
    "javascript:alert(1)",
  ])("rejects unsafe login URL %s", (url) => {
    expect(() => safeAuthUrl(url, "codex")).toThrow();
  });
  it("accepts only each runtime's official login destination", () => {
    expect(
      safeAuthUrl("https://auth.openai.com/authorize?state=example", "codex"),
    ).toContain("auth.openai.com");
    expect(
      safeAuthUrl("https://claude.ai/oauth/authorize", "claude-code"),
    ).toContain("claude.ai");
    expect(() =>
      safeAuthUrl("https://claude.ai/oauth/authorize", "codex"),
    ).toThrow();
  });
});
