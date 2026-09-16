import React from "react";

import {
  ArrowIcon,
  CloseIcon,
  DiamondIcon,
  EllipseIcon,
  EraserIcon,
  FillHachureIcon,
  FillSolidIcon,
  FreedrawIcon,
  HamburgerMenuIcon,
  ImageIcon,
  LibraryIcon,
  LineIcon,
  LockedIcon,
  RectangleIcon,
  SelectionIcon,
  share,
  StrokeStyleDashedIcon,
  StrokeStyleDottedIcon,
  StrokeStyleSolidIcon,
  StrokeWidthBaseIcon,
  StrokeWidthBoldIcon,
  StrokeWidthExtraBoldIcon,
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

const FeatureWorkspace = () => (
  <div className="board-feature-workspace">
    <header className="board-feature-header">
      <div className="board-feature-header__left">
        <span className="board-feature-header__button board-feature-header__button--panel" />
        <span className="board-feature-header__button board-feature-header__button--menu">
          <HamburgerMenuIcon />
        </span>
        <strong>Boardy scene</strong>
      </div>
      <div className="board-feature-header__tools" aria-hidden="true">
        <span>
          <LockedIcon />
        </span>
        <span className="is-active">
          <SelectionIcon />
        </span>
        <span>
          <RectangleIcon />
        </span>
        <span>
          <DiamondIcon />
        </span>
        <span>
          <EllipseIcon />
        </span>
        <span>
          <ArrowIcon />
        </span>
        <span>
          <LineIcon />
        </span>
        <span>
          <FreedrawIcon />
        </span>
        <span>
          <TextIcon />
        </span>
        <span>
          <ImageIcon />
        </span>
        <span>
          <EraserIcon />
        </span>
      </div>
      <div className="board-feature-header__right">
        <span>
          <LibraryIcon />
        </span>
        <span>
          <RectangleIcon />
        </span>
        <span>
          <DiamondIcon />
        </span>
        <span className="is-active">
          <EllipseIcon />
        </span>
        <span>
          <EraserIcon />
        </span>
        <span>
          <CloseIcon />
        </span>
      </div>
    </header>
    <div className="board-feature-canvas">
      <aside className="board-feature-properties">
        <strong>Stroke</strong>
        <div className="board-feature-swatches">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <strong>Background</strong>
        <div className="board-feature-swatches is-background">
          <i />
          <i />
          <i />
          <i className="is-selected" />
          <i />
        </div>
        <strong>Fill</strong>
        <div className="board-feature-options">
          <i>
            <FillSolidIcon />
          </i>
          <i className="is-active">
            <FillHachureIcon />
          </i>
          <i>
            <RectangleIcon />
          </i>
        </div>
        <strong>Stroke width</strong>
        <div className="board-feature-options">
          <i>
            <StrokeWidthBaseIcon />
          </i>
          <i className="is-active">
            <StrokeWidthBoldIcon />
          </i>
          <i>
            <StrokeWidthExtraBoldIcon />
          </i>
        </div>
        <strong>Stroke style</strong>
        <div className="board-feature-options">
          <i>
            <StrokeStyleSolidIcon />
          </i>
          <i>
            <StrokeStyleDottedIcon />
          </i>
          <i>
            <StrokeStyleDashedIcon />
          </i>
        </div>
        <strong>Opacity</strong>
        <div className="board-feature-slider">
          <i />
        </div>
        <strong className="board-feature-properties__actions">Actions</strong>
        <div className="board-feature-options">
          <i>
            <LibraryIcon />
          </i>
          <i>
            <EraserIcon />
          </i>
          <i>{React.createElement(share)}</i>
        </div>
      </aside>
      <aside className="board-feature-colors">
        <strong>Most used custom colors</strong>
        <div className="board-feature-colors__recent">
          <i />
          <i />
        </div>
        <strong>Colors</strong>
        <div className="board-feature-colors__grid">
          {Array.from({ length: 20 }, (_, index) => (
            <i key={index} />
          ))}
        </div>
        <label>
          HEX code
          <input value="# 2563EB" readOnly />
        </label>
      </aside>
      <div className="board-feature-tip">
        To move canvas, hold mouse wheel or spacebar while dragging
      </div>
      <div className="board-feature-selection">
        <i className="is-top" />
        <i className="is-left" />
        <i className="is-right" />
        <i className="is-bottom" />
      </div>
      <Collaborator className="board-feature-person is-alex" label="A" />
      <Collaborator className="board-feature-person is-maya" label="M" />
      <Collaborator className="board-feature-person is-jules" label="J" />
      <Pointer className="board-feature-cursor" label="" />
      <div className="board-feature-thread">
        <div className="board-feature-thread__head">
          <span>‹　›</span>
          <span>
            {React.createElement(share)} <EraserIcon /> <CloseIcon />
          </span>
        </div>
        <div className="board-feature-thread__entry">
          <span className="board-art-dot is-blue" />
          <p>
            <strong>Butterbean</strong>
            <small>· a day ago</small>
            <br />
            Boardy’s hand-drawn charm gives ideas an organic, welcoming quality.
          </p>
        </div>
        <div className="board-feature-thread__entry">
          <span className="board-art-dot is-sky" />
          <p>
            <strong>Tony</strong>
            <small>· 30 min ago</small>
            <br />
            The blue palette feels focused, clear, and true to Boardy’s
            identity.
          </p>
        </div>
        <div className="board-feature-thread__entry">
          <span className="board-art-dot is-amber" />
          <p>
            <strong>Smokin</strong>
            <small>· 5 min ago</small>
            <br />
            Boardy keeps the story visible while everyone moves the work
            forward.
          </p>
        </div>
        <div className="board-feature-thread__reply">
          <span className="board-art-dot is-amber" />
          Reply, @mention someone… <b>↑</b>
        </div>
      </div>
      <aside className="board-feature-activity">
        <div className="board-feature-search">⌕　Quick search</div>
        <div className="board-feature-filter">
          ☷ <span>✓ Mark all as read</span>
        </div>
        {[
          [
            "TheChief",
            "Boardy’s hand-drawn feeling enhances visual storytelling and guides the group through a cohesive experience.",
          ],
          [
            "milos",
            "Boardy’s playful details invite people to interact and foster deeper connection.",
          ],
          [
            "dwelle",
            "The blue palette is focused, clear, and instantly recognizable.",
          ],
          [
            "Smokin",
            "The interface feels professional, warm, and easy to understand.",
          ],
        ].map(([name, message], index) => (
          <div className="board-feature-activity__item" key={name}>
            <span className={`board-feature-activity__avatar is-${index}`} />
            <p>
              <strong>{name}</strong>
              <small>· a moment ago</small>
              <br />
              {message}
              <em>3 replies</em>
            </p>
          </div>
        ))}
      </aside>
      <div className="board-feature-zoom">
        +　 <b>100%</b>　−
      </div>
    </div>
  </div>
);

export const BoardArtwork = ({ variant }: { variant: "hero" | "feature" }) => {
  if (variant === "feature") {
    return (
      <div className="board-artwork board-artwork--feature" aria-hidden="true">
        <FeatureWorkspace />
      </div>
    );
  }

  return (
    <div className="board-artwork board-artwork--hero" aria-hidden="true">
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
      <StickyBoard />
      <CommentsPanel />
    </div>
  );
};
