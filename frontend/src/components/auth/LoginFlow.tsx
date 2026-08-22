"use client";

import { useEffect, useRef, useState } from "react";

import { CountryPicker } from "@/components/auth/CountryPicker";
import { OtpInput } from "@/components/auth/OtpInput";
import { SIGNAL_BLUE, SignalLockup } from "@/components/ui/SignalMark";
import { ApiError, api } from "@/lib/api";
import { DEFAULT_COUNTRY, type Country, flagFor } from "@/lib/countries";
import { displayPhone, isValidPhone, parseTypedNumber } from "@/lib/phone";
import type { User } from "@/lib/types";

type Step = "phone" | "code" | "name";

const RESEND_SECONDS = 60;

const nextButton =
  "rounded-full bg-outgoing px-7 py-2.5 text-body1 font-semibold text-white transition-opacity " +
  "hover:opacity-90 disabled:cursor-not-allowed disabled:bg-surface disabled:text-label-2 " +
  // Right-aligned on a phone, full width inside the desktop card.
  "sm:w-full";

export function LoginFlow({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [step, setStep] = useState<Step>("phone");
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [picking, setPicking] = useState(false);
  const [national, setNational] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);

  const e164 = `${country.dial}${national.replace(/\D/g, "")}`;
  const plausible = isValidPhone(e164);

  // Resend timer, exactly as the real app counts down.
  const ticking = step === "code";
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!ticking) return;
    timer.current = setInterval(() => setCountdown((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [ticking]);

  const mmss = `${String(Math.floor(countdown / 60)).padStart(2, "0")}:${String(countdown % 60).padStart(2, "0")}`;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const start = (advance = true) =>
    run(async () => {
      const result = await api.post<{ otp_sent: boolean; is_new: boolean }>("/api/auth/start", {
        phone: e164,
      });
      setIsNew(result.is_new);
      setCountdown(RESEND_SECONDS);
      if (advance) setStep("code");
    });

  const verify = (displayName?: string) =>
    run(async () => {
      try {
        const user = await api.post<User>("/api/auth/verify", {
          phone: e164,
          code,
          ...(displayName ? { display_name: displayName } : {}),
        });
        onAuthenticated(user);
      } catch (err) {
        // A new account only learns the code was wrong once it reaches the
        // profile step, so send them back to where they can fix it.
        if (isNew) setStep("code");
        throw err;
      }
    });

  // A new account needs a name before the server will create it, so collect
  // that first and verify once with everything.
  const submitCode = () => (isNew ? (setError(null), setStep("name")) : verify());

  return (
    <div className="flex min-h-screen w-full items-center justify-center px-6 py-10">
      {/* On a desktop browser this is a centred card; below `sm` the chrome
          falls away and it reads like the phone app. */}
      <div className="flex w-full max-w-[420px] flex-col sm:rounded-2xl sm:border sm:border-edge sm:bg-surface-2 sm:px-9 sm:py-10 sm:shadow-2xl">
        <SignalLockup
          size={34}
          className="mb-10 self-start sm:mb-8 sm:self-center"
          style={{ color: SIGNAL_BLUE }}
        />

        {step === "phone" && (
          <>
            <h1 className="text-title1 font-semibold text-label sm:text-center sm:text-title2">Phone number</h1>
            <p className="mt-3 text-body1 text-label-2 sm:text-center sm:text-body2">
              You will receive a verification code. Carrier rates may apply.
            </p>

            <button
              onClick={() => setPicking(true)}
              className="mt-10 flex w-full items-center gap-3 rounded-t-md border-b border-edge bg-surface-2 px-4 py-3 text-left hover:border-accent"
            >
              <span aria-hidden="true" className="text-title2 leading-none">
                {flagFor(country.code)}
              </span>
              <span className="flex-1 text-body1 text-label">{country.name}</span>
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-label-2" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" strokeLinecap="round" />
              </svg>
            </button>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                start();
              }}
              className="mt-3 flex flex-col"
            >
              <div className="flex gap-3">
                <span className="w-20 shrink-0 rounded-t-md border-b border-edge bg-surface-2 px-3 py-3 text-body1 text-label-2">
                  {country.dial}
                </span>
                <div className="flex-1">
                  <label htmlFor="phone" className="sr-only">
                    Phone number
                  </label>
                  <input
                    id="phone"
                    autoFocus
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="Phone number"
                    value={national}
                    onChange={(e) => {
                      // A pasted or typed international number retargets the
                      // country selector, so +91… never becomes +1 91….
                      const parsed = parseTypedNumber(e.target.value, country);
                      if (parsed) {
                        setCountry(parsed.country);
                        setNational(parsed.national);
                        return;
                      }
                      setNational(e.target.value.replace(/[^\d\s+-]/g, ""));
                    }}
                    className="w-full rounded-t-md border-b border-edge bg-surface-2 px-3 py-3 text-body1 text-label outline-none placeholder:text-label-2 focus:border-accent"
                  />
                </div>
              </div>

              <div className="mt-16 flex justify-end sm:mt-8">
                <button type="submit" className={nextButton} disabled={!plausible || busy}>
                  Next
                </button>
              </div>
            </form>
          </>
        )}

        {step === "code" && (
          <>
            <h1 className="text-title1 font-semibold text-label sm:text-center sm:text-title2">Verification code</h1>
            <p className="mt-3 text-body1 text-label-2 sm:text-center sm:text-body2">
              Enter the code we sent to {displayPhone(e164)}
            </p>
            <button
              onClick={() => {
                setStep("phone");
                setCode("");
                setError(null);
              }}
              className="mt-3 self-start text-body1 font-medium text-accent hover:underline sm:self-center sm:text-body2"
            >
              Wrong number?
            </button>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitCode();
              }}
              className="mt-10 flex flex-col"
            >
              <div className="sm:self-center">
                <OtpInput value={code} onChange={setCode} disabled={busy} />
              </div>

              <div className="mt-16 flex justify-end sm:mt-8">
                <button type="submit" className={nextButton} disabled={code.length !== 6 || busy}>
                  Next
                </button>
              </div>
            </form>

            <div className="mt-10 flex justify-between text-body2 sm:mt-6 sm:text-subtitle">
              <button
                onClick={() => start(false)}
                disabled={countdown > 0 || busy}
                className="text-label-2 enabled:text-accent enabled:hover:underline disabled:cursor-not-allowed"
              >
                Resend Code {countdown > 0 && `(${mmss})`}
              </button>
              <span className="cursor-not-allowed text-label-2" title="Coming soon">
                Call me {countdown > 0 && `(${mmss})`}
              </span>
            </div>
          </>
        )}

        {step === "name" && (
          <>
            <h1 className="text-title1 font-semibold text-label sm:text-center sm:text-title2">Profile</h1>
            <p className="mt-3 text-body1 text-label-2 sm:text-center sm:text-body2">
              Choose the name people will see when you message them.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                verify(name.trim());
              }}
              className="mt-10 flex flex-col"
            >
              <label htmlFor="name" className="mb-1 text-subtitle text-label-2">
                Your name
              </label>
              <input
                id="name"
                autoFocus
                autoComplete="name"
                placeholder="Alice Chen"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-t-md border-b border-edge bg-surface-2 px-3 py-3 text-body1 text-label outline-none placeholder:text-label-2 focus:border-accent"
              />

              <div className="mt-16 flex justify-end sm:mt-8">
                <button type="submit" className={nextButton} disabled={!name.trim() || busy}>
                  Next
                </button>
              </div>
            </form>
          </>
        )}

        {error && (
          <p role="alert" className="mt-6 text-body2 text-[#CF163E]">
            {error}
          </p>
        )}

      </div>

      {picking && (
        <CountryPicker
          onPick={(chosen) => {
            setCountry(chosen);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
