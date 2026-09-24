import { spawn, spawnSync } from "node:child_process";

const result = spawnSync("supabase", ["status", "-o", "env"], {
  cwd: process.cwd(),
  encoding: "utf8",
});
if (result.status !== 0) {
  throw new Error("Local Supabase is unavailable.");
}
const values = Object.fromEntries(
  result.stdout
    .split("\n")
    .map((line) => line.match(/^([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^"|"$/g, "")]),
);
if (!values.API_URL?.includes("127.0.0.1") || !values.ANON_KEY) {
  throw new Error("Refusing to start QA against a remote Supabase project.");
}
const child = spawn("../node_modules/.bin/vite", ["--host", "127.0.0.1", "--port", "5174"], {
  cwd: `${process.cwd()}/excalidraw-app`,
  env: {
    ...process.env,
    VITE_SUPABASE_URL: values.API_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: values.ANON_KEY,
  },
  stdio: "inherit",
});
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
