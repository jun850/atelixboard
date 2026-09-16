import React, { useEffect, useId, useRef, useState } from "react";
import {
  ArrowIcon,
  CloseIcon,
  EllipseIcon,
  FreedrawIcon,
  RectangleIcon,
  SelectionIcon,
  TextIcon,
} from "@excalidraw/excalidraw/components/icons";

import "./LandingArtwork.scss";

type IconName =
  | "arrow"
  | "chat"
  | "collaborate"
  | "organize"
  | "pointer"
  | "share";

export const LandingIcon = ({ name }: { name: IconName }) => {
  if (name === "arrow") {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M4 10h11M11 6l4 4-4 4" />
      </svg>
    );
  }
  if (name === "chat") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 5.5h14v10H10l-5 3v-13Z" />
        <path d="M8.5 9.5h7M8.5 12.5h4" />
      </svg>
    );
  }
  if (name === "collaborate") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.2" />
        <path d="M3.8 19c.6-3.3 2.3-5 5.2-5s4.6 1.7 5.2 5M14.5 14.5c3.2-.6 5.2.8 5.8 4" />
      </svg>
    );
  }
  if (name === "organize") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m5 17 8-8 3 3-8 8H5v-3ZM13 9l2-2 3 3-2 2" />
        <path d="m5 5 .5 1.5L7 7l-1.5.5L5 9l-.5-1.5L3 7l1.5-.5L5 5ZM18 16l.5 1.5L20 18l-1.5.5L18 20l-.5-1.5L16 18l1.5-.5L18 16Z" />
      </svg>
    );
  }
  if (name === "share") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="6" cy="12" r="2" />
        <circle cx="17.5" cy="6" r="2" />
        <circle cx="17.5" cy="18" r="2" />
        <path d="m8 11 7.5-4M8 13l7.5 4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 4 12 8-6 1.5L9.5 19 6 4Z" />
    </svg>
  );
};

const notes = [
  ["Faster onboarding", "yellow"],
  ["Team templates", "green"],
  ["Smart summaries", "blue"],
  ["Guest mode", "pink"],
  ["Board timeline", "blue"],
];
const comments = [
  ["Maya", "Love the smart summaries idea.", "sky"],
  ["Alex", "Could this work for guests too?", "amber"],
  ["Jules", "I’ll map the first flow today.", "green"],
];
const colors = [
  ["blue", "#3e63dd"],
  ["green", "#26805c"],
  ["orange", "#b66b21"],
];
const Pointer = ({ name, tone }: { name: string; tone: string }) => (
  <span className={`board-demo-cursor is-${tone}`} aria-hidden="true">
    <LandingIcon name="pointer" />
    <span>{name}</span>
  </span>
);
export const BoardArtwork = ({ variant }: { variant: "hero" | "feature" }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [selected, setSelected] = useState(2);
  const [color, setColor] = useState("#3e63dd");
  const [playing, setPlaying] = useState(true);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = rootRef.current;
    const ownerDocument = node?.ownerDocument;
    const ownerWindow = ownerDocument?.defaultView;
    if (!node || !ownerWindow || !ownerDocument) {
      return;
    }
    let visible = false;
    const update = () => setInView(visible && !ownerDocument.hidden);
    const observer = new ownerWindow.IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        update();
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    ownerDocument.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      ownerDocument.removeEventListener("visibilitychange", update);
    };
  }, []);
  return (
    <div
      ref={rootRef}
      className={`board-artwork board-artwork--${variant}`}
      data-playing={playing && inView}
      style={{ "--demo-accent": color } as React.CSSProperties}
      role="region"
      aria-label={`${
        variant === "hero" ? "Launch planning" : "Collaboration"
      } interactive preview`}
    >
      <header className="board-demo-header">
        <div className="board-demo-title">
          <span className="board-demo-mark">
            <LandingIcon name="organize" />
          </span>
          <strong>
            {variant === "hero" ? "Launch planning" : "Boardy scene"}
          </strong>
        </div>
        <div
          className="board-demo-people"
          aria-label="Maya, Alex and Jules collaborating"
        >
          <span className="is-sky">M</span>
          <span className="is-amber">A</span>
          <span className="is-green">J</span>
        </div>
        <button
          className="board-demo-comments-toggle"
          type="button"
          aria-label={commentsOpen ? "Hide comments" : "Show comments"}
          aria-expanded={commentsOpen}
          aria-controls={panelId}
          onClick={() => setCommentsOpen(!commentsOpen)}
        >
          <LandingIcon name="chat" />
        </button>
      </header>
      <div className="board-demo-body">
        <div className="board-demo-canvas">
          <div className="board-demo-toolbar" aria-hidden="true">
            {[
              SelectionIcon,
              RectangleIcon,
              EllipseIcon,
              ArrowIcon,
              FreedrawIcon,
              TextIcon,
            ].map((icon, index) => (
              <span className={index === 0 ? "is-active" : ""} key={index}>
                {icon}
              </span>
            ))}
          </div>
          {variant === "hero" ? (
            <div className="board-demo-brainstorm">
              <h3>What should we build next?</h3>
              <div className="board-demo-notes">
                {notes.map(([label, tone], index) => (
                  <button
                    type="button"
                    key={label}
                    className={`board-demo-note is-${tone}`}
                    aria-pressed={selected === index}
                    onClick={() => setSelected(index)}
                  >
                    {label}
                    {selected === index && (
                      <span
                        className="board-demo-selection"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                ))}
              </div>
              <Pointer name="Maya" tone="sky" />
              <Pointer name="Alex" tone="amber" />
            </div>
          ) : (
            <div className="board-demo-diagram">
              <h3>From a spark to a shared plan.</h3>
              <svg
                className="board-demo-flow"
                viewBox="0 0 580 290"
                role="img"
                aria-label="An idea becomes a team discussion, then a plan. Feedback connects back to the idea."
              >
                <g
                  className="board-demo-connections"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M165 110h47m-8-7 8 7-8 7M367 110h47m-8-7 8 7-8 7M493 154v73H87v-65m-7 8 7-8 7 8" />
                </g>
                <rect
                  x="12"
                  y="62"
                  width="150"
                  height="95"
                  rx="7"
                  fill="#fff3bf"
                  stroke="#c2a753"
                  strokeWidth="1.5"
                />
                <rect
                  x="214"
                  y="62"
                  width="150"
                  height="95"
                  rx="7"
                  fill="#e8edff"
                  stroke="var(--demo-accent)"
                  strokeWidth="2"
                />
                <rect
                  x="416"
                  y="62"
                  width="150"
                  height="95"
                  rx="7"
                  fill="#dff2e6"
                  stroke="#65a783"
                  strokeWidth="1.5"
                />
                <g
                  fill="#26324b"
                  textAnchor="middle"
                  fontSize="22"
                  fontWeight="600"
                >
                  <text x="87" y="117">
                    Idea
                  </text>
                  <text x="289" y="117">
                    Discuss
                  </text>
                  <text x="491" y="117">
                    Plan
                  </text>
                </g>
                <rect x="226" y="211" width="127" height="30" fill="#fcfdff" />
                <text
                  x="290"
                  y="232"
                  fill="#667085"
                  textAnchor="middle"
                  fontSize="16"
                >
                  Keep refining
                </text>
                <g fill="white" stroke="var(--demo-accent)">
                  <rect
                    x="207"
                    y="55"
                    width="164"
                    height="109"
                    fill="none"
                    strokeDasharray="4 4"
                  />
                  {[
                    [207, 55],
                    [371, 55],
                    [207, 164],
                    [371, 164],
                  ].map(([x, y]) => (
                    <rect
                      key={`${x}-${y}`}
                      x={x - 3}
                      y={y - 3}
                      width="6"
                      height="6"
                    />
                  ))}
                </g>
              </svg>
              <div
                className="board-demo-palette"
                role="group"
                aria-label="Diagram color"
              >
                {colors.map(([name, value]) => (
                  <button
                    type="button"
                    key={name}
                    aria-label={`Use ${name} color`}
                    aria-pressed={color === value}
                    onClick={() => setColor(value)}
                  >
                    <span style={{ backgroundColor: value }} />
                  </button>
                ))}
              </div>
              <Pointer name="Maya" tone="sky" />
              <Pointer name="Jules" tone="green" />
            </div>
          )}
        </div>
        {commentsOpen && (
          <aside
            className="board-demo-comments"
            id={panelId}
            aria-label="Example comments"
          >
            <div className="board-demo-comments-heading">
              <strong>
                Comments <span>3</span>
              </strong>
              <button
                type="button"
                aria-label="Close comments"
                onClick={() => setCommentsOpen(false)}
              >
                {CloseIcon}
              </button>
            </div>
            {comments.map(([name, message, tone]) => (
              <div className="board-demo-comment" key={name}>
                <span className={`board-demo-avatar is-${tone}`}>
                  {name[0]}
                </span>
                <div>
                  <strong>{name}</strong>
                  <p>{message}</p>
                </div>
              </div>
            ))}
            <span className="board-demo-comment-context">
              <LandingIcon name="chat" /> Feedback, right next to the work
            </span>
          </aside>
        )}
      </div>
      <footer className="board-demo-footer">
        <span>Interactive preview</span>
        <button
          className="board-demo-motion"
          type="button"
          aria-pressed={!playing}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? "Pause motion" : "Play motion"}
          <svg viewBox="0 0 16 16" aria-hidden="true">
            {playing ? (
              <path d="M5 3v10M11 3v10" />
            ) : (
              <path d="m5 3 7 5-7 5V3Z" />
            )}
          </svg>
        </button>
      </footer>
    </div>
  );
};
