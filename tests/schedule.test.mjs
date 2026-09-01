// Run-of-show timing tests. Every one of these drives a fake clock — the
// module never reads the real one, which is the whole reason the model can be
// trusted to agree across five screens in a room.
import assert from "node:assert/strict";
import test from "node:test";

import {
  activeSegment,
  advance,
  currentPhase,
  describeDrift,
  displayModeFor,
  driftMs,
  driftedStarts,
  elapsedMs,
  emptySchedule,
  extendActive,
  formatRemaining,
  isOverrun,
  nextPresenter,
  nextSegment,
  parseWallClock,
  pause,
  phaseViews,
  presenterRemainingMs,
  projectedStarts,
  remainingMs,
  resetDay,
  resume,
  segmentIndex,
  serverNow,
} from "../src/lib/schedule.ts";
import { createEvent, createRunOfShow } from "../src/lib/seed.ts";
import { fromSnapshot, toSnapshot } from "../src/lib/serialize.ts";

const MIN = 60_000;

/** A fixed instant to hang every test off. Nothing here reads a real clock. */
const T0 = 1_758_600_000_000;

function schedule() {
  return createRunOfShow();
}

/** Advance to `id`, asserting it worked, and return the new schedule. */
function start(state, now, id) {
  const result = advance(state, now, id);
  assert.ok(result, "expected the advance to land on a segment");
  return result.schedule;
}

// --- The segment clock ------------------------------------------------------

test("remaining time counts down from a fixed start against a fake clock", () => {
  // Welcome and Framing: 15 planned minutes.
  const running = start(schedule(), T0, "sg-welcome");

  assert.equal(remainingMs(running, T0), 15 * MIN);
  assert.equal(remainingMs(running, T0 + 5 * MIN), 10 * MIN);
  assert.equal(elapsedMs(running, T0 + 5 * MIN), 5 * MIN);
  assert.equal(formatRemaining(remainingMs(running, T0 + 5 * MIN + 20_000)), "9:40");
  assert.equal(isOverrun(running, T0 + 5 * MIN), false);
});

test("an overrun goes negative rather than clamping at zero", () => {
  const running = start(schedule(), T0, "sg-welcome");
  const over = remainingMs(running, T0 + 18 * MIN + 20_000);

  assert.ok(over < 0, "remaining must go negative");
  assert.equal(over, -(3 * MIN + 20_000));
  assert.equal(isOverrun(running, T0 + 18 * MIN + 20_000), true);
  // Never red alone — the overrun says so in words.
  assert.equal(formatRemaining(over), "+3:20 OVER");
});

test("pause and resume accumulate pausedMs correctly across two pauses", () => {
  let s = start(schedule(), T0, "sg-welcome");

  // Two minutes in, hold for three.
  s = pause(s, T0 + 2 * MIN);
  assert.equal(elapsedMs(s, T0 + 4 * MIN), 2 * MIN, "the clock is frozen while paused");
  assert.equal(remainingMs(s, T0 + 4 * MIN), 13 * MIN);

  s = resume(s, T0 + 5 * MIN);
  assert.equal(s.pausedMs, 3 * MIN);
  assert.equal(elapsedMs(s, T0 + 6 * MIN), 3 * MIN);

  // A second hold, this time for one minute.
  s = pause(s, T0 + 7 * MIN);
  s = resume(s, T0 + 8 * MIN);
  assert.equal(s.pausedMs, 4 * MIN, "both pauses accumulate");
  assert.equal(s.pausedAt, null);

  // 10 minutes of wall clock, 4 of it paused.
  assert.equal(elapsedMs(s, T0 + 10 * MIN), 6 * MIN);
  assert.equal(remainingMs(s, T0 + 10 * MIN), 9 * MIN);
});

test("pausing twice without resuming does not lose the first pause", () => {
  let s = start(schedule(), T0, "sg-welcome");
  s = pause(s, T0 + 2 * MIN);
  const doubled = pause(s, T0 + 4 * MIN);
  assert.equal(doubled.pausedAt, T0 + 2 * MIN, "the second click is ignored");

  // And resuming when nothing is paused is a no-op, not a negative.
  assert.equal(resume(doubled, T0 + 5 * MIN).pausedMs, 3 * MIN);
  assert.equal(resume(start(schedule(), T0, "sg-welcome"), T0 + MIN).pausedMs, 0);
});

// --- Drift ------------------------------------------------------------------

test("drift measures actual elapsed against planned cumulative start", () => {
  // Open the day on time.
  let s = start(schedule(), T0, "sg-welcome");
  assert.equal(describeDrift(driftMs(s, T0)), "on time");

  // Welcome runs 6 minutes over its 15.
  assert.equal(describeDrift(driftMs(s, T0 + 21 * MIN)), "6 min behind");

  // Advancing at that point carries the 6 minutes into the next segment.
  s = start(s, T0 + 21 * MIN, "sg-standing");
  assert.equal(describeDrift(driftMs(s, T0 + 21 * MIN)), "6 min behind");

  // Which the panel then makes back by finishing in 45 of its 55.
  s = start(s, T0 + 66 * MIN, "sg-move");
  assert.equal(describeDrift(driftMs(s, T0 + 66 * MIN)), "4 min ahead");
});

test("drift is zero before the day starts and inside the on-time band", () => {
  const idle = schedule();
  assert.equal(driftMs(idle, T0), 0);
  assert.equal(describeDrift(0), "on time");
  assert.equal(describeDrift(45_000), "on time");
  assert.equal(describeDrift(-45_000), "on time");
  assert.equal(describeDrift(3 * MIN), "3 min behind");
  assert.equal(describeDrift(-3 * MIN), "3 min ahead");
});

test("a pause pushes the day behind, because the room really did spend it", () => {
  let s = start(schedule(), T0, "sg-welcome");
  s = pause(s, T0 + 5 * MIN);
  s = resume(s, T0 + 9 * MIN);

  // 15 minutes of segment time used, but 19 minutes of wall clock gone.
  assert.equal(elapsedMs(s, T0 + 19 * MIN), 15 * MIN);
  assert.equal(remainingMs(s, T0 + 19 * MIN), 0);
  assert.equal(describeDrift(driftMs(s, T0 + 19 * MIN)), "4 min behind");
});


// --- Advancing --------------------------------------------------------------

test("advancing stamps the new start and switches the display mode", () => {
  const result = advance(schedule(), T0);
  assert.ok(result);
  assert.equal(result.segment.id, "sg-welcome", "the first advance opens the day");
  assert.equal(result.displayMode, "card");
  assert.equal(result.schedule.segmentStartedAt, T0);
  assert.equal(result.schedule.dayStartedAt, T0, "the day starts with the first advance");
  assert.equal(result.schedule.pausedMs, 0);
  assert.equal(result.schedule.pausedAt, null);

  // The breakout segment is a "findings" segment but a "board" display mode.
  const breakouts = advance(result.schedule, T0 + MIN, "sg-breakouts");
  assert.equal(breakouts.displayMode, "board");
  assert.equal(breakouts.schedule.segmentStartedAt, T0 + MIN);
  assert.equal(breakouts.schedule.dayStartedAt, T0, "the day start is not restamped");
});

test("advancing clears a pause and the presentation sub-timer", () => {
  let s = start(schedule(), T0, "sg-presentations");
  s = nextPresenter(s, activeSegment(s), T0 + MIN);
  s = pause(s, T0 + 2 * MIN);
  assert.equal(s.presenterIndex, 0);

  const next = advance(s, T0 + 3 * MIN);
  assert.equal(next.schedule.pausedAt, null);
  assert.equal(next.schedule.pausedMs, 0);
  assert.equal(next.schedule.presenterIndex, -1);
  assert.equal(next.schedule.presenterStartedAt, null);
});

test("advancing past the last segment is a no-op, not a crash", () => {
  const s = start(schedule(), T0, "sg-lunch");
  assert.equal(nextSegment(s), null);
  assert.equal(advance(s, T0 + MIN), null, "nowhere to go");

  // And so is advancing an empty agenda, or to an id that does not exist.
  assert.equal(advance(emptySchedule(), T0), null);
  assert.equal(advance(s, T0, "sg-nonexistent"), null);
});

test("the operator can jump out of order, forwards or back", () => {
  let s = start(schedule(), T0, "sg-auction");
  assert.equal(segmentIndex(s), 7);

  s = start(s, T0 + MIN, "sg-move");
  assert.equal(activeSegment(s).id, "sg-move");
  assert.equal(nextSegment(s).id, "sg-breakouts");
});

test("+5 MIN extends the segment rather than rewinding its start", () => {
  const s = start(schedule(), T0, "sg-welcome");
  const extended = extendActive(s, 5);

  assert.equal(extended.segmentStartedAt, T0, "the start stamp is untouched");
  assert.equal(remainingMs(extended, T0 + 15 * MIN), 5 * MIN);
  // Which is the point: the extra time shows up in the drift figure too.
  assert.equal(describeDrift(driftMs(extended, T0 + 18 * MIN)), "on time");
});

test("resetting the day keeps the agenda and drops the clock", () => {
  let s = start(schedule(), T0, "sg-auction");
  s = pause(s, T0 + MIN);
  const reset = resetDay(s);

  assert.equal(reset.segments.length, 12, "the agenda survives");
  assert.equal(reset.activeSegmentId, null);
  assert.equal(reset.segmentStartedAt, null);
  assert.equal(reset.dayStartedAt, null);
  assert.equal(reset.pausedAt, null);
  assert.equal(reset.pausedMs, 0);
  assert.equal(remainingMs(reset, T0 + MIN), 0);
});

// --- Clock skew -------------------------------------------------------------

test("the clock-skew offset is applied consistently across screens", () => {
  const running = start(schedule(), T0, "sg-welcome");

  // Three devices, three wrong clocks, three correct offsets: the projector is
  // 12 seconds fast, the operator's laptop 4 minutes slow, a phone is exact.
  const devices = [
    { local: T0 + 5 * MIN + 12_000, offset: -12_000 },
    { local: T0 + MIN, offset: 4 * MIN },
    { local: T0 + 5 * MIN, offset: 0 },
  ];

  const readings = devices.map((device) =>
    remainingMs(running, serverNow(device.local, device.offset)),
  );

  assert.deepEqual(readings, [10 * MIN, 10 * MIN, 10 * MIN]);
  assert.equal(serverNow(T0, Number.NaN), T0, "a missing offset degrades to no offset");
});

// --- Phases -----------------------------------------------------------------

test("the breakout phase strip tracks the clock and ends on the writing phase", () => {
  const breakout = createRunOfShow().segments.find((s) => s.id === "sg-breakouts");
  assert.equal(breakout.phases.length, 7);
  assert.equal(
    breakout.phases.reduce((sum, p) => sum + p.minutes, 0),
    breakout.plannedMinutes,
    "the phases add up to the segment",
  );

  assert.equal(currentPhase(breakout, 0).phase.title, "Set the frame");
  assert.equal(currentPhase(breakout, 10 * MIN).phase.title, "Status update");

  // Minute 35 is the one that matters: Diagnose opens, and it is the phase
  // that tells the room to stop talking and start typing.
  assert.equal(currentPhase(breakout, 34 * MIN + 59_000).phase.title, "Interrogate");
  const atThirtyFive = currentPhase(breakout, 35 * MIN);
  assert.equal(atThirtyFive.phase.title, "Diagnose");
  assert.match(
    atThirtyFive.phase.note,
    /start typing headlines/,
    "the phase at minute 35 carries the instruction",
  );
  assert.equal(currentPhase(breakout, 55 * MIN).phase.title, "Draft the five findings");

  const views = phaseViews(breakout, 35 * MIN);
  assert.deepEqual(
    views.map((v) => v.state),
    ["past", "past", "past", "current", "upcoming", "upcoming", "upcoming"],
  );
  assert.equal(views[3].remainingMs, 20 * MIN);

  // Overrun: the last phase absorbs it rather than the strip going blank.
  const late = currentPhase(breakout, 90 * MIN);
  assert.equal(late.phase.title, "Presenter and submit");
  assert.ok(late.remainingMs < 0);

  // A segment with no phases has no strip.
  assert.deepEqual(phaseViews({ phases: [] }, 0), []);
  assert.equal(currentPhase(null, 0), null);
});

// --- The presentation sub-timer ---------------------------------------------

test("five presenters are tracked in order and the timer counts past zero", () => {
  let s = start(schedule(), T0, "sg-presentations");
  const segment = activeSegment(s);

  assert.equal(presenterRemainingMs(s, segment, T0), null, "unarmed until clicked");

  s = nextPresenter(s, segment, T0);
  assert.equal(s.presenterIndex, 0);
  assert.equal(presenterRemainingMs(s, segment, T0), 150_000);
  assert.equal(formatRemaining(presenterRemainingMs(s, segment, T0)), "2:30");
  assert.equal(
    formatRemaining(presenterRemainingMs(s, segment, T0 + 170_000)),
    "+0:20 OVER",
  );

  for (let i = 1; i < 5; i++) {
    s = nextPresenter(s, segment, T0 + i * 3 * MIN);
    assert.equal(s.presenterIndex, i);
  }

  // Past the fifth, the overlay clears rather than showing a sixth slot.
  s = nextPresenter(s, segment, T0 + 20 * MIN);
  assert.equal(s.presenterIndex, 5);
  assert.equal(presenterRemainingMs(s, segment, T0 + 20 * MIN), null);
});

// --- Wall clock -------------------------------------------------------------

test("projected starts show what a longer segment does to lunch", () => {
  const segments = createRunOfShow().segments;

  assert.deepEqual(projectedStarts(segments), [
    "8:30",
    "8:45",
    "9:40",
    "9:50",
    "11:05",
    "11:15",
    "11:30",
    "11:35",
    "12:10",
    "12:18",
    "12:28",
    "12:30",
  ]);
  assert.equal(driftedStarts(segments), false, "the seeded agenda is self-consistent");

  // Give the opening panel five more minutes; everything after it moves.
  const stretched = segments.map((s) =>
    s.id === "sg-standing" ? { ...s, plannedMinutes: 60 } : s,
  );
  assert.equal(projectedStarts(stretched).at(-1), "12:35", "lunch slips to 12:35");
  assert.equal(driftedStarts(stretched), true);
});

test("wall-clock parsing rejects nonsense and wraps past midnight", () => {
  assert.equal(parseWallClock("8:30"), 510);
  assert.equal(parseWallClock("08:30"), 510);
  assert.equal(parseWallClock("23:59"), 1439);
  assert.equal(parseWallClock("24:00"), null);
  assert.equal(parseWallClock("8:60"), null);
  assert.equal(parseWallClock("half eight"), null);
  assert.equal(parseWallClock(""), null);

  // A segment with an unparseable start leaves every start alone rather than
  // renumbering the whole agenda from zero.
  assert.deepEqual(
    projectedStarts([{ plannedStart: "soon", plannedMinutes: 10 }]),
    ["soon"],
  );
});

// --- Persistence ------------------------------------------------------------

test("an event with no runOfShow at all still loads", () => {
  const state = createEvent({ demo: true });
  const snapshot = toSnapshot(state);
  delete snapshot.runOfShow;

  const loaded = fromSnapshot(snapshot);
  assert.deepEqual(loaded.runOfShow.segments, [], "an empty agenda, not a crash");
  assert.equal(loaded.runOfShow.activeSegmentId, null);
  assert.equal(loaded.runOfShow.presenterIndex, -1);
  assert.equal(activeSegment(loaded.runOfShow), null);
  assert.equal(nextSegment(loaded.runOfShow), null);
  assert.equal(remainingMs(loaded.runOfShow, T0), 0);
  assert.equal(driftMs(loaded.runOfShow, T0), 0);
  assert.equal(loaded.findings.length, 25, "the rest of the event is untouched");
});

test("the schedule round-trips through RTDB's keyed-object storage", () => {
  let state = createEvent({});
  state.runOfShow = start(state.runOfShow, T0, "sg-breakouts");
  state.runOfShow = pause(state.runOfShow, T0 + 5 * MIN);

  const snapshot = toSnapshot(state);
  assert.ok(!Array.isArray(snapshot.runOfShow.segments), "segments store as a map");
  assert.equal(snapshot.runOfShow.segmentOrder.length, 12);

  const loaded = fromSnapshot(snapshot).runOfShow;
  assert.deepEqual(
    loaded.segments.map((s) => s.id),
    state.runOfShow.segments.map((s) => s.id),
    "order survives",
  );
  assert.equal(loaded.activeSegmentId, "sg-breakouts");
  assert.equal(loaded.segmentStartedAt, T0);
  assert.equal(loaded.pausedAt, T0 + 5 * MIN);
  assert.equal(loaded.segments.find((s) => s.id === "sg-breakouts").phases.length, 7);
  assert.deepEqual(loaded.segments.find((s) => s.id === "sg-standing").speakers, [
    "Jon Larsen",
    "Brian Deese / Charlie Anderson",
    "Mike Catanzaro",
  ]);
});

test("phases and speakers survive RTDB turning an array into a keyed object", () => {
  const state = createEvent({});
  const snapshot = toSnapshot(state);

  // What RTDB actually returns once anything has written to these nodes.
  const breakouts = snapshot.runOfShow.segments["sg-breakouts"];
  breakouts.phases = Object.fromEntries(breakouts.phases.map((p, i) => [String(i), p]));
  const standing = snapshot.runOfShow.segments["sg-standing"];
  standing.speakers = Object.fromEntries(standing.speakers.map((s, i) => [String(i), s]));
  snapshot.runOfShow.segmentOrder = Object.fromEntries(
    snapshot.runOfShow.segmentOrder.map((id, i) => [String(i), id]),
  );

  const loaded = fromSnapshot(snapshot).runOfShow;
  assert.deepEqual(
    loaded.segments.map((s) => s.id),
    state.runOfShow.segments.map((s) => s.id),
    "the order list reads back in order",
  );
  assert.deepEqual(
    loaded.segments.find((s) => s.id === "sg-breakouts").phases.map((p) => p.title),
    createRunOfShow()
      .segments.find((s) => s.id === "sg-breakouts")
      .phases.map((p) => p.title),
  );
  assert.equal(
    loaded.segments.find((s) => s.id === "sg-standing").speakers.length,
    3,
  );
});

test("a segment missing from the order list is still on the agenda", () => {
  const state = createEvent({});
  const snapshot = toSnapshot(state);
  // An interrupted reorder: the map has twelve, the order list names eleven.
  snapshot.runOfShow.segmentOrder = snapshot.runOfShow.segmentOrder.slice(0, 11);

  const loaded = fromSnapshot(snapshot).runOfShow;
  assert.equal(loaded.segments.length, 12, "nothing is dropped");
  assert.equal(loaded.segments.at(-1).id, "sg-lunch");
});

// --- Display modes ----------------------------------------------------------

test("every segment kind maps to a real display mode", () => {
  for (const segment of createRunOfShow().segments) {
    const mode = displayModeFor(segment);
    assert.ok(
      ["board", "auction", "portfolios", "audience", "instructions", "card"].includes(mode),
      `${segment.id} maps to ${mode}`,
    );
  }
});
