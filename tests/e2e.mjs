// End-to-end walk through the full event, against a running server.
//
//   node tests/e2e.mjs [baseUrl]
//
// Exercises exactly the sequence the room will follow on the day:
// create event -> seed rooms -> facilitators write findings -> submit ->
// findings appear on the board -> five auction rounds -> undo -> exports.
// Also asserts that an SSE client receives the award without polling.

const BASE = process.argv[2] ?? "http://localhost:3100";
const ADMIN_PIN = process.env.ADMIN_PIN ?? "2026";

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

/** Minimal cookie jar so each actor keeps its own session. */
function actor(name) {
  let cookie = "";
  return {
    name,
    async call(path, method = "GET", body) {
      const response = await fetch(`${BASE}${path}`, {
        method,
        headers: {
          ...(cookie ? { cookie } : {}),
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: "manual",
      });
      const setCookie = response.headers.getSetCookie?.() ?? [];
      for (const entry of setCookie) {
        const pair = entry.split(";")[0];
        if (pair.startsWith("neis_session=")) cookie = pair;
      }
      const text = await response.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return { status: response.status, ok: response.ok, data, headers: response.headers };
    },
  };
}

const admin = actor("admin");
const facilitator = actor("facilitator");
const anonymous = actor("anonymous");

async function state() {
  const { data } = await anonymous.call("/api/state");
  return data.state;
}

// --- SSE listener ----------------------------------------------------------

function listenForRevisionBump(afterRevision, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, timeoutMs);

    fetch(`${BASE}/api/stream`, { signal: controller.signal })
      .then(async (response) => {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          for (const frame of buffer.split("\n\n")) {
            const line = frame.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            try {
              const payload = JSON.parse(line.slice(6));
              if (payload.revision > afterRevision) {
                clearTimeout(timer);
                controller.abort();
                resolve(payload);
                return;
              }
            } catch {
              /* partial frame */
            }
          }
          buffer = buffer.slice(buffer.lastIndexOf("\n\n") + 2);
        }
      })
      .catch(() => {});
  });
}

// --- Run -------------------------------------------------------------------

step("1. Access control");
{
  const blocked = await anonymous.call("/api/admin", "POST", { action: "reset_auction" });
  check("anonymous cannot run admin actions", blocked.status === 401);

  const display = await anonymous.call("/api/state");
  check("anonymous can read state for /display", display.ok);

  const badPin = await admin.call("/api/auth", "POST", { pin: "0000" });
  check("a wrong PIN is rejected", badPin.status === 401);

  const login = await admin.call("/api/auth", "POST", { pin: ADMIN_PIN });
  check("the administrator PIN is accepted", login.ok, JSON.stringify(login.data));
}

step("2. Create a fresh live event");
{
  const created = await admin.call("/api/admin", "POST", {
    action: "create_live_event",
    confirm: "RESET",
    title: "NEIS Strategic Findings Auction",
    startingBudget: 100,
    panelistNames: ["Ana Ruiz", "Ben Okafor", "Cai Lin", "Dara Novak"],
  });
  check("live event created", created.ok, JSON.stringify(created.data).slice(0, 200));

  const s = await state();
  check("starts with no findings", s.findings.length === 0);
  check("has 5 breakouts", s.breakouts.length === 5);
  check("has 5 objectives", s.objectives.length === 5);
  check("has 4 panelists at 100 credits", s.panelists.every((p) => p.startingBudget === 100));

  const seeded = await admin.call("/api/admin", "POST", { action: "seed_blank_findings" });
  check("blank templates seeded", seeded.ok);

  const after = await state();
  check("25 blank findings exist (5 per room)", after.findings.length === 25, `got ${after.findings.length}`);
  check("none are on the board yet", after.findings.every((f) => !f.submitted));
}

step("3. A breakout facilitator writes and submits findings");
{
  const s = await state();
  const grid = s.breakouts.find((b) => b.slug === "grid");

  const wrongRoom = await facilitator.call("/api/auth", "POST", {
    pin: "9999",
    slug: "grid",
  });
  check("a wrong room PIN is rejected", wrongRoom.status === 401);

  const login = await facilitator.call("/api/auth", "POST", { pin: grid.pin, slug: "grid" });
  check("the room PIN is accepted", login.ok);

  const otherRoom = await facilitator.call("/api/findings", "POST", {
    breakoutSlug: "auto",
    headline: "should not be allowed",
  });
  check("a facilitator cannot write to another room", otherRoom.status === 401);

  const mine = s.findings.filter((f) => f.breakoutId === grid.id);
  for (const [index, finding] of mine.entries()) {
    const result = await facilitator.call("/api/findings", "PATCH", {
      id: finding.id,
      headline: `Grid finding ${index + 1} — ${finding.type}`,
      whatChanged: "Recorded during the live breakout.",
      evidence: "• Point one\n• Point two",
      whyItMatters: "It shapes the affordability argument.",
      confidence: index % 2 === 0 ? "high" : "medium",
    });
    if (!result.ok) check(`wrote finding ${index + 1}`, false, JSON.stringify(result.data));
  }
  check("facilitator wrote all five findings", true);

  const beforeSubmit = await state();
  check(
    "findings are still off the board while drafting",
    beforeSubmit.findings.filter((f) => f.submitted).length === 0,
  );

  const submit = await facilitator.call("/api/breakouts", "PATCH", {
    slug: "grid",
    submissionStatus: "submitted",
  });
  check("room submits", submit.ok);

  const afterSubmit = await state();
  const published = afterSubmit.findings.filter((f) => f.submitted);
  check("its five findings are now on the board", published.length === 5, `got ${published.length}`);
  check(
    "the room reads as Submitted",
    afterSubmit.breakouts.find((b) => b.slug === "grid").submissionStatus === "submitted",
  );

  const reopen = await facilitator.call("/api/breakouts", "PATCH", {
    slug: "grid",
    submissionStatus: "drafting",
  });
  check("a facilitator cannot reopen their own submitted room", reopen.status === 401);

  const adminReopen = await admin.call("/api/breakouts", "PATCH", {
    slug: "grid",
    submissionStatus: "drafting",
  });
  check("the operator can reopen it", adminReopen.ok);
  const reopened = await state();
  check(
    "reopened findings leave the board",
    reopened.findings.filter((f) => f.submitted).length === 0,
  );

  await admin.call("/api/breakouts", "PATCH", { slug: "grid", submissionStatus: "submitted" });
}

step("4. All rooms submit");
{
  const s = await state();
  // Give the other four rooms headlines so the board is fully populated.
  for (const breakout of s.breakouts.filter((b) => b.slug !== "grid")) {
    const mine = s.findings.filter((f) => f.breakoutId === breakout.id);
    for (const [index, finding] of mine.entries()) {
      await admin.call("/api/findings", "PATCH", {
        id: finding.id,
        headline: `${breakout.shortName} finding ${index + 1} — ${finding.type}`,
        whatChanged: "Recorded during the live breakout.",
        whyItMatters: "Material to the strategy.",
      });
    }
  }

  const all = await admin.call("/api/admin", "POST", { action: "submit_all_breakouts" });
  check("all rooms submitted", all.ok);

  const s2 = await state();
  check("25 findings on the board", s2.findings.filter((f) => f.submitted).length === 25);
}

step("5. Run the auction — five objectives, four panelists");
{
  let s = await state();
  await admin.call("/api/event", "PATCH", { displayMode: "auction", currentRoundIndex: 0 });

  const objectives = [...s.objectives].sort((a, b) => a.roundOrder - b.roundOrder);
  const panelists = [...s.panelists].sort((a, b) => a.sortOrder - b.sortOrder);
  const prices = [
    [18, 20, 14, 9, 11],
    [22, 12, 25, 8, 7],
    [15, 30, 10, 12, 6],
    [11, 9, 19, 21, 13],
  ];

  // Watch the stream while the first award goes through.
  s = await state();
  const streamPromise = listenForRevisionBump(s.revision);

  let pool = s.findings.filter((f) => f.submitted).map((f) => f.id);
  let cursor = 0;
  let firstAward = null;

  for (const [round, objective] of objectives.entries()) {
    for (const [seat, panelist] of panelists.entries()) {
      const findingId = pool[cursor++];
      const result = await admin.call("/api/transactions", "POST", {
        findingId,
        panelistId: panelist.id,
        objectiveId: objective.id,
        price: prices[seat][round],
        acknowledgeWarnings: true,
        advanceRound: false,
      });
      if (!result.ok) {
        check(`award r${round + 1} seat${seat + 1}`, false, JSON.stringify(result.data));
      }
      if (!firstAward) firstAward = { findingId, panelistId: panelist.id };
    }
    await admin.call("/api/event", "PATCH", { round: "next" });
  }
  check("all 20 awards recorded", true);

  const pushed = await streamPromise;
  check("an SSE client received the update without polling", pushed !== null);

  const final = await state();
  check("ledger holds 20 transactions", final.transactions.length === 20, `got ${final.transactions.length}`);

  const expectedSpend = prices.map((row) => row.reduce((a, b) => a + b, 0));
  panelists.forEach((panelist, seat) => {
    const spent = final.transactions
      .filter((t) => t.panelistId === panelist.id)
      .reduce((sum, t) => sum + t.price, 0);
    check(
      `${panelist.name} spent ${expectedSpend[seat]} and holds 5 findings`,
      spent === expectedSpend[seat] &&
        final.transactions.filter((t) => t.panelistId === panelist.id).length === 5,
      `spent ${spent}`,
    );
    const slots = new Set(
      final.transactions.filter((t) => t.panelistId === panelist.id).map((t) => t.objectiveId),
    );
    check(`${panelist.name} filled five distinct objectives`, slots.size === 5);
  });

  check(
    "5 findings remain undrafted",
    final.findings.filter((f) => f.submitted).length - final.transactions.length === 5,
  );
}

step("6. Rule enforcement over HTTP");
{
  const s = await state();
  const soldFindingId = s.transactions[0].findingId;
  const panelist = s.panelists[0];
  const objective = s.objectives[0];
  const free = s.findings.find(
    (f) => f.submitted && !s.transactions.some((t) => t.findingId === f.id),
  );

  const doubleSale = await admin.call("/api/transactions", "POST", {
    findingId: soldFindingId,
    panelistId: s.panelists[1].id,
    objectiveId: s.objectives[1].id,
    price: 5,
    acknowledgeWarnings: true,
  });
  check("a sold finding cannot be sold again", doubleSale.status === 409);

  const doubleSlot = await admin.call("/api/transactions", "POST", {
    findingId: free.id,
    panelistId: panelist.id,
    objectiveId: objective.id,
    price: 1,
    acknowledgeWarnings: true,
  });
  check("a panelist cannot refill an objective", doubleSlot.status === 409);

  const overspend = await admin.call("/api/transactions", "POST", {
    findingId: free.id,
    panelistId: panelist.id,
    objectiveId: "ob-does-not-exist",
    price: 9999,
    acknowledgeWarnings: true,
  });
  check("an unknown objective is rejected", overspend.status === 409);
}

step("7. Undo");
{
  const before = await state();
  const last = [...before.transactions].sort((a, b) => b.timestamp - a.timestamp)[0];
  const buyer = before.panelists.find((p) => p.id === last.panelistId);
  const spentBefore = before.transactions
    .filter((t) => t.panelistId === buyer.id)
    .reduce((sum, t) => sum + t.price, 0);

  const undo = await admin.call("/api/transactions", "DELETE", { rewindRound: true });
  check("undo last transaction succeeds", undo.ok);

  const after = await state();
  check("the transaction is gone", after.transactions.length === before.transactions.length - 1);
  check(
    "the finding is back in the pool",
    !after.transactions.some((t) => t.findingId === last.findingId),
  );
  const spentAfter = after.transactions
    .filter((t) => t.panelistId === buyer.id)
    .reduce((sum, t) => sum + t.price, 0);
  check(
    `${buyer.name}'s spend fell by ${last.price}`,
    spentAfter === spentBefore - last.price,
    `${spentBefore} -> ${spentAfter}`,
  );

  // Put it back so the exports below describe a complete auction.
  const redo = await admin.call("/api/transactions", "POST", {
    findingId: last.findingId,
    panelistId: last.panelistId,
    objectiveId: last.objectiveId,
    price: last.price,
    acknowledgeWarnings: true,
  });
  check("the same award can be re-recorded after an undo", redo.ok);
}

step("8. Exports and printable summary");
{
  for (const [label, path, expectHeader] of [
    ["findings CSV", "/api/export/findings", "Breakout,Finding Type"],
    ["ledger CSV", "/api/export/transactions", "Order,Timestamp"],
    ["portfolios CSV", "/api/export/portfolios", "Panelist,Affiliation"],
  ]) {
    const response = await fetch(`${BASE}${path}`);
    const text = await response.text();
    const lines = text.trim().split("\r\n");
    check(
      `${label} downloads with data`,
      response.ok && text.includes(expectHeader) && lines.length > 1,
      `${lines.length} lines`,
    );
  }

  const summary = await fetch(`${BASE}/summary`);
  const html = await summary.text();
  check(
    "printable summary renders portfolios",
    summary.ok && html.includes("Final portfolios") && html.includes("Ana Ruiz"),
  );

  const display = await fetch(`${BASE}/display`);
  check("public display route serves", display.ok);
}

step("9. Reset the auction without losing findings");
{
  const reset = await admin.call("/api/admin", "POST", { action: "reset_auction" });
  check("auction reset", reset.ok);

  const s = await state();
  check("transactions cleared", s.transactions.length === 0);
  check("all 25 findings survive", s.findings.filter((f) => f.submitted).length === 25);
  check("round returns to standby", s.event.currentRoundIndex === -1);
}

console.log(`\n${"-".repeat(52)}`);
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
