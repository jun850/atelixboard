import React from "react";

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

const ToolIcon = ({
  shape,
}: {
  shape: "pointer" | "square" | "circle" | "line" | "pen" | "text";
}) => {
  if (shape === "pointer") {
    return <LandingIcon name="pointer" />;
  }
  if (shape === "square") {
    return <span className="board-art-tool-square" />;
  }
  if (shape === "circle") {
    return <span className="board-art-tool-circle" />;
  }
  if (shape === "line") {
    return <span className="board-art-tool-line" />;
  }
  if (shape === "text") {
    return <span className="board-art-tool-text">T</span>;
  }
  return <span className="board-art-tool-pen" />;
};

const Toolbar = () => (
  <div className="board-art-toolbar">
    <span className="is-active">
      <ToolIcon shape="pointer" />
    </span>
    <span>
      <ToolIcon shape="square" />
    </span>
    <span>
      <ToolIcon shape="circle" />
    </span>
    <span>
      <ToolIcon shape="line" />
    </span>
    <span>
      <ToolIcon shape="pen" />
    </span>
    <span>
      <ToolIcon shape="text" />
    </span>
  </div>
);

const Collaborator = ({
  className,
  label,
}: {
  className: string;
  label: string;
}) => <span className={`board-art-collaborator ${className}`}>{label}</span>;

const Pointer = ({
  className,
  label,
}: {
  className: string;
  label: string;
}) => (
  <span className={`board-art-pointer ${className}`}>
    <LandingIcon name="pointer" />
    <span>{label}</span>
  </span>
);

const CommentsPanel = () => (
  <aside className="board-art-comments">
    <div className="board-art-comments__head">
      <strong>Comments</strong>
      <span aria-hidden="true">×</span>
    </div>
    <div className="board-art-comment">
      <span className="board-art-dot is-blue" />
      <div>
        <strong>Maya</strong>
        <p>Love the smart summaries idea.</p>
      </div>
    </div>
    <div className="board-art-comment">
      <span className="board-art-dot is-amber" />
      <div>
        <strong>Alex</strong>
        <p>Could this work for guests too?</p>
      </div>
    </div>
    <div className="board-art-comment">
      <span className="board-art-dot is-green" />
      <div>
        <strong>Jules</strong>
        <p>I’ll map the first flow today.</p>
      </div>
    </div>
  </aside>
);

const StickyBoard = () => (
  <div className="board-art-workarea">
    <h3>What should we build next?</h3>
    <div className="board-art-stickies">
      <span className="is-yellow">
        Faster
        <br />
        onboarding
      </span>
      <span className="is-green">Team templates</span>
      <span className="is-blue">
        Smart
        <br />
        summaries
      </span>
      <span className="is-pink">Guest mode</span>
      <span className="is-blue">Board timeline</span>
    </div>
    <Pointer className="is-maya" label="Maya" />
  </div>
);

const ShapeBoard = () => (
  <div className="board-art-shape-area">
    <div className="board-art-selected-shape" />
    <div className="board-art-diagonal" />
    <Collaborator className="is-alex" label="A" />
    <Collaborator className="is-jules" label="J" />
    <Pointer className="is-tony" label="Tony" />
    <div className="board-art-thread">
      <div className="board-art-thread__actions">
        ‹ &nbsp; › <span>○ &nbsp; ↗ &nbsp; ×</span>
      </div>
      <p>
        <span className="board-art-dot is-blue" />
        <strong>Butterbean</strong>
        <small>a day ago</small>
      </p>
      <p>
        Boardy’s hand-drawn charm gives ideas an organic, welcoming quality.
      </p>
      <p>
        <span className="board-art-dot is-sky" />
        <strong>Tony</strong>
        <small>30 min ago</small>
      </p>
      <p>The blue palette feels focused, clear, and instantly recognizable.</p>
      <div className="board-art-thread__reply">Reply, @mention someone…</div>
    </div>
  </div>
);

const ColorPanel = () => (
  <aside className="board-art-palette">
    <strong>Stroke</strong>
    <div className="board-art-swatches is-row">
      <i className="is-ink" />
      <i className="is-red" />
      <i className="is-green" />
      <i className="is-blue" />
      <i className="is-orange" />
    </div>
    <strong>Background</strong>
    <div className="board-art-swatches is-row is-pale">
      <i />
      <i />
      <i />
      <i className="is-selected" />
      <i />
    </div>
    <strong>Fill</strong>
    <div className="board-art-segmented">
      <i />
      <i className="is-active" />
      <i />
    </div>
    <strong>Stroke width</strong>
    <div className="board-art-segmented">
      <i />
      <i className="is-active" />
      <i />
    </div>
    <strong>Opacity</strong>
    <div className="board-art-opacity">
      <i />
    </div>
  </aside>
);

export const BoardArtwork = ({ variant }: { variant: "hero" | "feature" }) => (
  <div className={`board-artwork board-artwork--${variant}`} aria-hidden="true">
    <div className="board-artwork__chrome">
      <div className="board-artwork__title">
        <span className="board-artwork__appmark">
          <LandingIcon name="organize" />
        </span>
        <strong>
          {variant === "hero" ? "Launch planning" : "Boardy scene"}
        </strong>
      </div>
      <div className="board-artwork__people">
        <Collaborator className="is-maya" label="M" />
        <Collaborator className="is-alex" label="A" />
        <Collaborator className="is-jules" label="J" />
        <span className="board-art-share">
          <LandingIcon name="share" /> Share
        </span>
      </div>
    </div>
    <Toolbar />
    {variant === "hero" ? (
      <>
        <StickyBoard />
        <CommentsPanel />
      </>
    ) : (
      <>
        <ColorPanel />
        <ShapeBoard />
        <CommentsPanel />
      </>
    )}
  </div>
);
