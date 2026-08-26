"use client";

import { useState } from "react";

import { attemptLogin } from "@/lib/localAuth";
import type { EventState, Role } from "@/lib/types";
import { Notice } from "./primitives";

/**
 * PIN entry for /control and the breakout rooms.
 *
 * The check runs in the browser against PINs held in the event record. See
 * lib/localAuth.ts for why that is an accepted trade here rather than an
 * oversight — briefly: this stops someone opening the wrong room's form, and
 * the content ends up projected on a wall regardless.
 */
export function PinGate({
  title,
  hint,
  slug,
  state,
  onAuthenticated,
}: {
  title: string;
  hint: string;
  /** Restricts matching to one breakout's PIN. Omit for /control. */
  slug?: string;
  state: EventState | null;
  onAuthenticated: (role: Role) => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = attemptLogin(state, pin, slug);

    if (!result.ok || !result.role) {
      setError(result.error ?? "That PIN was not recognised.");
      setPin("");
      return;
    }
    onAuthenticated(result.role);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form onSubmit={submit} className="panel w-full max-w-sm p-8">
        <div className="rule-signal mb-6">
          <h1 className="text-paper text-xl leading-tight font-semibold">{title}</h1>
          <p className="text-paper-mute mt-2 text-sm leading-relaxed">{hint}</p>
        </div>

        <label className="label" htmlFor="pin">
          Access PIN
        </label>
        <input
          id="pin"
          className="field tabular text-center text-2xl tracking-[0.4em]"
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          autoFocus
          required
        />

        {error ? (
          <div className="mt-4">
            <Notice tone="error">{error}</Notice>
          </div>
        ) : null}

        <button type="submit" className="btn btn-primary mt-6 w-full py-2.5">
          Enter
        </button>
      </form>
    </main>
  );
}
