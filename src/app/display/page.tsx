"use client";

import { useCallback, useEffect, useState } from "react";

import { FindingDetail } from "@/components/FindingDetail";
import { Logo } from "@/components/Logo";
import { StatusDot, cx } from "@/components/primitives";
import { CountdownDisplay } from "@/components/Timer";
import { AudienceMode } from "@/components/display/AudienceMode";
import { AuctionMode } from "@/components/display/AuctionMode";
import { BoardMode } from "@/components/display/BoardMode";
import { InstructionsMode } from "@/components/display/InstructionsMode";
import { PortfoliosMode } from "@/components/display/PortfoliosMode";
import type { FindingView } from "@/lib/derive";
import { useEvent } from "@/lib/useEvent";
import type { DisplayMode } from "@/lib/types";

/**
 * The projected screen.
 *
 * Which of the four modes is showing is server state, set by the operator, so
 * the projector follows /control without anyone touching the presenting laptop.
 * Keys 1/2/3/4 switch modes locally as a fallback if the operator's machine
 * drops off the network mid-session.
 */
export default function DisplayPage() {
  const { state, status } = useEvent("display");
  const [detail, setDetail] = useState<FindingView | null>(null);
  const [modeOverride, setModeOverride] = useState<DisplayMode | null>(null);

  // Clear a local override as soon as the operator changes the mode themselves,
  // so control does not appear stuck from the front of the room.
  const serverMode = state?.event.displayMode;
  useEffect(() => {
    setModeOverride(null);
  }, [serverMode]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "1") setModeOverride("board");
      if (event.key === "2") setModeOverride("auction");
      if (event.key === "3") setModeOverride("portfolios");
      if (event.key === "4") setModeOverride("audience");
      if (event.key === "5") setModeOverride("instructions");
      if (event.key === "f" || event.key === "F") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openFinding = useCallback((view: FindingView) => setDetail(view), []);

  if (!state) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-8 text-center">
        {status === "connecting" ? (
          <p className="eyebrow animate-pulse">Connecting to the event…</p>
        ) : (
          <div className="max-w-md">
            <p className="eyebrow mb-3">No event yet</p>
            <p className="text-paper-mute text-sm leading-relaxed">
              The operator has not created this event. Open{" "}
              <span className="text-signal font-mono">/control</span> and create one from
              the Setup tab.
            </p>
          </div>
        )}
      </main>
    );
  }

  const mode = modeOverride ?? state.event.displayMode;

  return (
    <main className="display-root flex h-dvh flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-[2em] px-[1.75em] pt-[1.25em] pb-[1em]">
        <div className="flex items-center gap-[1.25em]">
          {/* The projector header is the one place the brand has to be
              unmistakable from the back of the room. */}
          <Logo className="text-paper h-[2.1em] w-auto shrink-0" />
          <div className="border-ink-500 border-l pl-[1.25em]">
            <h1 className="text-paper text-[1.125em] leading-none font-medium">
              {state.event.title}
            </h1>
            {state.event.subtitle ? (
              <p className="text-paper-mute mt-[0.4em] font-mono text-[0.625em] tracking-[0.16em] uppercase">
                {state.event.subtitle}
              </p>
            ) : null}
          </div>
          {state.event.isDemo ? (
            <span className="border-signal/50 text-signal rounded-sm border px-[0.5em] py-[0.15em] font-mono text-[0.5625em] font-bold tracking-[0.14em] uppercase">
              Demo data
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-[1.5em]">
          {state.timer.visible ? <CountdownDisplay timer={state.timer} size="md" /> : null}
          <ModeIndicator mode={mode} overridden={modeOverride !== null} />
          <StatusDot status={status} />
        </div>
      </header>

      {mode === "instructions" ? (
        <InstructionsMode state={state} />
      ) : mode === "board" ? (
        <BoardMode state={state} onOpenFinding={openFinding} />
      ) : mode === "auction" ? (
        <AuctionMode state={state} onOpenFinding={openFinding} />
      ) : mode === "audience" ? (
        <AudienceMode state={state} />
      ) : (
        <PortfoliosMode state={state} onOpenFinding={openFinding} />
      )}

      <FindingDetail view={detail} onClose={() => setDetail(null)} />
    </main>
  );
}

function ModeIndicator({
  mode,
  overridden,
}: {
  mode: DisplayMode;
  overridden: boolean;
}) {
  const labels: Record<DisplayMode, string> = {
    board: "Findings Board",
    auction: "Live Auction",
    portfolios: "Final Portfolios",
    audience: "Audience vs Panel",
    instructions: "Instructions",
  };

  return (
    <span
      className={cx(
        "rounded-sm border px-[0.6em] py-[0.25em] font-mono text-[0.625em] font-semibold tracking-[0.14em] uppercase",
        overridden ? "border-signal/50 text-signal" : "border-ink-400 text-paper-mute",
      )}
      title={overridden ? "Local override — press the matching number key to change" : undefined}
    >
      {labels[mode]}
      {overridden ? " ·  local" : ""}
    </span>
  );
}
