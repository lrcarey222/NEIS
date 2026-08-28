// Auction rule tests. Run with `npm test` (Node 22.18+ strips the TS types).
import assert from "node:assert/strict";
import test from "node:test";

import {
  allPanelistViews,
  auctionSlots,
  availableFindings,
  blankCardPlan,
  breakoutCategories,
  buildSummary,
  findingCategory,
  lexicon,
  validateAward,
} from "../src/lib/derive.ts";
import { createBlankFindings, createEvent } from "../src/lib/seed.ts";
import { fromSnapshot, toSnapshot } from "../src/lib/serialize.ts";

function demo() {
  return createEvent({ demo: true, startingBudget: 100 });
}

function firstAvailable(state, skip = 0) {
  return availableFindings(state)[skip].finding.id;
}

/**
 * Records an award the way the app does. `slotId` is an objective id under the
 * default framing and a finding-type key when the auction is framed by
 * findings — the rule engine treats both the same way.
 */
function award(state, { findingId, panelistId, slotId, price }) {
  const validation = validateAward(state, { findingId, panelistId, slotId, price });
  assert.equal(
    validation.ok,
    true,
    `expected award to be valid, got: ${validation.errors.map((e) => e.message).join("; ")}`,
  );
  state.transactions.push({
    id: `tx-${state.transactions.length + 1}`,
    findingId,
    panelistId,
    slotId,
    price,
    timestamp: Date.now(),
    note: "",
  });
}

test("demo event seeds 25 submitted findings across 5 breakouts", () => {
  const state = demo();
  assert.equal(state.findings.length, 25);
  assert.equal(state.breakouts.length, 5);
  assert.equal(state.objectives.length, 5);
  assert.equal(availableFindings(state).length, 25);

  for (const breakout of state.breakouts) {
    const mine = state.findings.filter((f) => f.breakoutId === breakout.id);
    assert.equal(mine.length, 5, `${breakout.slug} should have 5 findings`);
    assert.deepEqual(
      [...mine.map((f) => f.type)].sort(),
      ["bottleneck", "fragility", "momentum", "opportunity", "wildcard"],
      `${breakout.slug} should have one finding of each type`,
    );
    assert.deepEqual(
      mine.map((f) => f.breakoutRank).sort(),
      [1, 2, 3, 4, 5],
      `${breakout.slug} ranks should be 1..5`,
    );
  }
});

test("a valid award reduces the buyer's budget and removes the finding from the pool", () => {
  const state = demo();
  const findingId = firstAvailable(state);
  const panelistId = state.panelists[0].id;

  award(state, { findingId, panelistId, slotId: state.objectives[0].id, price: 18 });

  const view = allPanelistViews(state).find((v) => v.panelist.id === panelistId);
  assert.equal(view.spent, 18);
  assert.equal(view.remaining, 82);
  assert.equal(view.filledCount, 1);
  assert.equal(availableFindings(state).length, 24);
  assert.equal(
    availableFindings(state).some((v) => v.finding.id === findingId),
    false,
  );
});

test("a finding cannot be sold twice", () => {
  const state = demo();
  const findingId = firstAvailable(state);

  award(state, {
    findingId,
    panelistId: state.panelists[0].id,
    slotId: state.objectives[0].id,
    price: 10,
  });

  const second = validateAward(state, {
    findingId,
    panelistId: state.panelists[1].id,
    slotId: state.objectives[1].id,
    price: 12,
  });

  assert.equal(second.ok, false);
  assert.ok(second.errors.some((e) => e.code === "already_sold"));
});

test("a panelist cannot buy two findings for the same objective", () => {
  const state = demo();
  const panelistId = state.panelists[0].id;
  const slotId = state.objectives[0].id;

  award(state, { findingId: firstAvailable(state), panelistId, slotId, price: 10 });

  const second = validateAward(state, {
    findingId: firstAvailable(state),
    panelistId,
    slotId,
    price: 5,
  });

  assert.equal(second.ok, false);
  assert.ok(second.errors.some((e) => e.code === "slot_filled"));
});

test("a panelist cannot spend more credits than they hold", () => {
  const state = demo();
  const panelistId = state.panelists[0].id;

  award(state, {
    findingId: firstAvailable(state),
    panelistId,
    slotId: state.objectives[0].id,
    price: 95,
  });

  const overspend = validateAward(state, {
    findingId: firstAvailable(state),
    panelistId,
    slotId: state.objectives[1].id,
    price: 6, // only 5 remain
  });

  assert.equal(overspend.ok, false);
  assert.ok(overspend.errors.some((e) => e.code === "insufficient"));
});

test("bids below the minimum are rejected", () => {
  const state = demo();
  state.event.minBid = 5;

  const tooLow = validateAward(state, {
    findingId: firstAvailable(state),
    panelistId: state.panelists[0].id,
    slotId: state.objectives[0].id,
    price: 4,
  });

  assert.equal(tooLow.ok, false);
  assert.ok(tooLow.errors.some((e) => e.code === "below_min"));
});

test("the budget reserve is a warning by default and an error when enforced", () => {
  const state = demo();
  const panelistId = state.panelists[0].id;

  // 98 of 100 on the first of five objectives leaves 2 credits for 4 slots.
  const input = {
    findingId: firstAvailable(state),
    panelistId,
    slotId: state.objectives[0].id,
    price: 98,
  };

  const lenient = validateAward(state, input);
  assert.equal(lenient.ok, true, "should be allowed by default");
  assert.ok(lenient.warnings.some((w) => w.code === "reserve"));

  state.event.enforceBudgetReserve = true;
  const strict = validateAward(state, input);
  assert.equal(strict.ok, false, "should be blocked when enforcement is on");
  assert.ok(strict.errors.some((e) => e.code === "reserve"));
});

test("maxSafeBid reserves one minimum bid for each remaining slot", () => {
  const state = demo();
  state.event.minBid = 2;

  const view = allPanelistViews(state)[0];
  // 5 open slots; winning this one leaves 4 to fill at 2 credits each.
  assert.equal(view.openCount, 5);
  assert.equal(view.reserveRequired, 8);
  assert.equal(view.maxSafeBid, 92);
});

test("removing a transaction fully restores budget and availability (undo)", () => {
  const state = demo();
  const findingId = firstAvailable(state);
  const panelistId = state.panelists[0].id;

  award(state, { findingId, panelistId, slotId: state.objectives[0].id, price: 42 });
  assert.equal(allPanelistViews(state)[0].remaining, 58);

  state.transactions.pop();

  const view = allPanelistViews(state).find((v) => v.panelist.id === panelistId);
  assert.equal(view.remaining, 100);
  assert.equal(view.spent, 0);
  assert.equal(view.filledCount, 0);
  assert.equal(availableFindings(state).length, 25);
  assert.ok(availableFindings(state).some((v) => v.finding.id === findingId));
});

test("editing a transaction excludes itself from the double-sale and budget checks", () => {
  const state = demo();
  const findingId = firstAvailable(state);
  const panelistId = state.panelists[0].id;

  award(state, { findingId, panelistId, slotId: state.objectives[0].id, price: 90 });
  const txId = state.transactions[0].id;

  // Re-pricing the same sale must not trip "already sold" or "insufficient".
  const repriced = validateAward(state, {
    findingId,
    panelistId,
    slotId: state.objectives[0].id,
    price: 30,
    excludeTransactionId: txId,
  });

  assert.equal(
    repriced.ok,
    true,
    repriced.errors.map((e) => e.message).join("; "),
  );
});

test("a full five-round auction fills every portfolio and summarises correctly", () => {
  const state = demo();
  const prices = [
    [18, 20, 14, 9, 11],
    [22, 12, 25, 8, 7],
    [15, 30, 10, 12, 6],
    [11, 9, 19, 21, 13],
  ];

  auctionSlots(state).forEach((slot, round) => {
    state.panelists.forEach((panelist, seat) => {
      award(state, {
        findingId: firstAvailable(state),
        panelistId: panelist.id,
        slotId: slot.id,
        price: prices[seat][round],
      });
    });
  });

  assert.equal(state.transactions.length, 20);
  assert.equal(availableFindings(state).length, 5);

  for (const view of allPanelistViews(state)) {
    assert.equal(view.filledCount, 5, `${view.panelist.name} should hold 5 findings`);
    assert.equal(view.openCount, 0);
    assert.ok(view.remaining >= 0, "no panelist may finish with a negative balance");
    assert.equal(
      view.spent + view.remaining,
      view.startingBudget,
      "spend and remainder must reconcile to the starting budget",
    );
    assert.equal(
      new Set(view.slots.map((s) => s.slot.id)).size,
      5,
      "each slot must be a distinct objective",
    );
  }

  const summary = buildSummary(state);
  assert.equal(summary.draftedFindings, 20);
  assert.equal(summary.undrafted.length, 5);
  assert.equal(
    summary.totalSpent,
    prices.flat().reduce((a, b) => a + b, 0),
  );
  // Highest-valued list must be sorted descending by price.
  const paid = summary.highestValued.map((v) => v.transaction.price);
  assert.deepEqual(paid, [...paid].sort((a, b) => b - a));
  assert.equal(
    summary.breakoutRepresentation.reduce((sum, row) => sum + row.count, 0),
    20,
  );
});

// --- Session format ---------------------------------------------------------
//
// Two independent framings: what the rooms write, and what the panel's teams
// are made of. The rule engine treats a slot as an opaque id, so the same
// twelve rules above hold in every combination — these tests check that the
// roster, the categories and the vocabulary follow the setting.

test("the default framing is findings into objectives, exactly as before", () => {
  const state = demo();
  assert.equal(state.event.breakoutFraming, "findings");
  assert.equal(state.event.auctionFraming, "objectives");

  assert.deepEqual(
    auctionSlots(state).map((s) => s.id),
    state.objectives.sort((a, b) => a.roundOrder - b.roundOrder).map((o) => o.id),
  );
  assert.deepEqual(
    breakoutCategories(state).map((c) => c.key),
    ["momentum", "fragility", "bottleneck", "opportunity", "wildcard"],
  );
  assert.equal(lexicon(state).boardTitle, "Strategic Findings Board");
});

test("framing the breakouts by objective gives every room one card per objective", () => {
  const state = createEvent({ breakoutFraming: "objectives", auctionFraming: "objectives" });
  const objectives = [...state.objectives].sort((a, b) => a.roundOrder - b.roundOrder);

  const plan = blankCardPlan(state);
  assert.equal(plan.length, objectives.length);
  assert.deepEqual(
    plan.map((p) => p.objectiveId),
    objectives.map((o) => o.id),
  );

  const cards = createBlankFindings("bk-grid", plan);
  state.findings = cards;
  assert.equal(cards.length, 5);
  assert.deepEqual(
    cards.map((c) => findingCategory(state, c).key),
    objectives.map((o) => o.id),
  );
  // Every card carries both bodies; only the objective ones are filled in.
  assert.ok(cards.every((c) => c.risks === "" && c.opportunities === ""));
  assert.equal(lexicon(state).boardTitle, "Strategic Objectives Board");
});

test("framing the auction by findings makes the finding types the team slots", () => {
  const state = demo();
  state.event.auctionFraming = "findings";

  assert.deepEqual(
    auctionSlots(state).map((s) => s.id),
    ["momentum", "fragility", "bottleneck", "opportunity", "wildcard"],
  );
  assert.equal(lexicon(state).Slot, "Finding type");

  // A panelist's team is now five typed positions, and each still takes one card.
  const panelistId = state.panelists[0].id;
  award(state, { findingId: firstAvailable(state), panelistId, slotId: "momentum", price: 10 });

  const view = allPanelistViews(state).find((v) => v.panelist.id === panelistId);
  assert.equal(view.filledCount, 1);
  assert.equal(view.slots[0].slot.id, "momentum");
  assert.equal(view.slots[0].transaction.price, 10);

  const refill = validateAward(state, {
    findingId: firstAvailable(state),
    panelistId,
    slotId: "momentum",
    price: 5,
  });
  assert.equal(refill.ok, false);
  assert.ok(refill.errors.some((e) => e.code === "slot_filled"));
});

test("a mismatched category warns, but only when the two framings line up", () => {
  const state = demo();
  state.event.auctionFraming = "findings";

  const momentum = availableFindings(state).find((v) => v.finding.type === "momentum");
  const fragility = availableFindings(state).find((v) => v.finding.type === "fragility");

  const wrongSlot = validateAward(state, {
    findingId: momentum.finding.id,
    panelistId: state.panelists[0].id,
    slotId: "fragility",
    price: 5,
  });
  assert.equal(wrongSlot.ok, true, "a mismatch is advisory, never a hard rule");
  assert.ok(wrongSlot.warnings.some((w) => w.code === "category_mismatch"));

  const rightSlot = validateAward(state, {
    findingId: fragility.finding.id,
    panelistId: state.panelists[0].id,
    slotId: "fragility",
    price: 5,
  });
  assert.ok(!rightSlot.warnings.some((w) => w.code === "category_mismatch"));

  // Cross-cutting is the point when the rooms and the auction differ, so no
  // warning is raised at all in the default findings-into-objectives setup.
  const crossCutting = demo();
  const anyFinding = availableFindings(crossCutting)[0];
  const validation = validateAward(crossCutting, {
    findingId: anyFinding.finding.id,
    panelistId: crossCutting.panelists[0].id,
    slotId: crossCutting.objectives[0].id,
    price: 5,
  });
  assert.ok(!validation.warnings.some((w) => w.code === "category_mismatch"));
});

test("a schema 1 ledger still loads: objectiveId is read as slotId", () => {
  const state = demo();
  const objectiveId = state.objectives[0].id;
  const snapshot = toSnapshot(state);

  // Exactly what a pre-framing event held on disk.
  snapshot.transactions = {
    "tx-old": {
      id: "tx-old",
      findingId: state.findings[0].id,
      panelistId: state.panelists[0].id,
      objectiveId,
      price: 12,
      timestamp: 1,
      note: "",
    },
  };
  delete snapshot.event.breakoutFraming;
  delete snapshot.event.auctionFraming;

  const loaded = fromSnapshot(snapshot);
  assert.equal(loaded.event.breakoutFraming, "findings");
  assert.equal(loaded.event.auctionFraming, "objectives");
  assert.equal(loaded.transactions[0].slotId, objectiveId);
  assert.equal(loaded.transactions[0].objectiveId, undefined, "the dead field is dropped");

  const view = allPanelistViews(loaded).find((v) => v.panelist.id === state.panelists[0].id);
  assert.equal(view.spent, 12);
  assert.equal(view.slots[0].transaction.price, 12, "the award still fills its objective");
});
