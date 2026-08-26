"use client";

import { useState } from "react";

import { FindingCard } from "@/components/FindingCard";
import { FindingDetail } from "@/components/FindingDetail";
import { Notice, cx } from "@/components/primitives";
import { buildFindingView, findingsForBreakout, sortedBreakouts, type FindingView } from "@/lib/derive";
import { patchBreakout } from "@/lib/actions";
import { usePresence } from "@/lib/useEvent";
import type { EventState, SubmissionStatus } from "@/lib/types";

/**
 * Breakout monitoring during the working session: who has submitted, what they
 * said, and the controls to reopen a room or fix a typo before it goes on the
 * projector.
 */
export function BreakoutsPanel({ state }: { state: EventState }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<FindingView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const breakouts = sortedBreakouts(state);
  const present = usePresence();

  async function setStatus(slug: string, submissionStatus: SubmissionStatus) {
    const result = await patchBreakout(state, slug, { submissionStatus });
    setError(result.ok ? null : (result.error ?? "Could not update."));
  }

  return (
    <section className="space-y-4">
      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="panel divide-ink-500 divide-y">
        {breakouts.map((breakout) => {
          const findings = findingsForBreakout(state, breakout.id);
          const written = findings.filter((f) => f.headline.trim()).length;
          const isOpen = expanded === breakout.id;
          // How many browsers currently have this room's workspace open. Tells
          // the operator at a glance whether a table has actually found the
          // link yet, which is the usual reason a room shows "Not started".
          const online = present.filter((p) => p.room === `breakout:${breakout.slug}`).length;

          return (
            <div key={breakout.id}>
              <div className="flex flex-wrap items-center gap-3 p-4">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setExpanded(isOpen ? null : breakout.id)}
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-2">
                    <StatusLamp status={breakout.submissionStatus} />
                    <span className="text-paper truncate text-sm font-semibold">
                      {breakout.name}
                    </span>
                    {online > 0 ? (
                      <span
                        className="border-momentum/40 text-momentum shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[0.5625rem] font-semibold tracking-[0.1em] uppercase"
                        title={`${online} device${online === 1 ? "" : "s"} has this room open`}
                      >
                        {online} online
                      </span>
                    ) : null}
                  </div>
                  <p className="text-paper-faint mt-1 pl-4 font-mono text-[0.625rem] tracking-[0.1em] uppercase">
                    {STATUS_LABEL[breakout.submissionStatus]} · {written}/{findings.length || 5}{" "}
                    written · PIN {breakout.pin} · /breakout/{breakout.slug}
                  </p>
                </button>

                <div className="flex shrink-0 gap-2">
                  {breakout.submissionStatus === "submitted" ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void setStatus(breakout.slug, "drafting")}
                    >
                      Reopen
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void setStatus(breakout.slug, "submitted")}
                      disabled={written === 0}
                    >
                      Submit for room
                    </button>
                  )}
                  <a
                    className="btn btn-ghost"
                    href={`../breakout/${breakout.slug}/`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open ↗
                  </a>
                </div>
              </div>

              {isOpen ? (
                <div className="border-ink-500 border-t p-4">
                  {findings.length === 0 ? (
                    <p className="text-paper-faint text-sm">
                      No findings yet. Use “Seed empty finding templates” in Setup.
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {findings.map((finding) => (
                        <FindingCard
                          key={finding.id}
                          view={buildFindingView(state, finding)}
                          onOpen={setDetail}
                          compact
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <FindingDetail view={detail} onClose={() => setDetail(null)} />
    </section>
  );
}

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  not_started: "Not started",
  drafting: "Drafting",
  submitted: "Submitted",
};

function StatusLamp({ status }: { status: SubmissionStatus }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "h-2 w-2 shrink-0 rounded-full",
        status === "submitted"
          ? "bg-momentum"
          : status === "drafting"
            ? "bg-signal"
            : "bg-ink-400",
      )}
    />
  );
}
