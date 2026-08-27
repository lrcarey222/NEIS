"use client";

import { useState } from "react";

import { Logo } from "@/components/Logo";
import { PinGate } from "@/components/PinGate";
import { Notice, StatusDot, cx } from "@/components/primitives";
import { CountdownDisplay } from "@/components/Timer";
import { AwardPanel } from "@/components/control/AwardPanel";
import { BreakoutsPanel } from "@/components/control/BreakoutsPanel";
import { LedgerPanel } from "@/components/control/LedgerPanel";
import { SetupPanel } from "@/components/control/SetupPanel";
import { patchEvent, patchTimer } from "@/lib/actions";
import { findingsCsv, downloadCsv, portfoliosCsv, transactionsCsv } from "@/lib/csv";
import { isAdmin, useRole } from "@/lib/localAuth";
import { useEvent } from "@/lib/useEvent";
import type { DisplayMode, EventState } from "@/lib/types";

type Tab = "auction" | "ledger" | "breakouts" | "setup";

const TABS: { key: Tab; label: string }[] = [
  { key: "auction", label: "Auction" },
  { key: "ledger", label: "Ledger" },
  { key: "breakouts", label: "Breakouts" },
  { key: "setup", label: "Setup" },
];

/**
 * The operator control room.
 *
 * Everything that has to happen fast lives above the tabs — display mode,
 * timer, round position — so switching what the room sees never costs the
 * operator their place in the transaction form.
 */
export default function ControlPage() {
  const { state, status, mode } = useEvent("control");
  const [role, setRole] = useRole();
  const [tab, setTab] = useState<Tab>("auction");

  if (status === "connecting") {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="eyebrow animate-pulse">Loading control room…</p>
      </main>
    );
  }

  if (!isAdmin(role)) {
    return (
      <PinGate
        title="Operator control room"
        hint="Enter the administrator PIN. This screen records auction results and drives the projected display."
        state={state}
        onAuthenticated={setRole}
      />
    );
  }

  // No event yet — the only thing that matters is creating one.
  if (!state) {
    return <FirstRun mode={mode} />;
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-7xl px-4 py-5 sm:px-6">
      <header className="mb-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Logo className="text-paper hidden h-9 w-auto shrink-0 sm:block" />
            <div className="border-ink-500 min-w-0 sm:border-l sm:pl-4">
              <div className="flex items-center gap-3">
                <p className="eyebrow">Control room</p>
                {state.event.isDemo ? (
                  <span className="border-signal/50 text-signal border px-1.5 py-0.5 font-mono text-[0.5625rem] font-bold tracking-[0.14em] uppercase">
                    Demo data
                  </span>
                ) : null}
              </div>
              <h1 className="text-paper mt-1 truncate text-xl font-medium">
                {state.event.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {state.timer.visible ? <CountdownDisplay timer={state.timer} size="sm" /> : null}
            <StatusDot status={status} />
            <a className="btn btn-ghost" href="../display/" target="_blank" rel="noreferrer">
              Open display ↗
            </a>
          </div>
        </div>

        <DisplayControls state={state} />
      </header>

      {status === "local" ? (
        <div className="mb-5">
          <Notice tone="error">
            <strong>Local-only mode — breakout rooms cannot reach this event.</strong> Paste
            your project&apos;s values into <code>src/lib/firebase-config.ts</code> and
            redeploy before the session. Until then, everything here stays in this browser.
          </Notice>
        </div>
      ) : null}

      {state.event.isDemo && state.transactions.length === 0 ? (
        <div className="mb-5">
          <Notice tone="warn">
            This event is loaded with <strong>sample findings</strong> for rehearsal. Before
            the live session, go to <strong>Setup → Event lifecycle</strong> and create a new
            live event, or clear the findings.
          </Notice>
        </div>
      ) : null}

      <nav className="border-ink-500 mb-5 flex flex-wrap gap-1 border-b">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            className={cx(
              "-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
              tab === entry.key
                ? "border-signal text-paper"
                : "text-paper-mute hover:text-paper border-transparent",
            )}
          >
            {entry.label}
            {entry.key === "ledger" && state.transactions.length > 0 ? (
              <span className="text-paper-faint tabular ml-1.5 font-mono text-xs">
                {state.transactions.length}
              </span>
            ) : null}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2 pb-1.5">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => downloadCsv("neis-findings.csv", findingsCsv(state))}
          >
            Findings CSV
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => downloadCsv("neis-auction-ledger.csv", transactionsCsv(state))}
          >
            Ledger CSV
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => downloadCsv("neis-final-portfolios.csv", portfoliosCsv(state))}
          >
            Portfolios CSV
          </button>
          <a className="btn btn-ghost" href="../summary/" target="_blank" rel="noreferrer">
            Printable summary ↗
          </a>
        </div>
      </nav>

      {tab === "auction" ? <AwardPanel state={state} /> : null}
      {tab === "ledger" ? <LedgerPanel state={state} /> : null}
      {tab === "breakouts" ? <BreakoutsPanel state={state} /> : null}
      {tab === "setup" ? <SetupPanel state={state} /> : null}
    </main>
  );
}

/**
 * Shown when the database has no event at this key yet.
 *
 * Takes `mode` rather than the connection status on purpose: with no event,
 * status is "empty" for both a working Firebase connection and an unconfigured
 * one, and this screen is the last chance to catch "we ran the whole breakout
 * session in local mode" before it costs an hour of the room's work.
 */
function FirstRun({ mode }: { mode: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(demo: boolean) {
    setBusy(true);
    const { createNewEvent } = await import("@/lib/actions");
    const result = await createNewEvent({ demo });
    setBusy(false);
    if (!result.ok) setError(result.error ?? "Could not create the event.");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="panel w-full max-w-lg p-8">
        <div className="rule-signal mb-5">
          <h1 className="text-paper text-xl font-semibold">No event yet</h1>
          <p className="text-paper-mute mt-2 text-sm leading-relaxed">
            Nothing has been created at this event slot. Start with a rehearsal event to
            practise, or an empty live event for the real session.
          </p>
        </div>

        {mode === "local" ? (
          <div className="mb-5">
            <Notice tone="error">
              <strong>Local only — breakout rooms will not see this event.</strong> Paste your
              project values into <code>src/lib/firebase-config.ts</code> and redeploy before
              the session, or anything created here stays in this browser.
            </Notice>
          </div>
        ) : null}

        {error ? (
          <div className="mb-5">
            <Notice tone="error">{error}</Notice>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            className="btn btn-primary py-3"
            disabled={busy}
            onClick={() => void create(true)}
          >
            Create rehearsal event (25 sample findings)
          </button>
          <button
            type="button"
            className="btn btn-ghost py-3"
            disabled={busy}
            onClick={() => void create(false)}
          >
            Create empty live event
          </button>
        </div>
      </div>
    </main>
  );
}

/** Display mode + countdown, always visible regardless of which tab is open. */
function DisplayControls({ state }: { state: EventState }) {
  const [minutes, setMinutes] = useState("20");
  const [label, setLabel] = useState(state.timer.label);

  // Chronological order — Instructions is the screen the room sees first.
  const modes: { key: DisplayMode; label: string }[] = [
    { key: "instructions", label: "Instructions" },
    { key: "board", label: "Findings Board" },
    { key: "auction", label: "Live Auction" },
    { key: "portfolios", label: "Final Portfolios" },
  ];

  return (
    <div className="panel flex flex-wrap items-center gap-x-6 gap-y-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-1">Big screen</span>
        {modes.map((mode) => (
          <button
            key={mode.key}
            type="button"
            onClick={() => void patchEvent(state, { displayMode: mode.key })}
            className={cx(
              "rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors",
              state.event.displayMode === mode.key
                ? "border-signal bg-signal text-ink-900"
                : "border-ink-400 text-paper-mute hover:text-paper",
            )}
          >
            {mode.label}
          </button>
        ))}

        {/* Final Portfolios is two screens; this flips between them. */}
        {state.event.displayMode === "portfolios" ? (
          <button
            type="button"
            onClick={() => void patchEvent(state, { showSummary: !state.event.showSummary })}
            className="border-ink-400 text-paper-mute hover:text-paper ml-1 rounded-sm border border-dashed px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            {state.event.showSummary ? "← Show roster" : "Show summary cuts →"}
          </button>
        ) : null}
      </div>

      <div className="border-ink-500 flex flex-wrap items-center gap-2 sm:border-l sm:pl-6">
        <span className="eyebrow mr-1">Timer</span>
        <input
          className="field tabular w-16 px-2 py-1 text-sm"
          type="number"
          min={1}
          value={minutes}
          onChange={(event) => setMinutes(event.target.value)}
          aria-label="Timer minutes"
        />
        <input
          className="field w-44 px-2 py-1 text-sm"
          value={label}
          placeholder="Label"
          onChange={(event) => setLabel(event.target.value)}
          aria-label="Timer label"
        />
        <button
          type="button"
          className="btn btn-ghost px-2.5 py-1 text-xs"
          onClick={() =>
            void patchTimer(state, "start", {
              seconds: Math.max(1, Number(minutes) || 1) * 60,
              label,
            })
          }
        >
          Start
        </button>
        <button
          type="button"
          className="btn btn-ghost px-2.5 py-1 text-xs"
          onClick={() => void patchTimer(state, state.timer.running ? "pause" : "resume")}
        >
          {state.timer.running ? "Pause" : "Resume"}
        </button>
        <button
          type="button"
          className="btn btn-ghost px-2.5 py-1 text-xs"
          onClick={() => void patchTimer(state, state.timer.visible ? "hide" : "show")}
        >
          {state.timer.visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
