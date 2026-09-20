import { writeFileSync } from "node:fs";
import {
  roleInstructions,
  SKILL_VERSION,
} from "../../supabase/functions/_shared/studio-core";
for (const kind of ["research", "prompts", "article", "review", "check"])
  writeFileSync(
    `scripts/discovery/skills/${kind}.md`,
    `# Boardy ${kind}\n\nVersion: ${SKILL_VERSION}\n\n${roleInstructions(
      kind,
    )}\n\nCapabilities: ${
      ["research", "prompts", "check"].includes(kind)
        ? "live web search"
        : "no web search"
    }. No shell, files, connected apps, private MCP, or publication tools. Fresh ephemeral thread for each job.\n`,
  );
writeFileSync(
  "scripts/discovery/skills/analysis.md",
  "# Boardy analysis\n\nVersion: 1.0.0\n\nExecuted deterministically by SQL aggregates, not a language model. Count successful recorded answers only. Retain prompt/model versions. Separate explicit product mentions, incidental Boardy links, provider source citations, crawler requests, AI referrals, and other requests. A zero denominator is missing data. No market-share or consumer ChatGPT ranking claims. No publication authority.\n",
);
