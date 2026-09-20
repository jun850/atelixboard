import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/discovery/*.{test.ts,test.tsx}"],
  },
});
