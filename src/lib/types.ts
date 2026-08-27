// ---------------------------------------------------------------------------
// Domain model for the NEIS Strategic Findings Auction.
//
// One rule governs this file: the transaction log is the single source of
// truth for the auction. A Finding never stores who bought it or for how
// much — that is derived from `transactions` (see lib/derive.ts). Undo is
// therefore just "drop the last transaction", which cannot leave the app in a
// half-updated state in front of a room full of people.
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
  /** Index into the objective round order. -1 means "auction not started". */
  currentRoundIndex: number;
  displayMode: DisplayMode;
  status: EventStatus;
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

export interface Finding {
  id: string;
  breakoutId: string;
  type: FindingType;
  headline: string;
  whatChanged: string;
  evidence: string;
  whyItMatters: string;
  confidence: Confidence;
  /** The breakout's own 1–5 priority ordering across its five findings. */
  breakoutRank: number;
  /** Optional minority/dissenting view recorded alongside the finding. */
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
  objectiveId: string;
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

export const SCHEMA_VERSION = 1;

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
  /** Text glyph so the categories never depend on colour alone. */
  glyph: string;
  blurb: string;
  /** CSS custom-property suffix, e.g. --type-momentum. */
  token: string;
}

export const FINDING_TYPE_META: Record<FindingType, FindingTypeMeta> = {
  momentum: {
    key: "momentum",
    label: "Momentum",
    glyph: "▲",
    blurb: "Strongest evidence of real progress",
    token: "momentum",
  },
  fragility: {
    key: "fragility",
    label: "Fragility",
    glyph: "▼",
    blurb: "Most serious vulnerability",
    token: "fragility",
  },
  bottleneck: {
    key: "bottleneck",
    label: "Bottleneck",
    glyph: "◆",
    blurb: "Most binding constraint",
    token: "bottleneck",
  },
  opportunity: {
    key: "opportunity",
    label: "Underappreciated Opportunity",
    glyph: "◇",
    blurb: "Important upside receiving too little attention",
    token: "opportunity",
  },
  wildcard: {
    key: "wildcard",
    label: "Wildcard",
    glyph: "✳",
    blurb: "Uncertainty that could materially change the outlook",
    token: "wildcard",
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
