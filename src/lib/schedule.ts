// ---------------------------------------------------------------------------
// The run of show: the agenda, the clock, and how far behind the day is.
//
// Pure, like derive.ts, and for the same reason — the operator's bar, the
// projector, the breakout phase strip and the public agenda page all have to
// agree to the second, so there is exactly one implementation of "how long is
// left" and every screen runs it.
//
// Three rules shape this file.
//
// 1. `now` is always a parameter. Nothing in here reads the clock, which is
//    what makes the whole model testable with a fake one and what lets callers
//    hand in a *server*-corrected time rather than whatever the projector's
//    laptop believes (see `serverNow`).
//
// 2. Nothing writes on a tick. The database holds a start stamp; every screen
//    subtracts locally. A room with eight screens open generates zero writes a
//    second, which is the only reason this is safe to leave running all day.
//
// 3. Segments run over, and that is allowed. Remaining time goes negative and
//    is reported as an overrun rather than clamped at zero, and a segment is
//    NEVER advanced automatically — advancing moves the projector in front of
//    the room, so it is always the operator's click.
// ---------------------------------------------------------------------------

import {
  DISPLAY_MODE_FOR_SEGMENT,
  type DisplayMode,
  type Phase,
  type ScheduleState,
  type Segment,
} from "./types";

const MINUTE = 60_000;

/** Seconds a breakout presenter gets when the segment does not say otherwise. */
export const DEFAULT_PRESENTATION_SECONDS = 150;

/** Under this much drift in either direction, the day is "on time". */
const ON_TIME_TOLERANCE_MS = 60_000;

// --- Clock skew ------------------------------------------------------------

/**
 * The projector's clock and the operator's laptop will not agree to the
 * second, and a countdown that differs between the two screens in the room is
 * worse than no countdown. Firebase publishes `/.info/serverTimeOffset` — the
 * signed milliseconds to add to this device's clock to land on the server's —
 * so every screen converts to one shared timebase before doing any arithmetic.
 *
 * The local adapter has no server, so its offset is 0 and this is the identity.
 */
export function serverNow(localNow: number, offsetMs: number): number {
  return localNow + (Number.isFinite(offsetMs) ? offsetMs : 0);
}

// --- Empty state -----------------------------------------------------------

export function emptySchedule(): ScheduleState {
  return {
    segments: [],
    activeSegmentId: null,
    segmentStartedAt: null,
    pausedAt: null,
    pausedMs: 0,
    dayStartedAt: null,
    presenterIndex: -1,
    presenterStartedAt: null,
    agendaVisible: true,
  };
}

// --- Lookups ---------------------------------------------------------------

export function segmentIndex(schedule: ScheduleState): number {
  if (!schedule.activeSegmentId) return -1;
  return schedule.segments.findIndex((s) => s.id === schedule.activeSegmentId);
}

export function activeSegment(schedule: ScheduleState): Segment | null {
  const index = segmentIndex(schedule);
  return index < 0 ? null : schedule.segments[index];
}

export function nextSegment(schedule: ScheduleState): Segment | null {
  const index = segmentIndex(schedule);
  // Before the day starts, "next" is the first thing on the agenda.
  if (index < 0) return schedule.segments[0] ?? null;
  return schedule.segments[index + 1] ?? null;
}

export function displayModeFor(segment: Segment): DisplayMode {
  return DISPLAY_MODE_FOR_SEGMENT[segment.displayMode] ?? "card";
}

export function plannedMs(segment: Segment | null): number {
  if (!segment) return 0;
  return Math.max(0, segment.plannedMinutes) * MINUTE;
}

export function totalPlannedMinutes(schedule: ScheduleState): number {
  return schedule.segments.reduce((sum, s) => sum + Math.max(0, s.plannedMinutes), 0);
}

// --- The segment clock -----------------------------------------------------

export function isPaused(schedule: ScheduleState): boolean {
  return schedule.pausedAt !== null;
}

/**
 * Time the active segment has actually consumed, with paused time removed.
 *
 * While paused the clock is frozen at the moment of the pause rather than
 * carrying on invisibly, because the opening panel *will* run over and the
 * operator needs to hold the clock without corrupting the rest of the day.
 */
export function elapsedMs(schedule: ScheduleState, now: number): number {
  if (schedule.segmentStartedAt === null) return 0;
  const stopped = schedule.pausedAt ?? now;
  return Math.max(0, stopped - schedule.segmentStartedAt - schedule.pausedMs);
}

/**
 * Milliseconds left in the active segment. **Negative once it runs over** —
 * deliberately not clamped, because a clock frozen at 0:00 tells the operator
 * nothing and the number they need is how far past they are.
 */
export function remainingMs(schedule: ScheduleState, now: number): number {
  const segment = activeSegment(schedule);
  if (!segment || schedule.segmentStartedAt === null) return 0;
  return plannedMs(segment) - elapsedMs(schedule, now);
}

export function isOverrun(schedule: ScheduleState, now: number): boolean {
  return activeSegment(schedule) !== null && remainingMs(schedule, now) < 0;
}

/** "12:04". Always minutes and seconds, never a bare count. */
export function formatClock(ms: number): string {
  const total = Math.floor(Math.abs(ms) / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * The countdown as the room should read it.
 *
 * An overrun reads "+3:20 OVER" in words, never as a red 3:20 — colour is
 * never the only signal on any screen in this app, and least of all on the one
 * telling the moderator to wrap up.
 */
export function formatRemaining(ms: number): string {
  return ms < 0 ? `+${formatClock(ms)} OVER` : formatClock(ms);
}

// --- Drift -----------------------------------------------------------------

/** Planned minutes of everything before `index`, in milliseconds. */
export function plannedCumulativeMs(schedule: ScheduleState, index: number): number {
  return schedule.segments
    .slice(0, Math.max(0, index))
    .reduce((sum, s) => sum + Math.max(0, s.plannedMinutes), 0) * MINUTE;
}

/**
 * How far behind the printed agenda the day is, in milliseconds. Positive is
 * behind, negative is ahead.
 *
 * This is the single most useful number the operator can have, so it is
 * measured live rather than frozen at the last advance: planned progress is
 * everything before this segment plus this segment's own time *capped at its
 * planned length*, so an overrun pushes the number out minute by minute while
 * finishing early pulls it back at the next advance.
 *
 * Actual progress is wall clock since the day started — pauses included. A
 * pause is real time the room spends, and the day genuinely runs late for it.
 */
export function driftMs(schedule: ScheduleState, now: number): number {
  if (schedule.dayStartedAt === null || schedule.segmentStartedAt === null) return 0;
  const index = segmentIndex(schedule);
  if (index < 0) return 0;

  const dayElapsed = Math.max(0, now - schedule.dayStartedAt);
  const withinSegment = Math.min(
    elapsedMs(schedule, now),
    plannedMs(schedule.segments[index]),
  );
  return dayElapsed - (plannedCumulativeMs(schedule, index) + withinSegment);
}

/** "on time" · "6 min behind" · "4 min ahead". */
export function describeDrift(ms: number): string {
  if (Math.abs(ms) < ON_TIME_TOLERANCE_MS) return "on time";
  const minutes = Math.round(Math.abs(ms) / MINUTE);
  return `${minutes} min ${ms > 0 ? "behind" : "ahead"}`;
}

// --- Operator actions ------------------------------------------------------

export interface AdvanceResult {
  schedule: ScheduleState;
  segment: Segment;
  /** What the projector should switch to. */
  displayMode: DisplayMode;
}

/**
 * Move to the next segment, or to `targetId` to jump out of order.
 *
 * Returns null when there is nowhere to go — an empty agenda, an unknown id,
 * or the end of the day. Advancing past the last segment is a no-op rather
 * than an error: the operator's finger lands on NEXT one more time than the
 * agenda has entries roughly every time, and the last thing anyone needs is a
 * blank projector during the close.
 */
export function advance(
  schedule: ScheduleState,
  now: number,
  targetId?: string,
): AdvanceResult | null {
  const index = targetId
    ? schedule.segments.findIndex((s) => s.id === targetId)
    : segmentIndex(schedule) + 1;

  const segment = index >= 0 ? schedule.segments[index] : undefined;
  if (!segment) return null;

  return {
    segment,
    displayMode: displayModeFor(segment),
    schedule: {
      ...schedule,
      activeSegmentId: segment.id,
      segmentStartedAt: now,
      pausedAt: null,
      pausedMs: 0,
      dayStartedAt: schedule.dayStartedAt ?? now,
      // A new segment always starts with its presentation sub-timer unarmed.
      presenterIndex: -1,
      presenterStartedAt: null,
    },
  };
}

export function pause(schedule: ScheduleState, now: number): ScheduleState {
  if (schedule.segmentStartedAt === null || schedule.pausedAt !== null) return schedule;
  return { ...schedule, pausedAt: now };
}

export function resume(schedule: ScheduleState, now: number): ScheduleState {
  if (schedule.pausedAt === null) return schedule;
  return {
    ...schedule,
    pausedMs: schedule.pausedMs + Math.max(0, now - schedule.pausedAt),
    pausedAt: null,
  };
}

/**
 * Give the active segment more time.
 *
 * Implemented by editing the segment's planned length rather than by rewinding
 * `segmentStartedAt`, so the extra five minutes show up in the drift figure
 * and in the recomputed wall-clock starts — which is the whole point of
 * pressing it.
 */
export function extendActive(schedule: ScheduleState, minutes: number): ScheduleState {
  const index = segmentIndex(schedule);
  if (index < 0) return schedule;
  return {
    ...schedule,
    segments: schedule.segments.map((segment, i) =>
      i === index
        ? { ...segment, plannedMinutes: Math.max(1, segment.plannedMinutes + minutes) }
        : segment,
    ),
  };
}

/** Back to before the day started. Keeps the agenda, drops the clock. */
export function resetDay(schedule: ScheduleState): ScheduleState {
  return {
    ...schedule,
    activeSegmentId: null,
    segmentStartedAt: null,
    pausedAt: null,
    pausedMs: 0,
    dayStartedAt: null,
    presenterIndex: -1,
    presenterStartedAt: null,
  };
}

// --- Phases ----------------------------------------------------------------

export interface PhaseView {
  index: number;
  phase: Phase;
  startMs: number;
  endMs: number;
  /** Negative once this phase has overrun. Only meaningful for the current one. */
  remainingMs: number;
  state: "past" | "current" | "upcoming";
}

/**
 * The segment's internal run of show, positioned against the clock.
 *
 * The last phase absorbs any overrun rather than the strip going blank at the
 * end: a room three minutes past its writing time still needs to be told it is
 * in the writing time.
 */
export function phaseViews(segment: Segment | null, elapsed: number): PhaseView[] {
  const phases = segment?.phases ?? [];
  if (phases.length === 0) return [];

  let cursor = 0;
  const bounds = phases.map((phase, index) => {
    const startMs = cursor;
    cursor += Math.max(0, phase.minutes) * MINUTE;
    return { index, phase, startMs, endMs: cursor };
  });

  const last = bounds.length - 1;
  const currentIndex = bounds.findIndex((b) => elapsed < b.endMs);
  const current = currentIndex < 0 ? last : currentIndex;

  return bounds.map((bound) => ({
    ...bound,
    remainingMs: bound.endMs - elapsed,
    state:
      bound.index === current
        ? ("current" as const)
        : bound.index < current
          ? ("past" as const)
          : ("upcoming" as const),
  }));
}

export function currentPhase(segment: Segment | null, elapsed: number): PhaseView | null {
  return phaseViews(segment, elapsed).find((view) => view.state === "current") ?? null;
}

// --- The presentation sub-timer --------------------------------------------

export function presentationSeconds(segment: Segment | null): number {
  return segment?.presentationSeconds ?? DEFAULT_PRESENTATION_SECONDS;
}

export function presenterCount(segment: Segment | null): number {
  return Math.max(0, segment?.presenterCount ?? 0);
}

export function presentationRunning(schedule: ScheduleState): boolean {
  return schedule.presenterIndex >= 0 && schedule.presenterStartedAt !== null;
}

/**
 * Time left for the presenter currently on their feet. Negative counts up,
 * same as the segment clock — five 2:30 slots only stay hard-timed if going
 * over is visible.
 */
export function presenterRemainingMs(
  schedule: ScheduleState,
  segment: Segment | null,
  now: number,
): number | null {
  if (!presentationRunning(schedule)) return null;
  return presentationSeconds(segment) * 1000 - (now - schedule.presenterStartedAt!);
}

/** Start the next presenter's clock. Stops after the last one. */
export function nextPresenter(
  schedule: ScheduleState,
  segment: Segment | null,
  now: number,
): ScheduleState {
  const total = presenterCount(segment);
  const next = schedule.presenterIndex + 1;
  if (total > 0 && next >= total) {
    // Every presenter has been through. Clear the overlay rather than showing
    // a sixth 2:30 that nobody is speaking to.
    return { ...schedule, presenterIndex: total, presenterStartedAt: null };
  }
  return { ...schedule, presenterIndex: next, presenterStartedAt: now };
}

export function resetPresenters(schedule: ScheduleState): ScheduleState {
  return { ...schedule, presenterIndex: -1, presenterStartedAt: null };
}

// --- Wall clock ------------------------------------------------------------

/** "08:30" → 510. Null for anything unparseable. */
export function parseWallClock(value: string): number | null {
  const match = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(value ?? "");
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** 510 → "8:30". Wraps past midnight rather than printing "25:30". */
export function formatWallClock(minutesSinceMidnight: number): string {
  const total = ((Math.round(minutesSinceMidnight) % 1440) + 1440) % 1440;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Recomputed wall-clock starts, so the operator can see what adding five
 * minutes to the opening panel does to the 12:30 lunch *before* they do it.
 *
 * Every segment after the first is the one before it plus its planned length,
 * anchored to the first segment's own `plannedStart`. Returns one string per
 * segment, in order.
 */
export function projectedStarts(segments: Segment[]): string[] {
  const anchor = parseWallClock(segments[0]?.plannedStart ?? "");
  if (anchor === null) return segments.map((s) => s.plannedStart);

  let cursor = anchor;
  return segments.map((segment) => {
    const label = formatWallClock(cursor);
    cursor += Math.max(0, segment.plannedMinutes);
    return label;
  });
}

/** True where a segment's stored `plannedStart` no longer matches the maths. */
export function driftedStarts(segments: Segment[]): boolean {
  const projected = projectedStarts(segments);
  return segments.some(
    (segment, index) =>
      parseWallClock(segment.plannedStart) !== parseWallClock(projected[index]),
  );
}
