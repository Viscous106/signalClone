/**
 * Phone helpers. `toE164` must stay in lockstep with the server's
 * `normalise_phone` in app/schemas/common.py — if they disagree, one person can
 * end up with two accounts.
 */

import { COUNTRIES, type Country, countryFor } from "./countries";

/** Dial-code digit counts, longest first. */
const DIAL_LENGTHS = [...new Set(COUNTRIES.map((c) => c.dial.length - 1))].sort((a, b) => b - a);

const digitsOf = (raw: string) => raw.replace(/\D/g, "");

export function toE164(raw: string): string {
  return `+${digitsOf(raw)}`;
}

export function isValidPhone(raw: string): boolean {
  const length = digitsOf(raw).length;
  return length >= 7 && length <= 15;
}

/**
 * Work out which country a typed or pasted number belongs to.
 *
 * Without this, selecting the United States and typing a +91 number produced
 * `+1` followed by the Indian digits — a different number entirely, so a
 * returning user looked new and was asked for a name again.
 */
export function splitInternational(
  raw: string,
  current: Country
): { country: Country; national: string } {
  const trimmed = raw.trim();
  const digits = digitsOf(trimmed);

  // `+` or `00` both mean "what follows is a full international number".
  const international = trimmed.startsWith("+") || digits.startsWith("00");
  const body = digits.startsWith("00") ? digits.slice(2) : digits;

  if (international) {
    if (!body) return { country: current, national: "" };

    // Longest dial code wins, so +1809 reads as the Dominican Republic rather
    // than the US. `countryFor` breaks ties between countries sharing a code —
    // +1 is the United States, not Canada.
    for (const length of DIAL_LENGTHS) {
      const match = countryFor(`+${body.slice(0, length)}`);
      if (match) return { country: match, national: body.slice(length) };
    }
    // Unrecognised code: keep the selection rather than guessing.
    return { country: current, national: body };
  }

  // A national number. Drop a trunk prefix — `0` everywhere, and a leading
  // `1` in the NANP, where no area code may begin with one.
  let national = body;
  if (national.startsWith("0")) national = national.replace(/^0+/, "");
  else if (current.dial === "+1" && national.length > 10 && national.startsWith("1")) {
    national = national.slice(1);
  }

  return { country: current, national };
}

/**
 * Split a typed number *only* when a dial code is actually recognisable.
 *
 * Returns null otherwise, so the field keeps whatever the user typed. Rewriting
 * on every keystroke would strip the leading `+` while they were still typing
 * the code after it.
 */
export function parseTypedNumber(
  raw: string,
  current: Country
): { country: Country; national: string } | null {
  const trimmed = raw.trim();
  const digits = digitsOf(trimmed);
  if (!trimmed.startsWith("+") && !digits.startsWith("00")) return null;

  const body = digits.startsWith("00") ? digits.slice(2) : digits;
  if (!body) return null;

  const split = splitInternational(raw, current);
  // On no match, splitInternational hands the digits straight back.
  return split.national === body && split.country.code === current.code ? null : split;
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
