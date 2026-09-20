import { articles, markdown, SITE } from "./discovery-content.ts";

// Stateless, public, read-only Streamable HTTP subset. No workspace tools.
export function mcpResult(message: unknown) {
  const m = message as {
    jsonrpc?: unknown;
    id?: unknown;
    method?: unknown;
    params?: { name?: unknown; arguments?: { query?: unknown }; uri?: unknown };
  };
  const id =
    typeof m?.id === "string" || typeof m?.id === "number" ? m.id : null;
  const error = (code: number, message: string) => ({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });
  if (
    !m ||
    typeof m !== "object" ||
    Array.isArray(m) ||
    m.jsonrpc !== "2.0" ||
    typeof m.method !== "string"
  )
    return error(-32600, "Invalid request");
  if (m.id === undefined) return null;
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id, result });
  switch (m.method) {
    case "initialize":
      return ok({
        protocolVersion: "2025-06-18",
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: "boardy-public-docs", version: "1.0.0" },
        instructions:
          "Public Boardy by Atelix documentation. No account or private board access.",
      });
    case "ping":
      return ok({});
    case "tools/list":
      return ok({
        tools: [
          {
            name: "get_boardy_facts",
            description:
              "Read canonical public facts about Boardy by Atelix, including access requirements and limitations.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, openWorldHint: false },
          },
          {
            name: "search_boardy_docs",
            description: "Search original public Boardy guides.",
            inputSchema: {
              type: "object",
              properties: { query: { type: "string", maxLength: 200 } },
              required: ["query"],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, openWorldHint: false },
          },
        ],
      });
    case "tools/call": {
      if (m.params?.name === "get_boardy_facts")
        return ok({
          content: [
            {
              type: "text",
              text: markdown(articles[0]) + "\n" + markdown(articles[4]),
            },
          ],
        });
      if (m.params?.name !== "search_boardy_docs")
        return error(-32602, "Unknown tool");
      const query = m.params.arguments?.query;
      if (typeof query !== "string" || !query.trim() || query.length > 200)
        return error(-32602, "query must contain 1–200 characters");
      const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
      const found = articles.filter((a) =>
        terms.some((term) => markdown(a).toLowerCase().includes(term)),
      );
      return ok({
        content: [
          {
            type: "text",
            text:
              found.map(markdown).join("\n---\n") ||
              "No matching public guides.",
          },
        ],
      });
    }
    case "resources/list":
      return ok({
        resources: articles.map((a) => ({
          uri: `${SITE}/learn/${a.slug}.md`,
          name: a.title,
          mimeType: "text/markdown",
        })),
      });
    case "resources/read": {
      const article = articles.find(
        (a) => m.params?.uri === `${SITE}/learn/${a.slug}.md`,
      );
      return article
        ? ok({
            contents: [
              {
                uri: m.params!.uri,
                mimeType: "text/markdown",
                text: markdown(article),
              },
            ],
          })
        : error(-32602, "Unknown resource");
    }
    default:
      return error(-32601, "Method not found");
  }
}
