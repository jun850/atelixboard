import type { ExcalidrawElement, FileId } from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
} from "@excalidraw/excalidraw/types";

import { supabase } from "../supabase/client";

type StoredSceneDocument = {
  version: 1;
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState> | null;
  files: BinaryFiles;
};

type SceneMetadata = {
  id: string;
  title: string;
  current_revision_number: number;
};

const invoke = async <T>(path: string, method = "GET", body?: unknown) => {
  const { data, error } = await supabase.functions.invoke("scenes", {
    body: { path, method, body },
  });
  if (error) {
    const code = (data as { error?: string } | null)?.error;
    throw new Error(code || error.message || "CLOUD_STORAGE_ERROR");
  }
  return data as T;
};

class CloudSceneStore {
  private scene: SceneMetadata | null = null;
  private files = new Map<FileId, BinaryFileData>();
  private saveChain = Promise.resolve();
  private ownerWindow: Window | null = null;

  private requestId() {
    if (!this.ownerWindow) {
      throw new Error("CLOUD_STORAGE_ERROR");
    }
    return `${this.ownerWindow.crypto.randomUUID()}-${Date.now().toString(36)}`;
  }

  async initialize(ownerWindow: Window) {
    this.ownerWindow = ownerWindow;
    const url = new URL(ownerWindow.location.href);
    if (import.meta.env.DEV && url.searchParams.get("localDemo") === "1") {
      return { version: 1 as const, elements: [], appState: null, files: {} };
    }
    const { data: auth } = await supabase.auth.getSession();
    if (auth.session?.access_token === "local-demo") {
      return { version: 1 as const, elements: [], appState: null, files: {} };
    }
    const requestedId = url.searchParams.get("scene");
    let sceneId = requestedId;
    if (!sceneId) {
      const list = await invoke<{ scenes: SceneMetadata[] }>("scenes");
      sceneId = list.scenes[0]?.id || null;
    }
    if (!sceneId) {
      const created = await invoke<{ sceneId: string }>("scenes", "POST", {
        title: "Untitled scene",
        requestId: this.requestId(),
        document: { version: 1, elements: [], appState: null, files: {} },
      });
      sceneId = created.sceneId;
    }
    const loaded = await invoke<{
      scene: SceneMetadata;
      document: StoredSceneDocument;
    }>(`scenes/${sceneId}`);
    this.scene = loaded.scene;
    this.files = new Map(
      Object.entries(loaded.document.files || {}) as [FileId, BinaryFileData][],
    );
    if (url.searchParams.get("scene") !== sceneId) {
      url.searchParams.set("scene", sceneId);
      ownerWindow.history.replaceState({}, "", url);
    }
    return loaded.document;
  }

  getFiles(ids: FileId[]) {
    const loadedFiles: BinaryFileData[] = [];
    const erroredFiles = new Map<FileId, true>();
    ids.forEach((id) => {
      const file = this.files.get(id);
      if (file) {
        loadedFiles.push(file);
      } else {
        erroredFiles.set(id, true);
      }
    });
    return { loadedFiles, erroredFiles };
  }

  rememberFiles(files: BinaryFiles) {
    Object.entries(files).forEach(([id, file]) => {
      this.files.set(id as FileId, file);
    });
  }

  save(
    elements: readonly ExcalidrawElement[],
    appState: Partial<AppState>,
    files: BinaryFiles,
  ) {
    this.rememberFiles(files);
    this.saveChain = this.saveChain.then(async () => {
      if (!this.scene) {
        return;
      }
      const document: StoredSceneDocument = {
        version: 1,
        elements,
        appState,
        files: Object.fromEntries(this.files),
      };
      const result = await invoke<{ revisionNumber: number }>(
        `scenes/${this.scene.id}`,
        "PUT",
        {
          requestId: this.requestId(),
          expectedRevisionNumber: this.scene.current_revision_number,
          document,
        },
      );
      this.scene.current_revision_number = result.revisionNumber;
    });
    return this.saveChain;
  }

  flush() {
    return this.saveChain;
  }
}

export const cloudSceneData = new CloudSceneStore();
