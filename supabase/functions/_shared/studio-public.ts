import { publicContent, SITE } from "./discovery-content.ts";
import { esc, normalizeDoc, renderDoc, docMarkdown } from "./studio-core.ts";
const html = (
  title: string,
  description: string,
  path: string,
  main: string,
  article = false,
) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(
    title,
  )} | Boardy by Atelix</title><meta name="description" content="${esc(
    description,
  )}"><link rel="canonical" href="${esc(
    SITE + path,
  )}"><link rel="stylesheet" href="/discovery.css"><script type="application/ld+json">${JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": article ? "Article" : "CollectionPage",
      headline: title,
      description,
      url: SITE + path,
      author: { "@type": "Organization", name: "Boardy by Atelix" },
    },
  ).replace(
    /</g,
    "\\u003c",
  )}</script></head><body><header><a class="brand" href="/">Boardy <small>by <img src="/atelix-horizontal.png" alt="Atelix" width="62" height="20"></small></a><nav><a href="/learn">Guides</a><a href="/signup">Open Boardy</a></nav></header><main id="main">${main}</main><footer><a href="/">Boardy by Atelix</a><a href="/llms.txt">AI documentation</a></footer></body></html>`;
export async function studioPublic(admin: any, path: string, page = 0) {
  const result = (
    body: string,
    type = "text/html; charset=utf-8",
    status = 200,
  ) => ({ body, type, status });
  if (path.startsWith("/learn/") && path !== "/learn/") {
    const slug = path.slice(7).replace(/\.md$/, "");
    const r = await admin
      .from("boardy_studio_articles")
      .select("slug,published")
      .eq("slug", slug)
      .maybeSingle();
    if (r.error) throw Error("Content unavailable");
    if (!r.data) return publicContent(path);
    if (!r.data.published) return result("Not found", "text/plain", 404);
    const a = r.data.published;
    const doc = normalizeDoc(a.doc);
    if (path.endsWith(".md"))
      return result(
        `# ${a.title}\n\n${a.description}\n\n${docMarkdown(doc)}`,
        "text/markdown; charset=utf-8",
      );
    return result(
      html(
        a.title,
        a.description,
        path,
        `<article><a href="/learn">All guides</a><h1>${esc(
          a.title,
        )}</h1><p class="intro">${esc(a.description)}</p>${renderDoc(
          doc,
        )}<p><a href="${esc(path)}.md">Read as Markdown</a></p></article>`,
        true,
      ),
    );
  }
  if (
    !["/learn", "/sitemap.xml", "/llms.txt", "/llms-full.txt", "/ai"].includes(
      path,
    )
  )
    return publicContent(path);
  const size = path === "/sitemap.xml" ? 1000 : 50;
  const r = await admin
    .from("boardy_studio_articles")
    .select("slug,published", { count: "exact" })
    .not("published", "is", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .range(
      (path === "/sitemap.xml" ? Math.max(0, page - 1) : page) * size,
      (path === "/sitemap.xml" ? Math.max(0, page - 1) : page) * size +
        size -
        1,
    );
  if (r.error) throw Error("Content unavailable");
  const rows = r.data;
  const more = (page + 1) * size < r.count;
  if (path === "/sitemap.xml")
    return result(
      `<?xml version="1.0" encoding="UTF-8"?>` +
        (r.count > 1000 && page === 0
          ? `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Array.from(
              { length: Math.ceil(r.count / 1000) },
              (_, i) =>
                `<sitemap><loc>${SITE}/sitemap.xml?page=${
                  i + 1
                }</loc></sitemap>`,
            ).join("")}</sitemapindex>`
          : `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE}/</loc></url><url><loc>${SITE}/learn</loc></url>${rows
              .map((a: any) => `<url><loc>${SITE}/learn/${a.slug}</loc></url>`)
              .join("")}</urlset>`),
      "application/xml; charset=utf-8",
    );
  if (path === "/ai")
    return result(
      JSON.stringify({
        name: "Boardy by Atelix",
        url: SITE,
        documentation: SITE + "/learn",
        llms: SITE + "/llms.txt",
        mcp: SITE + "/mcp",
        articles: rows.map((a: any) => ({
          title: a.published.title,
          url: `${SITE}/learn/${a.slug}`,
        })),
        next: more ? `${SITE}/ai?page=${page + 1}` : null,
      }),
      "application/json",
    );
  if (path === "/llms.txt")
    return result(
      `# Boardy by Atelix\n\nBrowser-based collaborative whiteboard with AI-assisted creation.\n\n${rows
        .map(
          (a: any) =>
            `- [${a.published.title}](${SITE}/learn/${a.slug}.md): ${a.published.description}`,
        )
        .join("\n")}\n${
        more ? `\nNext: ${SITE}/llms.txt?page=${page + 1}` : ""
      }`,
      "text/plain; charset=utf-8",
    );
  if (path === "/llms-full.txt")
    return result(
      rows
        .map(
          (a: any) =>
            `# ${a.published.title}\n\n${docMarkdown(
              normalizeDoc(a.published.doc),
            )}`,
        )
        .join("\n---\n") +
        (more ? `\nNext: ${SITE}/llms-full.txt?page=${page + 1}` : ""),
      "text/plain; charset=utf-8",
    );
  const nav = `<nav aria-label="Guide pages">${
    page ? `<a href="/learn?page=${page - 1}">Previous</a>` : ""
  } <span>Page ${page + 1}</span> ${
    more ? `<a href="/learn?page=${page + 1}">Next</a>` : ""
  }</nav>`;
  return result(
    html(
      "The Boardy guides",
      "Practical guides to AI-assisted visual collaboration.",
      "/learn" + (page ? `?page=${page}` : ""),
      `<h1>Ideas into action. The Boardy guides.</h1><p class="intro">Practical guides to AI-assisted whiteboarding, brainstorming, flowcharts, and collaborative planning.</p><div class="guides">${rows
        .map(
          (a: any) =>
            `<article><h2><a href="/learn/${a.slug}">${esc(
              a.published.title,
            )}</a></h2><p>${esc(a.published.description)}</p></article>`,
        )
        .join("")}</div>${nav}`,
    ),
  );
}
