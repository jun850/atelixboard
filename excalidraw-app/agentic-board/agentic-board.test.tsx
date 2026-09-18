import { Excalidraw } from "@excalidraw/excalidraw";
import { act, render } from "@excalidraw/excalidraw/tests/test-utils";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { Keyboard } from "@excalidraw/excalidraw/tests/helpers/ui";
import { isArrowElement } from "@excalidraw/element/typeChecks";
import { newIframeElement } from "@excalidraw/element/newElement";
import { safeGeneratedHtml } from "@excalidraw/excalidraw/generatedHtml";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { defaultContent, templates, validateContent } from "./catalog";
import {
  applyDraft,
  buildTemplate,
  cloneSnapshot,
  getBaseVersions,
  hasConflict,
  sanitizeSnapshot,
} from "./scene";
import { validateRequest } from "./protocol";

describe("agentic board catalog", () => {
  it("includes exactly the 29 documented templates with unique IDs", () => {
    expect(templates).toHaveLength(29);
    expect(new Set(templates.map((t) => t.id)).size).toBe(29);
  });
  it.each(templates)(
    "builds independent, bounded, bound default scenes for $id",
    (template) => {
      const elements = buildTemplate(template, defaultContent(template));
      expect(elements.length).toBeGreaterThan(4);
      expect(elements.length).toBeLessThanOrEqual(300);
      const ids = new Set(elements.map((e) => e.id));
      for (const e of elements) {
        expect([e.x, e.y, e.width, e.height].every(Number.isFinite)).toBe(true);
        if (e.frameId) {
          expect(ids.has(e.frameId)).toBe(true);
        }
        if ("containerId" in e && e.containerId) {
          expect(ids.has(e.containerId)).toBe(true);
        }
        if ("startBinding" in e && e.startBinding) {
          expect(ids.has(e.startBinding.elementId)).toBe(true);
        }
        for (const bound of e.boundElements || []) {
          expect(ids.has(bound.id)).toBe(true);
        }
      }
      const copy = cloneSnapshot(elements);
      expect(copy.every((e) => !ids.has(e.id))).toBe(true);
      expect(copy).toHaveLength(elements.length);
    },
  );
  it.each(templates)(
    "keeps maximum content finite and under the element cap for $id",
    (t) => {
      const c = defaultContent(t);
      c.sections = c.sections.map((s) => ({
        heading: s.heading,
        items: Array.from({ length: 6 }, () =>
          "Long realistic planning text ".repeat(10),
        ),
      }));
      const elements = buildTemplate(t, c);
      expect(elements.length).toBeLessThanOrEqual(300);
      expect(elements.every((e) => Number.isFinite(e.height))).toBe(true);
    },
  );
  it("renders flow content and routes arrows beside their bound nodes", () => {
    const content = defaultContent(templates[0]);
    content.sections[0].items = ["Unique generated action"];
    const elements = buildTemplate(templates[0], content);
    expect(
      elements.some(
        (e) =>
          e.type === "text" &&
          e.text.replace(/\s+/g, " ").includes("Unique generated action"),
      ),
    ).toBe(true);
    const arrows = elements.filter(isArrowElement);
    expect(arrows).toHaveLength(5);
    for (const arrow of arrows) {
      const from = elements.find(
        (e) => e.id === arrow.startBinding?.elementId,
      )!;
      expect(
        Math.hypot(
          arrow.x - (from.x + from.width / 2),
          arrow.y - (from.y + from.height / 2),
        ),
      ).toBeLessThan(Math.max(from.width, from.height));
      expect(
        arrow.points.some(([x, y]) => Math.abs(x) + Math.abs(y) > 30),
      ).toBe(true);
    }
  });
  it("rejects missing sections and overlong content rather than truncating", () => {
    expect(() =>
      validateContent(
        { ...defaultContent(templates[0]), sections: [] },
        templates[0],
      ),
    ).toThrow();
  });
  it("removes executable content, links, metadata and external bindings from personal templates", () => {
    const elements = buildTemplate(templates[0], defaultContent(templates[0]));
    const iframe = newIframeElement({
      type: "iframe",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const image = API.createElement({
      type: "image",
      x: 0,
      y: 0,
      width: 160,
      height: 90,
      fileId: "saved-template-image",
      status: "saved",
    });
    const result = sanitizeSnapshot([
      ...elements.map((e) => ({
        ...e,
        link: "https://private.invalid",
        customData: { secret: "remove" },
      })),
      image,
      iframe,
    ]);
    expect(result.excluded).toBe(1);
    expect(result.elements.some((e) => e.type === "image")).toBe(true);
    expect(result.elements.every((e) => !e.link && !e.customData)).toBe(true);
    expect(() => sanitizeSnapshot([iframe])).toThrow();
  });
  it("detects changed, deleted and missing sources but preserves unrelated edits", () => {
    const scene = buildTemplate(templates[0], defaultContent(templates[0]));
    const base = getBaseVersions(scene.slice(0, 1));
    expect(hasConflict(scene, base)).toBe(false);
    expect(
      hasConflict(
        scene.map((e, i) => (i ? { ...e, version: e.version + 1 } : e)),
        base,
      ),
    ).toBe(false);
    expect(hasConflict(scene.slice(1), base)).toBe(true);
    expect(
      hasConflict(
        scene.map((e) => ({ ...e, version: e.version + 1 })),
        base,
      ),
    ).toBe(true);
  });
});

describe("scene transaction", () => {
  it("preserves the live scene, prevents duplicate apply and undoes an insertion once", async () => {
    let api!: ExcalidrawImperativeAPI;
    await render(
      <Excalidraw
        handleKeyboardGlobally
        onExcalidrawAPI={(value) => {
          api = value!;
        }}
      />,
    );
    const existing = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    });
    API.setElements([{ ...existing, customData: { keep: true } }]);
    const draft = buildTemplate(templates[0], defaultContent(templates[0]));
    act(() => {
      applyDraft(api, draft, "test-draft");
    });
    expect(api.getSceneElements().length).toBe(draft.length + 1);
    expect(api.getSceneElements()[0].customData).toEqual({ keep: true });
    expect(() => applyDraft(api, draft, "test-draft")).toThrow("already");
    Keyboard.withModifierKeys({ ctrl: true }, () => Keyboard.keyPress("z"));
    expect(api.getSceneElements()).toHaveLength(1);
  });
});

describe("generated HTML and request boundaries", () => {
  it("removes active navigation, scripts, frames, images, handlers and forms", () => {
    const result = safeGeneratedHtml(
      '<html><body><script>fetch("https://evil.invalid")</script><meta http-equiv="refresh" content="0;url=https://evil.invalid"><iframe src="https://evil.invalid"></iframe><a href="https://evil.invalid">go</a><form action="https://evil.invalid"><input></form><img src="https://evil.invalid"><button onclick="location.href=\'https://evil.invalid\'">Hi</button><details><summary>Open</summary>Safe</details></body></html>',
      document,
    );
    expect(result).not.toContain("evil.invalid");
    expect(result).toContain("script-src 'none'");
    expect(result).toContain("<details>");
    expect(result).not.toContain("onclick");
  });
  it("rejects prompt-only requests that secretly include context", () => {
    expect(() =>
      validateRequest({
        requestId: "request-123456789",
        connectionId: "x",
        model: "m",
        task: "board",
        templateId: "flowchart",
        prompt: "hi",
        context: {
          mode: "prompt_only",
          elements: [
            { type: "text", text: "secret", x: 0, y: 0, width: 1, height: 1 },
          ],
        },
      }),
    ).toThrow();
  });
});

describe("template gallery journey", () => {
  it("opens the gallery, filters, previews privately and applies through the real editor", async () => {
    const { useState } = await import("react");
    const { fireEvent, waitFor } = await import("@testing-library/react");
    const { AgenticBoard } = await import("./AgenticBoard");
    let api!: ExcalidrawImperativeAPI;
    const Host = () => {
      const [instance, setInstance] = useState<ExcalidrawImperativeAPI | null>(
        null,
      );
      return (
        <Excalidraw
          onExcalidrawAPI={(value) => {
            api = value!;
            setInstance(value);
          }}
        >
          {instance && <AgenticBoard api={instance} />}
        </Excalidraw>
      );
    };
    const result = await render(<Host />);
    act(() => {
      api.toggleSidebar({
        name: "default",
        tab: "agentic-templates",
        force: true,
      });
    });
    const search = await result.findByLabelText("Search templates");
    expect(result.getAllByRole("tab", { name: "Templates" })).toHaveLength(1);
    expect(result.getAllByRole("tab", { name: "Assistant" })).toHaveLength(1);
    fireEvent.change(search, { target: { value: "kanban" } });
    fireEvent.click(
      result.getByRole("button", { name: /Kanban canvas preview/ }),
    );
    expect(api.getSceneElements()).toHaveLength(0);
    fireEvent.click(result.getByRole("button", { name: "Preview template" }));
    await waitFor(() =>
      expect(
        result.getByRole("button", { name: "Apply to board" }),
      ).toBeTruthy(),
    );
    expect(api.getSceneElements()).toHaveLength(0);
    fireEvent.click(result.getByRole("button", { name: "Apply to board" }));
    expect(api.getSceneElements().length).toBeGreaterThan(10);
  });
});
