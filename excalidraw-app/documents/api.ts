import { supabase } from "../supabase/client";

import type { DocumentRecord, OnlyOfficeSession } from "./types";

const headers = async (): Promise<Record<string, string>> => {
  const { data } = await supabase.auth.getSession();
  return {
    "x-boardy-local": "1",
    ...(import.meta.env.DEV ? { "x-boardy-local-demo": "1" } : {}),
    ...(data.session?.access_token
      ? { Authorization: `Bearer ${data.session.access_token}` }
      : {}),
  };
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`/__documents${path}`, {
    ...init,
    headers: { ...(await headers()), ...init?.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      payload?.error || `Document request failed (${response.status})`,
    );
  }
  return response.json();
};

export const uploadDocument = async (file: File, roomId: string | null) =>
  request<DocumentRecord>("/upload", {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "x-file-name": encodeURIComponent(file.name),
      ...(roomId ? { "x-boardy-room-id": roomId } : {}),
    },
    body: file,
  });

export const getDocument = (id: string) =>
  request<DocumentRecord>(`/${id}/meta`);

export const createEditorSession = (id: string) =>
  request<OnlyOfficeSession>(`/${id}/session`, { method: "POST" });

export const getDocumentBytes = async (id: string) => {
  const response = await fetch(`/__documents/${id}/download`, {
    headers: await headers(),
  });
  if (!response.ok) {
    throw new Error(`Could not load document (${response.status})`);
  }
  return response.arrayBuffer();
};

export const getDocumentPagePreview = async (id: string, page: number) => {
  const response = await fetch(`/__documents/${id}/preview?page=${page}`, {
    headers: await headers(),
  });
  if (!response.ok) {
    throw new Error(`Could not render PDF page (${response.status})`);
  }
  return response.blob();
};

export const saveAnnotatedPdf = (id: string, bytes: Uint8Array) =>
  request<DocumentRecord>(`/${id}/annotated`, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: bytes as BodyInit,
  });

export const downloadDocument = async (id: string, ownerDocument: Document) => {
  const response = await fetch(`/__documents/${id}/download`, {
    headers: await headers(),
  });
  if (!response.ok) {
    throw new Error(`Could not download document (${response.status})`);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1];
  const ownerWindow = ownerDocument.defaultView;
  if (!ownerWindow) {
    throw new Error("The document window is unavailable.");
  }
  const url = ownerWindow.URL.createObjectURL(blob);
  const anchor = ownerDocument.createElement("a");
  anchor.href = url;
  anchor.download = encodedName ? decodeURIComponent(encodedName) : "document";
  anchor.click();
  ownerWindow.setTimeout(() => ownerWindow.URL.revokeObjectURL(url), 1000);
};
