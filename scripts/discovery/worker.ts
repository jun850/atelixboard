import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

import { LocalRuntime } from "../agentic-board/local-runtime";

import { roleInstructions } from "../../supabase/functions/_shared/studio-core";

import { subscriptionExhausted } from "./capacity";
import { verifyPromptEvidence } from "./source-evidence";

const log = (message: string) => process.stdout.write(`${message}\n`);

async function main() {
  const root = join(homedir(), ".boardy-discovery");
  const endpoint =
    "https://hdrigcjadfaatdruyfza.supabase.co/functions/v1/discovery-studio";
  await mkdir(root, { recursive: true, mode: 0o700 });
  const configPath = join(root, "device.json");
  let token = "";
  async function call(body: unknown) {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { "x-boardy-worker": token } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const value = (await r.json()) as any;
    if (!r.ok || value.error) {
      throw Error(value.error || `HTTP ${r.status}`);
    }
    return value;
  }
  if (process.argv[2] === "pair") {
    const code = process.argv[3];
    if (!code) {
      throw Error("Usage: yarn discovery:worker pair <dashboard-code>");
    }
    const paired = await call({ action: "pair", code });
    await writeFile(configPath, JSON.stringify(paired), { mode: 0o600 });
    log("Paired with Boardy. Run yarn discovery:worker login.");
    process.exit(0);
  }
  try {
    token = JSON.parse(await readFile(configPath, "utf8")).token;
  } catch {
    if (process.argv[2] !== "login") {
      throw Error("Pair this Mac from Boardy → Connection first.");
    }
  }
  const runtime = await LocalRuntime.create("codex", join(root, "runtime"));
  if (process.argv[2] === "install") {
    await runtime.inspect();
    await runtime.dispose();
    const xml = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    const label = "com.boardy.discovery-worker";
    const dir = join(homedir(), "Library/LaunchAgents");
    await mkdir(dir, { recursive: true });
    const plist = join(dir, `${label}.plist`);
    const args = [
      process.execPath,
      resolve("node_modules/tsx/dist/cli.mjs"),
      resolve("scripts/discovery/worker.ts"),
      "start",
    ];
    await writeFile(
      plist,
      `<?xml version="1.0"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array>${args
        .map((a) => `<string>${xml(a)}</string>`)
        .join("")}</array><key>WorkingDirectory</key><string>${xml(
        process.cwd(),
      )}</string><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>30</integer><key>StandardOutPath</key><string>${xml(
        join(root, "worker.log"),
      )}</string><key>StandardErrorPath</key><string>${xml(
        join(root, "worker.log"),
      )}</string></dict></plist>`,
      { mode: 0o600 },
    );
    const exec = promisify(execFile);
    await exec("/bin/launchctl", [
      "bootout",
      `gui/${process.getuid!()}/${label}`,
    ]).catch(() => {});
    await exec("/bin/launchctl", [
      "bootstrap",
      `gui/${process.getuid!()}`,
      plist,
    ]);
    log(
      "Boardy worker installed for this Mac login. Revoke it in Boardy to stop access.",
    );
    return;
  }
  if (process.argv[2] === "login") {
    const auth = await runtime.login();
    if (auth.url) {
      log("Finish ChatGPT sign-in in your browser.");
      execFile("/usr/bin/open", [auth.url]);
    }
    for (let i = 0; i < 150; i++) {
      await sleep(2000);
      try {
        const snapshot = await runtime.inspect();
        if (snapshot.account) {
          if (token) {
            await call({
              action: "heartbeat",
              status: { connected: true, models: snapshot.models },
            });
          }
          log(
            "ChatGPT connected. Select a model in Boardy → Connection, then start the worker.",
          );
          await runtime.dispose();
          process.exit(0);
        }
      } catch {}
    }
    await runtime.dispose();
    throw Error("Login timed out. Run the login command again.");
  }
  let stopping = false;
  let abort: AbortController | undefined;
  process.on("SIGINT", () => {
    stopping = true;
    abort?.abort();
  });
  process.on("SIGTERM", () => {
    stopping = true;
    abort?.abort();
  });
  log("Boardy worker running. Credentials remain on this Mac.");
  while (!stopping) {
    try {
      const snapshot = await runtime.inspect();
      const limits: any = await runtime.limits();
      const limited = subscriptionExhausted(limits);
      const status = {
        connected: true,
        models: snapshot.models,
        limits,
        message: limited
          ? "Subscription limit reached. Waiting for reset."
          : "",
      };
      await call({ action: "heartbeat", status });
      if (limited) {
        await sleep(60000);
        continue;
      }
      const { job } = await call({ action: "claim" });
      if (!job) {
        await sleep(30000);
        continue;
      }
      abort = new AbortController();
      const controller = abort;
      let renewing = false;
      const heartbeat = setInterval(async () => {
        if (renewing) {
          return;
        }
        renewing = true;
        try {
          const r = await call({
            action: "heartbeat",
            status,
            jobId: job.id,
            lease: job.lease_token,
          });
          if (!r.active) {
            controller.abort();
          }
        } catch {
          controller.abort();
        } finally {
          renewing = false;
        }
      }, 30000);
      const deadline = setTimeout(() => controller.abort(), 600000);
      log(`Running ${job.kind} ${job.id}`);
      try {
        if (!snapshot.models.some((m: any) => m.id === job.input.model)) {
          throw Error(
            "Selected model is unavailable. Choose another model explicitly.",
          );
        }
        const prompt =
          job.kind === "check" ? job.input.prompt : JSON.stringify(job.input);
        const artifacts: unknown[] = [];
        const output = await runtime.generate(
          job.input.model,
          roleInstructions(job.kind),
          prompt,
          controller.signal,
          undefined,
          ["research", "prompts", "check"].includes(job.kind),
          (artifact) => {
            if (artifacts.length < 100) {
              artifacts.push(artifact);
            }
          },
        );
        const result =
          job.kind === "check"
            ? { answer: output }
            : JSON.parse(
                output.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, ""),
              );
        if (job.kind === "prompts") {
          await verifyPromptEvidence(result, undefined, controller.signal);
        }
        result.artifacts = artifacts;
        // Keep a private receipt before upload so an uncertain network result is recoverable.
        await writeFile(
          join(root, `receipt-${job.id}.json`),
          JSON.stringify({ jobId: job.id, lease: job.lease_token, result }),
          { mode: 0o600 },
        );
        await call({
          action: "finish",
          jobId: job.id,
          lease: job.lease_token,
          result,
        });
        log(`Completed ${job.kind}`);
      } catch (e) {
        const error = e instanceof Error ? e.message : "Generation failed";
        console.error(error);
        await call({
          action: "finish",
          jobId: job.id,
          lease: job.lease_token,
          error,
        }).catch(() => {});
      } finally {
        clearInterval(heartbeat);
        clearTimeout(deadline);
        abort = undefined;
      }
    } catch (e) {
      console.error(e instanceof Error ? e.message : "Worker unavailable");
      await call({
        action: "heartbeat",
        status: {
          connected: false,
          message: "Sign-in or connection required. Check the worker log.",
        },
      }).catch(() => {});
      await sleep(30000);
    }
  }
  await runtime.dispose();
}
void main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
