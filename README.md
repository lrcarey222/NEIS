# NEIS Strategic Findings Auction

**Live: <https://lrcarey222.github.io/NEIS/>**

A live-event web app for the NEIS session at NYC Climate Week.

Five breakout groups each record five Strategic Findings **at the same time, from their own
laptops**. Every finding lands on a shared board the moment it is submitted. A final panel
then bids fictional investment credits to acquire one finding for each of five strategic
objectives. The bidding happens **verbally in the room** — this app captures the findings,
projects the board, and lets an operator record each result so every screen updates instantly.

```
/                    Landing page — QR codes for each breakout room
/display             Big screen (16:9). Three modes, driven by the operator
/breakout/<slug>     Facilitator workspace, one per room. PIN protected
/control             Operator control room. Administrator PIN
/summary             Printable / save-as-PDF record of the session
```

---

## Quick start

Requires **Node.js 20 or newer** (developed and tested on Node 24).

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Go to `/control`, enter the admin PIN (`2026` by default), and
create a rehearsal event — that loads 25 sample findings so you can walk the whole exercise
immediately.

Until you paste a Firebase config (next section), the app runs in **local mode**: fully
functional, but state is shared only between tabs of the same browser. A red **LOCAL ONLY**
badge appears on every screen so this can never be mistaken for the real thing.

> **Working inside OneDrive or Dropbox?** The sync client turns build artefacts into cloud
> placeholders mid-build and `next build` fails with `EINVAL: readlink`. Point the build
> somewhere unsynced — the exported site still lands in `./out`:
>
> ```bash
> NEXT_DIST_DIR=../../../../neis-build npm run build
> ```
>
> (On Windows PowerShell: `$env:NEXT_DIST_DIR="../../../../neis-build"; npm run build`.)
> This only affects local builds; CI is unaffected.

---

## Firebase setup — do this before the event

This is the step that turns five separate laptops into one shared board. It takes about five
minutes and is free.

1. Go to <https://console.firebase.google.com> → **Add project**. Name it something like
   `neis-climate-week`. Disable Analytics when asked.
2. Left sidebar → **Build → Realtime Database → Create Database**. Pick a location, choose
   **Start in test mode**, Enable.
3. Gear icon → **Project settings** → **Your apps** → click the Web icon `</>` → register an
   app. Firebase shows a `firebaseConfig = {...}` object.
4. Copy those values into **`src/lib/firebase-config.ts`**, replacing the `PASTE_YOUR_*`
   placeholders. Make sure `databaseURL` is included — if Firebase does not show it, it is
   `https://<your-project-id>-default-rtdb.firebaseio.com`.
5. Realtime Database → **Rules** tab → paste the contents of **`database.rules.json`** from
   this repo → **Publish**. (Test mode expires after 30 days and would take the event down
   mid-session; these rules do not expire.)
6. Commit and push. The deploy workflow rebuilds the site and live sync is on.

Verify it worked: open `/control` → **Setup** → the **Sync** card at the top should read
*"Connected to Firebase"*. If it says **Local only**, something in step 4 did not take.

The `apiKey` in that file is **not a secret**. Firebase web API keys are public by design and
are safe to commit; access is controlled by the database rules, not by hiding the key.

### Testing against the real database

```bash
node --import ./tests/ts-resolver.mjs tests/e2e.mjs https://<your-project>-default-rtdb.firebaseio.com
```

42 checks against live Firebase, including the concurrency guarantee. It works under
`<root>/events/__e2e` and deletes that node when it finishes, so it is safe to run against the
event database — but run it before the session, not during.

---

## Architecture

**Next.js 15 + React 19 + TypeScript + Tailwind v4, exported as a static site, with Firebase
Realtime Database for all state.** There is no server: `npm run build` emits plain HTML and JS
into `out/`, which GitHub Pages serves. Nothing can crash mid-session because nothing is
running.

```
src/lib/types.ts          Domain model
src/lib/derive.ts         Pure selectors + every auction rule
src/lib/seed.ts           Event scaffolding + the 25 demo findings
src/lib/firebase-config.ts  ← paste your project values here
src/lib/net.ts            Transport: Firebase adapter | local fallback
src/lib/serialize.ts      EventState (arrays) ⇄ RTDB (keyed objects)
src/lib/actions.ts        Every mutation
src/lib/localAuth.ts      PIN → role, in the browser
src/lib/useEvent.ts       The hook every screen reads from
tests/                    Rule tests + live end-to-end walkthrough
```

Three decisions carry most of the weight:

**The transaction log is the only source of truth for the auction.** A `Finding` never stores
who bought it or for how much — budgets, availability and portfolios are all derived from
`transactions`. Undo is therefore a one-row delete that cannot leave the scoreboard
half-updated in front of a room.

**Writes are as narrow as possible.** A facilitator typing a headline writes
`findings/<id>/headline`, not the whole finding and certainly not the whole event. That is
what lets five rooms — and two people at the same table — edit simultaneously without
overwriting each other. The end-to-end test fires all five rooms' writes at once and asserts
nothing is lost.

**Awards go through a database transaction.** `awardFinding` re-runs the full validation
*inside* an RTDB transaction, against committed state rather than whatever this browser
happened to be rendering. Two operators clicking AWARD on the same finding cannot both
succeed.

There is one adapter boundary: when the Firebase config is unfilled, or the URL carries
`?local=1`, `net()` returns a localStorage + BroadcastChannel adapter with an identical
interface. Nothing above that file knows which is active, so the app is fully usable and
testable before anyone touches the Firebase console.

---

## Environment variables

Everything has a working default; the app builds and runs with no environment at all.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_ADMIN_PIN` | `2026` | Unlocks `/control`. **Change this before the event.** Set it as an Actions *variable* named `ADMIN_PIN` for deploys. |
| `NEXT_PUBLIC_BASE_PATH` | empty | URL prefix. The deploy workflow sets it to `/<repo>` for GitHub Pages. Leave unset locally. |

Breakout PINs are **not** environment variables — they live in the event record and are
editable in `/control` → Setup, so you can change them on the day.

---

## Deployment

Push to `main`. The workflow in `.github/workflows/deploy.yml` runs the tests, builds the
static export, and publishes to GitHub Pages.

One-time repo setup: **Settings → Pages → Source → GitHub Actions**. Then set
**Settings → Secrets and variables → Actions → Variables → New variable**, named `ADMIN_PIN`,
to the PIN you want in production.

The site lands at `https://<owner>.github.io/<repo>/`. You can also redeploy from the Actions
tab without pushing, which is the safe way to pick up a PIN change on the morning of the event.

Any static host works — Netlify, Cloudflare Pages, S3, or a USB stick. Only the `out/`
directory matters.

---

## Creating and resetting an event

`/control` → **Setup** → **Event lifecycle**. Destructive actions require typing `RESET`.

| Action | Effect |
| --- | --- |
| **New demo event** | Wipes everything and reloads the 25 sample findings. Use for rehearsal. |
| **New live event** | Wipes everything and starts empty. **Use this before the real session.** |
| **Seed empty finding templates** | Gives every room its five blank cards so facilitators can start typing straight away. |
| **Submit all breakouts** | Publishes everything currently written. Handy mid-rehearsal. |
| **Reset the auction** | Clears all transactions and returns to Round 0, **keeping every finding**. Use this between the rehearsal auction and the real one. |
| **Clear all findings** | Removes findings and transactions but keeps panelists, objectives and settings. |

These act on **everyone**, including a breakout room mid-sentence. That is why they need the
typed confirmation.

**Two event slots.** The URL takes `?event=` — `main` (the default) and anything else you
like, e.g. `?event=rehearsal`. They are completely separate events in the same database, so
you can rehearse without touching the live one. Everyone must be on the same slot; the
default is `main`, so in practice nobody has to think about it.

The demo findings are **illustrative placeholders**, not verified research. They are written
to be realistic in shape so the exercise can be rehearsed; replace them with what the
breakouts actually produce. A **DEMO DATA** badge shows on `/display` and `/control` whenever
a seeded event is loaded, so it cannot be mistaken for the real thing on the projector.

---

## Running the event

### Before the session

1. Complete the Firebase setup above and confirm the **Sync** card says *Connected*.
2. `/control` → **Setup**: event title, real **panelist names**, starting budget (default 100),
   the five **objectives** and their moderator prompts, and a **PIN per breakout room**.
3. **Event lifecycle** → **New live event**, then **Seed empty finding templates**.
4. Print the landing page (`/`) or the individual QR codes for the table cards.
5. Open `/display` on the projector and press **F** for fullscreen.

### During the breakouts

Set the big screen to **Findings Board**. Start the countdown from the control bar if you want
it visible in the rooms.

The **Breakouts** tab is your live view of all five rooms at once: submission status, how many
findings each has written, and a green **N ONLINE** badge showing how many devices actually
have that room's page open. If a room shows *Not started* and *0 online*, they have not found
the link — that is the single most useful thing on the screen during this phase.

From here you can also fix a typo, submit on a room's behalf, or **reopen** a submitted room.
Facilitators cannot reopen their own room once submitted; that is deliberately your call.

### During the auction

Switch the big screen to **Live Auction**. On the **Auction** tab:

1. The **objective** is pre-selected from the current round.
2. Filter and click the **finding** the room just bid on.
3. Click the winning **panelist** — each button shows their remaining credits.
4. Type the **winning bid**. Validation updates as you type.
5. **AWARD FINDING** → confirm the summary sentence → done.

Every screen updates within a few hundred milliseconds. "Advance to the next round after
awarding" is on by default; turn it off if several panelists buy within one round.

**UNDO LAST TRANSACTION** is at the top of the **Ledger** tab. Mis-hearing a bid in a loud
room is the likeliest failure mode of the exercise, so undo is one click plus a confirm, and
it fully restores the budget and returns the finding to the pool. Any earlier transaction can
also be edited in place or deleted.

### Closing

Switch to **Final Portfolios**. This mode is **two screens**, and a *Show summary cuts →*
button appears next to the mode buttons to flip between them:

1. **The roster** — every panelist's five slots with source breakout, finding type and price,
   plus total spent, credits remaining, and their breakout spread.
2. **The summary cuts** — findings submitted and acquired, credits committed, average price,
   then highest-valued findings, most-represented breakouts, and what went undrafted.

They are separate screens rather than one split view because four portfolios plus three
summary panels cannot both stay legible from the back of a room at 16:9. No winner is declared
unless you enable it in Setup.

Export from the toolbar on `/control`: **Findings CSV**, **Ledger CSV**, **Portfolios CSV**,
and a **Printable summary** page (browser → Print → Save as PDF). All three CSVs are generated
in the browser, so they work with no server.

---

## How facilitators submit findings

Each room opens `/breakout/<slug>` and enters its PIN. The five cards are pre-created, one per
finding type — Momentum, Fragility, Bottleneck, Underappreciated Opportunity, Wildcard.

Each takes a headline, what changed, evidence (one point per line), why it matters, confidence,
and an optional dissenting view. **Everything saves automatically when you leave a field** —
there is no save button to forget. The ↑/↓ buttons set the group's 1–5 ranking, and **Preview
on board** shows the cards exactly as they will project.

Several people can work in the same room's page at once on different devices — each field
saves independently. Nothing reaches the main board until the room clicks **Submit findings**
and confirms. After that, corrections go through the operator.

---

## Auction rules

Enforced inside the database transaction; previewed live in the operator's form. One
implementation (`src/lib/derive.ts`) runs in both places, so the warning shown is exactly the
rule applied.

Hard rules, never overridable:

- A panelist cannot spend more credits than they hold.
- A panelist cannot buy more than one finding for the same objective.
- A finding cannot be sold twice.
- Bids must be whole numbers, at or above the minimum bid.

Advisory by default:

- **Budget reserve.** Before each award the app computes the credits a panelist must keep to
  fill their remaining slots at the minimum bid. A bid that breaks that shows a warning but is
  allowed — a moderator may legitimately let someone go all-in. Setup → *Block bids that break
  the budget reserve* promotes it to a hard rule.

Minimum bid defaults to 1 credit and is configurable in Setup.

---

## Security posture — read this once

Be clear-eyed about what the PINs do. This is a **static site with a public database**. The
PINs stop an attendee wandering into the wrong room's form or idly opening the control screen.
They are **not** a security boundary: anyone determined can read them out of the database or
bypass the check in devtools, and `database.rules.json` as shipped allows any reader to write.

That is an accepted trade for this event. The content is a policy exercise projected on a wall
for the whole room to read, it exists for one afternoon, and the alternative — real
authentication — adds failure modes on the day for no benefit anyone in the room would notice.

If that trade is ever wrong for your use, the shape to change is in `database.rules.json`:
add Firebase Anonymous Auth and scope writes to `auth != null`, then key any private data by
uid segment so a `".write": "auth.uid === $uid"` rule can be added without touching the app.

What the shipped rules *do* give you: writes are confined to the `neis` node, so this app
cannot damage anything else in the same Firebase project, and nothing outside `neis` is
readable.

---

## Testing

```bash
npm test
```

11 unit tests over the rule engine: budget arithmetic, double-sale and double-slot rejection,
minimum bid, the reserve rule in both modes, undo restoring state exactly, editing a
transaction excluding itself from its own checks, and a full four-panelist five-round auction
reconciling to correct totals. These are pure and need no network.

```bash
node --import ./tests/ts-resolver.mjs tests/e2e.mjs <databaseURL>
```

42 checks against live Firebase: event round-trip, keyed-not-array storage, seeding all five
rooms, **five rooms writing simultaneously with nothing lost**, submit and reopen, twenty
awards across five rounds, rule enforcement against live data, undo, and resetting the auction
while keeping findings. Cleans up after itself.

---

## Operational notes

- The connection indicator on every screen reads **Live** on Firebase, **Local only** in
  red when this browser is not syncing, and **No event** before one is created.
- `/display` shortcuts: **1** Findings Board, **2** Live Auction, **3** Final Portfolios,
  **F** fullscreen. These are a local override in case the operator's machine drops off the
  network; the badge in the header says so, and the next change from `/control` takes back over.
- Realtime Database has an export button in the console. Taking a JSON export between the
  breakout session and the auction is a complete backup and takes about ten seconds.
- Add `?local=1` to any URL to force local mode — useful for demoing without touching the live
  event.
- Colour is never the only signal. Every finding type shows its glyph and full name, and
  confidence shows both bars and text.
