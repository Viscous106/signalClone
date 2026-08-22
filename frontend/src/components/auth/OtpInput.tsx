"use client";

import { useEffect, useRef } from "react";

const LENGTH = 6;
/** Signal splits the six digits 3–3 with a hyphen between. */
const SPLIT = 3;

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function OtpInput({ value, onChange, disabled = false }: Props) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const caret = Math.min(value.length, LENGTH - 1);

  useEffect(() => {
    // Keep the caret on the next empty box as the code fills in.
    if (!disabled) boxes.current[caret]?.focus();
  }, [caret, disabled]);

  function push(digits: string) {
    const next = (value + digits.replace(/\D/g, "")).slice(0, LENGTH);
    if (next !== value) onChange(next);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (value.length > 0) onChange(value.slice(0, -1));
      return;
    }
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      push(event.key);
    }
  }

  return (
    <fieldset
      disabled={disabled}
      className="flex items-center gap-2 border-0 p-0"
      aria-label="Verification code"
    >
      <legend className="sr-only">Verification code</legend>

      {Array.from({ length: LENGTH }).map((index, i) => (
        <span key={i} className="flex items-center gap-2">
          {i === SPLIT && (
            <span data-testid="otp-separator" aria-hidden="true" className="text-title2 text-label-2">
              –
            </span>
          )}
          <input
            ref={(node) => {
              boxes.current[i] = node;
            }}
            type="text"
            role="textbox"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            aria-label={`Digit ${i + 1}`}
            value={value[i] ?? ""}
            disabled={disabled}
            // Everything is driven from keydown and paste, so the change
            // handler only exists to keep React from warning.
            onChange={() => {}}
            onKeyDown={handleKeyDown}
            onPaste={(event) => {
              event.preventDefault();
              push(event.clipboardData.getData("text"));
            }}
            onFocus={(event) => event.currentTarget.select()}
            className="h-14 w-11 rounded-md bg-surface-2 text-center text-title2 text-label caret-transparent outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
          />
        </span>
      ))}
    </fieldset>
  );
}
