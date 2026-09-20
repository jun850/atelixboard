import { mcpResult } from "./discovery-mcp.ts";
import { SITE } from "./discovery-content.ts";
import { normalizeDoc, docMarkdown } from "./studio-core.ts";
export async function studioMcp(admin: any, m: any) {
  const fallback = mcpResult(m);
  if (!fallback || ("error" in fallback && m?.method !== "resources/read"))
    return fallback;
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id: m.id, result });
  const fail = (message: string) => ({
    jsonrpc: "2.0",
    id: m.id,
    error: { code: -32602, message },
  });
  const render = (a: any) =>
    `# ${a.published.title}\n\n${a.published.description}\n\n${docMarkdown(
      normalizeDoc(a.published.doc),
    )}\nSource: ${SITE}/learn/${a.slug}`;
  if (m.method === "resources/read") {
    const match = String(m.params?.uri).match(
      /^https:\/\/boardy\.sbs\/learn\/([a-z0-9-]+)\.md$/,
    );
    if (!match) return fail("Unknown resource");
    const { data, error } = await admin
      .from("boardy_studio_articles")
      .select("slug,published")
      .eq("slug", match[1])
      .not("published", "is", null)
      .maybeSingle();
    if (error) throw error;
    return data
      ? ok({
          contents: [
            {
              uri: m.params.uri,
              mimeType: "text/markdown",
              text: render(data),
            },
          ],
        })
      : fail("Unknown resource");
  }
  if (
    m.method === "resources/list" ||
    (m.method === "tools/call" && m.params?.name === "search_boardy_docs")
  ) {
    const cursor = Number(m.params?.cursor || 0);
    if (!Number.isInteger(cursor) || cursor < 0 || cursor > 1000000)
      return fail("Invalid cursor");
    let query = admin
      .from("boardy_studio_articles")
      .select("slug,published")
      .not("published", "is", null)
      .order("created_at")
      .order("id");
    if (m.method === "tools/call") {
      const term = String(m.params.arguments.query)
        .replace(/[%_,().]/g, " ")
        .trim()
        .slice(0, 200);
      query = query.ilike("published->>title", `%${term}%`);
    }
    const { data, error } = await query.range(cursor, cursor + 24);
    if (error) throw error;
    if (m.method === "resources/list")
      return ok({
        resources: data.map((a: any) => ({
          uri: `${SITE}/learn/${a.slug}.md`,
          name: a.published.title,
          mimeType: "text/markdown",
        })),
        ...(data.length === 25 ? { nextCursor: String(cursor + 25) } : {}),
      });
    return ok({
      content: [
        {
          type: "text",
          text:
            data.map(render).join("\n---\n") ||
            "No matching published guides. Browse resources/list for the complete published library.",
        },
      ],
    });
  }
  return fallback;
}
