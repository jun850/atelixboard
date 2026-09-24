import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const result = spawnSync("supabase", ["status", "-o", "env"], {
  cwd: process.cwd(), encoding: "utf8",
});
if (result.status !== 0) throw new Error("Local Supabase unavailable");
const values = Object.fromEntries(result.stdout.split("\n")
  .map((line) => line.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean)
  .map((match) => [match[1], match[2].replace(/^"|"$/g, "")]));
if (!values.API_URL?.includes("127.0.0.1")) throw new Error("Local only");
const client = createClient(values.API_URL, values.ANON_KEY, {
  auth: { persistSession: false },
});
const { data, error } = await client.auth.signInWithPassword({
  email: "boardy-free-qa-20260923@localhost.test",
  password: "BoardyFreeQA!2026-09-23",
});
if (error || !data.session) throw error || new Error("Auth failed");
const call = async (fn, path, method, body) => {
  const response = await fetch(`${values.API_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      apikey: values.ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path, method, body }),
  });
  return { status: response.status, payload: await response.json() };
};
const dashboard = await call("workspace", "dashboard", "GET", {});
if (dashboard.status !== 200) throw new Error(`Dashboard ${dashboard.status}`);
const workspaceId = dashboard.payload.workspace.id;
const sceneId = dashboard.payload.whiteboards[0]?.id;
if (!sceneId) throw new Error("First free board missing");
const cases = [
  ["secondBoard", "scenes", "scenes", "POST", { title: "Blocked QA board", workspaceId, document: { version: 1, elements: [], appState: null, files: {} }, requestId: crypto.randomUUID() }],
  ["secondCollection", "workspace", "collections", "POST", { workspaceId, name: "Blocked QA collection", visibility: "private" }],
  ["comment", "workspace", `comments/${sceneId}`, "POST", { message: "Blocked QA comment", anchorKind: "general", anchor: {} }],
  ["liveCollaboration", "workspace", "collaboration-key", "POST", { workspaceId, sceneId, candidateRoomKey: "abcdefghijklmnopqrstuvwxyz" }],
];
const checks = {};
for (const [name, fn, path, method, body] of cases) {
  const response = await call(fn, path, method, body);
  checks[name] = `${response.status}:${response.payload.error}`;
  if (checks[name] !== "402:PRO_REQUIRED") throw new Error(`${name}: ${checks[name]}`);
}
console.log(JSON.stringify(checks));
