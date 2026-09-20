import { writeFileSync } from "node:fs";
import {
  articles,
  trackedPrompts,
} from "../../supabase/functions/_shared/discovery-content";
const q = (v: unknown) =>
  "'" +
  String(typeof v === "string" ? v : JSON.stringify(v)).replace(/'/g, "''") +
  "'";
let sql =
  "-- Preserve existing public URLs and their traffic histories. Original reviewed Boardy guides.\n";
for (const a of articles) {
  const doc = {
    type: "doc",
    content: a.sections.flatMap(([heading, body]) => [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: heading }],
      },
      { type: "paragraph", content: [{ type: "text", text: body }] },
    ]),
  };
  sql += `insert into public.boardy_studio_articles(slug,title,description,doc,published,published_at) values(${q(
    a.slug,
  )},${q(a.title)},${q(a.description)},${q(doc)}::jsonb,${q({
    title: a.title,
    description: a.description,
    doc,
    version: 1,
  })}::jsonb,now()) on conflict(slug) do nothing;\n`;
}
for (const text of trackedPrompts.filter((t) => !/boardy/i.test(t)))
  sql += `insert into public.boardy_studio_prompts(text,topic) values(${q(
    text,
  )},'Visual collaboration') on conflict do nothing;\n`;
sql += `insert into public.boardy_studio_knowledge(name,body,source_url,approved) values('Verified Boardy product facts',${q(
  articles[0].sections.map(([h, b]) => h + "\n" + b).join("\n\n") +
    "\n\nVerified against shipped source: " +
    articles[0].evidence.join(", "),
)},'https://boardy.sbs/learn/what-is-boardy-ai',true);\n`;
writeFileSync("/tmp/boardy-studio-seed.sql", sql);
