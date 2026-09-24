import { describe, expect, it } from "vitest";

import { normalizeWorkspaceDashboard } from "./api";

import type { WorkspaceDashboard } from "./types";

describe("workspace dashboard compatibility", () => {
  it("keeps an older dashboard response usable without granting Pro creation", () => {
    const legacyDashboard = {
      whiteboards: [],
      collections: [],
    } as unknown as WorkspaceDashboard;

    expect(normalizeWorkspaceDashboard(legacyDashboard)).toMatchObject({
      whiteboards: [],
      collections: [],
      trashBoards: [],
      freeCreation: {
        boardAvailable: false,
        collectionAvailable: false,
      },
    });
  });
});
