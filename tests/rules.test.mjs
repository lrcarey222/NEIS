// Auction rule tests. Run with `npm test` (Node 22.18+ strips the TS types).
import assert from "node:assert/strict";
import test from "node:test";

import {
  allPanelistViews,
  auctionFindings,
  availableFindings,
  buildAudienceSummary,
  buildSummary,
  entrySpend,
  panelRoles,
  roundComplete,
  roundCount,
  validateAward,
} from "../src/lib/derive.ts";
import { createEvent } from "../src/lib/seed.ts";
import { fromSnapshot, toSnapshot } from "../src/lib/serialize.ts";
import {
  AUCTION_RANK_LIMIT,
  FIELD_LIMITS,
  evidenceLines,
  wordCount,
} from "../src/lib/types.ts";

function demo() {
  return createEvent({ demo: true, startingBudget: 100 });
}

function firstAvailable(state, skip = 0) {
  return availableFindings(state)[skip].finding.id;
}

function award(state, { findingId, panelistId, price }) {
  const validation = validateAward(state, { findingId, panelistId, price });
  assert.equal(
    validation.ok,
    true,
    `expected award to be valid, got: ${validation.errors.map((e) => e.message).join("; ")}`,
  );
  state.transactions.push({
    id: `tx-${state.transactions.length + 1}`,
    findingId,
    panelistId,
    price,
    // Picks are ordered by timestamp, so a same-millisecond run of awards
    // would otherwise shuffle every portfolio.
    timestamp: state.transactions.length + 1,
    note: "",
  });
}

/** Adds a submitted audience entry. `picks` is findingId -> credits. */
function play(state, { name, role, picks, submitted = true }) {
  const entry = {
    id: `au-${state.audience.length + 1}`,
    name,
    affiliation: "",
    role,
    allocations: picks,
    submitted,
    createdAt: state.audience.length + 1,
    updatedAt: state.audience.length + 1,
  };
  state.audience.push(entry);
  return entry;
}

test("demo event seeds 25 submitted findings across 5 breakouts", () => {
  const state = demo();
  assert.equal(state.findings.length, 25);
  assert.equal(state.breakouts.length, 5);

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

test("only each room's top three go to auction", () => {
  const state = demo();
  const pool = auctionFindings(state);

  assert.equal(pool.length, 15, "five rooms times three picks");
  assert.equal(availableFindings(state).length, 15);
  assert.ok(
    pool.every((v) => v.finding.breakoutRank <= AUCTION_RANK_LIMIT),
    "nothing below the line is for sale",
  );

  for (const breakout of state.breakouts) {
    assert.equal(
      pool.filter((v) => v.finding.breakoutId === breakout.id).length,
      AUCTION_RANK_LIMIT,
      `${breakout.slug} should contribute exactly ${AUCTION_RANK_LIMIT}`,
    );
  }

  // The pool reads as tiers: every room's #1 first, then every #2, then #3.
  assert.deepEqual(
    pool.map((v) => v.finding.breakoutRank),
    [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3],
  );
});

test("awarding a finding below the auction line warns but is still recorded", () => {
  const state = demo();
  const belowTheLine = state.findings.find((f) => f.breakoutRank === 5);

  const validation = validateAward(state, {
    findingId: belowTheLine.id,
    panelistId: state.panelists[0].id,
    price: 10,
  });

  // A moderator can take a bid from the floor; the app records what happened.
  assert.equal(validation.ok, true);
  assert.ok(validation.warnings.some((w) => w.code === "outside_pool"));
});

test("a valid award reduces the buyer's budget and removes the finding from the pool", () => {
  const state = demo();
  const findingId = firstAvailable(state);
  const panelistId = state.panelists[0].id;

  award(state, { findingId, panelistId, price: 18 });

  const view = allPanelistViews(state).find((v) => v.panelist.id === panelistId);
  assert.equal(view.spent, 18);
  assert.equal(view.remaining, 82);
  assert.equal(view.filledCount, 1);
  assert.equal(availableFindings(state).length, 14);
  assert.equal(
    availableFindings(state).some((v) => v.finding.id === findingId),
    false,
  );
});

test("a finding cannot be sold twice", () => {
  const state = demo();
  const findingId = firstAvailable(state);

  award(state, { findingId, panelistId: state.panelists[0].id, price: 10 });

  const second = validateAward(state, {
    findingId,
    panelistId: state.panelists[1].id,
    price: 12,
  });

  assert.equal(second.ok, false);
  assert.ok(second.errors.some((e) => e.code === "already_sold"));
});

test("a panelist cannot hold more findings than there are rounds", () => {
  const state = demo();
  state.event.roundCount = 2;
  const panelistId = state.panelists[0].id;

  award(state, { findingId: firstAvailable(state), panelistId, price: 5 });
  award(state, { findingId: firstAvailable(state), panelistId, price: 5 });

  const third = validateAward(state, {
    findingId: firstAvailable(state),
    panelistId,
    price: 5,
  });

  assert.equal(third.ok, false);
  assert.ok(third.errors.some((e) => e.code === "team_full"));
});

test("any panelist may take any finding — nothing constrains the combination", () => {
  const state = demo();
  const panelistId = state.panelists[0].id;

  // A whole room's pool, all of one panelist's picks.
  const fromOneRoom = availableFindings(state).filter(
    (v) => v.finding.breakoutId === "bk-grid",
  );
  assert.equal(fromOneRoom.length, 3);

  for (const view of fromOneRoom) {
    award(state, { findingId: view.finding.id, panelistId, price: 5 });
  }

  const view = allPanelistViews(state).find((v) => v.panelist.id === panelistId);
  assert.equal(view.filledCount, 3);
  assert.equal(view.openCount, 0);
  assert.equal(view.breakoutCounts["bk-grid"], 3);
});

test("a panelist cannot spend more credits than they hold", () => {
  const state = demo();
  const panelistId = state.panelists[0].id;

  award(state, { findingId: firstAvailable(state), panelistId, price: 95 });

  const overspend = validateAward(state, {
    findingId: firstAvailable(state),
    panelistId,
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
    price: 4,
  });

  assert.equal(tooLow.ok, false);
  assert.ok(tooLow.errors.some((e) => e.code === "below_min"));
});

test("the budget reserve is a warning by default and an error when enforced", () => {
  const state = demo();
  state.event.roundCount = 5;

  // 98 of 100 on the first of five picks leaves 2 credits for 4 more.
  const input = {
    findingId: firstAvailable(state),
    panelistId: state.panelists[0].id,
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

test("maxSafeBid reserves one minimum bid for each remaining pick", () => {
  const state = demo();
  state.event.roundCount = 5;
  state.event.minBid = 2;

  const view = allPanelistViews(state)[0];
  // 5 open picks; winning this one leaves 4 to fill at 2 credits each.
  assert.equal(view.openCount, 5);
  assert.equal(view.reserveRequired, 8);
  assert.equal(view.maxSafeBid, 92);
});

test("removing a transaction fully restores budget and availability (undo)", () => {
  const state = demo();
  const findingId = firstAvailable(state);
  const panelistId = state.panelists[0].id;

  award(state, { findingId, panelistId, price: 42 });
  assert.equal(allPanelistViews(state)[0].remaining, 58);

  state.transactions.pop();

  const view = allPanelistViews(state).find((v) => v.panelist.id === panelistId);
  assert.equal(view.remaining, 100);
  assert.equal(view.spent, 0);
  assert.equal(view.filledCount, 0);
  assert.equal(availableFindings(state).length, 15);
  assert.ok(availableFindings(state).some((v) => v.finding.id === findingId));
});

test("editing a transaction excludes itself from the double-sale and budget checks", () => {
  const state = demo();
  const findingId = firstAvailable(state);
  const panelistId = state.panelists[0].id;

  award(state, { findingId, panelistId, price: 90 });
  const txId = state.transactions[0].id;

  // Re-pricing the same sale must not trip "already sold" or "insufficient".
  const repriced = validateAward(state, {
    findingId,
    panelistId,
    price: 30,
    excludeTransactionId: txId,
  });

  assert.equal(repriced.ok, true, repriced.errors.map((e) => e.message).join("; "));
});

test("picks are ordered by when they were won, and pad out to the round count", () => {
  const state = demo();
  state.event.roundCount = 4;
  const panelistId = state.panelists[0].id;

  const first = firstAvailable(state);
  award(state, { findingId: first, panelistId, price: 10 });
  const second = firstAvailable(state);
  award(state, { findingId: second, panelistId, price: 20 });

  const view = allPanelistViews(state).find((v) => v.panelist.id === panelistId);
  assert.equal(view.slots.length, 4);
  assert.equal(view.slots[0].finding.id, first);
  assert.equal(view.slots[1].finding.id, second);
  assert.equal(view.slots[2].transaction, null);
  assert.deepEqual(
    view.slots.map((s) => s.index),
    [1, 2, 3, 4],
  );
});

test("lowering the round count never discards a pick already made", () => {
  const state = demo();
  const panelistId = state.panelists[0].id;
  for (let i = 0; i < 3; i++) {
    award(state, { findingId: firstAvailable(state), panelistId, price: 5 });
  }

  state.event.roundCount = 1;

  const view = allPanelistViews(state).find((v) => v.panelist.id === panelistId);
  assert.equal(view.slots.length, 3, "the extra picks stay visible rather than vanishing");
  assert.equal(view.filledCount, 3);
  assert.equal(view.openCount, 0);
});

test("roundCount floors at 1 so a zero cannot make every bid illegal", () => {
  const state = demo();
  state.event.roundCount = 0;
  assert.equal(roundCount(state), 1);

  const validation = validateAward(state, {
    findingId: firstAvailable(state),
    panelistId: state.panelists[0].id,
    price: 5,
  });
  assert.equal(validation.ok, true);
});

test("a round is complete only once every panelist has picked in it", () => {
  const state = demo();
  assert.equal(roundComplete(state, 0), false);

  for (const panelist of state.panelists) {
    award(state, { findingId: firstAvailable(state), panelistId: panelist.id, price: 5 });
  }
  assert.equal(roundComplete(state, 0), true);
  assert.equal(roundComplete(state, 1), false);
});

test("a full three-round draft empties the board and summarises correctly", () => {
  const state = demo();
  state.event.roundCount = 3;
  const prices = [
    [18, 20, 14],
    [22, 12, 25],
    [15, 30, 10],
    [11, 9, 19],
    [10, 8, 12],
  ];

  for (let round = 0; round < 3; round++) {
    state.panelists.forEach((panelist, seat) => {
      award(state, {
        findingId: firstAvailable(state),
        panelistId: panelist.id,
        price: prices[seat][round],
      });
    });
  }

  // Five panelists times three picks is exactly the fifteen on the board.
  assert.equal(state.transactions.length, 15);
  assert.equal(availableFindings(state).length, 0);

  for (const view of allPanelistViews(state)) {
    assert.equal(view.filledCount, 3, `${view.panelist.name} should hold 3 findings`);
    assert.equal(view.openCount, 0);
    assert.ok(view.remaining >= 0, "no panelist may finish with a negative balance");
    assert.equal(
      view.spent + view.remaining,
      view.startingBudget,
      "spend and remainder must reconcile to the starting budget",
    );
  }

  const summary = buildSummary(state);
  assert.equal(summary.draftedFindings, 15);
  assert.equal(summary.undrafted.length, 0);
  assert.equal(
    summary.totalSpent,
    prices.flat().reduce((a, b) => a + b, 0),
  );
  const paid = summary.highestValued.map((v) => v.transaction.price);
  assert.deepEqual(paid, [...paid].sort((a, b) => b - a));
});

test("a new event defaults to five panelists, three rounds and 100 credits", () => {
  const state = createEvent({});
  assert.equal(state.panelists.length, 5);
  assert.equal(state.event.roundCount, 3);
  assert.equal(state.event.startingBudget, 100);
  assert.ok(state.panelists.every((p) => p.startingBudget === 100));
});

test("a 2-round, 5-panelist draft reconciles and leaves the rest on the board", () => {
  const state = demo();
  state.event.roundCount = 2;
  assert.equal(state.panelists.length, 5);

  const prices = [
    [30, 25],
    [40, 15],
    [22, 22],
    [50, 30],
    [12, 8],
  ];

  for (let round = 0; round < 2; round++) {
    state.panelists.forEach((panelist, seat) => {
      award(state, {
        findingId: firstAvailable(state),
        panelistId: panelist.id,
        price: prices[seat][round],
      });
    });
  }

  assert.equal(state.transactions.length, 10);
  assert.equal(availableFindings(state).length, 5, "five of the fifteen go undrafted");

  allPanelistViews(state).forEach((view, seat) => {
    assert.equal(view.slots.length, 2, `${view.panelist.name} has two slots`);
    assert.equal(view.filledCount, 2);
    assert.equal(view.openCount, 0);
    assert.equal(view.spent, prices[seat].reduce((a, b) => a + b, 0));
    assert.equal(view.spent + view.remaining, view.startingBudget);
  });

  // A full team refuses a third pick even with credits to spare.
  const full = validateAward(state, {
    findingId: firstAvailable(state),
    panelistId: state.panelists[4].id,
    price: 5,
  });
  assert.equal(full.ok, false);
  assert.ok(full.errors.some((e) => e.code === "team_full"));

  const summary = buildSummary(state);
  assert.equal(summary.draftedFindings, 10);
  assert.equal(
    summary.undrafted.length,
    5,
    "only findings that were actually for sale count as undrafted",
  );
  assert.equal(summary.totalSpent, prices.flat().reduce((a, b) => a + b, 0));
  assert.equal(summary.totalBudget, 500);
});

// --- Roles ------------------------------------------------------------------

test("the panel seeds one seat per default role, each with its question", () => {
  const state = createEvent({});
  const roles = panelRoles(state);

  assert.deepEqual(
    roles.map((r) => r.name),
    [
      "National Security Advisor",
      "Treasury Secretary",
      "Governor",
      "Utility CEO",
      "National Lab Director",
    ],
  );
  assert.ok(roles.every((r) => r.prompt.length > 0), "every seeded role has a prompt");
});

test("two panelists sharing a role collapse to one entry for the audience", () => {
  const state = createEvent({});
  const shared = state.panelists[0].role;
  state.panelists[1].role = shared;
  state.panelists[1].rolePrompt = "";

  const roles = panelRoles(state);
  assert.equal(roles.filter((r) => r.name === shared).length, 1);
  const merged = roles.find((r) => r.name === shared);
  assert.equal(merged.panelists.length, 2);
  assert.ok(merged.prompt.length > 0, "the first non-empty prompt wins");
});

test("a panelist with no role is left out of the audience's choices", () => {
  const state = createEvent({});
  state.panelists[0].role = "   ";

  assert.equal(panelRoles(state).length, 4);
});

// --- Audience play-along -----------------------------------------------------

test("audience averages divide by everyone who submitted, not by backers", () => {
  const state = demo();
  const [a, b] = state.findings.filter((f) => f.submitted);

  // One zealot puts everything on `a`; three others put a little on `b`.
  play(state, { name: "Zealot", role: "Investor", picks: { [a.id]: 100 } });
  play(state, { name: "One", role: "Economist", picks: { [b.id]: 20 } });
  play(state, { name: "Two", role: "Economist", picks: { [b.id]: 20 } });
  play(state, { name: "Three", role: "Economist", picks: { [b.id]: 20 } });

  const summary = buildAudienceSummary(state);
  assert.equal(summary.submitted, 4);
  assert.equal(summary.creditsAllocated, 160);

  const statA = summary.stats.find((s) => s.finding.id === a.id);
  const statB = summary.stats.find((s) => s.finding.id === b.id);

  assert.equal(statA.total, 100);
  assert.equal(statA.backers, 1);
  assert.equal(statA.average, 25, "100 credits over 4 participants");
  assert.equal(statB.average, 15, "60 credits over 4 participants");

  // Ranked by average, so the one zealot still wins — but only 25 to 15, not
  // 100 to 20, which is the whole point of dividing by everyone.
  assert.equal(summary.stats[0].finding.id, a.id);
});

test("entries that were never submitted are ignored entirely", () => {
  const state = demo();
  const finding = state.findings.find((f) => f.submitted);

  play(state, { name: "Done", role: "Investor", picks: { [finding.id]: 40 } });
  play(state, {
    name: "Halfway",
    role: "Investor",
    picks: { [finding.id]: 100 },
    submitted: false,
  });

  const summary = buildAudienceSummary(state);
  assert.equal(summary.joined, 2);
  assert.equal(summary.submitted, 1);
  assert.equal(summary.creditsAllocated, 40);

  const stat = summary.stats.find((s) => s.finding.id === finding.id);
  assert.equal(stat.average, 40, "the unsubmitted 100 must not count");
});

test("the room-versus-panel gap surfaces what the panel left on the board", () => {
  const state = demo();
  const [bought, ignored] = state.findings.filter((f) => f.submitted);

  award(state, { findingId: bought.id, panelistId: state.panelists[0].id, price: 40 });

  // The room rates the undrafted one highly and the bought one barely at all.
  play(state, { name: "A", role: "Investor", picks: { [ignored.id]: 50, [bought.id]: 5 } });
  play(state, { name: "B", role: "Investor", picks: { [ignored.id]: 50, [bought.id]: 5 } });

  const summary = buildAudienceSummary(state);

  const overlooked = summary.overlooked[0];
  assert.equal(overlooked.finding.id, ignored.id);
  assert.equal(overlooked.panelPrice, null, "nobody drafted it");
  assert.equal(overlooked.delta, 50);

  const contested = summary.contested[0];
  assert.equal(contested.finding.id, bought.id);
  assert.equal(contested.panelPrice, 40);
  assert.equal(contested.delta, -35, "the panel paid 40 for something worth 5 to the room");
});

test("the per-role breakdown scores each lens against its own participants", () => {
  const state = demo();
  const [a, b] = state.findings.filter((f) => f.submitted);

  play(state, { name: "I1", role: "Investor", picks: { [a.id]: 60 } });
  play(state, { name: "I2", role: "Investor", picks: { [a.id]: 40 } });
  play(state, { name: "S1", role: "Security Hawk", picks: { [b.id]: 30 } });

  const summary = buildAudienceSummary(state);
  const investors = summary.byRole.find((r) => r.role === "Investor");
  const hawks = summary.byRole.find((r) => r.role === "Security Hawk");

  assert.equal(investors.entries, 2);
  assert.equal(investors.top[0].finding.id, a.id);
  assert.equal(investors.top[0].average, 50, "divided by the 2 investors, not all 3 players");

  assert.equal(hawks.entries, 1);
  assert.equal(hawks.top[0].finding.id, b.id);
  assert.equal(hawks.top[0].average, 30);
});

test("an audience summary with nobody playing is empty rather than broken", () => {
  const summary = buildAudienceSummary(demo());
  assert.equal(summary.submitted, 0);
  assert.equal(summary.creditsAllocated, 0);
  assert.deepEqual(summary.overlooked, []);
  assert.deepEqual(summary.byRole, []);
  assert.ok(summary.stats.every((s) => s.average === 0));
});

// --- Finding shape ----------------------------------------------------------

test("every demo finding sits inside the length targets it is modelling", () => {
  for (const finding of demo().findings) {
    const label = `${finding.id}`;

    assert.ok(
      wordCount(finding.headline) < FIELD_LIMITS.headline.amber,
      `${label}: headline is ${wordCount(finding.headline)} words, target ${FIELD_LIMITS.headline.target}`,
    );
    assert.ok(
      wordCount(finding.whyItMatters) < FIELD_LIMITS.whyItMatters.amber,
      `${label}: why-it-matters is ${wordCount(finding.whyItMatters)} words`,
    );

    const bullets = evidenceLines(finding.evidence);
    assert.equal(bullets.length, FIELD_LIMITS.evidenceBullets, `${label}: two bullets`);
    for (const bullet of bullets) {
      assert.ok(
        wordCount(bullet) < FIELD_LIMITS.evidenceBullet.amber,
        `${label}: bullet is ${wordCount(bullet)} words — "${bullet}"`,
      );
    }

    assert.equal(finding.whatChanged ?? "", "", `${label}: whatChanged is gone`);
  }
});

test("word and bullet counting match how a reader would count them", () => {
  assert.equal(wordCount(""), 0);
  assert.equal(wordCount("   \n  "), 0);
  assert.equal(wordCount("one  two\nthree"), 3);
  assert.deepEqual(evidenceLines("• first\n\n- second\n   \n* third"), [
    "first",
    "second",
    "third",
  ]);
  assert.deepEqual(evidenceLines(""), []);
});

// --- Persistence -------------------------------------------------------------

test("a schema 2 finding's whatChanged is appended to whyItMatters, not lost", () => {
  const state = demo();
  const snapshot = toSnapshot(state);
  const [id] = Object.keys(snapshot.findings);

  snapshot.findings[id].whatChanged = "Orders shifted from speculative to contracted.";
  snapshot.findings[id].whyItMatters = "It is resilient to policy reversal.";

  const loaded = fromSnapshot(snapshot);
  const finding = loaded.findings.find((f) => f.id === id);

  assert.ok(
    finding.whyItMatters.includes("Orders shifted from speculative to contracted."),
    "the old text survives",
  );
  assert.ok(
    finding.whyItMatters.includes("It is resilient to policy reversal."),
    "the existing text survives too",
  );

  // Migrating on read means it runs on every load — it must not stack up.
  const again = fromSnapshot(toSnapshot(loaded));
  assert.equal(
    again.findings.find((f) => f.id === id).whyItMatters,
    finding.whyItMatters,
    "the migration is idempotent",
  );
});

test("whatChanged with no whyItMatters becomes the whole field", () => {
  const state = demo();
  const snapshot = toSnapshot(state);
  const [id] = Object.keys(snapshot.findings);

  snapshot.findings[id].whatChanged = "Only this was ever written.";
  snapshot.findings[id].whyItMatters = "";

  const loaded = fromSnapshot(snapshot);
  assert.equal(
    loaded.findings.find((f) => f.id === id).whyItMatters,
    "Only this was ever written.",
  );
});


test("audience entries round-trip, and junk allocations are scrubbed on read", () => {
  const state = demo();
  const finding = state.findings.find((f) => f.submitted);
  play(state, { name: "Ana", role: "Investor", picks: { [finding.id]: 25 } });

  const snapshot = toSnapshot(state);
  // What a flaky client could actually put on the wire.
  snapshot.audience["au-1"].allocations["fd-junk"] = "not a number";
  snapshot.audience["au-1"].allocations["fd-negative"] = -10;
  snapshot.audience["au-1"].allocations["fd-fractional"] = 7.8;

  const loaded = fromSnapshot(snapshot);
  const entry = loaded.audience[0];

  assert.equal(entry.name, "Ana");
  assert.equal(entry.allocations[finding.id], 25);
  assert.equal(entry.allocations["fd-junk"], undefined);
  assert.equal(entry.allocations["fd-negative"], undefined);
  assert.equal(entry.allocations["fd-fractional"], 7, "floored, not rounded up");
  assert.equal(entrySpend(entry), 32);
});

test("a schema 1 event still loads: objectives dropped, five rounds assumed", () => {
  const state = demo();
  const snapshot = toSnapshot(state);

  // Reconstruct what version 1 actually held on disk.
  snapshot.objectives = {
    "ob-political": { id: "ob-political", name: "Political Durability", roundOrder: 0 },
  };
  snapshot.transactions = {
    "tx-old": {
      id: "tx-old",
      findingId: state.findings[0].id,
      panelistId: state.panelists[0].id,
      objectiveId: "ob-political",
      price: 12,
      timestamp: 1,
      note: "",
    },
  };
  delete snapshot.event.roundCount;
  delete snapshot.event.audienceOpen;
  delete snapshot.event.audienceBudget;
  delete snapshot.audience;
  for (const panelist of Object.values(snapshot.panelists)) {
    delete panelist.role;
    delete panelist.rolePrompt;
  }

  const loaded = fromSnapshot(snapshot);

  assert.equal(loaded.event.roundCount, 5, "five objectives meant five picks");
  assert.equal(loaded.event.audienceOpen, false);
  assert.equal(loaded.event.audienceBudget, 100);
  assert.deepEqual(loaded.audience, []);
  assert.equal(loaded.transactions[0].objectiveId, undefined, "the dead field is dropped");
  assert.equal(loaded.transactions[0].price, 12);
  assert.ok(loaded.panelists.every((p) => p.role === "" && p.rolePrompt === ""));

  const view = allPanelistViews(loaded).find((v) => v.panelist.id === state.panelists[0].id);
  assert.equal(view.spent, 12, "the old award still counts against its buyer");
  assert.equal(view.slots[0].transaction.price, 12);
});
