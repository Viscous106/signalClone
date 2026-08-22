import { initials } from "@/lib/format";

type Props = {
  name: string;
  color?: string | null;
  url?: string | null;
  size?: number;
  online?: boolean;
};

/**
 * Circular avatar: photo if there is one, otherwise initials on the colour the
 * server assigned. Signal gives every contact a stable colour.
 */
export function Avatar({ name, color, url, size = 48, online = false }: Props) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatars are remote and unoptimised
        <img
          src={url}
          alt=""
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center rounded-full font-medium text-white"
          style={{ backgroundColor: color ?? "#71717F", fontSize: Math.round(size * 0.4) }}
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
