"use client";

/** Shared settings controls, matching the desktop app's shapes. */

export function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 mt-8 text-body2 font-semibold text-label">{children}</h3>;
}

export function Divider() {
  return <div className="my-6 border-t border-edge" />;
}

/** Title (+ optional description) on the left, control on the right. */
export function Row({
  title,
  description,
  control,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  control?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-2">
      <div className="min-w-0">
        <p className="text-body2 text-label">{title}</p>
        {description && <p className="mt-0.5 text-subtitle text-label-2">{description}</p>}
      </div>
      {control && <div className="shrink-0">{control}</div>}
    </div>
  );
}

export function Check({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 py-1.5 ${
        disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        // 14px with a 3px radius, accent when on — the app's exact shape.
        className="mt-0.5 h-3.5 w-3.5 shrink-0 appearance-none rounded-[3px] border border-[color:var(--label-secondary)] bg-transparent checked:border-accent checked:bg-accent checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 12 12%22><path d=%22M2.5 6.3l2.2 2.2 4.8-5%22 fill=%22none%22 stroke=%22white%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/></svg>')] bg-center bg-no-repeat"
      />
      <span className="min-w-0">
        <span className="block text-body2 text-label">{label}</span>
        {description && <span className="mt-0.5 block text-subtitle text-label-2">{description}</span>}
      </span>
    </label>
  );
}

export function Select({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: string[];
  onChange?: (next: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      className="rounded-md border border-edge bg-surface-2 px-3 py-1.5 text-body2 text-label outline-none disabled:cursor-not-allowed disabled:opacity-70"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

type PillTone = "grey" | "accent" | "danger";

const TONES: Record<PillTone, string> = {
  grey: "bg-surface-2 text-label hover:opacity-90",
  accent: "bg-accent text-white hover:opacity-90",
  danger: "bg-[#CF163E]/15 text-[#F0868F] hover:bg-[#CF163E]/25",
};

export function Pill({
  children,
  tone = "grey",
  disabled = false,
  onClick,
  title,
}: {
  children: React.ReactNode;
  tone?: PillTone;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title ?? (disabled ? "Coming soon" : undefined)}
      className={`rounded-full px-4 py-1.5 text-body2 font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-50 ${TONES[tone]}`}
    >
      {children}
    </button>
  );
}

export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-subtitle text-label-2">{children}</p>;
}
