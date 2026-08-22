/** Signal's three bouncing dots, shown inside a received-style bubble. */
export function TypingIndicator({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 px-4 pb-2" aria-live="polite">
      <span className="flex items-center gap-1 rounded-[18px] bg-incoming px-3 py-2.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-label-2"
            style={{ animationDelay: `${i * 140}ms`, animationDuration: "1s" }}
          />
        ))}
      </span>
      {label && <span className="text-caption text-label-2">{label} is typing…</span>}
    </div>
  );
}
