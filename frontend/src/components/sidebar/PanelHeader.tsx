import { BackIcon } from "@/components/ui/icons";

/**
 * Header for a pane that has slid over the conversation list. Signal centres
 * the title and puts a back chevron on the left — no close button, because the
 * panel is part of the pane rather than an overlay.
 */
export function PanelHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="flex h-header shrink-0 items-center px-2">
      <button
        onClick={onBack}
        aria-label="Back"
        className="rounded-full p-2 text-label hover:bg-surface"
      >
        <BackIcon />
      </button>
      {/* Padded on the right by the button's width so the title sits centred. */}
      <h2 className="flex-1 pr-9 text-center text-body1 font-semibold text-label">{title}</h2>
    </header>
  );
}
