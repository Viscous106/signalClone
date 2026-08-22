/**
 * Phone helpers. `toE164` must stay in lockstep with the server's
 * `normalise_phone` in app/schemas/common.py — if they disagree, one person can
 * end up with two accounts.
 */

const digitsOf = (raw: string) => raw.replace(/\D/g, "");

export function toE164(raw: string): string {
  return `+${digitsOf(raw)}`;
}

export function isValidPhone(raw: string): boolean {
  const length = digitsOf(raw).length;
  return length >= 7 && length <= 15;
}

/** Readable form for echoing the number back on the verification screen. */
export function displayPhone(raw: string): string {
  const d = digitsOf(raw);

  // North American numbers are the common demo case: +1 555 123 4567
  if (d.length === 11 && d.startsWith("1")) {
    return `+1 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  }

  // Otherwise assume a two-digit country code and group the rest in threes.
  const cc = d.slice(0, 2);
  const rest = d.slice(2).replace(/(\d{3})(?=\d)/g, "$1 ");
  return `+${cc} ${rest}`.trim();
}
