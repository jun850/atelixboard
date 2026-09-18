import { clearSidebarForPersistence } from "./localStorage";

describe("Boardy local app state", () => {
  it("does not persist an open sidebar between page loads", () => {
    const appState = {
      openSidebar: {
        name: "default" as const,
        tab: "agentic-assistant" as const,
      },
      defaultSidebarDockedPreference: true,
    };

    expect(clearSidebarForPersistence(appState)).toEqual({
      ...appState,
      openSidebar: null,
    });
    expect(appState.openSidebar?.tab).toBe("agentic-assistant");
  });
});
