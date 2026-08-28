// ---------------------------------------------------------------------------
// Domain model for the NEIS Strategic Findings Auction.
//
// Two rules govern this file.
//
// 1. The transaction log is the single source of truth for the auction. A
//    Finding never stores who bought it or for how much — that is derived from
//    `transactions` (see lib/derive.ts). Undo is therefore just "drop the last
//    transaction", which cannot leave the app in a half-updated state in front
//    of a room full of people.
//
// 2. The exercise has two independent axes, both chosen in /control → Setup and
//    both called a *framing* (see `Framing`): what a breakout room writes, and
//    what a panelist's team is made of. Nothing below hard-codes either one —
//    a breakout card carries both a finding type and an objective, and a
//    transaction fills an opaque `slotId`. lib/derive.ts turns the pair into
//    the categories and slots every screen actually renders.
// ---------------------------------------------------------------------------

export const FINDING_TYPES = [
  "momentum",
  "fragility",
  "bottleneck",
  "opportunity",
  "wildcard",
] as const;
export type FindingType = (typeof FINDING_TYPES)[number];

export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const SUBMISSION_STATUSES = [
  "not_started",
  "drafting",
  "submitted",
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/**
 * Which dimension a part of the exercise is organised around.
 *
 * `findings`   — the five Strategic Finding types (Momentum, Fragility, …).
 * `objectives` — the event's Strategic Objectives (Political Durability, …).
 *
 * Applied to the breakouts it decides what each room writes: five typed
 * findings, or one risks-and-opportunities assessment per objective. Applied to
 * the auction it decides what a panelist's team is made of: one slot per
 * objective, or one slot per finding type. The two are set independently, so a
 * room can write by objective and still be auctioned by finding type.
 */
export const FRAMINGS = ["findings", "objectives"] as const;
export type Framing = (typeof FRAMINGS)[number];

/**
 * The five accent colours, addressed by slot rather than by name.
 *
 * Finding types map to a fixed slot; objectives take one by round order. That
 * indirection is the whole reason the board can be coloured consistently
 * without knowing which framing is in play. See `[data-accent]` in globals.css.
 */
export const ACCENT_SLOTS = ["a", "b", "c", "d", "e"] as const;
export type AccentSlot = (typeof ACCENT_SLOTS)[number];

/** Text glyphs paired with each accent, so colour is never the only signal. */
export const ACCENT_GLYPHS: Record<AccentSlot, string> = {
  a: "▲",
  b: "▼",
  c: "◆",
  d: "◇",
  e: "✳",
};

export const DISPLAY_MODES = [
  "board",
  "auction",
  "portfolios",
  /** The pre-session briefing: how to join, what to write, what happens next. */
  "instructions",
] as const;
export type DisplayMode = (typeof DISPLAY_MODES)[number];

export const EVENT_STATUSES = [
  "setup",
  "breakouts",
  "auction",
  "complete",
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export interface TimerState {
  /** Epoch ms at which the timer expires. Null when the timer has never run. */
  endsAt: number | null;
  /** Milliseconds left, captured at the moment the timer was paused. */
  pausedRemainingMs: number | null;
  running: boolean;
  label: string;
  /** When false, /display hides the timer entirely. */
  visible: boolean;
}

export interface EventConfig {
  id: string;
  title: string;
  subtitle: string;
  startingBudget: number;
  minBid: number;
  /** Index into the auction round order. -1 means "auction not started". */
  currentRoundIndex: number;
  displayMode: DisplayMode;
  status: EventStatus;
  /**
   * What each breakout room produces.
   *
   * `findings`   — five cards, one per finding type, each with what changed
   *                and its evidence.
   * `objectives` — one card per strategic objective, each with the risks and
   *                the opportunities the room sees against it.
   */
  breakoutFraming: Framing;
  /**
   * What a panelist's team is made of, and therefore what one auction round
   * contests: `objectives` gives a slot per strategic objective, `findings`
   * gives a slot per finding type.
   */
  auctionFraming: Framing;
  /** Show a "leader" callout on the Final Portfolios screen. Off by default. */
  declareWinner: boolean;
  /**
   * Within the Final Portfolios mode, flips the big screen between the
   * panelist roster and the three summary cuts. They are two full screens
   * rather than one split screen because four portfolios plus three summary
   * panels cannot both be legible from the back of a room at 16:9.
   */
  showSummary: boolean;
  /** When true, a bid that breaks the reserve rule is blocked, not just flagged. */
  enforceBudgetReserve: boolean;
  /** Marks a seeded rehearsal event so /control can warn before going live. */
  isDemo: boolean;
  createdAt: number;
}

export interface Breakout {
  id: string;
  slug: string;
  name: string;
  /** Compact label for the board columns and portfolio chips. */
  shortName: string;
  description: string;
  sortOrder: number;
  submissionStatus: SubmissionStatus;
  pin: string;
  submittedAt: number | null;
}

/**
 * One card written by a breakout room — the unit that goes to auction.
 *
 * It carries the fields for *both* framings rather than splitting into two
 * record types, because the operator can switch framing during setup and
 * because the auction machinery should never have to care which kind of card
 * it is selling. `type` categorises it under the findings framing;
 * `objectiveId` does so under the objectives framing.
 */
export interface Finding {
  id: string;
  breakoutId: string;
  type: FindingType;
  /**
   * Which strategic objective this card addresses. Set when the breakouts are
   * framed by objective; empty string otherwise.
   */
  objectiveId: string;
  headline: string;
  /** Findings framing: what moved over the last 18 months. */
  whatChanged: string;
  /** Findings framing: supporting points, one per line. */
  evidence: string;
  /** Objectives framing: what threatens this objective, one per line. */
  risks: string;
  /** Objectives framing: what could accelerate it, one per line. */
  opportunities: string;
  whyItMatters: string;
  confidence: Confidence;
  /** The breakout's own 1–5 priority ordering across its cards. */
  breakoutRank: number;
  /** Optional minority/dissenting view recorded alongside the card. */
  dissent: string;
  submitted: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Panelist {
  id: string;
  name: string;
  affiliation: string;
  startingBudget: number;
  sortOrder: number;
}

export interface Objective {
  id: string;
  name: string;
  shortName: string;
  /** The question the moderator reads aloud to open the round. */
  prompt: string;
  roundOrder: number;
}

export interface Transaction {
  id: string;
  findingId: string;
  panelistId: string;
  /**
   * The slot in the buyer's team that this award fills. An objective id when
   * the auction is framed by objective, a `FindingType` key when it is framed
   * by finding type. Resolved through `auctionSlots()` in lib/derive.ts.
   */
  slotId: string;
  price: number;
  timestamp: number;
  /** Free-text operator note, e.g. "corrected from 18". */
  note: string;
}

/** The entire persisted event. This object is what gets written to disk. */
export interface EventState {
  /** Bumped whenever the on-disk shape changes, so old files can be migrated. */
  schemaVersion: number;
  event: EventConfig;
  breakouts: Breakout[];
  findings: Finding[];
  panelists: Panelist[];
  objectives: Objective[];
  transactions: Transaction[];
  timer: TimerState;
  /** Monotonic counter; every mutation increments it. Clients use it to
   *  discard out-of-order snapshots that arrive over a flaky connection. */
  revision: number;
}

/**
 * 2 added the two framings, the risks/opportunities fields, and renamed
 * `Transaction.objectiveId` to the framing-neutral `slotId`. lib/serialize.ts
 * reads the old name so a version 1 event still loads.
 */
export const SCHEMA_VERSION = 2;

/**
 * Who the current browser is acting as. Declared here rather than in lib/auth
 * so client components can import the type without pulling the server-only
 * crypto and cookie machinery into the browser bundle.
 */
export type Role = { kind: "admin" } | { kind: "breakout"; slug: string } | null;

// --- Presentation metadata -------------------------------------------------

export interface FindingTypeMeta {
  key: FindingType;
  label: string;
  /** Compact form for chips and portfolio slots. */
  short: string;
  /** Text glyph so the categories never depend on colour alone. */
  glyph: string;
  blurb: string;
  /** Which accent slot this type paints with. */
  accent: AccentSlot;
  /** Read aloud to open the round when the auction is framed by finding type. */
  roundPrompt: string;
}

export const FINDING_TYPE_META: Record<FindingType, FindingTypeMeta> = {
  momentum: {
    key: "momentum",
    label: "Momentum",
    short: "Momentum",
    glyph: "▲",
    blurb: "Strongest evidence of real progress",
    accent: "a",
    roundPrompt:
      "Which finding from anywhere on the board is the strongest evidence of real progress?",
  },
  fragility: {
    key: "fragility",
    label: "Fragility",
    short: "Fragility",
    glyph: "▼",
    blurb: "Most serious vulnerability",
    accent: "b",
    roundPrompt:
      "Which finding describes the most serious vulnerability in the current position?",
  },
  bottleneck: {
    key: "bottleneck",
    label: "Bottleneck",
    short: "Bottleneck",
    glyph: "◆",
    blurb: "Most binding constraint",
    accent: "c",
    roundPrompt: "Which finding identifies the most binding constraint on progress?",
  },
  opportunity: {
    key: "opportunity",
    label: "Underappreciated Opportunity",
    short: "Opportunity",
    glyph: "◇",
    blurb: "Important upside receiving too little attention",
    accent: "d",
    roundPrompt:
      "Which finding names the most important upside currently receiving too little attention?",
  },
  wildcard: {
    key: "wildcard",
    label: "Wildcard",
    short: "Wildcard",
    glyph: "✳",
    blurb: "Uncertainty that could materially change the outlook",
    accent: "e",
    roundPrompt:
      "Which finding is the uncertainty most likely to change the outlook materially?",
  },
};

export const CONFIDENCE_META: Record<
  Confidence,
  { label: string; short: string; bars: string }
> = {
  high: { label: "High confidence", short: "HIGH", bars: "▮▮▮" },
  medium: { label: "Medium confidence", short: "MED", bars: "▮▮▯" },
  low: { label: "Low confidence", short: "LOW", bars: "▮▯▯" },
};
