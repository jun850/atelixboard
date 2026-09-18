export const DOCUMENT_LINK_PREFIX = "https://document.boardy.invalid/";

export type BoardyDocumentData = {
  version: 1;
  documentId: string;
  title: string;
  sourceType: "pdf" | "doc" | "docx";
};

export type DocumentRevision = {
  id: string;
  createdAt: string;
  fileName: string;
  fileType: string;
  sha256: string;
  size: number;
};

export type DocumentRecord = {
  id: string;
  ownerId: string;
  roomId: string | null;
  title: string;
  sourceType: string;
  currentRevisionId: string;
  createdAt: string;
  updatedAt: string;
  revisions: DocumentRevision[];
};

export type OnlyOfficeSession = {
  documentServerUrl: string;
  config: Record<string, unknown>;
};

export const getBoardyDocumentData = (
  customData: Record<string, any> | undefined,
): BoardyDocumentData | null => {
  const candidate = customData?.boardyDocument;
  return candidate?.version === 1 &&
    typeof candidate.documentId === "string" &&
    typeof candidate.title === "string"
    ? candidate
    : null;
};
