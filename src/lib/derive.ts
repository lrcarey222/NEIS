// ---------------------------------------------------------------------------
// Everything the UI needs, computed from the raw EventState.
//
// This module is pure and dependency-free so the same functions run on the
// server (to validate an award before it is written) and in the browser (to
// preview that award live as the operator types). One implementation means the
// warning the operator sees is exactly the rule the server enforces.
//
// It is also the only place that knows about the two framings. Screens ask for
// a card's `category` and the auction's `slots`, never for a finding type or an
// objective, so switching /control → Setup → Session format changes what the
// whole app renders without a single component branching on it.
// ---------------------------------------------------------------------------

import {
  ACCENT_GLYPHS,
  ACCENT_SLOTS,
  FINDING_TYPES,
  FINDING_TYPE_META,
  type AccentSlot,
  type Breakout,
  type EventState,
  type Finding,
  type FindingType,
  type Framing,
  type Objective,
  type Panelist,
  type Transaction,
} from "./types";

/**
 * How a breakout card is labelled on screen: its finding type under the
 * findings framing, the objective it addresses under the objectives framing.
 */
export interface Category {
  /** Finding-type key, or objective id. Comparable with `Slot.id`. */
  key: string;
  label: string;
  /** Compact form, for chips and the slots on a portfolio card. */
  shortName: string;
  glyph: string;
  blurb: string;
  accent: AccentSlot;
}

/** One position in a panelist's team, and therefore one auction round. */
export interface Slot {
  /** Objective id, or finding-type key. Comparable with `Category.key`. */
  id: string;
  name: string;
  shortName: string;
  /** Read aloud by the moderator to open the round. */
  prompt: string;
  accent: AccentSlot;
}

export interface PanelistSlot {
  slot: Slot;
  transaction: Transaction | null;
  finding: Finding | null;
  breakout: Breakout | null;
}

export interface PanelistView {
  panelist: Panelist;
  startingBudget: number;
  spent: number;
  remaining: number;
  /** Slots in round order, one per position on the team, filled or OPEN. */
  slots: PanelistSlot[];
  filledCount: number;
  openCount: number;
  /** Credits that must be held back to afford the remaining slots at minBid. */
  reserveRequired: number;
  /** Most the panelist can bid right now without breaking the reserve rule. */
  maxSafeBid: number;
  /** breakoutId -> number of cards acquired from it. */
  breakoutCounts: Record<string, number>;
}

export interface FindingView {
  finding: Finding;
  breakout: Breakout | null;
  transaction: Transaction | null;
  panelist: Panelist | null;
  /** The team position this card was bought for, once it has been sold. */
  slot: Slot | null;
  category: Category;
  isDrafted: boolean;
  /** Submitted by its breakout and not yet sold. */
  isAvailable: boolean;
}

// --- Lookups ---------------------------------------------------------------

export function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

export function sortedObjectives(state: EventState): Objective[] {
  return [...state.objectives].sort((a, b) => a.roundOrder - b.roundOrder);
}

export function sortedBreakouts(state: EventState): Breakout[] {
  return [...state.breakouts].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function sortedPanelists(state: EventState): Panelist[] {
  return [...state.panelists].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Cards for one breakout, ordered by the breakout's own 1–5 ranking. */
export function findingsForBreakout(
  state: EventState,
  breakoutId: string,
): Finding[] {
  return state.findings
    .filter((f) => f.breakoutId === breakoutId)
    .sort((a, b) => a.breakoutRank - b.breakoutRank || a.createdAt - b.createdAt);
}

/** The live transaction for a card, or null if it is still on the board. */
export function transactionForFinding(
  state: EventState,
  findingId: string,
): Transaction | null {
  return state.transactions.find((t) => t.findingId === findingId) ?? null;
}

// --- Framing ---------------------------------------------------------------

/** Accents cycle, so a sixth objective is coloured rather than left grey. */
function accentAt(index: number): AccentSlot {
  return ACCENT_SLOTS[((index % ACCENT_SLOTS.length) + ACCENT_SLOTS.length) % ACCENT_SLOTS.length];
}

function typeCategory(type: FindingType): Category {
  const meta = FINDING_TYPE_META[type];
  return {
    key: meta.key,
    label: meta.label,
    shortName: meta.short,
    glyph: meta.glyph,
    blurb: meta.blurb,
    accent: meta.accent,
  };
}

function objectiveCategory(objective: Objective, index: number): Category {
  const accent = accentAt(index);
  return {
    key: objective.id,
    label: objective.name,
    shortName: objective.shortName || objective.name,
    glyph: ACCENT_GLYPHS[accent],
    blurb: objective.prompt,
    accent,
  };
}

/**
 * The card a room has written against an objective that has since been renamed
 * away, or a card seeded under the other framing. Named rather than hidden, so
 * the operator can see there is something to fix.
 */
const UNASSIGNED: Category = {
  key: "",
  label: "Unassigned",
  shortName: "Unassigned",
  glyph: "○",
  blurb: "No strategic objective has been chosen for this card yet.",
  accent: "a",
};

/**
 * The roster every breakout room fills — five finding types, or one card per
 * strategic objective. Also what /control seeds blank cards from.
 */
export function breakoutCategories(state: EventState): Category[] {
  if (state.event.breakoutFraming === "objectives") {
    return sortedObjectives(state).map(objectiveCategory);
  }
  return FINDING_TYPES.map(typeCategory);
}

/** How one card is labelled, under whichever framing the breakouts are using. */
export function findingCategory(state: EventState, finding: Finding): Category {
  if (state.event.breakoutFraming === "objectives") {
    const objectives = sortedObjectives(state);
    const index = objectives.findIndex((o) => o.id === finding.objectiveId);
    return index < 0 ? UNASSIGNED : objectiveCategory(objectives[index], index);
  }
  return typeCategory(finding.type);
}

/**
 * The positions on a panelist's team, in round order. One auction round
 * contests one of these.
 */
export function auctionSlots(state: EventState): Slot[] {
  if (state.event.auctionFraming === "findings") {
    return FINDING_TYPES.map((type) => {
      const meta = FINDING_TYPE_META[type];
      return {
        id: meta.key,
        name: meta.label,
        shortName: meta.short,
        prompt: meta.roundPrompt,
        accent: meta.accent,
      };
    });
  }
  return sortedObjectives(state).map((objective, index) => ({
    id: objective.id,
    name: objective.name,
    shortName: objective.shortName || objective.name,
    prompt: objective.prompt,
    accent: accentAt(index),
  }));
}

/**
 * True when cards and team slots are categorised on the same dimension, so
 * "does this card belong in this slot?" is a question with an answer.
 */
export function framingsAlign(state: EventState): boolean {
  return state.event.breakoutFraming === state.event.auctionFraming;
}

/** Which finding type and objective a freshly seeded blank card should carry. */
export function blankCardPlan(
  state: EventState,
): { type: FindingType; objectiveId: string }[] {
  if (state.event.breakoutFraming === "objectives") {
    // The finding type is carried anyway, cycling so the cards are still
    // distinguishable if the operator later flips the auction to finding types.
    return sortedObjectives(state).map((objective, index) => ({
      type: FINDING_TYPES[index % FINDING_TYPES.length],
      objectiveId: objective.id,
    }));
  }
  return FINDING_TYPES.map((type) => ({ type, objectiveId: "" }));
}

// --- Vocabulary ------------------------------------------------------------

/**
 * What the room is asked to call things, given the framing.
 *
 * Screens read this instead of hard-coding "finding" or "objective", so the
 * projected wording matches the exercise actually being run. Deliberately
 * small: only the words that appear in headings and instructions.
 */
export interface Lexicon {
  /** One breakout card: "finding" / "objective". */
  item: string;
  itemPlural: string;
  Item: string;
  ItemPlural: string;
  /** Full form used in headings: "Strategic Finding" / "Strategic Objective". */
  itemFull: string;
  itemFullPlural: string;
  boardTitle: string;
  /** One team position: "objective" / "finding type". */
  slot: string;
  slotPlural: string;
  Slot: string;
  SlotPlural: string;
  /** Reads as "…buying one card for every ___". */
  slotFullPlural: string;
}

function itemWords(framing: Framing) {
  return framing === "objectives"
    ? {
        item: "objective",
        itemPlural: "objectives",
        Item: "Objective",
        ItemPlural: "Objectives",
        itemFull: "Strategic Objective",
        itemFullPlural: "Strategic Objectives",
        boardTitle: "Strategic Objectives Board",
      }
    : {
        item: "finding",
        itemPlural: "findings",
        Item: "Finding",
        ItemPlural: "Findings",
        itemFull: "Strategic Finding",
        itemFullPlural: "Strategic Findings",
        boardTitle: "Strategic Findings Board",
      };
}

export function lexicon(state: EventState): Lexicon {
  const slots =
    state.event.auctionFraming === "findings"
      ? {
          slot: "finding type",
          slotPlural: "finding types",
          Slot: "Finding type",
          SlotPlural: "Finding types",
          slotFullPlural: "finding type",
        }
      : {
          slot: "objective",
          slotPlural: "objectives",
          Slot: "Objective",
          SlotPlural: "Objectives",
          slotFullPlural: "strategic objective",
        };

  return { ...itemWords(state.event.breakoutFraming), ...slots };
}

// --- Views -----------------------------------------------------------------

export function buildFindingView(
  state: EventState,
  finding: Finding,
): FindingView {
  const transaction = transactionForFinding(state, finding.id);
  const breakout = state.breakouts.find((b) => b.id === finding.breakoutId) ?? null;
  const panelist = transaction
    ? (state.panelists.find((p) => p.id === transaction.panelistId) ?? null)
    : null;
  const slot = transaction
    ? (auctionSlots(state).find((s) => s.id === transaction.slotId) ?? null)
    : null;

  return {
    finding,
    breakout,
    transaction,
    panelist,
    slot,
    category: findingCategory(state, finding),
    isDrafted: transaction !== null,
    isAvailable: finding.submitted && transaction === null,
  };
}

export function allFindingViews(state: EventState): FindingView[] {
  return state.findings.map((f) => buildFindingView(state, f));
}

/** Cards that can still be bought: submitted, not yet sold. */
export function availableFindings(state: EventState): FindingView[] {
  return allFindingViews(state).filter((v) => v.isAvailable);
}

export function buildPanelistView(
  state: EventState,
  panelist: Panelist,
): PanelistView {
  const findings = byId(state.findings);
  const breakouts = byId(state.breakouts);
  const mine = state.transactions.filter((t) => t.panelistId === panelist.id);

  const slots: PanelistSlot[] = auctionSlots(state).map((slot) => {
    const transaction = mine.find((t) => t.slotId === slot.id) ?? null;
    const finding = transaction
      ? (findings.get(transaction.findingId) ?? null)
      : null;
    const breakout = finding ? (breakouts.get(finding.breakoutId) ?? null) : null;
    return { slot, transaction, finding, breakout };
  });

  const spent = mine.reduce((sum, t) => sum + t.price, 0);
  const startingBudget = panelist.startingBudget;
  const remaining = startingBudget - spent;

  const filledCount = slots.filter((s) => s.transaction !== null).length;
  const openCount = slots.length - filledCount;

  // After winning the current lot the panelist still owes minBid for each of
  // the other open slots, so that much has to stay in the bank.
  const slotsAfterThisOne = Math.max(0, openCount - 1);
  const reserveRequired = slotsAfterThisOne * state.event.minBid;
  const maxSafeBid = Math.max(0, remaining - reserveRequired);

  const breakoutCounts: Record<string, number> = {};
  for (const slot of slots) {
    if (slot.finding) {
      breakoutCounts[slot.finding.breakoutId] =
        (breakoutCounts[slot.finding.breakoutId] ?? 0) + 1;
    }
  }

  return {
    panelist,
    startingBudget,
    spent,
    remaining,
    slots,
    filledCount,
    openCount,
    reserveRequired,
    maxSafeBid,
    breakoutCounts,
  };
}

export function allPanelistViews(state: EventState): PanelistView[] {
  return sortedPanelists(state).map((p) => buildPanelistView(state, p));
}

// --- Rounds ----------------------------------------------------------------

export function currentSlot(state: EventState): Slot | null {
  const slots = auctionSlots(state);
  const index = state.event.currentRoundIndex;
  if (index < 0 || index >= slots.length) return null;
  return slots[index];
}

// --- Award validation ------------------------------------------------------

export interface AwardInput {
  findingId: string;
  panelistId: string;
  /** Objective id, or finding-type key — see `auctionSlots`. */
  slotId: string;
  price: number;
  /** Set when editing an existing transaction so it excludes itself. */
  excludeTransactionId?: string;
}

export interface ValidationIssue {
  code: string;
  message: string;
}

export interface AwardValidation {
  /** Hard rule violations. The server refuses to write when this is non-empty. */
  errors: ValidationIssue[];
  /** Soft advisories. Shown to the operator; overridable unless configured otherwise. */
  warnings: ValidationIssue[];
  ok: boolean;
}

/**
 * Applies every auction rule to a proposed award.
 *
 * Hard errors (a panelist overspending, double-buying a slot, a card being sold
 * twice) can never be overridden — they would corrupt the scoreboard. The
 * budget-reserve rule is a warning by default, because a moderator may
 * legitimately let a panelist go all-in, and is only promoted to an error when
 * the operator turns on `enforceBudgetReserve`.
 */
export function validateAward(
  state: EventState,
  input: AwardInput,
): AwardValidation {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const finding = state.findings.find((f) => f.id === input.findingId);
  const panelist = state.panelists.find((p) => p.id === input.panelistId);
  const slot = auctionSlots(state).find((s) => s.id === input.slotId);

  if (!finding) errors.push({ code: "no_finding", message: "That card no longer exists." });
  if (!panelist) errors.push({ code: "no_panelist", message: "That panelist no longer exists." });
  if (!slot) errors.push({ code: "no_slot", message: "That auction slot no longer exists." });
  if (!finding || !panelist || !slot) return { errors, warnings, ok: false };

  const others = state.transactions.filter(
    (t) => t.id !== input.excludeTransactionId,
  );

  if (!finding.submitted) {
    warnings.push({
      code: "unsubmitted",
      message: `“${finding.headline}” has not been submitted by its breakout yet.`,
    });
  }

  // When the rooms and the auction are organised on the same dimension, a card
  // landing in a slot it does not belong to is almost always a mis-click. It
  // stays a warning: the moderator is allowed to run a cross-cutting round.
  if (framingsAlign(state)) {
    const category = findingCategory(state, finding);
    if (category.key !== slot.id) {
      warnings.push({
        code: "category_mismatch",
        message: `This is a ${category.label} card being bought for the ${slot.name} slot.`,
      });
    }
  }

  // A card cannot be sold twice.
  const existingSale = others.find((t) => t.findingId === finding.id);
  if (existingSale) {
    const buyer = state.panelists.find((p) => p.id === existingSale.panelistId);
    errors.push({
      code: "already_sold",
      message: `Already acquired by ${buyer?.name ?? "another panelist"} for ${existingSale.price} credits.`,
    });
  }

  // One card per slot, per panelist.
  const slotTaken = others.find(
    (t) => t.panelistId === panelist.id && t.slotId === slot.id,
  );
  if (slotTaken) {
    const held = state.findings.find((f) => f.id === slotTaken.findingId);
    errors.push({
      code: "slot_filled",
      message: `${panelist.name} already filled ${slot.name} with “${held?.headline ?? "another card"}”.`,
    });
  }

  // Price sanity.
  if (!Number.isFinite(input.price) || !Number.isInteger(input.price)) {
    errors.push({ code: "price_integer", message: "Bid must be a whole number of credits." });
  } else if (input.price < state.event.minBid) {
    errors.push({
      code: "below_min",
      message: `Minimum bid is ${state.event.minBid} credit${state.event.minBid === 1 ? "" : "s"}.`,
    });
  }

  // Budget. Recomputed against `others` so editing a transaction refunds the
  // old price before testing the new one.
  const spentByOthers = others
    .filter((t) => t.panelistId === panelist.id)
    .reduce((sum, t) => sum + t.price, 0);
  const remaining = panelist.startingBudget - spentByOthers;

  if (input.price > remaining) {
    errors.push({
      code: "insufficient",
      message: `${panelist.name} has only ${remaining} credit${remaining === 1 ? "" : "s"} left.`,
    });
  } else {
    const filled = others.filter((t) => t.panelistId === panelist.id).length;
    const openAfterThis = Math.max(0, auctionSlots(state).length - filled - 1);
    const reserve = openAfterThis * state.event.minBid;
    const leftAfter = remaining - input.price;

    if (leftAfter < reserve) {
      const issue: ValidationIssue = {
        code: "reserve",
        message:
          `Leaves ${leftAfter} credit${leftAfter === 1 ? "" : "s"} for ${openAfterThis} ` +
          `remaining slot${openAfterThis === 1 ? "" : "s"} — ${reserve} needed to fill them at the minimum bid.`,
      };
      if (state.event.enforceBudgetReserve) errors.push(issue);
      else warnings.push(issue);
    }
  }

  return { errors, warnings, ok: errors.length === 0 };
}

// --- Summary statistics ----------------------------------------------------

export interface EventSummary {
  totalFindings: number;
  submittedFindings: number;
  draftedFindings: number;
  totalSpent: number;
  totalBudget: number;
  averagePrice: number;
  highestValued: FindingView[];
  breakoutRepresentation: { breakout: Breakout; count: number; spend: number }[];
  undrafted: FindingView[];
  /** Only meaningful once every slot is filled; see `declareWinner`. */
  leaders: PanelistView[];
}

export function buildSummary(state: EventState): EventSummary {
  const views = allFindingViews(state);
  const drafted = views.filter((v) => v.isDrafted);
  const submitted = views.filter((v) => v.finding.submitted);

  const totalSpent = state.transactions.reduce((sum, t) => sum + t.price, 0);
  const totalBudget = state.panelists.reduce((s, p) => s + p.startingBudget, 0);

  const highestValued = [...drafted].sort(
    (a, b) => (b.transaction?.price ?? 0) - (a.transaction?.price ?? 0),
  );

  const breakoutRepresentation = sortedBreakouts(state)
    .map((breakout) => {
      const owned = drafted.filter((v) => v.finding.breakoutId === breakout.id);
      return {
        breakout,
        count: owned.length,
        spend: owned.reduce((sum, v) => sum + (v.transaction?.price ?? 0), 0),
      };
    })
    .sort((a, b) => b.count - a.count || b.spend - a.spend);

  // "Notable" undrafted cards surface the breakouts' own top picks first.
  const undrafted = submitted
    .filter((v) => !v.isDrafted)
    .sort(
      (a, b) =>
        a.finding.breakoutRank - b.finding.breakoutRank ||
        (a.breakout?.sortOrder ?? 0) - (b.breakout?.sortOrder ?? 0),
    );

  // Ranked by slots filled, then by credits held in reserve. Deliberately not
  // surfaced unless the operator opts in — this is a policy exercise, not a game.
  const leaders = allPanelistViews(state).sort(
    (a, b) => b.filledCount - a.filledCount || b.remaining - a.remaining,
  );

  return {
    totalFindings: views.length,
    submittedFindings: submitted.length,
    draftedFindings: drafted.length,
    totalSpent,
    totalBudget,
    averagePrice: drafted.length ? totalSpent / drafted.length : 0,
    highestValued,
    breakoutRepresentation,
    undrafted,
    leaders,
  };
}
