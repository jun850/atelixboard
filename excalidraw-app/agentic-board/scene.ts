import { convertToExcalidrawElements } from "@excalidraw/element/transform";
import { getCommonBounds } from "@excalidraw/element/bounds";
import { newElementWith } from "@excalidraw/element/mutateElement";
import { CaptureUpdateAction } from "@excalidraw/element";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";
import { pointFrom } from "@excalidraw/math";
import { randomId } from "@excalidraw/common";

import type { LocalPoint } from "@excalidraw/math";
import type { ExcalidrawElementSkeleton } from "@excalidraw/element/transform";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { validateContent } from "./catalog";

import type { Content, Template } from "./catalog";

const fills = ["#e7f5ff", "#fff3bf", "#d3f9d8", "#ffdeeb", "#e5dbff"];
export function buildTemplate(template: Template, input: Content) {
  const content = validateContent(input, template);
  const shapes: ExcalidrawElementSkeleton[] = [];
  let counter = 0;
  const geometry = new Map<
    string,
    { x: number; y: number; width: number; height: number }
  >();
  const text = (value: string, x: number, y: number, fontSize = 20) => {
    const id = `t${counter++}`;
    shapes.push({
      id,
      type: "text",
      x,
      y,
      text: value,
      fontSize,
      fontFamily: 2,
      strokeColor: "#1b1b1f",
    });
    return id;
  };
  const box = (
    value: string,
    x: number,
    y: number,
    width = 260,
    height = 130,
    color = 0,
    type: "rectangle" | "diamond" | "ellipse" = "rectangle",
  ) => {
    const id = `n${counter++}`;
    geometry.set(id, { x, y, width, height });
    shapes.push({
      id,
      type,
      x,
      y,
      width,
      height,
      backgroundColor: fills[color % fills.length],
      fillStyle: "solid",
      roughness: 0,
      strokeColor: "#495057",
      strokeWidth: 1,
      label: { text: value, fontSize: 18, fontFamily: 2 },
    });
    return id;
  };
  const edge = (start: string, end: string, label = "", returnPath = false) => {
    const from = geometry.get(start)!;
    const to = geometry.get(end)!;
    const dx = to.x + to.width / 2 - from.x - from.width / 2;
    const dy = to.y + to.height / 2 - from.y - from.height / 2;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const sign = Math.sign(horizontal ? dx : dy) || 1;
    const x =
      from.x + from.width / 2 + (horizontal ? sign * (from.width / 2 + 12) : 0);
    const y =
      from.y +
      from.height / 2 +
      (horizontal ? 0 : sign * (from.height / 2 + 12));
    const endX =
      to.x + to.width / 2 - (horizontal ? sign * (to.width / 2 + 12) : 0);
    const endY =
      to.y + to.height / 2 - (horizontal ? 0 : sign * (to.height / 2 + 12));
    const originX = returnPath ? from.x + from.width / 2 : x;
    const originY = returnPath ? from.y + from.height + 12 : y;
    const points = returnPath
      ? [
          pointFrom<LocalPoint>(0, 0),
          pointFrom<LocalPoint>(0, 60),
          pointFrom<LocalPoint>(to.x + to.width / 2 - originX, 60),
          pointFrom<LocalPoint>(
            to.x + to.width / 2 - originX,
            to.y + to.height + 12 - originY,
          ),
        ]
      : [
          pointFrom<LocalPoint>(0, 0),
          pointFrom<LocalPoint>(endX - x, endY - y),
        ];
    shapes.push({
      type: "arrow",
      x: originX,
      y: originY,
      points,
      start: { id: start },
      end: { id: end },
      endArrowhead: "arrow",
      strokeWidth: 1,
      roughness: 0,
      ...(label ? { label: { text: label, fontSize: 14, fontFamily: 2 } } : {}),
    });
  };
  const line = (x: number, y: number, width: number, height: number) =>
    shapes.push({
      type: "line",
      x,
      y,
      width,
      height,
      strokeStyle: "dashed",
      strokeWidth: 1,
    });
  const label = (i: number) =>
    `${content.sections[i].heading}\n\n${content.sections[i].items.join("\n")}`;
  // Text length controls spacing before conversion, so expanded labels do not collide.
  const cellHeight = Math.max(
    160,
    ...content.sections.map(
      (s) =>
        70 +
        s.items.reduce(
          (n, item) => n + Math.max(1, Math.ceil(item.length / 24)) * 24,
          0,
        ),
    ),
  );
  text(content.title, 0, -80, 32);
  switch (template.layout) {
    case "flow": {
      const nodes = content.sections.map((s, i) =>
        box(
          label(i),
          i * 420,
          i === 3 ? cellHeight + 130 : 0,
          320,
          cellHeight,
          i,
          i === 2 ? "diamond" : i === 0 || i === 4 ? "ellipse" : "rectangle",
        ),
      );
      edge(nodes[0], nodes[1]);
      edge(nodes[1], nodes[2]);
      edge(nodes[2], nodes[4], "Yes");
      edge(nodes[2], nodes[3], "No");
      edge(nodes[3], nodes[2], "Review again", true);
      break;
    }
    case "tree": {
      const positions = [
        [660, 0],
        [220, cellHeight + 90],
        [1100, cellHeight + 90],
        [0, 2 * (cellHeight + 90)],
        [440, 2 * (cellHeight + 90)],
        [880, 2 * (cellHeight + 90)],
        [1320, 2 * (cellHeight + 90)],
      ];
      const nodes = positions.map(([x, y], i) =>
        box(label(i), x, y, 320, cellHeight, i),
      );
      nodes.slice(1).forEach((id, i) => edge(nodes[Math.floor(i / 2)], id));
      break;
    }
    case "mind": {
      const center = box(content.title, 460, 2 * cellHeight, 280, 140);
      content.sections.forEach((s, i) => {
        const id = box(
          label(i),
          i % 2 ? 940 : 0,
          Math.floor(i / 2) * (cellHeight + 120),
          320,
          cellHeight,
          i + 1,
        );
        edge(center, id, template.id === "concept-map" ? "relates to" : "");
      });
      break;
    }
    case "sequence": {
      const nodes = content.sections.map((s, i) =>
        box(s.heading, i * 400, 0, 240, 80, i),
      );
      nodes.forEach((_, i) => line(i * 400 + 120, 80, 0, 680));
      for (let i = 0; i < 6; i++) {
        const from = i % 3;
        const to = (from + 1) % 3;
        shapes.push({
          type: "arrow",
          x: from * 400 + 120,
          y: 170 + i * 95,
          width: (to - from) * 400,
          height: 0,
          endArrowhead: "arrow",
          label: {
            text:
              content.sections[from].items[Math.floor(i / 3)] ||
              `Message ${i + 1} · TBD`,
            fontSize: 16,
          },
        });
      }
      break;
    }
    case "layers": {
      let previous: string | undefined;
      content.sections.forEach((s, i) => {
        text(s.heading, 0, i * (cellHeight + 100));
        const nodes = s.items.map((item, j) =>
          box(item, j * 360, i * (cellHeight + 100) + 45, 280, cellHeight, i),
        );
        if (previous && nodes[0]) {
          edge(previous, nodes[0]);
        }
        previous = nodes[0];
      });
      break;
    }
    case "tables": {
      const nodes = content.sections.map((s, i) => {
        const x = (i % 2) * 510;
        const y = Math.floor(i / 2) * (cellHeight + 160);
        const id = box(label(i), x, y, 330, cellHeight, i);
        line(x, y + 52, 330, 0);
        return id;
      });
      edge(
        nodes[0],
        nodes[1],
        template.id === "entity-relationship" ? "1 → many" : "uses",
      );
      edge(
        nodes[0],
        nodes[2],
        template.id === "entity-relationship" ? "1 → many" : "extends",
      );
      edge(
        nodes[2],
        nodes[3],
        template.id === "entity-relationship" ? "1 → many" : "uses",
      );
      break;
    }
    case "document":
      content.sections.forEach((s, i) =>
        box(label(i), 0, i * (cellHeight + 40), 720, cellHeight, i),
      );
      break;
    case "lanes":
      content.sections.forEach((s, i) => {
        box(s.heading, i * 350, 0, 300, 70, i);
        s.items.forEach((item, j) =>
          box(item, i * 350, 105 + j * (cellHeight + 30), 300, cellHeight, i),
        );
      });
      break;
    case "journey":
    case "stories": {
      const rows =
        template.layout === "journey"
          ? ["Actions", "Pain points", "Opportunities"]
          : ["Release 1", "Release 2"];
      rows.forEach((row, j) =>
        text(row, -185, 140 + j * (cellHeight + 35), 18),
      );
      content.sections.forEach((s, i) => {
        box(s.heading, i * 330, 0, 290, 70, i);
        rows.forEach((_, j) =>
          box(
            s.items[j] || "Add your content",
            i * 330,
            110 + j * (cellHeight + 35),
            290,
            cellHeight,
            i,
          ),
        );
      });
      break;
    }
    case "desktop":
    case "mobile": {
      const mobile = template.layout === "mobile";
      const w = mobile ? 380 : 1080;
      const start = shapes.length;
      box(content.sections[0].heading, 24, 24, w - 48, 70);
      if (!mobile) {
        box("Navigation\n\nItem\nItem\nItem", 24, 130, 180, 420, 4);
      }
      const x = mobile ? 24 : 240;
      const cw = mobile ? w - 48 : w - 270;
      content.sections
        .slice(1)
        .forEach((s, i) =>
          box(
            `${s.heading}\n${s.items[0] || ""}`,
            x,
            130 + i * (cellHeight + 30),
            cw,
            cellHeight,
            i + 1,
          ),
        );
      shapes.push({
        type: "frame",
        name: content.title,
        children: shapes
          .slice(start)
          .map((s) => s.id!)
          .filter(Boolean),
      });
      break;
    }
    case "timeline": {
      text(
        template.id === "gantt"
          ? "Illustrative units · no calendar dates assigned"
          : "Timing to confirm",
        0,
        0,
        18,
      );
      content.sections.forEach((s, i) => {
        text(s.heading, 0, 85 + i * (cellHeight + 25), 18);
        box(
          s.items.join("\n"),
          270 + i * 100,
          65 + i * (cellHeight + 25),
          350,
          cellHeight,
          i,
        );
      });
      break;
    }
    case "business": {
      const regions = [
        [0, 0, 300, 2],
        [330, 0, 300, 1],
        [330, 1, 300, 1],
        [660, 0, 300, 2],
        [990, 0, 300, 1],
        [990, 1, 300, 1],
        [1320, 0, 300, 2],
        [0, 2, 795, 1],
        [825, 2, 795, 1],
      ];
      regions.forEach(([x, y, w, h], i) =>
        box(
          label(i),
          x,
          y * (cellHeight + 30),
          w,
          h * cellHeight + (h - 1) * 30,
          i,
        ),
      );
      break;
    }
    case "frames":
      content.sections.forEach((s, i) => {
        const x = (i % 3) * 700;
        const y = Math.floor(i / 3) * (cellHeight + 230);
        const children = [box(label(i), x, y, 620, cellHeight + 100, i)];
        shapes.push({
          type: "frame",
          name: `${i + 1}. ${s.heading}`,
          children,
        });
      });
      break;
    case "components":
      content.sections.forEach((s, i) => {
        text(s.heading, 0, i * (cellHeight + 100));
        ["Default", "Selected", "Disabled"].forEach((state, j) =>
          box(
            `${state}\n${s.items[j] || s.heading}`,
            j * 350,
            i * (cellHeight + 100) + 45,
            300,
            cellHeight,
            j,
          ),
        );
      });
      break;
    default:
      content.sections.forEach((_, i) =>
        box(
          label(i),
          (i % 2) * 430,
          Math.floor(i / 2) * (cellHeight + 45),
          380,
          cellHeight,
          i,
        ),
      );
  }
  const elements = convertToExcalidrawElements(shapes);
  validateScene(elements);
  return elements;
}

export function validateScene(elements: readonly ExcalidrawElement[]) {
  if (
    !elements.length ||
    elements.length > 300 ||
    elements.some(
      (el) =>
        ![el.x, el.y, el.width, el.height].every(Number.isFinite) ||
        Math.max(Math.abs(el.x), Math.abs(el.y), el.width, el.height) > 100000,
    )
  ) {
    throw new Error("The draft exceeds the supported canvas size.");
  }
}

export function cloneSnapshot(elements: readonly ExcalidrawElement[]) {
  validateScene(elements);
  const ids = new Map(elements.map((e) => [e.id, randomId()]));
  const groups = new Map(
    elements.flatMap((e) => e.groupIds).map((id) => [id, randomId()]),
  );
  return restoreElements(
    elements.map((e) => ({
      ...e,
      id: ids.get(e.id)!,
      groupIds: e.groupIds.map((id) => groups.get(id)!),
      frameId: e.frameId ? ids.get(e.frameId) || null : null,
      boundElements:
        e.boundElements
          ?.filter((b) => ids.has(b.id))
          .map((b) => ({ ...b, id: ids.get(b.id)! })) || null,
      ...("containerId" in e
        ? { containerId: e.containerId ? ids.get(e.containerId) || null : null }
        : {}),
      ...("startBinding" in e
        ? {
            startBinding:
              e.startBinding && ids.has(e.startBinding.elementId)
                ? {
                    ...e.startBinding,
                    elementId: ids.get(e.startBinding.elementId)!,
                  }
                : null,
            endBinding:
              e.endBinding && ids.has(e.endBinding.elementId)
                ? {
                    ...e.endBinding,
                    elementId: ids.get(e.endBinding.elementId)!,
                  }
                : null,
          }
        : {}),
    })),
    null,
    { repairBindings: true },
  );
}

const nativeTypes = new Set([
  "rectangle",
  "diamond",
  "ellipse",
  "text",
  "arrow",
  "line",
  "freedraw",
  "frame",
  "image",
  "stickyNote",
]);
export function sanitizeSnapshot(elements: readonly ExcalidrawElement[]) {
  const allowed = elements.filter(
    (e) => !e.isDeleted && nativeTypes.has(e.type),
  );
  if (JSON.stringify(allowed).length > 512 * 1024) {
    throw new Error("Template is larger than 512 KiB.");
  }
  const clean = allowed.map(({ customData, link, ...e }) => ({
    ...e,
    customData: undefined,
    link: null,
  }));
  return {
    elements: cloneSnapshot(clean),
    excluded: elements.length - allowed.length,
  };
}
export type BaseVersions = Record<
  string,
  { version: number; versionNonce: number }
>;
export function getBaseVersions(
  elements: readonly ExcalidrawElement[],
): BaseVersions {
  return Object.fromEntries(
    elements.map((e) => [
      e.id,
      { version: e.version, versionNonce: e.versionNonce },
    ]),
  );
}
export function hasConflict(
  elements: readonly ExcalidrawElement[],
  base: BaseVersions,
) {
  return Object.entries(base).some(
    ([id, version]) =>
      !elements.some(
        (e) =>
          e.id === id &&
          !e.isDeleted &&
          e.version === version.version &&
          e.versionNonce === version.versionNonce,
      ),
  );
}
export function applyDraft(
  api: ExcalidrawImperativeAPI,
  draft: readonly ExcalidrawElement[],
  draftId: string,
  base: BaseVersions = {},
) {
  const current = api.getSceneElementsIncludingDeleted();
  if (current.some((e) => e.customData?.agenticDraftId === draftId)) {
    throw new Error("This draft has already been applied.");
  }
  if (hasConflict(current, base)) {
    throw new Error("Source changed. Regenerate, or insert a separate copy.");
  }
  const cloned = cloneSnapshot(draft);
  const [minX, minY] = getCommonBounds(cloned);
  const live = current.filter((e) => !e.isDeleted);
  const [, , maxX] = live.length ? getCommonBounds(live) : [0, 0, 0, 0];
  const additions = cloned.map((e) =>
    newElementWith(e, {
      x: e.x - minX + (live.length ? maxX + 120 : 0),
      y: e.y - minY,
      customData: { ...e.customData, agenticDraftId: draftId },
    }),
  );
  api.updateScene({
    elements: [...current, ...additions],
    appState: {
      selectedElementIds: Object.fromEntries(
        additions.map((e) => [e.id, true]),
      ),
    },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  api.setViewport({ target: additions, fit: "contain", animation: false });
}
