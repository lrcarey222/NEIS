# NEIS Strategic Findings Auction

### ▶ Live: <https://lrcarey222.github.io/NEIS/>

A live-event web app for the NEIS session at NYC Climate Week.

Five breakout groups each record five Strategic Findings **at the same time, from their own
laptops**. Every finding lands on a shared board the moment it is submitted. A final panel then
bids fictional investment credits to acquire one finding for each of five strategic objectives.
The bidding happens **verbally in the room** — this app captures the findings, projects the
board, and lets an operator record each result so every screen updates instantly.

Everything is set up and running. Firebase is connected, the site is deployed, and all screens
sync live across devices.

| Screen | URL | PIN |
| --- | --- | --- |
| **Operator control room** | [`/control/`](https://lrcarey222.github.io/NEIS/control/) | `2026` |
| **Big screen display** | [`/display/`](https://lrcarey222.github.io/NEIS/display/) | none — public |
| **Breakout workspace** | [`/breakout/manufacturing/`](https://lrcarey222.github.io/NEIS/breakout/manufacturing/) · [`auto`](https://lrcarey222.github.io/NEIS/breakout/auto/) · [`clean-firm`](https://lrcarey222.github.io/NEIS/breakout/clean-firm/) · [`grid`](https://lrcarey222.github.io/NEIS/breakout/grid/) · [`ai`](https://lrcarey222.github.io/NEIS/breakout/ai/) | `1234` |
| **Printable summary** | [`/summary/`](https://lrcarey222.github.io/NEIS/summary/) | none |
| **Landing page + QR codes** | [`/`](https://lrcarey222.github.io/NEIS/) | none |

> **Before the real session, change the admin PIN.** The repository is public, so `2026` is
> readable in the source. See [Changing the PINs](#changing-the-pins).

---

# Running the event

## 1. Before the session

**Configure the event** — `/control/` → **Setup**:

- Event title and subtitle (shown across the top of the big screen)
- The real **panelist names** and starting budget (default 100 credits)
- The five **strategic objectives**, their moderator prompts, and the round order
- Rename breakouts if needed, and **set a PIN per room**

**Create the live event** — Setup → **Event lifecycle**:

1. Type `RESET` in the confirmation box
2. **New live event (empty)** — clears the rehearsal data
3. **Seed empty finding templates** — gives every room its five blank cards

**Set up the room:**

4. Print the landing page (`/`) or the individual QR codes for the table cards
5. Open `/display/` on the projector and press **F** for fullscreen

## 2. During the breakouts

Set the big screen to **Findings Board**. Start the countdown from the control bar if you want
it visible in the rooms.

The **Breakouts** tab is your live view of all five rooms at once: submission status, how many
findings each has written, and a green **N ONLINE** badge showing how many devices actually have
that room's page open.

> **If a room shows *Not started* and *0 online*, they have not found the link.** That is the
> single most useful thing on your screen during this phase — it distinguishes "still thinking"
> from "never got in".

From here you can also fix a typo, submit on a room's behalf, or **reopen** a submitted room.
Facilitators cannot reopen their own room once submitted; that is deliberately your call.

## 3. During the auction

Switch the big screen to **Live Auction**. On the **Auction** tab:

1. The **objective** is pre-selected from the current round
2. Filter and click the **finding** the room just bid on
3. Click the winning **panelist** — each button shows their remaining credits
4. Type the **winning bid** — validation updates as you type
5. **AWARD FINDING** → confirm the summary sentence → done

Every screen updates within a few hundred milliseconds. *Advance to the next round after
awarding* is on by default; turn it off if several panelists buy within one round.

**UNDO LAST TRANSACTION** is at the top of the **Ledger** tab. Mis-hearing a bid in a loud room
is the likeliest failure mode of the whole exercise, so undo is one click plus a confirm, and it
fully restores the budget and returns the finding to the pool. Any earlier transaction can also
be edited in place or deleted.

## 4. Closing

Switch to **Final Portfolios**. This mode is **two screens**, and a *Show summary cuts →* button
appears next to the mode buttons to flip between them:

1. **The roster** — every panelist's five slots with source breakout, finding type and price,
   plus total spent, credits remaining, and their breakout spread
2. **The summary cuts** — findings submitted and acquired, credits committed, average price,
   then highest-valued findings, most-represented breakouts, and what went undrafted

They are separate screens rather than one split view because four portfolios plus three summary
panels cannot both stay legible from the back of a room at 16:9. No winner is declared unless
you enable it in Setup.

**Export** from the toolbar on `/control/`: **Findings CSV**, **Ledger CSV**, **Portfolios CSV**,
and a **Printable summary** page (browser → Print → Save as PDF).

---

# For breakout facilitators

Open your room's link and enter the PIN from your table card. Five cards are already there, one
per finding type — Momentum, Fragility, Bottleneck, Underappreciated Opportunity, Wildcard.

Each takes a headline, what changed, evidence (one point per line), why it matters, confidence,
and an optional dissenting view.

- **Everything saves automatically when you leave a field.** There is no save button to forget.
- The **↑/↓** buttons set your group's 1–5 ranking.
- **Preview on board** shows the cards exactly as they will project.
- Several people can work in the same room at once on different devices — each field saves
  independently, so you will not overwrite each other.

Nothing reaches the main board until you click **Submit findings** and confirm. After that,
corrections go through the operator.

---

# Managing the event

## Event lifecycle

`/control/` → **Setup** → **Event lifecycle**. Destructive actions require typing `RESET` first,
because they act on **everyone** — including a breakout room mid-sentence.

| Action | Effect |
| --- | --- |
| **Seed empty finding templates** | Gives every room its five blank cards. Skips rooms that already have findings. |
| **Submit all breakouts** | Publishes everything currently written. Handy mid-rehearsal. |
| **Reset the auction** | Clears all transactions, returns to Round 0, **keeps every finding**. Use this between the rehearsal auction and the real one. |
| **Clear all findings** | Removes findings and transactions, keeps panelists, objectives and settings. |
| **New demo event** | Wipes everything and reloads the 25 sample findings. For rehearsal. |
| **New live event** | Wipes everything and starts empty. **Use this before the real session.** |

## Rehearsing without touching the live event

Add `?event=rehearsal` to any URL. Event slots are completely separate records in the same
database, so you can practise the full auction while the live event sits untouched at the
default `main` slot.

Everyone must be on the same slot. `main` is the default, so in practice nobody has to think
about it — just make sure the QR codes and the projector are not pointing at `?event=rehearsal`
on the day.

Add `?local=1` instead to force offline mode — useful for demoing on a plane.

## The demo findings

The 25 seeded findings are **illustrative placeholders**, not verified research. They are
written to be realistic in shape so the exercise can be rehearsed; replace them with what the
breakouts actually produce.

A **DEMO DATA** badge shows on `/display/` and `/control/` whenever a seeded event is loaded, so
it cannot be mistaken for the real thing on the projector.

## Changing the PINs

**Breakout PINs** live in the event record — edit them in `/control/` → **Setup** → Breakouts.
They take effect immediately, no redeploy.

**The admin PIN** is baked into the build. To change it:

1. **Settings → Secrets and variables → Actions → Variables → New repository variable**
2. Name it `ADMIN_PIN`, set your value
3. **Actions** tab → *Deploy to GitHub Pages* → **Run workflow**

Until you do, it is `2026` — and since the repository is public, that is readable by anyone.

## Backups

Realtime Database has an export button in the Firebase console. Taking a JSON export between the
breakout session and the auction is a complete backup and takes about ten seconds.

---

# Auction rules

Enforced inside the database transaction and previewed live in the operator's form. One
implementation (`src/lib/derive.ts`) runs in both places, so the warning shown is exactly the
rule applied.

**Hard rules, never overridable:**

- A panelist cannot spend more credits than they hold
- A panelist cannot buy more than one finding for the same objective
- A finding cannot be sold twice
- Bids must be whole numbers, at or above the minimum bid

**Advisory by default:**

- **Budget reserve.** Before each award the app computes the credits a panelist must keep to fill
  their remaining slots at the minimum bid. A bid that breaks that shows a warning but is
  allowed — a moderator may legitimately let someone go all-in. Setup → *Block bids that break
  the budget reserve* promotes it to a hard rule.

Minimum bid defaults to 1 credit and is configurable in Setup.

---

# Troubleshooting

**A screen shows a red LOCAL ONLY badge.**
That browser is not syncing — anything typed there stays local and never reaches the board. Check
the URL does not carry `?local=1`. If every screen shows it, the deployed build lost its Firebase
config; see [Firebase](#firebase).

**The site did not update after a commit.**
The deploy runs the test suite and a full typecheck, so a broken commit fails the build rather
than shipping a broken site. Check the **Actions** tab — a red run is why. This is working as
intended; fix the error and push again.

**Writes fail, or the console shows `PERMISSION_DENIED`.**
The database rules were not published, or Firebase test mode expired. Realtime Database → **Rules**
→ paste `database.rules.json` → **Publish**. The Rules tab should show the `neis` block, *not* a
default `".read": "now < ..."` timestamp rule.

**A breakout room cannot get in.**
Check the PIN in `/control/` → Setup → Breakouts. The admin PIN opens every room, so you can
always take over from the control laptop.

**A finding is wrong after it was sold.**
Ledger tab → **Edit** on that transaction. You can change panelist, objective and price in place,
or delete it entirely.

---

# Technical

## Architecture

**Next.js 15 + React 19 + TypeScript + Tailwind v4, exported as a static site, with Firebase
Realtime Database for all state.** There is no server: `npm run build` emits plain HTML and JS
into `out/`, which GitHub Pages serves. Nothing can crash mid-session because nothing is running.

```
src/lib/types.ts            Domain model
src/lib/derive.ts           Pure selectors + every auction rule
src/lib/seed.ts             Event scaffolding + the 25 demo findings
src/lib/firebase-config.ts  Firebase project values
src/lib/net.ts              Transport: Firebase adapter | local fallback
src/lib/serialize.ts        EventState (arrays) ⇄ RTDB (keyed objects)
src/lib/actions.ts          Every mutation
src/lib/localAuth.ts        PIN → role, in the browser
src/lib/useEvent.ts         The hook every screen reads from
tests/                      Rule tests + live end-to-end walkthrough
```

Three decisions carry most of the weight:

**The transaction log is the only source of truth for the auction.** A `Finding` never stores who
bought it or for how much — budgets, availability and portfolios are all derived from
`transactions`. Undo is therefore a one-row delete that cannot leave the scoreboard half-updated
in front of a room.

**Writes are as narrow as possible.** A facilitator typing a headline writes
`findings/<id>/headline`, not the whole finding and certainly not the whole event. That is what
lets five rooms — and two people at the same table — edit simultaneously without overwriting each
other. The end-to-end test fires all five rooms' writes at once and asserts nothing is lost.

**Awards go through a database transaction.** `awardFinding` re-runs the full validation *inside*
an RTDB transaction, against committed state rather than whatever this browser happened to be
rendering. Two operators clicking AWARD on the same finding cannot both succeed.

There is one adapter boundary: when the Firebase config is unfilled, or the URL carries
`?local=1`, `net()` returns a localStorage + BroadcastChannel adapter with an identical
interface. Nothing above that file knows which is active, so the app stays usable and testable
with no network at all.

## Firebase

Already configured. Project **`neis-climate-week`**, Realtime Database at
`https://neis-climate-week-default-rtdb.firebaseio.com`, rules published from
`database.rules.json`. All event state lives under the `neis` node.

The `apiKey` in `src/lib/firebase-config.ts` is **not a secret** — Firebase web API keys are
public by design and are safe to commit. Access is controlled by the database rules, not by
hiding the key.

<details>
<summary>Pointing at a different Firebase project</summary>

1. <https://console.firebase.google.com> → **Add project**. Disable Analytics when asked.
2. **Build → Realtime Database → Create Database** → pick a location → **Start in test mode**.
3. Gear icon → **Project settings** → **Your apps** → Web icon `</>` → register an app. Copy the
   `firebaseConfig` values into `src/lib/firebase-config.ts`. Make sure `databaseURL` is present —
   Firebase only includes it once a Realtime Database exists.
4. Realtime Database → **Rules** → paste `database.rules.json` → **Publish**. Test mode expires
   after 30 days and would take the event down mid-session; these rules do not expire.
5. Commit and push. Verify at `/control/` → **Setup** → the **Sync** card should read
   *Connected to Firebase*.

</details>

## Deployment

Push to `main`. The workflow in `.github/workflows/deploy.yml` runs the tests, builds the static
export, and publishes to GitHub Pages. You can also redeploy from the **Actions** tab without
pushing — the safe way to pick up a PIN change on the morning of the event.

Repo settings already in place: **Pages → Source → GitHub Actions**, and the repository is public
(GitHub Pages on a free plan requires it).

Any static host works — Netlify, Cloudflare Pages, S3, a USB stick. Only the `out/` directory
matters.

## Local development

Requires **Node.js 20 or newer** (developed and tested on Node 24).

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. It talks to the same live Firebase project, so **be careful** — use
`?event=rehearsal` or `?local=1` unless you intend to touch the real event.

<details>
<summary>Working inside OneDrive or Dropbox?</summary>

The sync client turns build artefacts into cloud placeholders mid-build and `next build` fails
with `EINVAL: readlink`. Point the build somewhere unsynced — the exported site still lands in
`./out`:

```bash
NEXT_DIST_DIR=../../../../neis-build npm run build
```

On Windows PowerShell: `$env:NEXT_DIST_DIR="../../../../neis-build"; npm run build`.
Also stop anything serving `out/` first, or the rebuild fails with `EBUSY`. CI is unaffected.

</details>

## Environment variables

Everything has a working default; the app builds and runs with no environment at all.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_ADMIN_PIN` | `2026` | Unlocks `/control/`. Set as an Actions *variable* named `ADMIN_PIN` for deploys. |
| `NEXT_PUBLIC_BASE_PATH` | empty | URL prefix. The deploy workflow sets it to `/<repo>` for GitHub Pages. Leave unset locally. |
| `NEXT_DIST_DIR` | `.next` | Build directory. Only needed inside a synced folder — see above. |

Breakout PINs are **not** environment variables — they live in the event record and are editable
in `/control/` → Setup, so you can change them on the day.

## Testing

```bash
npm test
```

11 unit tests over the rule engine: budget arithmetic, double-sale and double-slot rejection,
minimum bid, the reserve rule in both modes, undo restoring state exactly, editing a transaction
excluding itself from its own checks, and a full four-panelist five-round auction reconciling to
correct totals. Pure — no network.

```bash
node --import ./tests/ts-resolver.mjs tests/e2e.mjs https://neis-climate-week-default-rtdb.firebaseio.com
```

42 checks against live Firebase: event round-trip, keyed-not-array storage, seeding all five
rooms, **five rooms writing simultaneously with nothing lost**, submit and reopen, twenty awards
across five rounds, rule enforcement against live data, undo, and resetting the auction while
keeping findings.

It works under `neis/events/__e2e` and deletes that node when it finishes, so it is safe to run
against the event database — but run it *before* the session, not during.

## Security posture

Be clear-eyed about what the PINs do. This is a **static site with a public database**. The PINs
stop an attendee wandering into the wrong room's form or idly opening the control screen. They
are **not** a security boundary: anyone determined can read them out of the database or bypass
the check in devtools, and `database.rules.json` as shipped allows any reader to write.

That is an accepted trade for this event. The content is a policy exercise projected on a wall
for the whole room to read, it exists for one afternoon, and the alternative — real
authentication — adds failure modes on the day for no benefit anyone in the room would notice.

What the shipped rules *do* give you: writes are confined to the `neis` node, so this app cannot
damage anything else in the same Firebase project, and nothing outside `neis` is readable.

If that trade is ever wrong for your use, the shape to change is in `database.rules.json`: add
Firebase Anonymous Auth and scope writes to `auth != null`, then key any private data by uid
segment so a `".write": "auth.uid === $uid"` rule can be added without touching the app.

## Notes

- The connection indicator on every screen reads **Live** on Firebase, **Local only** in red when
  this browser is not syncing, and **No event** before one is created.
- `/display/` shortcuts: **1** Findings Board, **2** Live Auction, **3** Final Portfolios,
  **F** fullscreen. These are a local override in case the operator's machine drops off the
  network; the badge in the header says so, and the next change from `/control/` takes back over.
- Colour is never the only signal. Every finding type shows its glyph and full name, and
  confidence shows both bars and text.
