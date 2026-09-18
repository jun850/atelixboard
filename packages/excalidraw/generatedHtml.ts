// All generated HTML, including imported scenes, receives this policy. Ordinary URL embeds do not.
// Script execution is disabled until a network-isolated JavaScript runtime is available.
export function safeGeneratedHtml(html: string, ownerDocument: Document) {
  if (new TextEncoder().encode(html).length > 256 * 1024) {
    return "<p>Preview exceeds the supported size.</p>";
  }
  const doc = ownerDocument.implementation.createHTMLDocument("");
  const template = doc.createElement("template");
  template.innerHTML = html;
  const allowed = new Set([
    "HTML",
    "HEAD",
    "BODY",
    "TITLE",
    "STYLE",
    "DIV",
    "SPAN",
    "P",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "SECTION",
    "MAIN",
    "HEADER",
    "FOOTER",
    "NAV",
    "ARTICLE",
    "ASIDE",
    "BUTTON",
    "INPUT",
    "LABEL",
    "TEXTAREA",
    "SELECT",
    "OPTION",
    "DETAILS",
    "SUMMARY",
    "UL",
    "OL",
    "LI",
    "TABLE",
    "THEAD",
    "TBODY",
    "TR",
    "TH",
    "TD",
    "STRONG",
    "EM",
    "B",
    "I",
    "SMALL",
    "BR",
    "HR",
    "PRE",
    "CODE",
  ]);
  for (const el of Array.from(template.content.querySelectorAll("*"))) {
    if (!allowed.has(el.tagName)) {
      el.remove();
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      if (
        !/^(class|id|style|title|type|value|placeholder|checked|disabled|selected|open|name|for|role|aria-[\w-]+|min|max|step|rows|cols|colspan|rowspan)$/.test(
          attr.name,
        )
      ) {
        el.removeAttribute(attr.name);
      }
    }
    if (el.tagName === "INPUT" && el.getAttribute("type") === "file") {
      el.remove();
    }
  }
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; media-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none';"><meta name="referrer" content="no-referrer"></head><body>${template.innerHTML}</body></html>`;
}
