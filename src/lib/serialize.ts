import { createEvent } from "./seed";
import {
  type Breakout,
  type EventState,
  type Finding,
  type Objective,
  type Panelist,
  SCHEMA_VERSION,
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

function normaliseFinding(finding: Partial<Finding>, id: string): Finding {
  return {
    id: finding.id ?? id,
    breakoutId: finding.breakoutId ?? "",
    type: finding.type ?? "momentum",
    objectiveId: finding.objectiveId ?? "",
    headline: finding.headline ?? "",
    whatChanged: finding.whatChanged ?? "",
    evidence: finding.evidence ?? "",
    risks: finding.risks ?? "",
    opportunities: finding.opportunities ?? "",
    whyItMatters: finding.whyItMatters ?? "",
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
 * Builds a complete EventState from whatever the database returned.
 *
 * Returns null for a genuinely absent event so callers can offer to create one,
 * but tolerates a partially-written event — during the breakout session the
 * findings node exists long before anyone has touched panelists or objectives.
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
      currentRoundIndex: event.currentRoundIndex ?? -1,
      displayMode: event.displayMode ?? "board",
      status: event.status ?? "setup",
      // Absent on an event created before the framings existed; those events
      // were all findings-into-objectives, which is exactly this default pair.
      breakoutFraming: event.breakoutFraming ?? "findings",
      auctionFraming: event.auctionFraming ?? "objectives",
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
      startingBudget: p.startingBudget ?? 100,
      sortOrder: p.sortOrder ?? 0,
    })),
    objectives: toArray<Objective>(data.objectives).map((o) => ({
      ...o,
      shortName: o.shortName ?? o.name,
      prompt: o.prompt ?? "",
      roundOrder: o.roundOrder ?? 0,
    })),
    transactions: toArray<Transaction & { objectiveId?: string }>(
      data.transactions,
    ).map((t) => ({
      id: t.id,
      findingId: t.findingId ?? "",
      panelistId: t.panelistId ?? "",
      // Schema 1 called this `objectiveId`, because the only kind of slot was a
      // strategic objective. Read the old name — and drop it from the result,
      // so the next write does not carry a dead field forward — and a
      // pre-framing ledger still loads with its buyers and prices intact.
      slotId: t.slotId ?? t.objectiveId ?? "",
      price: t.price ?? 0,
      timestamp: t.timestamp ?? 0,
      note: t.note ?? "",
    })),
    timer: { ...DEFAULT_TIMER, ...((data.timer as Partial<TimerState>) ?? {}) },
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
    objectives: toMap(state.objectives),
    transactions: toMap(state.transactions),
    timer: state.timer,
    revision: state.revision,
  });
}
