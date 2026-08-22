import { SignalGlyph } from "@/components/ui/SignalMark";

/** The chat pane before anything is open. */
export default function EmptyState() {
  return (
    <div className="relative flex h-full flex-col items-center justify-center px-8 text-center">
      <SignalGlyph size={68} className="text-label" />
      <h2 className="mt-6 text-title2 font-semibold text-label">Welcome to Signal</h2>
      <p className="mt-1 text-body1 text-label-2">
        Select a chat to start messaging. Your messages are end-to-end encrypted.
      </p>

      {/* Signal keeps this pinned to the bottom of the pane. */}
      <p className="absolute bottom-6 text-caption text-label-2">
        Signal is a 501c3 nonprofit
      </p>
    </div>
  );
}
