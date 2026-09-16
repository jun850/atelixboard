import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Excalidraw,
  convertToExcalidrawElements,
  CaptureUpdateAction,
} from "@excalidraw/excalidraw";

import {
  CloseIcon,
  EraserIcon,
  LibraryIcon,
  LockedIcon,
  share,
  messageCircleIcon,
  presentationIcon,
} from "@excalidraw/excalidraw/components/icons";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import "./EditorArtwork.scss";

const names = [
  "Maya Chen",
  "Alex Rivera",
  "Jordan",
  "Nora",
  "Theo",
  "Sam",
  "Riley",
];
const messages = [
  "The hand-drawn canvas keeps the idea open. Let’s explore this direction together.",
  "This blue works well. Can we keep the same treatment across the next set of frames?",
  "I’ve added my notes here so we can keep the feedback close to the work.",
];
const Avatar = ({ index = 0 }: { index?: number }) => (
  <span className={`editor-art-avatar tone-${index % 5}`}>
    {names[index % names.length][0]}
  </span>
);
const Stack = ({ index = 0 }: { index?: number }) => (
  <span className="editor-art-stack">
    <Avatar index={index} />
    <Avatar index={index + 1} />
    <Avatar index={index + 2} />
  </span>
);
const Glyph = ({ kind }: { kind: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {kind === "search" ? (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 5 5" />
      </>
    ) : kind === "chevron" ? (
      <path d="m14 7-5 5 5 5" />
    ) : kind === "check" ? (
      <path d="m5 12 4 4L19 6" />
    ) : kind === "dots" ? (
      <path d="M12 5v1m0 5v1m0 5v1" />
    ) : kind === "link" ? (
      <path d="m9 15 6-6M8 16l-1 1a4 4 0 0 1-5-5l4-4a4 4 0 0 1 5 0m2 8a4 4 0 0 0 5 0l4-4a4 4 0 0 0-5-5l-1 1" />
    ) : kind === "copy" ? (
      <>
        <rect x="7" y="7" width="13" height="13" rx="2" />
        <path d="M16 7V3H3v13h4" />
      </>
    ) : kind === "panel" ? (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M10 4v16" />
      </>
    ) : (
      <path d="M4 7h16M4 12h16M4 17h16M8 5v4m8 1v4m-7 1v4" />
    )}
  </svg>
);

export const EditorArtwork = () => {
  const shellRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [frameDocument, setFrameDocument] = useState<Document | null>(null);
  useEffect(() => {
    const node = shellRef.current;
    const ownerWindow = node?.ownerDocument.defaultView;
    if (!node || !ownerWindow) {
      return;
    }
    const resize = () => setScale(node.clientWidth / 1750);
    resize();
    const observer = new ownerWindow.ResizeObserver(resize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      className="editor-art-shell"
      ref={shellRef}
      role="img"
      aria-label="Boardy editor preview. Log in to create and edit boards."
      onContextMenu={(event) => event.preventDefault()}
    >
      <iframe
        title="Boardy editor preview"
        tabIndex={-1}
        aria-hidden="true"
        className="editor-art-frame"
        style={{ transform: `scale(${scale})` }}
        onLoad={(event) => {
          const frame = event.currentTarget;
          const doc = frame.contentDocument;
          if (!doc) {
            return;
          }
          frame.ownerDocument
            .querySelectorAll('style, link[rel="stylesheet"]')
            .forEach((style) => doc.head.appendChild(style.cloneNode(true)));
          doc.documentElement.style.cssText =
            "margin:0; width:1750px; height:1034px; overflow:hidden;";
          doc.body.style.cssText =
            "margin:0; width:1750px; height:1034px; overflow:hidden;";
          // Keep the real editor's appearance without exposing an editable
          // workspace. Inert also blocks keyboard focus inside this document.
          doc.body.setAttribute("inert", "");
          setFrameDocument(doc);
        }}
      />
      {frameDocument &&
        createPortal(
          <EditorScene ownerDocument={frameDocument} />,
          frameDocument.body,
        )}
    </div>
  );
};
const scene = convertToExcalidrawElements(
  [
    {
      id: "landing-selection",
      type: "rectangle",
      x: 535,
      y: 299,
      width: 429,
      height: 426,
      strokeColor: "#228be6",
      backgroundColor: "#dbe7fa",
      fillStyle: "hachure",
      strokeWidth: 4,
      roughness: 1,
      opacity: 80,
    },
  ],
  { regenerateIds: false },
);
const EditorScene = ({ ownerDocument }: { ownerDocument: Document }) => {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const restoreFrame = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (restoreFrame.current !== null) {
        ownerDocument.defaultView?.cancelAnimationFrame(restoreFrame.current);
      }
    },
    [ownerDocument],
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeThread, setActiveThread] = useState(0);
  const [removedComments, setRemovedComments] = useState<number[]>([]);
  const [selectedComment, setSelectedComment] = useState(1);
  const [read, setRead] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [following, setFollowing] = useState(1);
  const copyLink = async () => {
    try {
      await ownerDocument.defaultView?.navigator.clipboard.writeText(
        `${ownerDocument.baseURI.split("#")[0]}#product`,
      );
      setStatus("Link copied");
    } catch {
      setStatus(
        "Unable to copy link. Use the page address to share this preview.",
      );
    }
  };
  const [thread, setThread] = useState(true);
  const [menu, setMenu] = useState(true);
  const [people, setPeople] = useState(true);
  const [filter, setFilter] = useState(true);
  const [resolved, setResolved] = useState(false);
  const [sort, setSort] = useState("date");
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState("");
  const [replies, setReplies] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const control = (
    icon: React.ReactNode,
    label: string,
    onClick?: () => void,
    active = false,
  ) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={active ? "is-active" : ""}
      onClick={onClick || (() => setStatus(`${label} selected in preview`))}
    >
      {icon}
    </button>
  );
  return (
    <div className="editor-art-scene">
      <div className="editor-art-real">
        <Excalidraw
          onExcalidrawAPI={(api) => {
            apiRef.current = api;
          }}
          ownerDocument={ownerDocument}
          autoFocus={false}
          handleKeyboardGlobally={false}
          detectScroll={true}
          theme="light"
          viewModeEnabled={false}
          zenModeEnabled={false}
          onChange={(_, appState) => {
            // Document-level outside-click handlers can dismiss the palette
            // even when the preview itself is inert. Keep its artwork state.
            if (
              appState.openPopup !== "elementStroke" ||
              !appState.selectedElementIds["landing-selection"]
            ) {
              if (restoreFrame.current !== null) {
                return;
              }
              restoreFrame.current =
                ownerDocument.defaultView?.requestAnimationFrame(() => {
                  restoreFrame.current = null;
                  apiRef.current?.updateScene({
                    appState: {
                      openPopup: "elementStroke",
                      selectedElementIds: { "landing-selection": true },
                    },
                    captureUpdate: CaptureUpdateAction.NEVER,
                  });
                }) ?? null;
            }
          }}
          initialData={{
            elements: scene,
            appState: {
              viewBackgroundColor: "#ffffff",
              selectedElementIds: { "landing-selection": true },
              openPopup: "elementStroke",
              currentItemStrokeColor: "#228be6",
              currentItemBackgroundColor: "#dbe7fa",
              currentItemFillStyle: "hachure",
              scrollX: 0,
              scrollY: 0,
            },
          }}
          onInitialize={(api) =>
            api.updateScene({
              appState: {
                selectedElementIds: { "landing-selection": true },
                openPopup: "elementStroke",
              },
              captureUpdate: CaptureUpdateAction.NEVER,
            })
          }
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              export: false,
            },
          }}
        />
      </div>
      <div className="editor-art-scene-title">Boardy scene</div>
      <div className="editor-art-header-people">
        <button
          type="button"
          aria-label="Show collaborators"
          aria-expanded={people}
          onClick={() => setPeople(!people)}
        >
          {names.map((name, index) => (
            <Avatar key={name} index={index} />
          ))}
          <span>+99</span>
        </button>
        {control(
          share,
          "Share preview",
          () =>
            setStatus(
              "This is an interactive preview. Sign up to share your own board.",
            ),
          true,
        )}
        {control(<Glyph kind="chevron" />, "Collapse sidebar", () =>
          setSidebarOpen(!sidebarOpen),
        )}
      </div>
      <span className="editor-art-pin pin-one">
        <Avatar index={3} />
      </span>
      <button
        type="button"
        className="editor-art-pin pin-two"
        aria-label="Open Maya's thread"
        onClick={() => setThread(true)}
      >
        <Stack />
      </button>
      <span className="editor-art-pin pin-three">
        <Stack index={2} />
      </span>
      <span className="editor-art-pin pin-four">
        <Stack index={4} />
      </span>
      {people && (
        <aside className="editor-art-collaborators">
          {names.map((name, index) => (
            <button
              type="button"
              key={name}
              onClick={() => setFollowing(index)}
              className={index === following ? "is-active" : ""}
            >
              <Avatar index={index} />
              {name}
            </button>
          ))}
        </aside>
      )}
      {thread && (
        <aside className="editor-art-thread">
          <div className="editor-art-thread-bar">
            {control(<Glyph kind="chevron" />, "Previous thread", () => {
              setActiveThread((activeThread + 5) % 6);
              setRemovedComments([]);
            })}
            {control(
              <span className="flip">
                <Glyph kind="chevron" />
              </span>,
              "Next thread",
              () => {
                setActiveThread((activeThread + 1) % 6);
                setRemovedComments([]);
              },
            )}
            <span />
            {control(<Glyph kind="check" />, "Resolve thread", () => {
              setResolved(true);
              setThread(false);
            })}
            {control(
              <Glyph kind="link" />,
              "Copy thread link",
              () => void copyLink(),
            )}
            {control(EraserIcon, "Remove preview thread", () =>
              setThread(false),
            )}
            {control(CloseIcon, "Close thread", () => setThread(false))}
          </div>
          {messages.map((message, index) =>
            removedComments.includes(index) ? null : (
              <article className="editor-art-thread-entry" key={message}>
                <div>
                  <Avatar index={index} />
                  <strong>
                    {names[(index + activeThread) % names.length]}
                  </strong>
                  <span>
                    ·{" "}
                    {index === 0
                      ? "a day ago"
                      : index === 1
                      ? "30 min ago"
                      : "5 min ago"}
                  </span>
                  {control(<Glyph kind="dots" />, "Comment options", () => {
                    setSelectedComment(index);
                    setMenu(!menu);
                  })}
                </div>
                <p>{message}</p>
              </article>
            ),
          )}
          {menu && (
            <div className="editor-art-comment-menu">
              {control(
                <>
                  <Glyph kind="copy" />
                  Copy link
                </>,
                "Copy comment link",
                () => {
                  void copyLink();
                  setMenu(false);
                },
              )}
              {control(
                <>{EraserIcon}Remove</>,
                "Remove example comment",
                () => {
                  setMenu(false);
                  setRemovedComments([...removedComments, selectedComment]);
                },
              )}
            </div>
          )}
          {replies.map((text, index) => (
            <p className="editor-art-reply" key={index}>
              <strong>You</strong> {text}
            </p>
          ))}
          <form
            className="editor-art-reply-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (reply.trim()) {
                setReplies([...replies, reply.trim()]);
                setReply("");
              }
            }}
          >
            <Avatar index={4} />
            <input
              aria-label="Reply to preview thread"
              placeholder="Reply, @mention someone…"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
            <button
              type="submit"
              aria-label="Send preview reply"
              disabled={!reply.trim()}
            >
              ↑
            </button>
          </form>
        </aside>
      )}
      {sidebarOpen && (
        <aside className="editor-art-sidebar">
          <div className="editor-art-side-tabs">
            {control(LibraryIcon, "Library", () =>
              apiRef.current?.toggleSidebar({ name: "library" }),
            )}
            {control(
              messageCircleIcon,
              "Comments",
              () => setThread(true),
              true,
            )}
            {control(presentationIcon, "Present", () =>
              apiRef.current?.updateScene({
                appState: {
                  viewModeEnabled:
                    !apiRef.current.getAppState().viewModeEnabled,
                },
                captureUpdate: CaptureUpdateAction.NEVER,
              }),
            )}
            <span />
            {control(
              LockedIcon,
              "Pin sidebar",
              () => setPinned(!pinned),
              pinned,
            )}
            {control(CloseIcon, "Close sidebar", () => setSidebarOpen(false))}
          </div>
          <div className="editor-art-search">
            <Glyph kind="search" />
            <input
              aria-label="Search preview comments"
              placeholder="Quick search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <small>⌘3</small>
          </div>
          <div className="editor-art-filter-bar">
            {control(<Glyph kind="filter" />, "Sort comments", () =>
              setFilter(!filter),
            )}
            <button type="button" onClick={() => setRead(true)}>
              <Glyph kind="check" />
              {read ? "All read" : "Mark all as read"}
            </button>
          </div>
          {filter && (
            <div className="editor-art-filter-menu">
              <button
                type="button"
                className={sort === "date" ? "is-active" : ""}
                onClick={() => setSort("date")}
              >
                ↕　Sort by date
              </button>
              <button
                type="button"
                className={sort === "unread" ? "is-active" : ""}
                onClick={() => setSort("unread")}
              >
                ↕　Sort by unread
              </button>
              <button
                type="button"
                aria-pressed={resolved}
                onClick={() => setResolved(!resolved)}
              >
                Show resolved comments{" "}
                <span className={`editor-art-switch ${resolved ? "on" : ""}`} />
              </button>
            </div>
          )}
          <div className="editor-art-feed">
            {(sort === "date" ? [0, 1, 2, 3, 4, 5] : [5, 3, 1, 0, 2, 4])
              .filter((i) =>
                (names[i] + messages[i % 3])
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((i) => (
                <button
                  type="button"
                  className="editor-art-feed-entry"
                  key={i}
                  onClick={() => {
                    setActiveThread(i);
                    setThread(true);
                    setRemovedComments([]);
                  }}
                >
                  <Stack index={i} />
                  <div>
                    <strong>{names[i]}</strong> · a moment ago
                  </div>
                  <p>{messages[i % 3]}</p>
                  <span>3 replies</span>
                </button>
              ))}
          </div>
        </aside>
      )}
      {status && (
        <button
          type="button"
          className="editor-art-status"
          onClick={() => setStatus("")}
          aria-live="polite"
        >
          {status}
        </button>
      )}
    </div>
  );
};
