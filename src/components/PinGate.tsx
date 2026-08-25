"use client";

import { useState } from "react";

import { api } from "@/lib/useEvent";
import { Notice } from "./primitives";

/**
 * PIN entry for /control and the breakout rooms.
 *
 * The PIN is exchanged for a signed role cookie server-side and never kept in
 * component state, so a facilitator handing their laptop to a colleague is not
 * also handing over a reusable secret sitting in the DOM.
 */
export function PinGate({
  title,
  hint,
  slug,
  onAuthenticated,
}: {
  title: string;
  hint: string;
  /** Restricts matching to one breakout's PIN. Omit for /control. */
  slug?: string;
  onAuthenticated: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await api("/api/auth", "POST", { pin, slug });
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? "That PIN was not recognised.");
      setPin("");
      return;
    }
    onAuthenticated();
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

        <button type="submit" className="btn btn-primary mt-6 w-full py-2.5" disabled={busy}>
          {busy ? "Checking…" : "Enter"}
        </button>
      </form>
    </main>
  );
}
