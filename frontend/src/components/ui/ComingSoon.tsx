/** Placeholder for the features the brief allows us to stub. */
export function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <h2 className="text-title2 font-semibold text-label">{title}</h2>
      <p className="mt-2 max-w-sm text-body2 text-label-2">{blurb}</p>
      <span className="mt-6 rounded-full border border-edge px-4 py-1.5 text-caption uppercase tracking-wide text-label-2">
        Coming soon
      </span>
    </div>
  );
}
