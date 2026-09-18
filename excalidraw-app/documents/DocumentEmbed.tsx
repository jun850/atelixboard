import { useCallback, useEffect, useRef, useState } from "react";
import { PDFDocument, rgb } from "pdf-lib";

import type { AppState } from "@excalidraw/excalidraw/types";

import type { ExcalidrawEmbeddableElement } from "@excalidraw/element/types";

import {
  createEditorSession,
  downloadDocument,
  getDocument,
  getDocumentBytes,
  getDocumentPagePreview,
  saveAnnotatedPdf,
} from "./api";
import { getBoardyDocumentData } from "./types";

import "./document-embed.scss";

import type { DocumentRecord } from "./types";

type Point = { x: number; y: number };
type Stroke = { page: number; points: Point[] };

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (id: string, config: Record<string, unknown>) => {
        destroyEditor: () => void;
      };
    };
  }
}

const loadOnlyOffice = async (ownerDocument: Document, baseUrl: string) => {
  const ownerWindow = ownerDocument.defaultView;
  if (!ownerWindow) {
    throw new Error("Document window is unavailable.");
  }
  if (ownerWindow.DocsAPI) {
    return;
  }
  const source = `${baseUrl.replace(
    /\/$/,
    "",
  )}/web-apps/apps/api/documents/api.js`;
  const existing = ownerDocument.querySelector<HTMLScriptElement>(
    `script[data-boardy-onlyoffice="${source}"]`,
  );
  await new Promise<void>((resolve, reject) => {
    const script = existing || ownerDocument.createElement("script");
    const done = () =>
      ownerWindow.DocsAPI
        ? resolve()
        : reject(new Error("Editor API did not load."));
    script.addEventListener("load", done, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("ONLYOFFICE is not running on localhost:8080.")),
      { once: true },
    );
    if (!existing) {
      script.src = source;
      script.dataset.boardyOnlyoffice = source;
      ownerDocument.head.append(script);
    }
  });
};

const DesktopEditor = ({
  id,
  ownerDocument,
}: {
  id: string;
  ownerDocument: Document;
}) => {
  const hostId = useRef(
    `boardy-document-${id}-${Math.random().toString(36).slice(2)}`,
  );
  const [error, setError] = useState("");
  useEffect(() => {
    let editor: { destroyEditor: () => void } | undefined;
    let cancelled = false;
    void createEditorSession(id)
      .then(async (session) => {
        await loadOnlyOffice(ownerDocument, session.documentServerUrl);
        if (!cancelled) {
          editor = new ownerDocument.defaultView!.DocsAPI!.DocEditor(
            hostId.current,
            session.config,
          );
        }
      })
      .catch((reason) => setError(reason.message));
    return () => {
      cancelled = true;
      editor?.destroyEditor();
    };
  }, [id, ownerDocument]);
  return error ? (
    <div className="boardy-document__message" role="alert">
      <strong>Editor unavailable</strong>
      <span>{error}</span>
      <span>Start the local document service, then reopen this document.</span>
    </div>
  ) : (
    <div className="boardy-document__editor-shell">
      <div
        className="boardy-document__editor"
        id={hostId.current}
        aria-label="Document editor"
      />
    </div>
  );
};

const PdfViewer = ({
  id,
  ownerDocument,
}: {
  id: string;
  ownerDocument: Document;
}) => {
  const pageRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const pageImageUrlRef = useRef("");
  const bytesRef = useRef<Uint8Array | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const activeRef = useRef<Stroke | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [drawing, setDrawing] = useState(false);
  const [pageImage, setPageImage] = useState("");
  const [sourceReady, setSourceReady] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [status, setStatus] = useState("Loading preview…");

  const redrawOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#e03131";
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 3;
    for (const stroke of strokesRef.current.filter(
      (item) => item.page === page,
    )) {
      context.beginPath();
      stroke.points.forEach((point, index) =>
        index
          ? context.lineTo(point.x, point.y)
          : context.moveTo(point.x, point.y),
      );
      context.stroke();
    }
  }, [page]);

  useEffect(() => {
    let cancelled = false;
    void getDocumentBytes(id)
      .then(async (bytes) => {
        const source = new Uint8Array(bytes);
        const pdf = await PDFDocument.load(source.slice());
        if (!cancelled) {
          bytesRef.current = source;
          setPages(pdf.getPageCount());
          setSourceReady(true);
          setStatus("Rendering page…");
        }
      })
      .catch((reason) => setStatus(reason.message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const ownerWindow = ownerDocument.defaultView;
    if (!ownerWindow || !sourceReady) {
      return;
    }
    let cancelled = false;
    setStatus("Rendering page…");
    void getDocumentPagePreview(id, page)
      .then((preview) => {
        if (cancelled) {
          return;
        }
        const nextUrl = ownerWindow.URL.createObjectURL(preview);
        if (pageImageUrlRef.current) {
          ownerWindow.URL.revokeObjectURL(pageImageUrlRef.current);
        }
        pageImageUrlRef.current = nextUrl;
        setPageImage(nextUrl);
        setStatus("");
      })
      .catch((reason) => {
        if (!cancelled) {
          setStatus(reason?.message || "The PDF page could not be rendered.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, ownerDocument, page, previewVersion, sourceReady]);

  useEffect(
    () => () => {
      const ownerWindow = ownerDocument.defaultView;
      if (ownerWindow && pageImageUrlRef.current) {
        ownerWindow.URL.revokeObjectURL(pageImageUrlRef.current);
      }
    },
    [ownerDocument],
  );

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x:
        ((event.clientX - bounds.left) / bounds.width) *
        event.currentTarget.width,
      y:
        ((event.clientY - bounds.top) / bounds.height) *
        event.currentTarget.height,
    };
  };

  const save = async () => {
    if (!bytesRef.current) {
      return;
    }
    setStatus("Saving annotation…");
    try {
      const pdf = await PDFDocument.load(bytesRef.current.slice());
      for (const stroke of strokesRef.current) {
        const pdfPage = pdf.getPage(stroke.page - 1);
        const overlay = overlayRef.current!;
        const scaleX = pdfPage.getWidth() / overlay.width;
        const scaleY = pdfPage.getHeight() / overlay.height;
        for (let index = 1; index < stroke.points.length; index++) {
          const from = stroke.points[index - 1];
          const to = stroke.points[index];
          pdfPage.drawLine({
            start: {
              x: from.x * scaleX,
              y: pdfPage.getHeight() - from.y * scaleY,
            },
            end: { x: to.x * scaleX, y: pdfPage.getHeight() - to.y * scaleY },
            thickness: 2,
            color: rgb(0.88, 0.12, 0.16),
          });
        }
      }
      const saved = await pdf.save();
      await saveAnnotatedPdf(id, saved);
      bytesRef.current = new Uint8Array(saved);
      strokesRef.current = [];
      redrawOverlay();
      setPreviewVersion((version) => version + 1);
      setStatus("Saved as a new PDF revision.");
    } catch (reason: any) {
      setStatus(reason.message);
    }
  };

  return (
    <div className="boardy-document__viewer">
      <div className="boardy-document__toolbar">
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1}
        >
          Previous
        </button>
        <span>
          {page} / {pages}
        </span>
        <button
          onClick={() => setPage(Math.min(pages, page + 1))}
          disabled={page === pages}
        >
          Next
        </button>
        <button aria-pressed={drawing} onClick={() => setDrawing(!drawing)}>
          Annotate
        </button>
        <button
          onClick={() => {
            strokesRef.current = [];
            redrawOverlay();
          }}
        >
          Clear
        </button>
        <button onClick={save}>Save revision</button>
        <button onClick={() => downloadDocument(id, ownerDocument)}>
          Download
        </button>
      </div>
      {status && (
        <div className="boardy-document__status" aria-live="polite">
          {status}
        </div>
      )}
      <div className="boardy-document__page" ref={pageRef}>
        {pageImage && (
          <img
            src={pageImage}
            alt={`Page ${page} of ${pages}`}
            onLoad={(event) => {
              const overlay = overlayRef.current;
              if (!overlay) {
                return;
              }
              overlay.width = event.currentTarget.naturalWidth;
              overlay.height = event.currentTarget.naturalHeight;
              redrawOverlay();
            }}
          />
        )}
        <canvas
          ref={overlayRef}
          className={drawing ? "is-drawing" : ""}
          onPointerDown={(event) => {
            if (!drawing) {
              return;
            }
            event.currentTarget.setPointerCapture(event.pointerId);
            activeRef.current = { page, points: [point(event)] };
            strokesRef.current.push(activeRef.current);
          }}
          onPointerMove={(event) => {
            if (!activeRef.current) {
              return;
            }
            activeRef.current.points.push(point(event));
            redrawOverlay();
          }}
          onPointerUp={() => {
            activeRef.current = null;
          }}
        />
      </div>
    </div>
  );
};

export const DocumentEmbed = ({
  element,
  appState,
}: {
  element: ExcalidrawEmbeddableElement;
  appState: AppState;
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const data = getBoardyDocumentData(element.customData);
  const documentId = data?.documentId;
  const [record, setRecord] = useState<DocumentRecord | null>(null);
  const [error, setError] = useState("");
  const active = appState.activeEmbeddable?.element?.id === element.id;
  const ownerDocument = rootRef.current?.ownerDocument;

  useEffect(() => {
    if (!documentId) {
      return;
    }
    void getDocument(documentId)
      .then(setRecord)
      .catch((reason) => setError(reason.message));
  }, [documentId]);

  if (!data) {
    return null;
  }
  return (
    <div
      className={`boardy-document${active ? " is-active" : ""}`}
      ref={rootRef}
      aria-label={`${data.title} document`}
    >
      {!ownerDocument ? (
        <div className="boardy-document__message" aria-live="polite">
          Loading document…
        </div>
      ) : error ? (
        <div className="boardy-document__message" role="alert">
          <strong>Document unavailable</strong>
          <span>{error}</span>
        </div>
      ) : !record ? (
        <div className="boardy-document__message" aria-live="polite">
          Loading {data.title}…
        </div>
      ) : (record.revisions.at(-1)?.fileType || data.sourceType) === "pdf" ? (
        <PdfViewer id={data.documentId} ownerDocument={ownerDocument} />
      ) : (
        <DesktopEditor id={data.documentId} ownerDocument={ownerDocument} />
      )}
      {ownerDocument &&
        record &&
        (record.revisions.at(-1)?.fileType || data.sourceType) !== "pdf" && (
          <button
            className="boardy-document__download"
            onClick={() => downloadDocument(data.documentId, ownerDocument)}
            aria-label={`Download ${data.title}`}
          >
            Download
          </button>
        )}
    </div>
  );
};
