import { MIME_TYPES, toBrandedType } from "@excalidraw/common";
import { getSceneVersion } from "@excalidraw/element";
import { reconcileElements } from "@excalidraw/excalidraw";
import { decompressData } from "@excalidraw/excalidraw/data/encode";
import {
  decryptData,
  encryptData,
} from "@excalidraw/excalidraw/data/encryption";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";

import type {
  ExcalidrawElement,
  FileId,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFileMetadata,
  DataURL,
} from "@excalidraw/excalidraw/types";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";

import { FILE_CACHE_MAX_AGE_SEC } from "../app_constants";

import { requireSupabase } from "../supabase/client";

import { getSyncableElements } from ".";

import type { CollaborationSocket } from "../collab/CollaborationSocket";

import type { SyncableExcalidrawElement } from ".";

type StoredScene = {
  room_id: string;
  scene_version: number;
  ciphertext: string;
  iv: string;
};

const sceneVersions = new WeakMap<CollaborationSocket, number>();

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const hexToBytes = (value: string) => {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
};

const encryptElements = async (
  roomKey: string,
  elements: readonly ExcalidrawElement[],
) => {
  const encoded = new TextEncoder().encode(JSON.stringify(elements));
  const { encryptedBuffer, iv } = await encryptData(roomKey, encoded);
  return {
    ciphertext: bytesToHex(new Uint8Array(encryptedBuffer)),
    iv: bytesToHex(iv),
  };
};

const decryptElements = async (scene: StoredScene, roomKey: string) => {
  const decrypted = await decryptData(
    hexToBytes(scene.iv),
    hexToBytes(scene.ciphertext).buffer,
    roomKey,
  );
  return JSON.parse(new TextDecoder().decode(new Uint8Array(decrypted)));
};

export const isSavedToSupabase = (
  socket: CollaborationSocket | null,
  elements: readonly ExcalidrawElement[],
) => {
  if (!socket) {
    return true;
  }
  return sceneVersions.get(socket) === getSceneVersion(elements);
};

export const saveSceneToSupabase = async (
  socket: CollaborationSocket | null,
  roomId: string | null,
  roomKey: string | null,
  elements: readonly SyncableExcalidrawElement[],
  appState: AppState,
) => {
  if (!socket || !roomId || !roomKey || isSavedToSupabase(socket, elements)) {
    return null;
  }

  const client = requireSupabase();
  const { data: previous, error: loadError } = await client
    .from("board_scenes")
    .select("room_id, scene_version, ciphertext, iv")
    .eq("room_id", roomId)
    .maybeSingle<StoredScene>();
  if (loadError) {
    throw loadError;
  }

  let storedElements = elements;
  if (previous) {
    const previousElements = getSyncableElements(
      restoreElements(await decryptElements(previous, roomKey), null),
    );
    storedElements = getSyncableElements(
      reconcileElements(
        elements,
        previousElements as OrderedExcalidrawElement[] as RemoteExcalidrawElement[],
        appState,
      ),
    );
  }

  const sceneVersion = getSceneVersion(storedElements);
  const encrypted = await encryptElements(roomKey, storedElements);
  const { error: saveError } = await client.from("board_scenes").upsert({
    room_id: roomId,
    scene_version: sceneVersion,
    ...encrypted,
    updated_at: new Date().toISOString(),
  });
  if (saveError) {
    throw saveError;
  }

  sceneVersions.set(socket, sceneVersion);
  return toBrandedType<RemoteExcalidrawElement[]>([...storedElements]);
};

export const loadSceneFromSupabase = async (
  roomId: string,
  roomKey: string,
  socket: CollaborationSocket | null,
) => {
  const { data, error } = await requireSupabase()
    .from("board_scenes")
    .select("room_id, scene_version, ciphertext, iv")
    .eq("room_id", roomId)
    .maybeSingle<StoredScene>();
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  const elements = getSyncableElements(
    restoreElements(await decryptElements(data, roomKey), null, {
      deleteInvisibleElements: true,
    }),
  );
  if (socket) {
    sceneVersions.set(socket, getSceneVersion(elements));
  }
  return elements;
};

export const saveFilesToSupabase = async ({
  roomId,
  files,
}: {
  roomId: string;
  files: { id: FileId; buffer: Uint8Array }[];
}) => {
  const bucket = requireSupabase().storage.from("board-files");
  const savedFiles: FileId[] = [];
  const erroredFiles: FileId[] = [];

  await Promise.all(
    files.map(async ({ id, buffer }) => {
      const { error } = await bucket.upload(`${roomId}/${id}`, buffer, {
        cacheControl: String(FILE_CACHE_MAX_AGE_SEC),
        contentType: "application/octet-stream",
        upsert: true,
      });
      if (error) {
        erroredFiles.push(id);
      } else {
        savedFiles.push(id);
      }
    }),
  );
  return { savedFiles, erroredFiles };
};

export const loadFilesFromSupabase = async (
  roomId: string,
  decryptionKey: string,
  fileIds: readonly FileId[],
) => {
  const bucket = requireSupabase().storage.from("board-files");
  const loadedFiles: BinaryFileData[] = [];
  const erroredFiles = new Map<FileId, true>();

  await Promise.all(
    [...new Set(fileIds)].map(async (id) => {
      const { data, error } = await bucket.download(`${roomId}/${id}`);
      if (error || !data) {
        erroredFiles.set(id, true);
        return;
      }
      try {
        const { data: decoded, metadata } =
          await decompressData<BinaryFileMetadata>(
            new Uint8Array(await data.arrayBuffer()),
            { decryptionKey },
          );
        loadedFiles.push({
          mimeType: metadata.mimeType || MIME_TYPES.binary,
          id,
          dataURL: new TextDecoder().decode(decoded) as DataURL,
          created: metadata.created || Date.now(),
          lastRetrieved: metadata.created || Date.now(),
        });
      } catch (error) {
        console.error(error);
        erroredFiles.set(id, true);
      }
    }),
  );

  return { loadedFiles, erroredFiles };
};
