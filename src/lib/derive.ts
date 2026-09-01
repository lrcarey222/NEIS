// ---------------------------------------------------------------------------
// Everything the UI needs, computed from the raw EventState.
//
// This module is pure and dependency-free so the same functions run inside a
// database transaction (to validate an award before it is written) and in the
// browser (to preview that award live as the operator types). One
// implementation means the warning the operator sees is exactly the rule
// enforced.
//
// It also holds the audience arithmetic. Panel prices and audience averages
// are computed side by side here rather than in the closing screen, so the
// number on the projector and the number in the CSV cannot drift apart.
// ---------------------------------------------------------------------------

import { AUCTION_RANK_LIMIT } from "./types";
import type {
  AudienceEntry,
  Breakout,
  EventState,
  Finding,
  Panelist,
  Transaction,
} from "./types";

/** One position in a panelist's team: their Nth pick, filled or open. */
export interface PanelistSlot {
  /** 1-based pick number. */
  index: number;
  transaction: Transaction | null;
  finding: Finding | null;
  breakout: Breakout | null;
}

export interface PanelistView {
  panelist: Panelist;
  startingBudget: number;
  spent: number;
  remaining: number;
  /** `roundCount` slots in acquisition order, padded out with open ones. */
  slots: PanelistSlot[];
  filledCount: number;
  openCount: number;
  /** Credits that must be held back to afford the remaining picks at minBid. */
  reserveRequired: number;
  /** Most the panelist can bid right now without breaking the reserve rule. */
  maxSafeBid: number;
  /** breakoutId -> number of findings acquired from it. */
  breakoutCounts: Record<string, number>;
}

export interface FindingView {
  finding: Finding;
  breakout: Breakout | null;
  transaction: Transaction | null;
  panelist: Panelist | null;
  isDrafted: boolean;
  /** In the auction pool: submitted and ranked in its room's top three. */
  inAuction: boolean;
  /** In the pool and not yet sold. */
  isAvailable: boolean;
}

// --- Lookups ---------------------------------------------------------------

export function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

export function sortedBreakouts(state: EventState): Breakout[] {
  return [...state.breakouts].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function sortedPanelists(state: EventState): Panelist[] {
  return [...state.panelists].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Findings for one breakout, ordered by the breakout's own 1–5 ranking. */
export function findingsForBreakout(
  state: EventState,
  breakoutId: string,
): Finding[] {
  return state.findings
    .filter((f) => f.breakoutId === breakoutId)
    .sort((a, b) => a.breakoutRank - b.breakoutRank || a.createdAt - b.createdAt);
}

/**
 * Is this finding for sale at all?
 *
 * The one place the top-three rule is expressed. Everything that shows a pool —
 * the auction board, the operator's award form, the audience's phone, the
 * closing comparison — asks this rather than filtering on rank itself, so the
 * fifteen findings on the projector are provably the same fifteen the room can
 * back and the same fifteen the operator can award.
 */
export function isAuctionEligible(finding: Finding): boolean {
  return finding.submitted && finding.breakoutRank <= AUCTION_RANK_LIMIT;
}

/** The live transaction for a finding, or null if it is still on the board. */
export function transactionForFinding(
  state: EventState,
  findingId: string,
): Transaction | null {
  return state.transactions.find((t) => t.findingId === findingId) ?? null;
}

/** Everything one panelist has bought, oldest first. */
export function transactionsForPanelist(
  state: EventState,
  panelistId: string,
): Transaction[] {
  return state.transactions
    .filter((t) => t.panelistId === panelistId)
    .sort((a, b) => a.timestamp - b.timestamp);
}

// --- Rounds ----------------------------------------------------------------

/**
 * How many findings each panelist ends up holding.
 *
 * Floored at 1: a zero here would make every bid illegal and leave the
 * operator staring at a form that refuses everything with no obvious cause.
 */
export function roundCount(state: EventState): number {
  return Math.max(1, Math.floor(state.event.roundCount || 1));
}

/** 1-based round numbers, for the pips across the top of the auction screen. */
export function roundNumbers(state: EventState): number[] {
  return Array.from({ length: roundCount(state) }, (_, index) => index + 1);
}

/**
 * True once every panelist holds at least one finding per round played so far,
 * which is what "the round is over" means when there is no fixed bidding order.
 */
export function roundComplete(state: EventState, roundIndex: number): boolean {
  if (roundIndex < 0 || state.panelists.length === 0) return false;
  return state.panelists.every(
    (p) => state.transactions.filter((t) => t.panelistId === p.id).length > roundIndex,
  );
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

  const inAuction = isAuctionEligible(finding);

  return {
    finding,
    breakout,
    transaction,
    panelist,
    isDrafted: transaction !== null,
    inAuction,
    isAvailable: inAuction && transaction === null,
  };
}

export function allFindingViews(state: EventState): FindingView[] {
  return state.findings.map((f) => buildFindingView(state, f));
}

/**
 * The whole auction pool — each room's top three, sold or not.
 *
 * Ordered by rank and then by room, so the pool reads as three tiers rather
 * than as five blocks of three: the number ones sit together at the top of the
 * board, which is the order the panel is arguing about.
 */
export function auctionFindings(state: EventState): FindingView[] {
  return allFindingViews(state)
    .filter((v) => v.inAuction)
    .sort(
      (a, b) =>
        a.finding.breakoutRank - b.finding.breakoutRank ||
        (a.breakout?.sortOrder ?? 0) - (b.breakout?.sortOrder ?? 0),
    );
}

/** Findings that can still be bought: in the pool, not yet sold. */
export function availableFindings(state: EventState): FindingView[] {
  return auctionFindings(state).filter((v) => v.isAvailable);
}

export function buildPanelistView(
  state: EventState,
  panelist: Panelist,
): PanelistView {
  const findings = byId(state.findings);
  const breakouts = byId(state.breakouts);
  const mine = transactionsForPanelist(state, panelist.id);
  const total = roundCount(state);

  // Picks in the order they were won, then empty positions to fill the team.
  // A panelist who somehow holds more than `roundCount` (the operator lowered
  // it mid-event) keeps every pick rather than having one silently vanish.
  const slots: PanelistSlot[] = Array.from(
    { length: Math.max(total, mine.length) },
    (_, index) => {
      const transaction = mine[index] ?? null;
      const finding = transaction
        ? (findings.get(transaction.findingId) ?? null)
        : null;
      const breakout = finding ? (breakouts.get(finding.breakoutId) ?? null) : null;
      return { index: index + 1, transaction, finding, breakout };
    },
  );

  const spent = mine.reduce((sum, t) => sum + t.price, 0);
  const startingBudget = panelist.startingBudget;
  const remaining = startingBudget - spent;

  const filledCount = mine.length;
  const openCount = Math.max(0, total - filledCount);

  // After winning the current lot the panelist still owes minBid for each of
  // the other open picks, so that much has to stay in the bank.
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

// --- Roles -----------------------------------------------------------------

export interface RoleView {
  name: string;
  prompt: string;
  panelists: Panelist[];
}

/**
 * The distinct roles on the panel, in seat order.
 *
 * This is the list the audience picks from at /play: the room drafts against
 * the same briefs as the stage, which is what makes the closing comparison
 * mean anything. Two panelists sharing a role collapse into one entry, and the
 * first non-empty prompt wins.
 */
export function panelRoles(state: EventState): RoleView[] {
  const roles: RoleView[] = [];
  for (const panelist of sortedPanelists(state)) {
    const name = panelist.role.trim();
    if (!name) continue;
    const existing = roles.find(
      (r) => r.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      existing.panelists.push(panelist);
      if (!existing.prompt) existing.prompt = panelist.rolePrompt.trim();
    } else {
      roles.push({ name, prompt: panelist.rolePrompt.trim(), panelists: [panelist] });
    }
  }
  return roles;
}

// --- Award validation ------------------------------------------------------

export interface AwardInput {
  findingId: string;
  panelistId: string;
  price: number;
  /** Set when editing an existing transaction so it excludes itself. */
  excludeTransactionId?: string;
}

export interface ValidationIssue {
  code: string;
  message: string;
}

export interface AwardValidation {
  /** Hard rule violations. The write is refused when this is non-empty. */
  errors: ValidationIssue[];
  /** Soft advisories. Shown to the operator; overridable unless configured otherwise. */
  warnings: ValidationIssue[];
  ok: boolean;
}

/**
 * Applies every auction rule to a proposed award.
 *
 * Hard errors (a panelist overspending, a full team, a finding being sold
 * twice) can never be overridden — they would corrupt the scoreboard. The
 * budget-reserve rule is a warning by default, because a moderator may
 * legitimately let a panelist go all-in, and is only promoted to an error when
 * the operator turns on `enforceBudgetReserve`.
 *
 * Note what is deliberately *not* a rule: nothing constrains which findings a
 * panelist may combine. Judging that portfolio against their role is the
 * exercise, and the app must not pre-empt it.
 */
export function validateAward(
  state: EventState,
  input: AwardInput,
): AwardValidation {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const finding = state.findings.find((f) => f.id === input.findingId);
  const panelist = state.panelists.find((p) => p.id === input.panelistId);

  if (!finding) errors.push({ code: "no_finding", message: "That finding no longer exists." });
  if (!panelist) errors.push({ code: "no_panelist", message: "That panelist no longer exists." });
  if (!finding || !panelist) return { errors, warnings, ok: false };

  const others = state.transactions.filter(
    (t) => t.id !== input.excludeTransactionId,
  );
  const total = roundCount(state);

  if (!finding.submitted) {
    warnings.push({
      code: "unsubmitted",
      message: `“${finding.headline}” has not been submitted by its breakout yet.`,
    });
  } else if (finding.breakoutRank > AUCTION_RANK_LIMIT) {
    // A warning rather than an error: the moderator can take a bid on a
    // finding the room raised from the floor, and refusing to record what
    // actually happened in front of everyone would be worse than a pool the
    // board did not predict.
    warnings.push({
      code: "outside_pool",
      message:
        `Ranked #${finding.breakoutRank} by its breakout — outside the top ` +
        `${AUCTION_RANK_LIMIT} on the board, so it is not in the auction pool.`,
    });
  }

  // A finding cannot be sold twice.
  const existingSale = others.find((t) => t.findingId === finding.id);
  if (existingSale) {
    const buyer = state.panelists.find((p) => p.id === existingSale.panelistId);
    errors.push({
      code: "already_sold",
      message: `Already acquired by ${buyer?.name ?? "another panelist"} for ${existingSale.price} credits.`,
    });
  }

  // A team holds exactly `roundCount` findings and no more.
  const held = others.filter((t) => t.panelistId === panelist.id).length;
  if (held >= total) {
    errors.push({
      code: "team_full",
      message: `${panelist.name} already holds ${held} of ${total} findings. Undo a pick or add a round first.`,
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
    const openAfterThis = Math.max(0, total - held - 1);
    const reserve = openAfterThis * state.event.minBid;
    const leftAfter = remaining - input.price;

    if (leftAfter < reserve) {
      const issue: ValidationIssue = {
        code: "reserve",
        message:
          `Leaves ${leftAfter} credit${leftAfter === 1 ? "" : "s"} for ${openAfterThis} ` +
          `remaining pick${openAfterThis === 1 ? "" : "s"} — ${reserve} needed to fill them at the minimum bid.`,
      };
      if (state.event.enforceBudgetReserve) errors.push(issue);
      else warnings.push(issue);
    }
  }

  return { errors, warnings, ok: errors.length === 0 };
}

// --- Audience --------------------------------------------------------------

/** Entries that have actually been submitted — the only ones that count. */
export function submittedEntries(state: EventState): AudienceEntry[] {
  return state.audience.filter((entry) => entry.submitted);
}

/** Total credits one audience member has put on the board. */
export function entrySpend(entry: AudienceEntry): number {
  return Object.values(entry.allocations ?? {}).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0,
  );
}

export interface AudienceStat {
  finding: Finding;
  breakout: Breakout | null;
  /** Credits the audience put on this finding, across submitted entries. */
  total: number;
  /** How many people backed it at all. */
  backers: number;
  /**
   * Credits per submitted entry, including the people who gave it nothing.
   * That is the figure comparable to a panel price: both are "what one
   * participant, holding one budget, paid for this finding".
   */
  average: number;
  /** Share of every audience credit allocated, 0–1. */
  share: number;
  /** What the panel actually paid, or null if nobody drafted it. */
  panelPrice: number | null;
  panelist: Panelist | null;
  /** Audience average minus panel price. Positive = the room rated it higher. */
  delta: number;
}

export interface AudienceSummary {
  /** Rows written — people who got as far as entering a name. */
  joined: number;
  /** Rows submitted. The denominator for every average below. */
  submitted: number;
  creditsAllocated: number;
  /** Every finding in the auction pool, most-backed first. */
  stats: AudienceStat[];
  /** Rated well above what the panel paid — including findings left undrafted. */
  overlooked: AudienceStat[];
  /** The panel paid well above what the room would have. */
  contested: AudienceStat[];
  /** Top pick per role, so the closing screen can show how the lenses differed. */
  byRole: { role: string; entries: number; top: AudienceStat[] }[];
}

/**
 * Aggregates the audience against the panel's ledger.
 *
 * Every average divides by the number of *submitted entries*, never by the
 * number of backers: a finding two people loved and 148 ignored should not
 * outrank one the whole room put a little behind.
 */
export function buildAudienceSummary(state: EventState): AudienceSummary {
  const entries = submittedEntries(state);
  const breakouts = byId(state.breakouts);
  const panelists = byId(state.panelists);

  const creditsAllocated = entries.reduce((sum, entry) => sum + entrySpend(entry), 0);

  const statFor = (finding: Finding, pool: AudienceEntry[]): AudienceStat => {
    let total = 0;
    let backers = 0;
    for (const entry of pool) {
      const value = Number(entry.allocations?.[finding.id]) || 0;
      if (value > 0) {
        total += value;
        backers += 1;
      }
    }
    const transaction = transactionForFinding(state, finding.id);
    const average = total / Math.max(1, pool.length);
    return {
      finding,
      breakout: breakouts.get(finding.breakoutId) ?? null,
      total,
      backers,
      average,
      share: creditsAllocated > 0 ? total / creditsAllocated : 0,
      panelPrice: transaction?.price ?? null,
      panelist: transaction ? (panelists.get(transaction.panelistId) ?? null) : null,
      delta: average - (transaction?.price ?? 0),
    };
  };

  // The pool, not everything submitted: the room allocated across the same
  // fifteen the panel bid on, so an average over twenty-five would divide the
  // audience's credits by findings they were never offered.
  const poolFindings = state.findings.filter(isAuctionEligible);
  const stats = poolFindings
    .map((finding) => statFor(finding, entries))
    .sort((a, b) => b.average - a.average || b.backers - a.backers);

  // Only meaningful once somebody has actually played.
  const rated = entries.length > 0 ? stats.filter((s) => s.total > 0) : [];

  const overlooked = [...rated]
    .filter((s) => s.delta > 0)
    .sort((a, b) => b.delta - a.delta);
  const contested = [...stats]
    .filter((s) => s.panelPrice !== null && s.delta < 0)
    .sort((a, b) => a.delta - b.delta);

  const roleNames = [...new Set(entries.map((e) => e.role.trim()).filter(Boolean))];
  const byRole = roleNames
    .map((role) => {
      const pool = entries.filter(
        (e) => e.role.trim().toLowerCase() === role.toLowerCase(),
      );
      const top = poolFindings
        .map((finding) => statFor(finding, pool))
        .filter((s) => s.total > 0)
        .sort((a, b) => b.average - a.average)
        .slice(0, 3);
      return { role, entries: pool.length, top };
    })
    .sort((a, b) => b.entries - a.entries);

  return {
    joined: state.audience.length,
    submitted: entries.length,
    creditsAllocated,
    stats,
    overlooked,
    contested,
    byRole,
  };
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
  /** Only meaningful once every team is full; see `declareWinner`. */
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

  // Findings that went unsold, top ranks first. Only ones that were actually
  // for sale: a rank-four finding was never on the board, so calling it
  // "undrafted" would read as a judgement the panel never made.
  const undrafted = auctionFindings(state).filter((v) => !v.isDrafted);

  // Ranked by picks made, then by credits held in reserve. Deliberately not
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
