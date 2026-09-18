import type { ReactNode } from "react";

type Segment<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
};

export const PenIconButton = ({
  label,
  children,
  disabled,
  onClick,
}: {
  label: string;
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    className="pen-icon-button"
    aria-label={label}
    title={label}
    disabled={disabled}
    onClick={onClick}
  >
    {children}
  </button>
);

export function PenSegmentedControl<T extends string>({
  label,
  options,
  value,
  disabled,
  onChange,
}: {
  label: string;
  options: readonly Segment<T>[];
  value: T;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <div className="pen-segmented-control" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          className={option.value === value ? "is-selected" : undefined}
          aria-pressed={option.value === value}
          disabled={disabled}
          key={option.value}
          onClick={() => onChange(option.value)}
        >
          {option.icon && (
            <span className="pen-control-icon">{option.icon}</span>
          )}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export const PenSelectRow = ({
  label,
  icon,
  children,
  disabled,
  value,
  onChange,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  disabled?: boolean;
  value: string;
  onChange: (value: string) => void;
}) => (
  <label className="pen-select-row">
    <span className="pen-select-row__icon">{icon}</span>
    <span className="pen-select-row__copy">
      <span className="pen-select-row__label">{label}</span>
      <select
        aria-label={label}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </span>
  </label>
);

export const PenChip = ({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: ReactNode;
  onClick: () => void;
}) => (
  <button
    type="button"
    className="pen-chip"
    aria-pressed={selected}
    data-selected={selected || undefined}
    onClick={onClick}
  >
    {children}
  </button>
);
