import { spawn, execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, access, realpath } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { setTimeout, clearTimeout } from "node:timers";

import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type {
  ConnectionAccount,
  Model,
  Subscription,
} from "../../excalidraw-app/agentic-board/protocol";

const execute = promisify(execFile);
export const runtimeVersions = { codex: "0.154.0", "claude-code": "2.1.226" };
const unavailable = () => new Error("RUNTIME_UNAVAILABLE");

export type RuntimeSnapshot = {
  account: ConnectionAccount;
  defaultModel?: string;
  models: Model[];
};

// Allowlist environment variables. Never inherit API keys, OAuth tokens, proxy URLs,
// provider overrides, hooks, or the parent agent's runtime configuration.
export function runtimeEnvironment(root: string): NodeJS.ProcessEnv {
  return {
    HOME: homedir(),
    PATH: "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
    LANG: "en_US.UTF-8",
    TMPDIR: tmpdir(),
    CODEX_HOME: join(root, "codex"),
    CLAUDE_CONFIG_DIR: join(root, "claude"),
    DISABLE_AUTOUPDATER: "1",
    CLAUDE_CODE_SAFE_MODE: "1",
  };
}

export const claudeArguments = [
  "-p",
  "--input-format",
  "stream-json",
  "--output-format",
  "stream-json",
  "--verbose",
  "--safe-mode",
  "--tools",
  "",
  "--disable-slash-commands",
  "--strict-mcp-config",
  "--mcp-config",
  '{"mcpServers":{}}',
  "--setting-sources",
  "",
  "--no-session-persistence",
  "--max-turns",
  "1",
];
export const codexConfig = {
  web_search: "disabled",
  sandbox_mode: "read-only",
  approval_policy: "never",
  cli_auth_credentials_store: "file",
  project_doc_max_bytes: 0,
  tools: {
    update_plan: { enabled: false },
    experimental_request_user_input: { enabled: false },
  },
  features: {
    skip_host_skill_discovery: true,
    ...Object.fromEntries(
      [
        "shell_tool",
        "unified_exec",
        "apps",
        "plugins",
        "remote_plugin",
        "hooks",
        "browser_use",
        "browser_use_external",
        "computer_use",
        "in_app_browser",
        "in_app_local_automation",
        "in_app_chat",
        "shell_snapshot",
        "image_generation",
        "view_image",
        "code_mode",
        "code_mode_host",
        "multi_agent",
        "multi_agent_v2",
        "goals",
        "sleep_tool",
        "skill_search",
        "skill_mcp_dependency_install",
        "tool_suggest",
        "workspace_dependencies",
        "external_agent_memory_import",
      ].map((key) => [key, false]),
    ),
  },
};

/** Narrow NDJSON transport; never expose runtime RPC or raw diagnostics to the browser. */
export class RuntimeProcess {
  child: ChildProcessWithoutNullStreams;
  private pending = new Map<
    string,
    {
      resolve: (v: any) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  onEvent?: (event: any) => void;
  private closed = false;
  constructor(
    binary: string,
    args: string[],
    root: string,
    private kind: Subscription,
    launch: typeof spawn = spawn,
  ) {
    this.child = launch(binary, args, {
      cwd: join(root, "work"),
      env: runtimeEnvironment(root),
      stdio: "pipe",
    });
    let buffer = "";
    this.child.stderr.resume(); // May contain credentials. Never log or return it.
    this.child.stdin.on("error", () => this.close());
    this.child.on("error", () => this.close());
    this.child.on("exit", () => this.close());
    this.child.stdout.on("data", (chunk) => {
      buffer += chunk;
      if (Buffer.byteLength(buffer) > 2 * 1024 * 1024) {
        this.close();
        return;
      }
      let newline;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        try {
          this.receive(JSON.parse(line));
        } catch {
          this.close();
        }
      }
    });
  }
  private receive(message: any) {
    const id =
      this.kind === "codex" ? message.id : message.response?.request_id;
    const pending = id === undefined ? undefined : this.pending.get(String(id));
    if (pending) {
      this.pending.delete(String(id));
      clearTimeout(pending.timer);
      if (message.error || message.response?.subtype === "error") {
        pending.reject(unavailable());
      } else {
        pending.resolve(
          this.kind === "codex" ? message.result : message.response.response,
        );
      }
      return;
    }
    // Fail closed on any server-initiated request. No tool execution or approvals.
    if (
      (message.method && message.id !== undefined) ||
      message.type === "control_request"
    ) {
      this.close();
      return;
    }
    this.onEvent?.(message);
  }
  write(value: unknown) {
    if (this.closed) {
      throw unavailable();
    }
    this.child.stdin.write(`${JSON.stringify(value)}\n`);
  }
  request(
    method: string,
    params: Record<string, unknown> = {},
    timeout = 30000,
  ): Promise<any> {
    if (this.closed) {
      return Promise.reject(unavailable());
    }
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(unavailable());
        this.close();
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.write(
        this.kind === "codex"
          ? { id, method, params }
          : {
              type: "control_request",
              request_id: id,
              request: { subtype: method, ...params },
            },
      );
    });
  }
  close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.child.kill("SIGTERM");
    const force = setTimeout(() => this.child.kill("SIGKILL"), 1000);
    force.unref();
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(unavailable());
    }
    this.pending.clear();
    this.onEvent?.({ type: "runtime_closed" });
  }
}

export function safeAuthUrl(value: unknown, kind: Subscription): string {
  if (typeof value !== "string") {
    throw unavailable();
  }
  const url = new URL(value);
  const hosts =
    kind === "codex"
      ? ["auth.openai.com", "chatgpt.com"]
      : ["claude.ai", "platform.claude.com", "console.anthropic.com"];
  if (
    url.protocol !== "https:" ||
    !hosts.includes(url.hostname) ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  ) {
    throw unavailable();
  }
  return url.href;
}

export class LocalRuntime {
  readonly id = randomUUID();
  private process?: RuntimeProcess;
  private authProcess?: ChildProcessWithoutNullStreams;
  private loginId?: string;
  private loginTimer?: ReturnType<typeof setTimeout>;
  private loginUrl?: string;
  private disposed = false;
  private constructor(
    readonly kind: Subscription,
    private binary: string,
    private root: string,
  ) {}
  static async create(kind: Subscription) {
    const candidates =
      kind === "codex"
        ? [
            join(homedir(), ".local/bin/codex"),
            "/opt/homebrew/bin/codex",
            "/usr/local/bin/codex",
          ]
        : [
            "/opt/homebrew/bin/claude",
            join(homedir(), ".local/bin/claude"),
            "/usr/local/bin/claude",
          ];
    let binary = "";
    for (const candidate of candidates) {
      try {
        await access(candidate);
        binary = candidate;
        break;
      } catch {}
    }
    if (!binary) {
      throw unavailable();
    }
    binary = await realpath(binary);
    const { stdout } = await execute(binary, ["--version"], {
      timeout: 10000,
      env: { HOME: homedir(), PATH: "/usr/bin:/bin" },
    });
    if (
      stdout.trim() !==
      (kind === "codex"
        ? `codex-cli ${runtimeVersions.codex}`
        : `${runtimeVersions["claude-code"]} (Claude Code)`)
    ) {
      throw unavailable();
    }
    const root = await mkdtemp(join(tmpdir(), "boardy-runtime-"));
    await Promise.all(
      ["work", "codex", "claude"].map((dir) =>
        mkdir(join(root, dir), { mode: 0o700 }),
      ),
    );
    return new LocalRuntime(kind, binary, root);
  }
  private async codex() {
    if (this.disposed) {
      throw unavailable();
    }
    if (!this.process) {
      const args = ["app-server", "--strict-config"];
      // CLI -c accepts TOML; JSON object literals are not TOML inline tables.
      const add = (prefix: string, value: any) => {
        if (value && typeof value === "object") {
          for (const [key, v] of Object.entries(value)) {
            add(prefix ? `${prefix}.${key}` : key, v);
          }
        } else {
          args.push("-c", `${prefix}=${JSON.stringify(value)}`);
        }
      };
      add("", codexConfig);
      const process = new RuntimeProcess(this.binary, args, this.root, "codex");
      try {
        await process.request("initialize", {
          clientInfo: { name: "boardy_local", version: "0.1.0" },
          capabilities: { experimentalApi: true },
        });
        process.write({ method: "initialized", params: {} });
        this.process = process;
      } catch (error) {
        process.close();
        throw error;
      }
    }
    return this.process;
  }
  async login(): Promise<{ url?: string; pending: boolean }> {
    if (this.loginId || this.authProcess) {
      return { url: this.loginUrl, pending: true };
    }
    if (this.kind === "codex") {
      const process = await this.codex();
      const result = await process.request("account/login/start", {
        type: "chatgpt",
        useHostedLoginSuccessPage: true,
      });
      this.loginId = result.loginId;
      this.loginUrl = safeAuthUrl(result.authUrl, this.kind);
      process.onEvent = (event) => {
        if (
          event.method === "account/login/completed" &&
          event.params.loginId === this.loginId
        ) {
          this.loginId = undefined;
          this.loginUrl = undefined;
          clearTimeout(this.loginTimer);
        }
      };
      this.loginTimer = setTimeout(() => {
        void this.cancelLogin();
      }, 5 * 60000);
      return { url: this.loginUrl, pending: true };
    }
    // The official CLI owns OAuth and its loopback callback. Boardy never accepts a code/token.
    const child = spawn(this.binary, ["auth", "login"], {
      cwd: join(this.root, "work"),
      env: runtimeEnvironment(this.root),
      stdio: "pipe",
    });
    this.authProcess = child;
    child.stderr.resume();
    child.stdin.on("error", () => {});
    return new Promise((resolve, reject) => {
      let output = "";
      const ready = setTimeout(() => resolve({ pending: true }), 2000);
      child.stdout.on("data", (chunk) => {
        output = (output + chunk).slice(-32768);
        for (const value of output.match(/https:\/\/[^\s]+/g) || []) {
          try {
            this.loginUrl = safeAuthUrl(
              value.split(String.fromCharCode(27))[0],
              this.kind,
            );
            clearTimeout(ready);
            resolve({ url: this.loginUrl, pending: true });
            break;
          } catch {}
        }
      });
      child.on("error", () => {
        clearTimeout(ready);
        this.authProcess = undefined;
        reject(unavailable());
      });
      child.on("exit", () => {
        clearTimeout(ready);
        clearTimeout(this.loginTimer);
        this.authProcess = undefined;
        this.loginUrl = undefined;
        resolve({ pending: false });
      });
      this.loginTimer = setTimeout(() => {
        void this.cancelLogin();
      }, 5 * 60000);
    });
  }
  async cancelLogin() {
    clearTimeout(this.loginTimer);
    this.authProcess?.kill("SIGTERM");
    this.authProcess = undefined;
    if (this.loginId) {
      await this.process
        ?.request("account/login/cancel", { loginId: this.loginId })
        .catch(() => {});
    }
    this.loginId = undefined;
    this.loginUrl = undefined;
  }
  async inspect(): Promise<RuntimeSnapshot> {
    if (this.disposed) {
      throw unavailable();
    }
    if (this.kind === "codex") {
      const process = await this.codex();
      const account = await process.request("account/read", {
        refreshToken: false,
      });
      if (account.account?.type !== "chatgpt") {
        throw new Error("SIGN_IN_REQUIRED");
      }
      const models: Model[] = [];
      let defaultModel: string | undefined;
      let cursor: string | undefined;
      for (let page = 0; page < 30; page++) {
        const result = await process.request("model/list", {
          limit: 100,
          includeHidden: false,
          ...(cursor ? { cursor } : {}),
        });
        for (const model of result.data) {
          if (model.isDefault === true) {
            defaultModel = model.model;
          }
          models.push({
            id: model.model,
            name: model.displayName,
            compatible: true,
            outputLimit: null,
            isDefault: model.isDefault === true,
            reasoningEfforts: (model.supportedReasoningEfforts || [])
              .map((option: any) => option.reasoningEffort)
              .filter((effort: unknown): effort is string =>
                ["none", "minimal", "low", "medium", "high"].includes(
                  String(effort),
                ),
              ),
          });
        }
        if (!result.nextCursor) {
          return {
            account: {
              label:
                typeof account.account.email === "string"
                  ? account.account.email
                  : "ChatGPT account",
              authMode: "subscription",
              ...(typeof account.account.planType === "string"
                ? { plan: account.account.planType }
                : {}),
            },
            defaultModel,
            models,
          };
        }
        if (cursor === result.nextCursor) {
          throw unavailable();
        }
        cursor = result.nextCursor;
      }
      throw unavailable();
    }
    const status = await execute(this.binary, ["auth", "status", "--json"], {
      cwd: join(this.root, "work"),
      env: runtimeEnvironment(this.root),
      timeout: 15000,
    }).catch(() => {
      throw new Error("SIGN_IN_REQUIRED");
    });
    const account = JSON.parse(status.stdout);
    if (!account.loggedIn || account.authMethod !== "claude.ai") {
      throw new Error("SIGN_IN_REQUIRED");
    }
    const process = new RuntimeProcess(
      this.binary,
      claudeArguments,
      this.root,
      this.kind,
    );
    try {
      const result = await process.request("initialize", {
        hooks: {},
        sdkMcpServers: [],
      });
      if (
        result.commands?.length ||
        result.account?.apiProvider !== "firstParty"
      ) {
        throw unavailable();
      }
      const unique = new Map<string, Model>();
      for (const model of result.models || []) {
        if (
          typeof model.resolvedModel === "string" &&
          model.value !== "default"
        ) {
          unique.set(model.resolvedModel, {
            id: model.resolvedModel,
            name: model.displayName,
            compatible: true,
            outputLimit: null,
          });
        }
      }
      if (!unique.size) {
        throw unavailable();
      }
      const defaultEntry = (result.models || []).find(
        (model: any) =>
          model.value === "default" && typeof model.resolvedModel === "string",
      );
      const defaultModel = defaultEntry?.resolvedModel;
      if (defaultModel && unique.has(defaultModel)) {
        unique.set(defaultModel, {
          ...unique.get(defaultModel)!,
          isDefault: true,
        });
      }
      return {
        account: {
          label:
            typeof account.email === "string"
              ? account.email
              : "Claude account",
          authMode: "subscription",
          ...(typeof account.subscriptionType === "string"
            ? { plan: account.subscriptionType }
            : {}),
        },
        defaultModel,
        models: [...unique.values()],
      };
    } finally {
      process.close();
    }
  }
  async models(): Promise<Model[]> {
    return (await this.inspect()).models;
  }
  async generate(
    model: string,
    instructions: string,
    prompt: string,
    signal: AbortSignal,
    reasoningEffort?: string,
  ): Promise<string> {
    if (signal.aborted || this.disposed) {
      throw new Error("CANCELLED");
    }
    if (this.kind === "codex") {
      const process = await this.codex();
      const thread = await process.request("thread/start", {
        model,
        cwd: join(this.root, "work"),
        environments: [],
        selectedCapabilityRoots: [],
        dynamicTools: [],
        ephemeral: true,
        approvalPolicy: "never",
        sandbox: "read-only",
        baseInstructions: instructions,
        config: codexConfig,
      });
      if (
        thread.model !== model ||
        thread.instructionSources?.length ||
        thread.thread.environments?.length !== 0
      ) {
        throw unavailable();
      }
      return new Promise((resolve, reject) => {
        let text = "";
        const finish = (error?: Error) => {
          signal.removeEventListener("abort", abort);
          process.onEvent = undefined;
          error ? reject(error) : resolve(text);
        };
        const abort = () => {
          process.close();
          this.process = undefined;
          finish(new Error("CANCELLED"));
        };
        signal.addEventListener("abort", abort, { once: true });
        process.onEvent = (event) => {
          if (event.type === "runtime_closed") {
            finish(
              new Error(signal.aborted ? "CANCELLED" : "RUNTIME_UNAVAILABLE"),
            );
            return;
          }
          if (event.params?.threadId !== thread.thread.id) {
            return;
          }
          if (event.method === "item/agentMessage/delta") {
            text += event.params.delta;
          }
          if (text.length > 300000) {
            abort();
          }
          if (event.method === "turn/completed") {
            finish(
              event.params.turn.status === "completed"
                ? undefined
                : new Error("PROVIDER_ERROR"),
            );
          }
        };
        if (signal.aborted) {
          abort();
          return;
        }
        void process
          .request("turn/start", {
            threadId: thread.thread.id,
            model,
            environments: [],
            input: [{ type: "text", text: prompt }],
            ...(reasoningEffort
              ? { effort: reasoningEffort, summary: "none" }
              : {}),
          })
          .catch(() =>
            finish(
              new Error(signal.aborted ? "CANCELLED" : "RUNTIME_UNAVAILABLE"),
            ),
          );
      });
    }
    const process = new RuntimeProcess(
      this.binary,
      [...claudeArguments, "--model", model, "--system-prompt", instructions],
      this.root,
      this.kind,
    );
    const abort = () => process.close();
    signal.addEventListener("abort", abort, { once: true });
    try {
      await process.request("initialize", { hooks: {}, sdkMcpServers: [] });
      return await new Promise<string>((resolve, reject) => {
        process.onEvent = (event) => {
          if (event.type === "runtime_closed") {
            reject(
              new Error(signal.aborted ? "CANCELLED" : "RUNTIME_UNAVAILABLE"),
            );
          }
          if (
            event.type === "system" &&
            event.subtype === "init" &&
            (event.tools?.length || event.mcp_servers?.length)
          ) {
            process.close();
          }
          if (
            event.type === "assistant" &&
            event.message?.content?.some(
              (item: any) => item.type === "tool_use",
            )
          ) {
            process.close();
          }
          if (event.type === "result") {
            event.is_error || event.subtype !== "success"
              ? reject(new Error("PROVIDER_ERROR"))
              : resolve(event.result);
          }
        };
        if (signal.aborted) {
          process.close();
          return;
        }
        process.write({
          type: "user",
          message: { role: "user", content: prompt },
          parent_tool_use_id: null,
          session_id: "",
        });
      });
    } finally {
      signal.removeEventListener("abort", abort);
      process.close();
    }
  }
  async dispose() {
    this.disposed = true;
    await this.cancelLogin();
    if (this.kind === "codex") {
      await this.process?.request("account/logout").catch(() => {});
    } else {
      await execute(this.binary, ["auth", "logout"], {
        cwd: join(this.root, "work"),
        env: runtimeEnvironment(this.root),
        timeout: 10000,
      }).catch(() => {});
    }
    this.process?.close();
    this.process = undefined;
    await rm(this.root, { recursive: true, force: true });
  }
}
