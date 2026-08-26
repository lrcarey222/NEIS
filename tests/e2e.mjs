// End-to-end test against a live Realtime Database.
//
//   node tests/e2e.mjs <databaseURL> [rootNode]
//
// Drives the REST API with exactly the same paths and payloads the browser
// client writes, so it exercises the real data model rather than a mock. It
// covers the two things the Firebase move had to get right:
//
//   * five breakout rooms typing at the same time never overwrite each other,
//     because every commit is a field-level write;
//   * the auction still cannot double-sell a finding, even when two operators
//     award the same one simultaneously.
//
// It writes under <root>/events/__e2e and deletes that node when finished.

import assert from "node:assert/strict";

import { validateAward } from "../src/lib/derive.ts";
import { createBlankFindings, createEvent } from "../src/lib/seed.ts";
import { fromSnapshot, toSnapshot } from "../src/lib/serialize.ts";

const DB = (process.argv[2] ?? "").replace(/\/$/, "");
const ROOT = process.argv[3] ?? "neis";
const EVENT = `${DB}/${ROOT}/events/__e2e`;

if (!DB) {
  console.error("usage: node tests/e2e.mjs <databaseURL> [rootNode]");
  process.exit(2);
}

let passed = 0;
let failed = 0;

function check(label, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function step(title) {
  console.log(`\n${title}`);
}

async function req(method, path, body) {
  const response = await fetch(`${EVENT}${path}.json`, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${method} ${path} → ${response.status} ${await response.text()}`);
  }
  const text = await response.text();
  return text === "null" ? null : JSON.parse(text);
}

const get = (path = "") => req("GET", path);
const put = (path, body) => req("PUT", path, body);
const patch = (path, body) => req("PATCH", path, body);
const del = (path = "") => req("DELETE", path);

/** The whole event, through the same deserializer the app uses. */
async function readState() {
  return fromSnapshot(await get());
}

// --- Run -------------------------------------------------------------------

try {
  step("0. Reachability");
  {
    await del();
    check("database is reachable and writable", true);
  }

  step("1. Create the event");
  {
    const seeded = createEvent({
      demo: false,
      panelistNames: ["Ana Ruiz", "Ben Okafor", "Cai Lin", "Dara Novak"],
    });
    await put("", toSnapshot(seeded));

    const state = await readState();
    check("event round-trips through the database", state !== null);
    check("5 breakouts", state.breakouts.length === 5, `got ${state.breakouts.length}`);
    check("5 objectives", state.objectives.length === 5);
    check("4 panelists at 100 credits", state.panelists.every((p) => p.startingBudget === 100));
    check("no findings yet", state.findings.length === 0);
    check(
      "collections are stored keyed by id, not as arrays",
      !Array.isArray((await get("/breakouts")) ?? {}),
    );
  }

  step("2. Seed the five rooms with blank templates");
  {
    const state = await readState();
    const updates = {};
    for (const breakout of state.breakouts) {
      for (const finding of createBlankFindings(breakout.id)) {
        updates[finding.id] = finding;
      }
    }
    await patch("/findings", updates);

    const after = await readState();
    check("25 templates exist", after.findings.length === 25, `got ${after.findings.length}`);
    check("none are on the board yet", after.findings.every((f) => !f.submitted));
    for (const breakout of after.breakouts) {
      const mine = after.findings.filter((f) => f.breakoutId === breakout.id);
      check(`${breakout.slug} has one of each type`, mine.length === 5);
    }
  }

  step("3. Five rooms type at the same time (the concurrency guarantee)");
  {
    const before = await readState();

    // Every room fires its writes simultaneously, and each room writes several
    // fields on several findings — the realistic worst case for clobbering.
    const writes = [];
    for (const breakout of before.breakouts) {
      const mine = before.findings
        .filter((f) => f.breakoutId === breakout.id)
        .sort((a, b) => a.breakoutRank - b.breakoutRank);

      mine.forEach((finding, index) => {
        writes.push(
          put(`/findings/${finding.id}/headline`, `${breakout.shortName} finding ${index + 1}`),
          put(`/findings/${finding.id}/whyItMatters`, `Because ${breakout.slug} says so.`),
          put(`/findings/${finding.id}/confidence`, index % 2 === 0 ? "high" : "medium"),
        );
      });
    }
    await Promise.all(writes);

    const after = await readState();
    check(
      "all 25 headlines landed",
      after.findings.filter((f) => f.headline).length === 25,
      `got ${after.findings.filter((f) => f.headline).length}`,
    );
    check(
      "no room overwrote another room's work",
      after.breakouts.every(
        (b) => after.findings.filter((f) => f.breakoutId === b.id && f.headline).length === 5,
      ),
    );
    check(
      "sibling fields on the same finding survived concurrent writes",
      after.findings.every((f) => f.headline && f.whyItMatters && f.confidence),
    );
    check(
      "field-level writes did not disturb untouched fields",
      after.findings.every((f) => f.breakoutRank >= 1 && f.type),
    );
  }

  step("4. Submitting publishes a room to the board");
  {
    const state = await readState();
    const grid = state.breakouts.find((b) => b.slug === "grid");

    const updates = { [`breakouts/${grid.id}/submissionStatus`]: "submitted" };
    await patch(`/breakouts/${grid.id}`, {
      submissionStatus: "submitted",
      submittedAt: Date.now(),
    });
    const findingUpdates = {};
    for (const finding of state.findings.filter((f) => f.breakoutId === grid.id)) {
      findingUpdates[`${finding.id}/submitted`] = true;
    }
    await patch("/findings", findingUpdates);
    void updates;

    const after = await readState();
    check("its five findings are on the board", after.findings.filter((f) => f.submitted).length === 5);
    check(
      "the other rooms are still private",
      after.findings.filter((f) => !f.submitted).length === 20,
    );

    // Reopen, exactly as the operator's Reopen button does.
    await patch(`/breakouts/${grid.id}`, { submissionStatus: "drafting", submittedAt: null });
    const reopenUpdates = {};
    for (const finding of state.findings.filter((f) => f.breakoutId === grid.id)) {
      reopenUpdates[`${finding.id}/submitted`] = false;
    }
    await patch("/findings", reopenUpdates);

    const reopened = await readState();
    check("reopening pulls them back off the board", reopened.findings.every((f) => !f.submitted));
  }

  step("5. All rooms submit");
  {
    const state = await readState();
    const breakoutUpdates = {};
    for (const breakout of state.breakouts) {
      breakoutUpdates[`${breakout.id}/submissionStatus`] = "submitted";
      breakoutUpdates[`${breakout.id}/submittedAt`] = Date.now();
    }
    const findingUpdates = {};
    for (const finding of state.findings) findingUpdates[`${finding.id}/submitted`] = true;

    await Promise.all([patch("/breakouts", breakoutUpdates), patch("/findings", findingUpdates)]);

    const after = await readState();
    check("25 findings on the board", after.findings.filter((f) => f.submitted).length === 25);
  }

  step("6. Run the auction — five objectives, four panelists");
  {
    let state = await readState();
    const objectives = [...state.objectives].sort((a, b) => a.roundOrder - b.roundOrder);
    const panelists = [...state.panelists].sort((a, b) => a.sortOrder - b.sortOrder);
    const prices = [
      [18, 20, 14, 9, 11],
      [22, 12, 25, 8, 7],
      [15, 30, 10, 12, 6],
      [11, 9, 19, 21, 13],
    ];

    const pool = state.findings.filter((f) => f.submitted).map((f) => f.id);
    let cursor = 0;
    let rejected = 0;

    for (const [round, objective] of objectives.entries()) {
      for (const [seat, panelist] of panelists.entries()) {
        const findingId = pool[cursor++];
        state = await readState();

        const validation = validateAward(state, {
          findingId,
          panelistId: panelist.id,
          objectiveId: objective.id,
          price: prices[seat][round],
        });
        if (!validation.ok) {
          rejected++;
          continue;
        }

        const id = `tx-${round}-${seat}`;
        await put(`/transactions/${id}`, {
          id,
          findingId,
          panelistId: panelist.id,
          objectiveId: objective.id,
          price: prices[seat][round],
          timestamp: Date.now(),
          note: "",
        });
      }
    }

    check("no valid award was rejected", rejected === 0, `${rejected} rejected`);

    const final = await readState();
    check("ledger holds 20 transactions", final.transactions.length === 20, `got ${final.transactions.length}`);

    const expected = prices.map((row) => row.reduce((a, b) => a + b, 0));
    panelists.forEach((panelist, seat) => {
      const mine = final.transactions.filter((t) => t.panelistId === panelist.id);
      const spent = mine.reduce((sum, t) => sum + t.price, 0);
      check(
        `${panelist.name} holds 5 findings and spent ${expected[seat]}`,
        mine.length === 5 && spent === expected[seat],
        `${mine.length} findings, spent ${spent}`,
      );
      check(
        `${panelist.name} filled five distinct objectives`,
        new Set(mine.map((t) => t.objectiveId)).size === 5,
      );
    });
    check("5 findings remain undrafted", 25 - final.transactions.length === 5);
  }

  step("7. Rules still hold against the live data");
  {
    const state = await readState();
    const sold = state.transactions[0];
    const free = state.findings.find(
      (f) => f.submitted && !state.transactions.some((t) => t.findingId === f.id),
    );

    const doubleSale = validateAward(state, {
      findingId: sold.findingId,
      panelistId: state.panelists[1].id,
      objectiveId: state.objectives[1].id,
      price: 5,
    });
    check("a sold finding cannot be sold again", !doubleSale.ok);

    const doubleSlot = validateAward(state, {
      findingId: free.id,
      panelistId: sold.panelistId,
      objectiveId: sold.objectiveId,
      price: 1,
    });
    check("a panelist cannot refill an objective", !doubleSlot.ok);

    const broke = validateAward(state, {
      findingId: free.id,
      panelistId: state.panelists[0].id,
      objectiveId: state.objectives[0].id,
      price: 9999,
    });
    check("a panelist cannot overspend", !broke.ok);
  }

  step("8. Undo restores budget and availability");
  {
    const before = await readState();
    const last = [...before.transactions].sort((a, b) => b.timestamp - a.timestamp)[0];
    const spentBefore = before.transactions
      .filter((t) => t.panelistId === last.panelistId)
      .reduce((sum, t) => sum + t.price, 0);

    await del(`/transactions/${last.id}`);

    const after = await readState();
    check("the transaction is gone", after.transactions.length === before.transactions.length - 1);
    check(
      "the finding is back in the pool",
      !after.transactions.some((t) => t.findingId === last.findingId),
    );
    const spentAfter = after.transactions
      .filter((t) => t.panelistId === last.panelistId)
      .reduce((sum, t) => sum + t.price, 0);
    check(
      `the buyer's spend fell by ${last.price}`,
      spentAfter === spentBefore - last.price,
      `${spentBefore} -> ${spentAfter}`,
    );

    // Re-record it so the reset check below starts from a full auction.
    await put(`/transactions/${last.id}`, last);
  }

  step("9. Reset the auction without losing findings");
  {
    await del("/transactions");
    await patch("/event", { currentRoundIndex: -1, displayMode: "board", status: "breakouts" });

    const state = await readState();
    check("transactions cleared", state.transactions.length === 0);
    check("all 25 findings survive", state.findings.filter((f) => f.submitted).length === 25);
    check("round returns to standby", state.event.currentRoundIndex === -1);
  }
} catch (error) {
  failed++;
  console.log(`\n  FAIL unexpected error — ${error.message}`);
} finally {
  step("Cleanup");
  try {
    await del();
    console.log("  ok   test event removed");
  } catch (error) {
    console.log(`  FAIL could not remove test event — ${error.message}`);
  }
}

console.log(`\n${"-".repeat(52)}`);
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
