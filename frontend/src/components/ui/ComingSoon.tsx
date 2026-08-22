/**
 * Placeholder pane for the features the brief allows us to stub.
 *
 * Mirrors Signal's empty states — a large glyph, a bold line, a quieter one —
 * with an explicit chip so nobody mistakes it for a feature that is merely
 * empty.
 */
export function ComingSoon({
  icon,
  title,
  blurb,
}: {
  icon?: React.ReactNode;
  title: string;
  blurb: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      {icon && <span className="mb-5 text-label-2">{icon}</span>}
      <h2 className="text-body1 font-semibold text-label">{title}</h2>
      <p className="mt-1 max-w-xs text-body2 text-label-2">{blurb}</p>
      <span className="mt-6 rounded-full border border-edge px-4 py-1.5 text-caption uppercase tracking-wide text-label-2">
        Coming soon
      </span>
    </div>
  );
}
