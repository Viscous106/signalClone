"use client";

import { useState } from "react";

import { ApiError, api } from "@/lib/api";
import { displayPhone, isValidPhone, toE164 } from "@/lib/phone";
import type { User } from "@/lib/types";

type Step = "phone" | "code" | "name";

const field =
  "w-full rounded-lg border border-edge bg-surface-2 px-4 py-3 text-body1 " +
  "text-label outline-none placeholder:text-label-2 focus:border-accent";

const primary =
  "w-full rounded-full bg-outgoing px-6 py-3 text-body1 font-semibold text-white " +
  "transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";

export function LoginFlow({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const submitPhone = () =>
    run(async () => {
      const result = await api.post<{ otp_sent: boolean; is_new: boolean }>(
        "/api/auth/start",
        { phone: toE164(phone) }
      );
      setIsNew(result.is_new);
      setStep("code");
    });

  const verify = (displayName?: string) =>
    run(async () => {
      try {
        const user = await api.post<User>("/api/auth/verify", {
          phone: toE164(phone),
          code,
          ...(displayName ? { display_name: displayName } : {}),
        });
        onAuthenticated(user);
      } catch (err) {
        // A new user only learns the code was wrong once they reach the name
        // step, so send them back to where they can fix it.
        if (isNew) setStep("code");
        throw err;
      }
    });

  // A new account needs a name before the server will create it, so collect
  // that first and verify once with everything.
  const submitCode = () => (isNew ? (setError(null), setStep("name")) : verify());

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-title1 font-semibold text-label">Signal</h1>
        <p className="mt-1 text-body2 text-label-2">
          {step === "phone" && "Enter your phone number to get started."}
          {step === "code" && (
            <>
              Enter the code sent to <span className="text-label">{displayPhone(phone)}</span>
            </>
          )}
          {step === "name" && "Choose the name people will see."}
        </p>
      </div>

      {step === "phone" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitPhone();
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="phone" className="mb-1 block text-subtitle text-label-2">
              Phone number
            </label>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+1 555 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={field}
            />
          </div>
          <button type="submit" className={primary} disabled={!isValidPhone(phone) || busy}>
            Continue
          </button>
        </form>
      )}

      {step === "code" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitCode();
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="code" className="mb-1 block text-subtitle text-label-2">
              Verification code
            </label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={`${field} text-center text-title2 tracking-[0.4em]`}
            />
          </div>
          <button type="submit" className={primary} disabled={code.length !== 6 || busy}>
            Continue
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("phone");
              setCode("");
              setError(null);
            }}
            className="w-full text-center text-body2 text-label-2 hover:text-label"
          >
            Use a different number
          </button>
        </form>
      )}

      {step === "name" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify(name.trim());
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="name" className="mb-1 block text-subtitle text-label-2">
              Your name
            </label>
            <input
              id="name"
              autoComplete="name"
              placeholder="Alice Chen"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={field}
            />
          </div>
          <button type="submit" className={primary} disabled={!name.trim() || busy}>
            Finish
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-4 text-center text-body2 text-[#CF163E]">
          {error}
        </p>
      )}

      <p className="mt-10 text-center text-caption text-label-2">
        Demo build. Verification is mocked — the code is always 123456.
      </p>
    </div>
  );
}
