"use client";

import { useState } from "react";

import { PinGate } from "@/components/PinGate";
import { Notice, StatusDot, cx } from "@/components/primitives";
import { CountdownDisplay } from "@/components/Timer";
import { AwardPanel } from "@/components/control/AwardPanel";
import { BreakoutsPanel } from "@/components/control/BreakoutsPanel";
import { LedgerPanel } from "@/components/control/LedgerPanel";
import { SetupPanel } from "@/components/control/SetupPanel";
import { api, useEvent } from "@/lib/useEvent";
import type { DisplayMode } from "@/lib/types";

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
 * timer, and the round position — so switching what the room sees never costs
 * the operator their place in the transaction form.
 */
export default function ControlPage() {
  const { state, role, status, refresh } = useEvent();
  const [tab, setTab] = useState<Tab>("auction");

  if (!state) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="eyebrow animate-pulse">Loading control room…</p>
      </main>
    );
  }

  if (role?.kind !== "admin") {
    return (
      <PinGate
        title="Operator control room"
        hint="Enter the administrator PIN. This screen records auction results and drives the projected display."
        onAuthenticated={refresh}
      />
    );
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-7xl px-4 py-5 sm:px-6">
      <header className="mb-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <p className="eyebrow">Control room</p>
              {state.event.isDemo ? (
                <span className="border-signal/50 text-signal rounded-sm border px-1.5 py-0.5 font-mono text-[0.5625rem] font-bold tracking-[0.14em] uppercase">
                  Demo data
                </span>
              ) : null}
            </div>
            <h1 className="text-paper mt-1 truncate text-xl font-semibold">
              {state.event.title}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {state.timer.visible ? <CountdownDisplay timer={state.timer} size="sm" /> : null}
            <StatusDot status={status} />
            <a className="btn btn-ghost" href="/display" target="_blank" rel="noreferrer">
              Open display ↗
            </a>
          </div>
        </div>

        <DisplayControls state={state} />
      </header>

      {state.event.isDemo && state.transactions.length === 0 ? (
        <div className="mb-5">
          <Notice tone="warn">
            This event is loaded with <strong>sample findings</strong> for rehearsal. Before the
            live session, go to <strong>Setup → Event lifecycle</strong> and create a new live
            event, or clear the findings.
          </Notice>
        </div>
      ) : null}

      <nav className="border-ink-500 mb-5 flex gap-1 border-b">
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
          <a className="btn btn-ghost" href="/api/export/findings">
            Findings CSV
          </a>
          <a className="btn btn-ghost" href="/api/export/transactions">
            Ledger CSV
          </a>
          <a className="btn btn-ghost" href="/api/export/portfolios">
            Portfolios CSV
          </a>
          <a className="btn btn-ghost" href="/summary" target="_blank" rel="noreferrer">
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

/** Display mode + countdown, always visible regardless of which tab is open. */
function DisplayControls({ state }: { state: React.ComponentProps<typeof AwardPanel>["state"] }) {
  const [minutes, setMinutes] = useState("20");
  const [label, setLabel] = useState(state.timer.label);

  const modes: { key: DisplayMode; label: string }[] = [
    { key: "board", label: "Findings Board" },
    { key: "auction", label: "Live Auction" },
    { key: "portfolios", label: "Final Portfolios" },
  ];

  return (
    <div className="panel flex flex-wrap items-center gap-x-6 gap-y-3 p-3">
      <div className="flex items-center gap-2">
        <span className="eyebrow mr-1">Big screen</span>
        {modes.map((mode) => (
          <button
            key={mode.key}
            type="button"
            onClick={() => void api("/api/event", "PATCH", { displayMode: mode.key })}
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
            onClick={() =>
              void api("/api/event", "PATCH", { showSummary: !state.event.showSummary })
            }
            className="border-ink-400 text-paper-mute hover:text-paper ml-1 rounded-sm border border-dashed px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            {state.event.showSummary ? "← Show roster" : "Show summary cuts →"}
          </button>
        ) : null}
      </div>

      <div className="border-ink-500 flex items-center gap-2 border-l pl-6">
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
            void api("/api/timer", "PATCH", {
              action: "start",
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
          onClick={() =>
            void api("/api/timer", "PATCH", {
              action: state.timer.running ? "pause" : "resume",
            })
          }
        >
          {state.timer.running ? "Pause" : "Resume"}
        </button>
        <button
          type="button"
          className="btn btn-ghost px-2.5 py-1 text-xs"
          onClick={() =>
            void api("/api/timer", "PATCH", {
              action: state.timer.visible ? "hide" : "show",
            })
          }
        >
          {state.timer.visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
