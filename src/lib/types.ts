// ---------------------------------------------------------------------------
// Domain model for the NEIS Strategic Findings Auction.
//
// Three rules govern this file.
//
// 1. The transaction log is the single source of truth for the auction. A
//    Finding never stores who bought it or for how much — that is derived from
//    `transactions` (see lib/derive.ts). Undo is therefore just "drop the last
//    transaction", which cannot leave the app in a half-updated state in front
//    of a room full of people.
//
// 2. A panelist's team is just "up to `roundCount` findings". There is no slot
//    taxonomy: a panelist may buy any finding for any reason, and what makes
//    their picks cohere is their *role* — the lens they were asked to draft
//    against, carried on the panelist itself as a question the big screen
//    shows the room.
//
// 3. The audience plays the same game, one entry per phone. Their allocations
//    live in `audience` and never touch `transactions`, so nothing the room
//    does can corrupt the panel's ledger.
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
  /** Panel picks against what the room would have paid. The closing screen. */
  "audience",
  /** The pre-session briefing: how to join, what to write, what happens next. */
  "instructions",
  /**
   * A title card for the segment currently running: name, description,
   * speakers, clock. This is what fills the opening panel, the transitions and
   * the close — stretches where the projector otherwise had nothing to show.
   */
  "card",
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

// --- The run of show -------------------------------------------------------

/**
 * What the projector switches to when a segment is advanced.
 *
 * Named for what the segment *is* rather than for the display mode it happens
 * to use, which is why "findings" here is "board" there — three different
 * segments (the breakouts, the presentations, the panel questions) all sit on
 * the findings board, and calling them "board" segments would say nothing
 * about the day.
 */
export const SEGMENT_KINDS = [
  "card",
  "instructions",
  "findings",
  "auction",
  "portfolios",
  "audience",
] as const;
export type SegmentKind = (typeof SEGMENT_KINDS)[number];

export const DISPLAY_MODE_FOR_SEGMENT: Record<SegmentKind, DisplayMode> = {
  card: "card",
  instructions: "instructions",
  findings: "board",
  auction: "auction",
  portfolios: "portfolios",
  audience: "audience",
};

/**
 * One step inside a segment — the breakout's internal run of show.
 *
 * This is the mitigation for the biggest risk in the day: a room that talks
 * for seventy minutes and writes for five. The phase strip at minute 35 says
 * "open your cards and start typing", and it is on the facilitator's screen
 * whether or not anyone is watching the clock.
 */
export interface Phase {
  title: string;
  minutes: number;
  note?: string;
}

export interface Segment {
  id: string;
  title: string;
  /** One or two sentences, projected on the title card. */
  description?: string;
  speakers?: string[];
  /** Who is running it. Operator view only — never projected. */
  owner?: string;
  /** Speaker notes for the operator. Never projected. */
  operatorNotes?: string;
  /** Wall clock, "08:30". For the printed agenda and the operator's view. */
  plannedStart: string;
  plannedMinutes: number;
  displayMode: SegmentKind;
  phases?: Phase[];
  /**
   * Puts the play-along QR code on the segment's title card.
   *
   * For the stretches where the room is doing nothing but moving — the
   * transition and seating in particular — the projector's most useful job is
   * getting phones onto /play before the draft starts, rather than after it.
   * Only honoured by the `card` display mode; every other mode carries the
   * code, or deliberately doesn't, on its own terms.
   */
  audienceQr?: boolean;
  /** Runs the hard-timed per-presenter sub-clock. See lib/schedule.ts. */
  presentationTimer?: boolean;
  /** Seconds each presenter gets. Defaults to 150. */
  presentationSeconds?: number;
  /** How many presenters to track, so the operator can see 3 done, 2 left. */
  presenterCount?: number;
}

/**
 * Where the day has got to.
 *
 * Every screen computes remaining time locally from `segmentStartedAt`, which
 * is why this record holds a start stamp and never a countdown: a room with
 * eight screens open must not generate eight writes a second. Nothing in here
 * is written on a timer — only when the operator clicks.
 */
export interface ScheduleState {
  segments: Segment[];
  activeSegmentId: string | null;
  /** Server epoch ms, so every screen agrees. Null before the day starts. */
  segmentStartedAt: number | null;
  /** Server epoch ms the clock was held at, or null when running. */
  pausedAt: number | null;
  /** Paused milliseconds accumulated within the active segment. */
  pausedMs: number;
  /** Stamped by the first advance. Drift is measured against it. */
  dayStartedAt: number | null;
  /** -1 when the presentation sub-timer has not been started. */
  presenterIndex: number;
  presenterStartedAt: number | null;
  /** The thin agenda band along the bottom of /display. */
  agendaVisible: boolean;
}

export interface EventConfig {
  id: string;
  title: string;
  subtitle: string;
  startingBudget: number;
  minBid: number;
  /**
   * How many findings each panelist ends up holding, and therefore how many
   * rounds the auction runs. Set in /control → Setup.
   */
  roundCount: number;
  /** Index into the rounds. -1 means "auction not started". */
  currentRoundIndex: number;
  displayMode: DisplayMode;
  status: EventStatus;
  /** When true, /play accepts audience entries. Opened by the operator. */
  audienceOpen: boolean;
  /** Credits each audience member has to allocate. */
  audienceBudget: number;
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
  /**
   * Removed from the form in schema 3. A room has thirteen minutes for five
   * findings, and a headline that is a real conclusion already contains what
   * changed — asking for both made every room write the finding twice.
   *
   * Kept on the type, and read on load, only so events written before the
   * change survive: lib/serialize.ts appends any text found here to
   * `whyItMatters` rather than dropping it.
   */
  whatChanged?: string;
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
  /**
   * The lens this panelist drafts through — "Governor", "Utility CEO". Free
   * text, because the panel is whoever turns up.
   */
  role: string;
  /**
   * The question the role is answering, projected beside their portfolio so
   * the room can judge the picks against what the panelist was actually
   * trying to do.
   */
  rolePrompt: string;
  startingBudget: number;
  sortOrder: number;
}

export interface Transaction {
  id: string;
  findingId: string;
  panelistId: string;
  price: number;
  timestamp: number;
  /** Free-text operator note, e.g. "corrected from 18". */
  note: string;
}

/**
 * One audience member playing along from their phone at /play.
 *
 * Written twice in the normal case — once on joining, once on submitting —
 * rather than on every keystroke. A conference network does not need 150
 * people streaming slider updates, and half-finished allocations would skew
 * the averages on the closing screen.
 */
export interface AudienceEntry {
  /** Generated in the browser and kept in localStorage, so a reload resumes. */
  id: string;
  name: string;
  affiliation: string;
  /** Matched by name against the panel's roles where one exists. */
  role: string;
  /** findingId -> credits. Findings with nothing on them are omitted. */
  allocations: Record<string, number>;
  /** Only submitted entries count towards the averages. */
  submitted: boolean;
  createdAt: number;
  updatedAt: number;
}

/** The entire persisted event. This object is what gets written to disk. */
export interface EventState {
  /** Bumped whenever the on-disk shape changes, so old files can be migrated. */
  schemaVersion: number;
  event: EventConfig;
  breakouts: Breakout[];
  findings: Finding[];
  panelists: Panelist[];
  transactions: Transaction[];
  audience: AudienceEntry[];
  timer: TimerState;
  /** The agenda, the clock and where the day has got to. See lib/schedule.ts. */
  runOfShow: ScheduleState;
  /** Monotonic counter; every mutation increments it. Clients use it to
   *  discard out-of-order snapshots that arrive over a flaky connection. */
  revision: number;
}

/**
 * 2 dropped strategic objectives (the auction now runs `roundCount` free
 * picks), gave panelists a role and an action prompt, and added the audience
 * play-along. lib/serialize.ts reads a version 1 event without complaint: its
 * objectives are ignored and its `objectiveId` on a transaction is dropped.
 *
 * 3 dropped the finding's `whatChanged` field and added the run of show. A
 * version 2 event still loads: its `whatChanged` text is appended to
 * `whyItMatters` rather than discarded, and an event with no `runOfShow` gets
 * an empty one, which every screen renders as "no schedule loaded".
 */
export const SCHEMA_VERSION = 3;

/**
 * Soft length targets for the finding form.
 *
 * These are legibility limits before they are time limits: a forty-word
 * headline does not read from the back of a conference room at 16:9, however
 * long the room had to write it. The counters warn and then shout, but never
 * block — nothing stops a facilitator mid-sentence. `maxLength` is roughly
 * double the target and exists only so a pasted paragraph cannot destroy the
 * projected layout.
 */
export const FIELD_LIMITS = {
  headline: { target: 20, amber: 20, red: 28, maxLength: 280 },
  /** Per bullet, not for the whole box. */
  evidenceBullet: { target: 15, amber: 15, red: 22 },
  /** Bullets beyond this are kept but flagged as "won't project". */
  evidenceBullets: 2,
  evidenceMaxLength: 480,
  whyItMatters: { target: 40, amber: 40, red: 55, maxLength: 560 },
  dissentMaxLength: 400,
} as const;

/** Words, the way a reader counts them. */
export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Evidence lines, bullet markers and blank lines stripped. */
export function evidenceLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[•\-*]\s*/, "").trim())
    .filter(Boolean);
}

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

/**
 * The roles the panel is seeded with, and the question each one is answering.
 *
 * Only defaults: both fields are free text in Setup, and typing a role name
 * that matches one of these offers to fill in its prompt. The audience picks
 * from whatever roles the panel actually ends up with, so the room is drafting
 * against the same brief as the stage.
 */
export const DEFAULT_ROLES: { name: string; prompt: string }[] = [
  {
    name: "National Security Advisor",
    prompt:
      "Which findings most reduce exposure to coercion, disruption, or untrusted supply?",
  },
  {
    name: "Treasury Secretary",
    prompt:
      "Which findings most improve productivity, market share, and the ability to compete without indefinite protection?",
  },
  {
    name: "Governor",
    prompt:
      "Which findings most determine whether this agenda delivers visible benefits and survives a change of administration?",
  },
  {
    name: "Utility CEO",
    prompt:
      "Which findings most affect reliable, abundant, predictably priced power for households and strategic industry?",
  },
  {
    name: "National Lab Director",
    prompt:
      "Which findings most affect durable emissions reductions, deployment speed, learning, and technology diffusion?",
  },
];

/** The prompt shipped with a role name, if it is one of the defaults. */
export function defaultPromptForRole(role: string): string | null {
  const match = DEFAULT_ROLES.find(
    (entry) => entry.name.toLowerCase() === role.trim().toLowerCase(),
  );
  return match?.prompt ?? null;
}
