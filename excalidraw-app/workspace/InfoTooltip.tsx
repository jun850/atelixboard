import { useId } from "react";

import "./InfoTooltip.scss";

import type { ReactNode } from "react";

export const InfoTooltip = ({
  id,
  label,
  children,
}: {
  id?: string;
  label: string;
  children: ReactNode;
}) => {
  const generatedId = useId();
  const tooltipId = id || generatedId;

  return (
    <span className="boardy-info-tooltip">
      <button
        className="boardy-info-tooltip__trigger"
        type="button"
        aria-label={label}
        aria-describedby={tooltipId}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="7.25" />
          <path d="M10 8.5v5M10 6.1h.01" />
        </svg>
      </button>
      <span
        className="boardy-info-tooltip__content"
        id={tooltipId}
        role="tooltip"
      >
        {children}
      </span>
    </span>
  );
};
