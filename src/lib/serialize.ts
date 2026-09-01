import { emptySchedule } from "./schedule";
import { createEvent, LEGACY_ROUND_COUNT } from "./seed";
import {
  type AudienceEntry,
  type Breakout,
  type EventState,
  type Finding,
  type Panelist,
  type Phase,
  SCHEMA_VERSION,
  type ScheduleState,
  type Segment,
  type TimerState,
  type Transaction,
} from "./types";

// ---------------------------------------------------------------------------
// Translation between the app's EventState (arrays, the shape derive.ts and
// every component expect) and the Realtime Database's shape (keyed objects).
//
// RTDB has two habits that will silently corrupt an event if ignored:
//   * it stores arrays as objects keyed "0","1","2"… and drops holes, so an
//     array of records is always written as a map keyed by id instead;
//   * it deletes any key whose value is null and rejects undefined outright,
//     so every read has to re-establish defaults rather than trusting presence.
//
// Everything above this boundary works with plain arrays and never has to know
// either of those things.
// ---------------------------------------------------------------------------

type Keyed<T> = Record<string, T>;

export function toMap<T extends { id: string }>(items: T[]): Keyed<T> {
  const map: Keyed<T> = {};
  for (const item of items) map[item.id] = item;
  return map;
}

/** Accepts RTDB's map form *or* its array form and always returns an array. */
export function toArray<T extends { id: string }>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean) as T[];
  return Object.entries(value as Keyed<T>)
    .filter(([, item]) => item && typeof item === "object")
    .map(([key, item]) => ({ ...item, id: item.id ?? key }));
}

/** RTDB rejects undefined. Strip it rather than letting a write throw mid-event. */
export function stripUndefined<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stripUndefined) as unknown as T;

  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry !== undefined) out[key] = stripUndefined(entry);
  }
  return out as T;
}

const DEFAULT_TIMER: TimerState = {
  endsAt: null,
  pausedRemainingMs: null,
  running: false,
  label: "Breakout working session",
  visible: false,
};

/**
 * Schema 2 → 3: fold `whatChanged` into `whyItMatters`.
 *
 * The field is gone from the form, but a rehearsal event — or the real one,
 * mid-session, if this ships between the breakouts and the auction — has text
 * in it that a room wrote. Appending rather than dropping means the migration
 * cannot lose a sentence.
 *
 * Done on read and not written back, so it has to be idempotent: once the text
 * is present in `whyItMatters` the next load leaves it alone.
 */
function foldWhatChanged(whyItMatters: string, whatChanged: string): string {
  const legacy = whatChanged.trim();
  const why = whyItMatters.trim();
  if (!legacy || why.includes(legacy)) return whyItMatters;
  return why ? `${why}\n\n${legacy}` : legacy;
}

function normaliseFinding(finding: Partial<Finding>, id: string): Finding {
  return {
    id: finding.id ?? id,
    breakoutId: finding.breakoutId ?? "",
    type: finding.type ?? "momentum",
    headline: finding.headline ?? "",
    // Retained verbatim so nothing is deleted from the record, but no screen
    // reads it any more — the text the room wrote reaches them through
    // `whyItMatters` below.
    whatChanged: finding.whatChanged ?? "",
    evidence: finding.evidence ?? "",
    whyItMatters: foldWhatChanged(
      finding.whyItMatters ?? "",
      finding.whatChanged ?? "",
    ),
    confidence: finding.confidence ?? "medium",
    breakoutRank: finding.breakoutRank ?? 1,
    dissent: finding.dissent ?? "",
    submitted: finding.submitted ?? false,
    createdAt: finding.createdAt ?? 0,
    updatedAt: finding.updatedAt ?? 0,
  };
}

function normaliseBreakout(breakout: Partial<Breakout>, id: string): Breakout {
  return {
    id: breakout.id ?? id,
    slug: breakout.slug ?? id,
    name: breakout.name ?? "Breakout",
    shortName: breakout.shortName ?? breakout.name ?? "Breakout",
    description: breakout.description ?? "",
    sortOrder: breakout.sortOrder ?? 0,
    submissionStatus: breakout.submissionStatus ?? "not_started",
    pin: breakout.pin ?? "1234",
    submittedAt: breakout.submittedAt ?? null,
  };
}

/**
 * One audience entry.
 *
 * `allocations` is written by a phone on a conference network, so every value
 * is re-coerced: a stray string or a negative would otherwise propagate
 * straight into the averages on the closing screen.
 */
function normaliseAudience(entry: Partial<AudienceEntry>, id: string): AudienceEntry {
  const raw = (entry.allocations ?? {}) as Record<string, unknown>;
  const allocations: Record<string, number> = {};
  for (const [findingId, value] of Object.entries(raw)) {
    const credits = Math.max(0, Math.floor(Number(value) || 0));
    if (credits > 0) allocations[findingId] = credits;
  }

  return {
    id: entry.id ?? id,
    name: entry.name ?? "",
    affiliation: entry.affiliation ?? "",
    role: entry.role ?? "",
    allocations,
    submitted: entry.submitted ?? false,
    createdAt: entry.createdAt ?? 0,
    updatedAt: entry.updatedAt ?? 0,
  };
}

// --- The run of show -------------------------------------------------------

/**
 * A plain list that came back from RTDB.
 *
 * A segment's `phases` and `speakers` have no ids to key by, so they are
 * stored as real arrays — which RTDB returns as an object keyed "0","1","2"
 * once anything edits them, and as an array otherwise. Both shapes have to
 * read back in order or the breakout's phase strip silently reorders itself
 * mid-session.
 */
function toList<T>(value: unknown): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item) => item != null) as T[];
  if (typeof value !== "object") return [];
  return Object.entries(value as Record<string, T>)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, item]) => item)
    .filter((item) => item != null);
}

function normalisePhase(phase: Partial<Phase>): Phase {
  return {
    title: phase.title ?? "",
    minutes: Number(phase.minutes) || 0,
    ...(phase.note ? { note: phase.note } : {}),
  };
}

function normaliseSegment(segment: Partial<Segment>, id: string): Segment {
  const phases = toList<Partial<Phase>>(segment.phases).map(normalisePhase);
  const speakers = toList<string>(segment.speakers).filter(
    (name) => typeof name === "string" && name.trim().length > 0,
  );

  return {
    id: segment.id ?? id,
    title: segment.title ?? "Segment",
    description: segment.description ?? "",
    speakers,
    owner: segment.owner ?? "",
    operatorNotes: segment.operatorNotes ?? "",
    plannedStart: segment.plannedStart ?? "",
    plannedMinutes: Math.max(0, Number(segment.plannedMinutes) || 0),
    displayMode: segment.displayMode ?? "card",
    phases,
    audienceQr: segment.audienceQr ?? false,
    presentationTimer: segment.presentationTimer ?? false,
    presentationSeconds: Number(segment.presentationSeconds) || 150,
    presenterCount: Math.max(0, Number(segment.presenterCount) || 0),
  };
}

/**
 * The schedule, from whatever the database returned.
 *
 * An event with no `runOfShow` at all — every rehearsal and demo event written
 * before schema 3 — gets an empty one rather than an error. Every screen
 * renders an empty schedule as "no run of show loaded" and carries on, so the
 * only thing an old event loses is the agenda strip.
 */
function normaliseSchedule(raw: unknown): ScheduleState {
  const empty = emptySchedule();
  if (!raw || typeof raw !== "object") return empty;
  const data = raw as Partial<ScheduleState> & { segments?: unknown };

  // Segments carry ids, so they are stored as a keyed map like every other
  // collection — but `sortOrder` would be a second source of truth for
  // something the array already says, so order comes from an explicit list.
  const segments = toArray<Segment>(data.segments).map((s) => normaliseSegment(s, s.id));
  const order = toList<string>((data as { segmentOrder?: unknown }).segmentOrder);
  if (order.length > 0) {
    const byId = new Map(segments.map((s) => [s.id, s]));
    const ordered = order.map((id) => byId.get(id)).filter(Boolean) as Segment[];
    // Anything not named in the order list still has to appear, or an
    // interrupted reorder would drop a segment off the agenda entirely.
    for (const segment of segments) {
      if (!order.includes(segment.id)) ordered.push(segment);
    }
    segments.splice(0, segments.length, ...ordered);
  }

  return {
    segments,
    activeSegmentId: data.activeSegmentId ?? null,
    segmentStartedAt: data.segmentStartedAt ?? null,
    pausedAt: data.pausedAt ?? null,
    pausedMs: Number(data.pausedMs) || 0,
    dayStartedAt: data.dayStartedAt ?? null,
    presenterIndex: Number.isFinite(data.presenterIndex)
      ? Number(data.presenterIndex)
      : -1,
    presenterStartedAt: data.presenterStartedAt ?? null,
    agendaVisible: data.agendaVisible ?? true,
  };
}

/**
 * Builds a complete EventState from whatever the database returned.
 *
 * Returns null for a genuinely absent event so callers can offer to create one,
 * but tolerates a partially-written event — during the breakout session the
 * findings node exists long before anyone has touched panelists, and the
 * audience node does not exist at all until the first phone joins.
 */
export function fromSnapshot(raw: unknown): EventState | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (!data.event) return null;

  const defaults = createEvent({ demo: false });
  const event = data.event as Partial<EventState["event"]>;

  return {
    schemaVersion: SCHEMA_VERSION,
    event: {
      ...defaults.event,
      ...event,
      // Booleans and numbers that RTDB drops when false/0/null must come back
      // as their defaults, not as undefined.
      minBid: event.minBid ?? 1,
      startingBudget: event.startingBudget ?? 100,
      // Absent on a schema 1 event, which ran five strategic objectives and so
      // gave every panelist five picks. Not the current default — that would
      // shrink a portfolio somebody already drafted.
      roundCount: event.roundCount ?? LEGACY_ROUND_COUNT,
      currentRoundIndex: event.currentRoundIndex ?? -1,
      displayMode: event.displayMode ?? "board",
      status: event.status ?? "setup",
      audienceOpen: event.audienceOpen ?? false,
      audienceBudget: event.audienceBudget ?? 100,
      declareWinner: event.declareWinner ?? false,
      showSummary: event.showSummary ?? false,
      enforceBudgetReserve: event.enforceBudgetReserve ?? false,
      isDemo: event.isDemo ?? false,
      subtitle: event.subtitle ?? "",
    },
    breakouts: toArray<Breakout>(data.breakouts).map((b) => normaliseBreakout(b, b.id)),
    findings: toArray<Finding>(data.findings).map((f) => normaliseFinding(f, f.id)),
    panelists: toArray<Panelist>(data.panelists).map((p) => ({
      ...p,
      affiliation: p.affiliation ?? "",
      role: p.role ?? "",
      rolePrompt: p.rolePrompt ?? "",
      startingBudget: p.startingBudget ?? 100,
      sortOrder: p.sortOrder ?? 0,
    })),
    // A schema 1 transaction also carried `objectiveId`. There are no
    // objectives any more, so it is read and dropped rather than migrated —
    // the buyer, the price and the order are the whole record now.
    transactions: toArray<Transaction & { objectiveId?: string }>(
      data.transactions,
    ).map((t) => ({
      id: t.id,
      findingId: t.findingId ?? "",
      panelistId: t.panelistId ?? "",
      price: t.price ?? 0,
      timestamp: t.timestamp ?? 0,
      note: t.note ?? "",
    })),
    audience: toArray<AudienceEntry>(data.audience).map((a) =>
      normaliseAudience(a, a.id),
    ),
    timer: { ...DEFAULT_TIMER, ...((data.timer as Partial<TimerState>) ?? {}) },
    runOfShow: normaliseSchedule(data.runOfShow),
    revision: (data.revision as number) ?? 0,
  };
}

/** The full event, in the shape written to the database. */
export function toSnapshot(state: EventState): Record<string, unknown> {
  return stripUndefined({
    event: state.event,
    breakouts: toMap(state.breakouts),
    findings: toMap(state.findings),
    panelists: toMap(state.panelists),
    transactions: toMap(state.transactions),
    audience: toMap(state.audience),
    timer: state.timer,
    runOfShow: {
      ...state.runOfShow,
      // Keyed by id like every other collection, with the order carried
      // alongside — RTDB does not preserve the order of an object's keys.
      segments: toMap(state.runOfShow.segments),
      segmentOrder: state.runOfShow.segments.map((s) => s.id),
    },
    revision: state.revision,
  });
}
