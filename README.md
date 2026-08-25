# NEIS Strategic Findings Auction

A live-event web app for the NEIS session at NYC Climate Week.

Five breakout groups each record five Strategic Findings. Every finding lands on a shared
board. A final panel then bids fictional investment credits to acquire one finding for each
of five strategic objectives. The bidding happens **verbally in the room** — this app captures
the findings, projects the board, and lets an operator record each result so the big screen
updates instantly.

```
/                    Landing page — QR codes for each breakout room
/display             Big screen (16:9). Three modes, driven by the operator
/breakout/<slug>     Facilitator workspace, one per room. PIN protected
/control             Operator control room. Administrator PIN
/summary             Printable / save-as-PDF record of the whole session
```

---

## Quick start

Requires **Node.js 20 or newer** (developed and tested on Node 24).

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The app boots with a **demo event already loaded** — 25 sample
findings, four panelists, 100 credits each — so you can rehearse the full exercise
immediately. Default PINs are `2026` for `/control` and `1234` for every breakout room.

To rehearse the auction right now: open `/control`, enter `2026`, and start awarding findings
on the **Auction** tab with `/display` open in a second window.

### Production

```bash
npm run build
npm start
```

`npm start` serves on port 3000; set `PORT` to change it. The build also emits
`.next/standalone`, so the app can be shipped as a single Node process.

---

## Architecture, and why it is not Supabase

The brief suggested Next.js + Supabase or Firebase. This build keeps **Next.js 15, React 19,
TypeScript and Tailwind CSS v4**, but replaces the hosted database with a **single JSON file
plus Server-Sent Events**.

The event is a few dozen records — 25 findings, a handful of panelists, at most 25
transactions — with exactly one writer (the operator). At that size, a hosted database adds
failure modes without adding capability: an expired key, a paused free-tier project, or hotel
wifi that cannot reach the API all become a dead scoreboard in front of a room of senior
policymakers. The file store has no credentials to expire and no network hop, so the app runs
correctly on a laptop with the wifi switched off.

What that buys, concretely:

- **No configuration required.** Clone, `npm install`, run. Nothing to provision.
- **Real-time by push.** Every mutation fans out to all connected screens over SSE, with an
  automatic polling fallback if a proxy will not hold the stream open.
- **Atomic, crash-safe writes.** Writes are serialised through a queue and land via
  write-temp-then-rename, so a crash cannot truncate the state file.
- **A readable state file.** If something goes badly wrong on stage, `data/event.json` can be
  fixed in a text editor and the server restarted.
- **Trivial undo.** The transaction log is the only source of truth for the auction — budgets,
  availability and portfolios are all derived from it. Undo deletes one row; nothing can be
  left half-applied.

The trade-off is that the app must run as **one long-lived Node process with a writable disk**.
That rules out multi-instance serverless (plain Vercel), and it means the state file should be
on a persistent volume. Deployment options below.

### Layout

```
src/lib/types.ts       Domain model
src/lib/derive.ts      Pure selectors + every auction rule (shared server/client)
src/lib/store.ts       File persistence, write queue, in-process pub/sub
src/lib/seed.ts        Event scaffolding + the 25 demo findings
src/lib/auth.ts        PIN -> signed role cookie
src/lib/useEvent.ts    Client hook: SSE + polling fallback
src/app/api/*          Route handlers
src/components/*       UI
tests/                 Rule tests + full end-to-end walkthrough
```

`derive.ts` is pure and dependency-free, so the same `validateAward` runs in the browser to
warn the operator as they type and on the server to enforce the rule. The warning shown is
exactly the rule applied.

---

## Environment variables

Every value has a working default; the app runs with no `.env` at all. Copy `.env.example` to
`.env.local` to override.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ADMIN_PIN` | `2026` | Unlocks `/control`. **Change this before the event.** |
| `BREAKOUT_PIN` | `1234` | Default PIN for new breakouts. Per-room PINs are editable in Setup. |
| `NEIS_DATA_DIR` | `./data` | Where `event.json` and `audit.jsonl` are written. Point at a persistent volume when hosted. |
| `NEIS_PUBLIC_URL` | inferred | Base URL for the landing-page QR codes. Usually unnecessary — inferred from the request. |
| `SESSION_SECRET` | falls back to `ADMIN_PIN` | HMAC key for session cookies. |
| `NEIS_SECURE_COOKIES` | unset | Set to `1` **only** when serving over HTTPS. Leave unset on a plain-HTTP LAN or nobody can log in. |
| `PORT` | `3000` | Server port. |

---

## Deployment

**The reliable option — run it in the room.** Start the app on the operator's laptop, connect
the projector, and have facilitators join over the venue wifi at `http://<laptop-ip>:3000`.
Find the IP with `ipconfig` (Windows) or `ipconfig getifaddr en0` (macOS). No internet
required. Check beforehand that the venue network does not use client isolation — if it does,
a phone hotspot works, or use a hosted deployment.

**Hosted — any platform that runs a persistent Node process with a disk.** Render, Railway,
Fly.io, or a plain VPS:

- Build `npm run build`, start `npm start`
- Attach a persistent disk and set `NEIS_DATA_DIR` to its mount path
- Set `ADMIN_PIN` and `NEIS_SECURE_COOKIES=1`
- **Run exactly one instance.** Two instances would each hold their own copy of the state.

**Docker.** `output: "standalone"` is already enabled, so a minimal image is:

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production NEIS_DATA_DIR=/data
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
VOLUME /data
EXPOSE 3000
CMD ["node", "server.js"]
```

Plain Vercel is **not** suitable without swapping the store for a hosted database, because
serverless instances have an ephemeral filesystem and do not share an in-process event bus.

---

## Creating and resetting an event

All of this lives in `/control` → **Setup** → **Event lifecycle**. Destructive actions require
typing `RESET` first.

| Action | Effect |
| --- | --- |
| **New demo event** | Wipes everything and reloads the 25 sample findings. Use for rehearsal. |
| **New live event** | Wipes everything and starts empty. **Use this before the real session.** |
| **Seed empty finding templates** | Gives every room its five blank cards so facilitators can start typing straight away. |
| **Submit all breakouts** | Publishes everything currently written. Handy mid-rehearsal. |
| **Reset the auction** | Clears all transactions and returns to Round 0, **keeping every finding**. This is the one to use between a rehearsal auction and the real one. |
| **Clear all findings** | Removes findings and transactions but keeps panelists, objectives and settings. |

The demo findings are **illustrative placeholders**, not verified research. They are written to
be realistic in shape so the exercise can be rehearsed; replace them with what the breakouts
actually produce. A **DEMO DATA** badge shows on `/display` and `/control` whenever a seeded
event is loaded, so it cannot be mistaken for the real thing on the projector.

---

## Running the event

### Before the session

1. `/control` → **Setup**
   - Set the event title and subtitle.
   - Enter the real **panelist names** and starting budget (default 100 credits).
   - Adjust the five **objectives**, their moderator prompts, and the round order.
   - Rename breakouts if needed and **set a PIN per room**.
2. **Event lifecycle** → **New live event**, then **Seed empty finding templates**.
3. Print the landing page (`/`) or the individual QR codes for the table cards.
4. Open `/display` on the projector and press **F** for fullscreen.

### During the breakouts

Set the big screen to **Findings Board**. Start the countdown from the control bar if you want
it visible in the rooms.

The **Breakouts** tab shows each room's status — Not started / Drafting / Submitted — with the
findings written so far. From here you can fix a typo, submit on a room's behalf, or **reopen**
a submitted room. Facilitators cannot reopen their own room once submitted; that is
deliberately the operator's call.

### During the auction

Switch the big screen to **Live Auction**. On the **Auction** tab:

1. The **objective** is pre-selected from the current round.
2. Filter and click the **finding** the room just bid on.
3. Click the winning **panelist** — each button shows their remaining credits.
4. Type the **winning bid**. Validation updates as you type.
5. **AWARD FINDING** → confirm the summary sentence → done.

The board, budgets and portfolios update on every screen instantly. "Advance to the next round
after awarding" is on by default; turn it off if several panelists buy within one round.

**UNDO LAST TRANSACTION** is at the top of the **Ledger** tab. Mis-hearing a bid in a loud room
is the likeliest failure mode of the whole exercise, so undo is one click plus a confirm, and
it fully restores the budget and returns the finding to the pool. Any earlier transaction can
also be edited in place or deleted.

### Closing

Switch the big screen to **Final Portfolios**. This mode is **two screens**, and a
*Show summary cuts →* button appears next to the mode buttons to flip between them:

1. **The roster** — every panelist's five slots with source breakout, finding type and price,
   plus total spent, credits remaining, and their breakout spread.
2. **The summary cuts** — findings submitted and acquired, credits committed, average price,
   then highest-valued findings, most-represented breakouts, and what went undrafted.

They are separate screens rather than one split view because four portfolios plus three
summary panels cannot both stay legible from the back of a room at 16:9. No winner is
declared unless you enable it in Setup.

Export from the toolbar on `/control`: **Findings CSV**, **Ledger CSV**, **Portfolios CSV**,
and a **Printable summary** page (browser → Print → Save as PDF).

---

## How facilitators submit findings

Each room opens `/breakout/<slug>` and enters its PIN. The five cards are pre-created, one per
finding type — Momentum, Fragility, Bottleneck, Underappreciated Opportunity, Wildcard.

Each card takes a headline, what changed, evidence (one point per line), why it matters,
confidence, and an optional dissenting view. **Everything saves automatically on blur** — there
is no save button to forget. The ↑/↓ buttons set the group's 1–5 ranking, and **Preview on
board** shows the cards exactly as they will project.

Nothing reaches the main board until the room clicks **Submit findings** and confirms. After
that, corrections go through the operator.

---

## Auction rules

Enforced on the server; previewed live in the operator's form.

Hard rules, never overridable:

- A panelist cannot spend more credits than they hold.
- A panelist cannot buy more than one finding for the same objective.
- A finding cannot be sold twice.
- Bids must be whole numbers, at or above the minimum bid.

Advisory by default:

- **Budget reserve.** Before each award the app computes the credits a panelist must keep to
  fill their remaining slots at the minimum bid. A bid that breaks that shows a warning, but is
  allowed — a moderator may legitimately let someone go all-in. Setup → *Block bids that break
  the budget reserve* promotes it to a hard rule.

Minimum bid defaults to 1 credit and is configurable in Setup.

---

## Testing

```bash
npm test
```

11 unit tests over the rule engine: budget arithmetic, double-sale and double-slot rejection,
minimum bid, the reserve rule in both modes, undo restoring state exactly, editing a
transaction excluding itself from its own checks, and a full four-panelist five-round auction
reconciling to the correct totals.

The end-to-end script walks the entire event against a running server:

```bash
npm run build
npm start                  # in one terminal
node tests/e2e.mjs http://localhost:3000
```

It covers access control, creating a live event, a facilitator writing and submitting findings,
findings appearing on the board, operator reopen, twenty awards across five rounds, rule
enforcement over HTTP, undo and re-award, SSE push delivery, all three CSV exports, the
printable summary, and resetting the auction while keeping findings.

---

## Operational notes

- **`data/` is gitignored.** It holds the live event. Back up `data/event.json` between the
  breakout session and the auction — copying that one file is a complete snapshot.
- **`data/audit.jsonl`** records every mutation with a timestamp, for reconstructing what
  happened if there is a dispute.
- If the state file is ever unparseable, the server moves it aside as `event.json.corrupt-<ts>`
  and starts a fresh event rather than refusing to boot. The original is preserved.
- `/display` accepts keyboard shortcuts: **1** Findings Board, **2** Live Auction,
  **3** Final Portfolios, **F** fullscreen. These are a local override in case the operator's
  machine drops off the network; the badge in the header says so, and the next change from
  `/control` takes back over.
- The connection indicator on every screen reads **Live** on SSE, **Reconnecting** while it
  falls back to polling, **Offline** if it cannot reach the server at all.
- Colour is never the only signal. Every finding type shows its glyph and full name, and
  confidence shows both bars and text.
