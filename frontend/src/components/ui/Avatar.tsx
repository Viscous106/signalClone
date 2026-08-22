import { initials } from "@/lib/format";

type Props = {
  name: string;
  /** The pale fill. */
  color?: string | null;
  /** The initials, in a strong version of the same hue. */
  fg?: string | null;
  url?: string | null;
  size?: number;
  online?: boolean;
};

// Signal's neutral pair (A210), used when the server has not given us one.
const FALLBACK_FILL = "#D7D7D9";
const FALLBACK_INK = "#5C5C5C";

/**
 * Circular avatar: photo if there is one, otherwise initials on the pale fill
 * the server assigned. Signal never renders white initials on a saturated
 * circle — the fill is a tint and the letters carry the colour.
 */
export function Avatar({ name, color, fg, url, size = 48, online = false }: Props) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatars are remote and unoptimised
        <img
          src={url}
          alt=""
          role="presentation"
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <div
          data-testid="avatar-initials"
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center rounded-full font-medium"
          style={{
            backgroundColor: color || FALLBACK_FILL,
            color: fg || FALLBACK_INK,
            fontSize: Math.round(size * 0.4),
          }}
        >
          {initials(name)}
        </div>
      )}
      {online && (
        <span
          data-testid="online-dot"
          title="Online"
          className="absolute bottom-0 right-0 block rounded-full border-2 border-surface-2 bg-[#1D8663]"
          style={{ width: Math.max(10, size * 0.22), height: Math.max(10, size * 0.22) }}
        />
      )}
    </div>
  );
}
