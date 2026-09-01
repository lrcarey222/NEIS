"use client";

import { useState } from "react";

import { EmptyState, Notice, cx } from "@/components/primitives";
import {
  advanceSegment,
  createSegment,
  deleteSegment,
  patchSegment,
  reorderSegments,
  resetRunOfShow,
  seedRunOfShow,
  setAgendaVisible,
  type SegmentPatch,
} from "@/lib/actions";
import {
  activeSegment,
  currentPhase,
  driftedStarts,
  elapsedMs,
  formatWallClock,
  nextSegment,
  parseWallClock,
  projectedStarts,
  segmentIndex,
  totalPlannedMinutes,
} from "@/lib/schedule";
import { useServerClock } from "@/lib/useEvent";
import { SEGMENT_KINDS, type EventState, type Segment } from "@/lib/types";

/**
 * The agenda, as the operator edits it.
 *
 * Two jobs, and they are different enough to be stacked rather than mixed. At
 * the top, a presenter view: the notes for what is running and what is next,
 * large enough to read from a laptop on a table in a dark room. Below it, the
 * agenda itself — reorder, retime, jump out of order, reset the day.
 *
 * Every duration edit recomputes the wall-clock starts live, so the operator
 * can see what five more minutes on the opening panel does to the 12:30 lunch
 * *before* committing to it.
 */
export function RunOfShowPanel({ state }: { state: EventState }) {
  const { now, offsetMs } = useServerClock(1000);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const schedule = state.runOfShow;
  const segments = schedule.segments;
  const current = activeSegment(schedule);
  const upcoming = nextSegment(schedule);
  const activeIndex = segmentIndex(schedule);
  const projected = projectedStarts(segments);
  const drifted = driftedStarts(segments);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    const result = await action();
    setError(result.ok ? null : (result.error ?? "Could not update the schedule."));
  }

  if (segments.length === 0) {
    return (
      <div className="space-y-4">
        {error ? <Notice tone="error">{error}</Notice> : null}
        <EmptyState
          title="No run of show on this event"
          hint="Events created before the schedule existed have no agenda. Loading the default one leaves findings, panelists and the ledger untouched."
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void run(() => seedRunOfShow(state))}
        >
          Load the default run of show
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? <Notice tone="error">{error}</Notice> : null}

      <PresenterView
        current={current}
        upcoming={upcoming}
        elapsed={elapsedMs(schedule, now)}
      />

      <section>
        <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-paper text-base font-semibold">The day</h2>
            <p className="text-paper-faint mt-0.5 text-xs">
              {segments.length} segments · {totalPlannedMinutes(schedule)} planned minutes ·{" "}
              {projected[0]}–{endOfDay(segments)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-paper-mute flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={schedule.agendaVisible}
                onChange={(event) => void run(() => setAgendaVisible(event.target.checked))}
              />
              Agenda strip on the big screen
            </label>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void run(() => createSegment(state))}
            >
              + Segment
            </button>
            {confirmReset ? (
              <span className="flex items-center gap-2">
                <span className="text-paper-mute text-xs">
                  Clear the clock and start the day again?
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setConfirmReset(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setConfirmReset(false);
                    void run(() => resetRunOfShow(state));
                  }}
                >
                  Reset day
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmReset(true)}
              >
                Reset day
              </button>
            )}
          </div>
        </header>

        {drifted ? (
          <div className="mb-3">
            <Notice tone="warn">
              The planned start times no longer match the durations below. The{" "}
              <strong>projected</strong> column is what will actually happen; the printed
              agenda still says the stored time. <em>Apply projected</em> on a row rewrites
              it.
            </Notice>
          </div>
        ) : null}

        <ol className="space-y-2">
          {segments.map((segment, index) => (
            <SegmentRow
              key={segment.id}
              segment={segment}
              index={index}
              total={segments.length}
              projectedStart={projected[index]}
              isActive={index === activeIndex}
              isPast={activeIndex >= 0 && index < activeIndex}
              onPatch={(patch) => run(() => patchSegment(segment.id, patch))}
              onJump={() => run(() => advanceSegment(state, offsetMs, segment.id))}
              onDelete={() => run(() => deleteSegment(state, segment.id))}
              onMove={(direction) => {
                const ordered = segments.map((s) => s.id);
                const target = index + direction;
                if (target < 0 || target >= ordered.length) return Promise.resolve();
                [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
                return run(() => reorderSegments(ordered));
              }}
            />
          ))}
        </ol>
      </section>
    </div>
  );
}

/** When the last segment finishes, on the projected timings. */
function endOfDay(segments: Segment[]): string {
  const anchor = parseWallClock(segments[0]?.plannedStart ?? "");
  if (anchor === null) return "—";
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.plannedMinutes), 0);
  return formatWallClock(anchor + total);
}

/**
 * Speaker notes, at a size that can be read at a glance.
 *
 * The operator's notes never reach the projector — this is the only place they
 * exist, which is why the current segment's get the room and the next one's
 * get a preview.
 */
function PresenterView({
  current,
  upcoming,
  elapsed,
}: {
  current: Segment | null;
  upcoming: Segment | null;
  elapsed: number;
}) {
  const phase = currentPhase(current, elapsed);

  return (
    <section className="grid gap-3 sm:grid-cols-[2fr_1fr]">
      <div className="panel rule-signal p-4">
        <p className="eyebrow text-signal">Running now</p>
        <h2 className="text-paper mt-1 text-xl leading-tight font-semibold">
          {current?.title ?? "The day has not started"}
        </h2>

        {current?.owner ? (
          <p className="text-paper-faint mt-1 font-mono text-[0.6875rem] tracking-[0.1em] uppercase">
            Run by {current.owner}
          </p>
        ) : null}

        {phase ? (
          <p className="border-signal/40 text-paper-dim mt-3 border-l-2 pl-3 text-sm leading-relaxed">
            <strong className="text-signal">Phase: {phase.phase.title}</strong>
            {phase.phase.note ? ` — ${phase.phase.note}` : ""}
          </p>
        ) : null}

        {current?.operatorNotes ? (
          <p className="text-paper mt-3 text-base leading-relaxed whitespace-pre-line">
            {current.operatorNotes}
          </p>
        ) : (
          <p className="text-paper-faint mt-3 text-sm">No operator notes for this segment.</p>
        )}
      </div>

      <div className="panel p-4">
        <p className="eyebrow">Up next</p>
        <h3 className="text-paper-dim mt-1 text-base leading-tight font-semibold">
          {upcoming?.title ?? "End of the day"}
        </h3>
        {upcoming?.operatorNotes ? (
          <p className="text-paper-mute mt-2 text-sm leading-relaxed whitespace-pre-line">
            {upcoming.operatorNotes}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function SegmentRow({
  segment,
  index,
  total,
  projectedStart,
  isActive,
  isPast,
  onPatch,
  onJump,
  onDelete,
  onMove,
}: {
  segment: Segment;
  index: number;
  total: number;
  projectedStart: string;
  isActive: boolean;
  isPast: boolean;
  onPatch: (patch: SegmentPatch) => Promise<void>;
  onJump: () => Promise<void>;
  onDelete: () => Promise<void>;
  onMove: (direction: -1 | 1) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmJump, setConfirmJump] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const startMismatch = projectedStart !== segment.plannedStart;

  return (
    <li
      className={cx(
        "panel p-3",
        isActive && "border-signal/60",
        isPast && "opacity-55",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="tabular text-paper-faint w-6 shrink-0 font-mono text-xs">
          {index + 1}
        </span>

        <div className="flex shrink-0 flex-col">
          <span className="tabular text-paper font-mono text-sm font-semibold">
            {segment.plannedStart || "—"}
          </span>
          {startMismatch ? (
            <button
              type="button"
              className="text-signal font-mono text-[0.625rem] tracking-[0.06em] underline"
              title="Rewrite the stored start time to the projected one"
              onClick={() => void onPatch({ plannedStart: projectedStart })}
            >
              → {projectedStart}
            </button>
          ) : null}
        </div>

        {/* Widths live on the wrappers, not on the controls: `.field` sets
            width:100% from an unlayered rule, which beats a Tailwind width
            utility on the element itself. */}
        <div className="min-w-0 flex-1">
          <input
            className="field px-2 py-1 text-sm"
            defaultValue={segment.title}
            aria-label={`Title of segment ${index + 1}`}
            onBlur={(event) => {
              if (event.target.value !== segment.title) {
                void onPatch({ title: event.target.value });
              }
            }}
          />
        </div>

        <label className="flex shrink-0 items-center gap-1.5">
          <span className="w-14">
            <input
              className="field tabular px-2 py-1 text-sm"
              type="number"
              min={1}
              defaultValue={segment.plannedMinutes}
              aria-label={`Planned minutes for ${segment.title}`}
              onBlur={(event) => {
                const minutes = Math.max(1, Number(event.target.value) || 1);
                if (minutes !== segment.plannedMinutes) {
                  void onPatch({ plannedMinutes: minutes });
                }
              }}
            />
          </span>
          <span className="text-paper-faint font-mono text-[0.625rem] uppercase">min</span>
        </label>

        <div className="w-32 shrink-0">
          <select
            className="field px-2 py-1 text-sm"
            value={segment.displayMode}
            aria-label={`Display mode for ${segment.title}`}
            onChange={(event) =>
              void onPatch({ displayMode: event.target.value as Segment["displayMode"] })
            }
          >
            {SEGMENT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="btn btn-ghost px-2 py-1 text-xs"
            disabled={index === 0}
            onClick={() => void onMove(-1)}
            aria-label={`Move ${segment.title} earlier`}
          >
            ↑
          </button>
          <button
            type="button"
            className="btn btn-ghost px-2 py-1 text-xs"
            disabled={index === total - 1}
            onClick={() => void onMove(1)}
            aria-label={`Move ${segment.title} later`}
          >
            ↓
          </button>
          <button
            type="button"
            className="btn btn-ghost px-2 py-1 text-xs"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            {expanded ? "−" : "+"}
          </button>
        </div>

        {isActive ? (
          <span className="bg-signal text-ink-900 shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-[0.5625rem] font-bold tracking-[0.12em] uppercase">
            On screen
          </span>
        ) : confirmJump ? (
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="text-paper-mute text-xs">Jump here?</span>
            <button
              type="button"
              className="btn btn-ghost px-2 py-1 text-xs"
              onClick={() => setConfirmJump(false)}
            >
              No
            </button>
            <button
              type="button"
              className="btn btn-primary px-2 py-1 text-xs"
              onClick={() => {
                setConfirmJump(false);
                void onJump();
              }}
            >
              Yes
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="btn btn-ghost shrink-0 px-2 py-1 text-xs"
            onClick={() => setConfirmJump(true)}
            title="Make this the live segment and switch the big screen"
          >
            Jump to
          </button>
        )}
      </div>

      {expanded ? (
        <div className="border-ink-500 mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Description — projected on the title card</span>
            <textarea
              className="field"
              rows={2}
              defaultValue={segment.description ?? ""}
              onBlur={(event) => {
                if (event.target.value !== (segment.description ?? "")) {
                  void onPatch({ description: event.target.value });
                }
              }}
            />
          </label>

          <label className="block">
            <span className="label">Speakers — one per line, projected</span>
            <textarea
              className="field"
              rows={2}
              defaultValue={(segment.speakers ?? []).join("\n")}
              onBlur={(event) => {
                const speakers = event.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean);
                if (speakers.join("\n") !== (segment.speakers ?? []).join("\n")) {
                  void onPatch({ speakers });
                }
              }}
            />
          </label>

          <label className="block">
            <span className="label">Owner — operator view only</span>
            <input
              className="field"
              defaultValue={segment.owner ?? ""}
              onBlur={(event) => {
                if (event.target.value !== (segment.owner ?? "")) {
                  void onPatch({ owner: event.target.value });
                }
              }}
            />
          </label>

          <label className="block">
            <span className="label">Operator notes — never projected</span>
            <textarea
              className="field"
              rows={3}
              defaultValue={segment.operatorNotes ?? ""}
              onBlur={(event) => {
                if (event.target.value !== (segment.operatorNotes ?? "")) {
                  void onPatch({ operatorNotes: event.target.value });
                }
              }}
            />
          </label>

          <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
            <label className="text-paper-mute flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={segment.presentationTimer ?? false}
                onChange={(event) =>
                  void onPatch({ presentationTimer: event.target.checked })
                }
              />
              Hard-timed presentations
            </label>

            {segment.presentationTimer ? (
              <>
                <label className="text-paper-mute flex items-center gap-1.5 text-xs">
                  <span className="w-16">
                    <input
                      className="field tabular px-2 py-1 text-sm"
                      type="number"
                      min={15}
                      defaultValue={segment.presentationSeconds ?? 150}
                      onBlur={(event) =>
                        void onPatch({
                          presentationSeconds: Math.max(
                            15,
                            Number(event.target.value) || 150,
                          ),
                        })
                      }
                    />
                  </span>
                  seconds each
                </label>
                <label className="text-paper-mute flex items-center gap-1.5 text-xs">
                  <span className="w-16">
                    <input
                      className="field tabular px-2 py-1 text-sm"
                      type="number"
                      min={1}
                      defaultValue={segment.presenterCount ?? 5}
                      onBlur={(event) =>
                        void onPatch({
                          presenterCount: Math.max(1, Number(event.target.value) || 5),
                        })
                      }
                    />
                  </span>
                  presenters
                </label>
              </>
            ) : null}

            {segment.phases && segment.phases.length > 0 ? (
              <span className="text-paper-faint font-mono text-[0.625rem] tracking-[0.1em] uppercase">
                {segment.phases.length} phases ·{" "}
                {segment.phases.reduce((sum, p) => sum + p.minutes, 0)} min
              </span>
            ) : null}

            <div className="ml-auto">
              {confirmDelete ? (
                <span className="flex items-center gap-2">
                  <span className="text-paper-mute text-xs">Delete this segment?</span>
                  <button
                    type="button"
                    className="btn btn-ghost px-2 py-1 text-xs"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary px-2 py-1 text-xs"
                    onClick={() => {
                      setConfirmDelete(false);
                      void onDelete();
                    }}
                  >
                    Delete
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost px-2 py-1 text-xs"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}
