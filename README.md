# NEIS Strategic Findings Auction

### ▶ Live: <https://lrcarey222.github.io/NEIS/>

A live-event web app for the NEIS session at NYC Climate Week.

Five breakout groups each record five Strategic Findings **at the same time, from their own
laptops**. Every finding lands on a shared board the moment it is submitted. A panel of experts
then bids fictional investment credits for them — each panelist drafting the strongest set of
findings for the question their **role** is answering. The audience plays the same game from
their phones, and the closing screen puts the two side by side.

The bidding happens **verbally in the room** — this app captures the findings, projects the
board, and lets an operator record each result so every screen updates instantly.

Everything is set up and running. Firebase is connected, the site is deployed, and all screens
sync live across devices.

The app also **runs the day**, not just the auction: the agenda, the clock and
the projected title cards are all in here, so the run of show is on the wall
rather than in a Word document nobody in the room can see.

| Screen | URL | PIN |
| --- | --- | --- |
| **Operator control room** | [`/control/`](https://lrcarey222.github.io/NEIS/control/) | `2026` |
| **Big screen display** | [`/display/`](https://lrcarey222.github.io/NEIS/display/) — segment card, instructions, findings board, auction, portfolios, audience | none — public |
| **Breakout workspace** | [`/breakout/manufacturing/`](https://lrcarey222.github.io/NEIS/breakout/manufacturing/) · [`auto`](https://lrcarey222.github.io/NEIS/breakout/auto/) · [`clean-firm`](https://lrcarey222.github.io/NEIS/breakout/clean-firm/) · [`grid`](https://lrcarey222.github.io/NEIS/breakout/grid/) · [`ai`](https://lrcarey222.github.io/NEIS/breakout/ai/) | `1234` |
| **Audience play-along** | [`/play/`](https://lrcarey222.github.io/NEIS/play/) | none — public |
| **Run of show** | [`/agenda/`](https://lrcarey222.github.io/NEIS/agenda/) — the day on a phone, updating live | none — public |
| **Printable summary** | [`/summary/`](https://lrcarey222.github.io/NEIS/summary/) | none |
| **Landing page + QR codes** | [`/`](https://lrcarey222.github.io/NEIS/) | none |

> **Before the real session, change the admin PIN.** The repository is public, so `2026` is
> readable in the source. See [Changing the PINs](#changing-the-pins).

---

# Running the event

## 1. Before the session

**Configure the event** — `/control/` → **Setup**:

- Event title and subtitle (shown across the top of the big screen)
- The number of **rounds** — how many findings each panelist ends up holding (default 3)
- The real **panelist names**, their **roles**, and the starting budget (default 5 seats,
  100 credits each)
- Each role's **action prompt** — the question that panelist is answering, projected beside
  their picks. Typing one of the built-in role names fills its prompt in for you.
- Whether to run the **audience play-along**, and the credits each person gets
- Rename breakouts if needed, and **set a PIN per room**

The five built-in roles and the question each one is answering. Custom roles and prompts
work exactly the same way — these are only the defaults a new event arrives with.

| Role | Action prompt |
| --- | --- |
| **National Security Advisor** | Which findings most reduce exposure to coercion, disruption, or untrusted supply? |
| **Treasury Secretary** | Which findings most improve productivity, market share, and the ability to compete without indefinite protection? |
| **Governor** | Which findings most determine whether this agenda delivers visible benefits and survives a change of administration? |
| **Utility CEO** | Which findings most affect reliable, abundant, predictably priced power for households and strategic industry? |
| **National Lab Director** | Which findings most affect durable emissions reductions, deployment speed, learning, and technology diffusion? |

> **There are no strategic objectives.** A panelist may buy any finding for any reason. What
> makes a portfolio judgeable is the role it was drafted for, which is why the prompt is on
> screen next to every set of picks.

**Create the live event** — Setup → **Event lifecycle**:

1. Type `RESET` in the confirmation box
2. **New live event (empty)** — clears the rehearsal data
3. **Seed empty finding templates** — gives every room its five blank cards

**Check the run of show** — `/control/` → **Run of Show**. The default agenda is the
23 September schedule; adjust titles, speakers, durations and operator notes to match
what is actually happening. See [Running the day](#running-the-day).

**Set up the room:**

4. Print the landing page (`/`) or the individual QR codes for the table cards
5. Open `/display/` on the projector and press **F** for fullscreen
6. Set the big screen to **Instructions** while the room is being seated

## 1a. Briefing the room

The **Instructions** screen is the projected briefing: a QR code and PIN for every
breakout, the five finding types, what submitting does, and the roles the panel will draft
through. When the play-along is open it also carries the audience QR code. Leave it up while people find their tables and while the moderator explains the
exercise — it is the fastest way to fix the room that has not found its link.

It reads the live event, so renamed breakouts and edited PINs appear on it immediately, and the
QR codes carry `?event=rehearsal` through when the projector is on the rehearsal slot.

> **It projects the room PINs.** That is deliberate — everyone who can read the screen is in the
> room — but `/display/` is a public URL, so anyone with the link sees them too. See
> [Security posture](#security-posture); switch to another mode if that matters to you.
>
> The same applies to the play-along: `/play/` has no PIN at all, by design — a QR code a whole
> room scans cannot also be a gate. Anyone with the link can submit a portfolio.

## 1b. Running the day

The **bar across the top of `/control/`** is the run of show. It is above the tabs
deliberately: you will be on the Auction tab recording bids while the clock runs, and a
countdown you have to navigate away from is a countdown nobody looks at.

It reads: what is running · time remaining or overrun · **how far behind the day is** ·
what is next. Then three controls:

| Control | Effect |
| --- | --- |
| **NEXT SEGMENT** | Advances the day and **switches the projector** to that segment's screen. Confirmed, because it moves what is in front of the room. |
| **PAUSE / RESUME** | Holds the clock without corrupting the rest of the schedule. |
| **+5 MIN** | Lengthens the live segment, so the knock-on shows up in the drift figure and in the projected start times. |

> **Nothing advances by itself.** A segment that runs over keeps running and shows
> `+3:20 OVER`. Advancing is always your click — the app will never move the projector in
> front of the room on a timer.

**Drift** — "on time", "6 min behind", "4 min ahead" — is the single most useful number on
the screen. It is measured live: an overrun pushes it out minute by minute, and finishing
early pulls it back at the next advance. A pause counts as falling behind, because a
four-minute hold is four minutes the room actually spent.

### The default agenda

Every new event arrives with this. Edit it on the Run of Show tab.

| # | Start | Min | Segment | Big screen |
| --- | --- | --- | --- | --- |
| 1 | 8:30 | 15 | Welcome and Framing | Segment card |
| 2 | 8:45 | 55 | Where Do Things Stand Today | Segment card |
| 3 | 9:40 | 10 | Move to Breakout Rooms | Instructions |
| 4 | 9:50 | 75 | Breakout Sessions — seven phases | Findings board |
| 5 | 11:05 | 10 | Transition and Seating | Segment card + play-along QR |
| 6 | 11:15 | 15 | Breakout Presentations — 5 × 2:30, hard-timed | Findings board |
| 7 | 11:30 | 5 | Panel Questions | Findings board |
| 8 | 11:35 | 35 | Strategic Findings Auction | Live auction |
| 9 | 12:10 | 8 | Team Defenses | Final portfolios |
| 10 | 12:18 | 10 | Audience vs Panel and Synthesis | Audience vs panel |
| 11 | 12:28 | 2 | Close | Segment card |
| 12 | 12:30 | 60 | Lunch | Segment card |

Segment 2's speakers are seeded as Jon Larsen; Brian Deese / Charlie Anderson; Mike
Catanzaro. Segment 8 carries an operator note: *if still in round 2 at 12:00, call the final
round at 60 seconds a lot with no rationale until the defenses.*

The **Run of Show tab** is everything that is not the clock:

- **Presenter view** at the top: the operator notes for the current and next segment, at a
  size you can read from a laptop on a table. These are never projected.
- **Reorder, retime, edit and jump** to any segment out of order. Editing a duration
  recomputes the projected wall-clock starts immediately, so you can see what five more
  minutes on the opening panel does to the 12:30 lunch before you commit to it. The stored
  start time stays put until you click the arrow to apply the new one, because the printed
  agenda and the table cards still say 9:50.
- **Reset day** clears the clock and keeps the agenda.
- **Agenda strip on the big screen** toggles the band along the bottom of `/display/`.
  Turn it off during the auction if the screen feels full.

### What the room sees

The **Segment card** display mode projects the live segment: title large, description,
speakers, and a big clock. This is what fills 8:30–9:40, where the projector previously
had nothing useful to show.

A segment card can also carry the **play-along QR code** — a checkbox per segment on the
Run of Show tab, seeded on **Transition and Seating**. Those ten minutes at 11:05 are the
only stretch of the day when the whole room is standing up with a phone in its hand and
nothing to do, which makes them the best chance the audience draft gets at a crowd. The
code goes up whether or not the play-along is open yet: a phone that scans early is told
to keep the page open, and it unlocks itself when you open the draft. The panel shows how
many people are in, so you can see the room arriving from the front.

The **agenda strip** is available under every display mode — a thin band showing the day
with the current segment marked and past ones dimmed. It answers "where are we" and "when
is lunch" without a slide change.

`/agenda/` is the same thing on a phone, public and PIN-free, with its QR code on the
Instructions screen next to the breakout codes. It updates live, so it shows what is
actually happening rather than what was printed.

### The breakout phase strip

The breakout segment carries seven phases, and `/breakout/<slug>` renders them above the
cards with the current one highlighted and its remaining time. The phase at minute 35
says *"Typists: open your cards now and start typing headlines"*, and it is the largest
text in the strip.

This is the mitigation for the biggest risk in the day — a room that discusses for seventy
minutes and then finds it has five to write in.

| Minutes | Phase |
| --- | --- |
| 0–5 | Set the frame — sector boundary, candid assessment not consensus |
| 5–20 | Status update — the 5–7 most consequential changes since March 2025 |
| 20–35 | Interrogate — separate announcements from implementation and outcomes |
| 35–55 | Diagnose — **typists: open your cards now and start typing headlines** |
| 55–68 | Draft the five findings |
| 68–73 | Sharpen and rank |
| 73–75 | Presenter and submit |

### The presentation timer

Segment 6 is five breakout presentations at 2:30 each, hard-timed. When that segment is
live, a **NEXT PRESENTER** control appears on the operator bar and the display overlays
the findings board with the room's name and a large countdown — amber at 0:30, red at
0:00, then counting up, because a clock that stops at zero stops being a deadline. Five
presenters are tracked in order, so you can see three are done and two remain.

### Two things that are true of every clock in the app

**No screen writes on a tick.** The database holds one start timestamp per segment and
every screen computes remaining time locally from it. A room with eight screens open
generates zero writes a second. You can verify this in the Firebase console: watch
`runOfShow` while the clock runs and nothing changes until somebody clicks.

**Clock skew is corrected.** The projector and your laptop will not agree to the second,
so every screen reads Firebase's `/.info/serverTimeOffset` and converts before doing any
arithmetic. Two browsers on the same event show the same remaining time to within a
second.

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

Switch the big screen to **Live Auction**. The pool is **each room's top three** — fifteen cards,
grouped on screen by room pick #1, #2, #3 rather than run as one long list. See
[Auction rules](#auction-rules).

On the **Auction** tab:

1. Filter and click the **finding** the room just bid on
2. Click the winning **panelist** — each button shows their role, picks so far, and credits left
3. Type the **winning bid** — validation updates as you type
4. **AWARD FINDING** → confirm the summary sentence → done

There is no slot to choose. A team is just its picks in the order they were won, so each award
lands in that panelist's next open position by itself.

Every screen updates within a few hundred milliseconds. *Advance the round once every panelist
has picked* is on by default: nobody bids in a fixed order, so the round steps on when the board
says it is over rather than after each individual award.

**UNDO LAST TRANSACTION** is at the top of the **Ledger** tab. Mis-hearing a bid in a loud room
is the likeliest failure mode of the whole exercise, so undo is one click plus a confirm, and it
fully restores the budget and returns the finding to the pool. Any earlier transaction can also
be edited in place or deleted.

## 3a. The audience play-along

Open it from **Setup → Audience play-along** (or the **Audience** tab). A QR code then appears in
the right-hand column of the **Live Auction** screen for as long as it stays open, with a live
count of how many people have submitted.

Each person scans it, enters their name, picks one of the panel's **roles**, and spends their own
credits across the same fifteen the panel is bidding on — the same exercise, from the same brief,
at the same time.

Fifteen findings do not fit on a phone as a list, so they arrive folded into **collapsible
groups**, one open at a time. A *Group by* switch offers two cuts: **Session**, which is how the
room heard them, and **Finding type**, which puts every Fragility next to every other one.
Tapping a finding opens the breakout's full record underneath it — the evidence, why it matters,
the confidence, and any dissenting view — without losing your place in the list.

The **Audience** tab is your view of it: the code to hold up if a table cannot find it, the
counts, the room-versus-panel table in reading order, and the roster if you need to remove a
duplicate or a test entry.

> **Two writes per phone, not two hundred.** An entry reaches the database when someone joins and
> again when they submit — not on every tap. That is what keeps 150 handsets on a conference
> network from swamping the projector.

## 4. Closing

Switch to **Final Portfolios**. This mode is **two screens**, and a *Show summary cuts →* button
appears next to the mode buttons to flip between them:

1. **The roster** — every panelist's picks with source breakout, finding type and price, plus
   their role and its question, total spent, credits remaining, and their breakout spread
2. **The summary cuts** — findings submitted and acquired, credits committed, average price,
   then highest-valued findings, most-represented breakouts, and what went undrafted

Then switch to **Audience vs Panel** for the closing comparison: what the room paid per person
for each finding against what the panel actually paid, the findings the room rated far above the
panel (including ones nobody drafted), the ones the panel paid up for and the room did not, and
the top pick under each role.

> **Why the audience figure is an average over everyone.** It divides by every submitted
> portfolio, including the people who put nothing on that finding — which is exactly what a panel
> price is: what one participant, holding one budget, paid for one finding. Averaging over
> backers instead would let two enthusiasts outrank the whole room.

They are separate screens rather than one split view because five portfolios plus three summary
panels cannot both stay legible from the back of a room at 16:9. Three picks per panelist
instead of five leaves each portfolio card room to show more of its headlines, and the
column count follows the roster rather than being fixed. No winner is declared unless you
enable it in Setup.

Advance to **Close** and then **Lunch** on the operator bar as you go; the projector shows
each as a title card, so the room is never looking at a stale auction board.

**Export** from the toolbar on `/control/`: **Findings CSV** (carrying the audience columns too),
**Ledger CSV**, **Portfolios CSV**, **Audience CSV**, and a **Printable summary** page
(browser → Print → Save as PDF).

---

# For breakout facilitators

Open your room's link and enter the PIN from your table card. Five cards are already there, one
per finding type — Momentum, Fragility, Bottleneck, Underappreciated Opportunity, Wildcard.

Each takes a **headline**, **evidence** (one bullet per line), **why it matters** and
**confidence**, plus an optional dissenting view behind a link.

Headline, why-it-matters and confidence are marked *required*; evidence is encouraged.
None of it blocks submission — you have about thirteen minutes and being refused at the
last moment is the worst possible time to find out. Submitting confirms with a count
("5 findings — 5 headlines, 4 with evidence") so you can decide whether the missing piece
is worth the last two minutes.

**Length targets.** A counter under each field turns amber at the target and red well past
it. These are legibility limits before they are time limits — a forty-word headline does
not read from the back of the room however long there was to write it.

| Field | Target |
| --- | --- |
| Headline | ≤ 20 words, and a **conclusion** rather than a topic |
| Evidence | 2 bullets, ≤ 15 words each. A third is kept but marked *won't project* |
| Why it matters | ≤ 40 words |

Nothing is blocked. There is a hard character limit at roughly double each target, only so
a pasted paragraph cannot destroy the projected layout.

> **There is no "what changed" field.** If the headline is a real conclusion rather than a
> topic, what changed is already inside it — asking for both made every room write the
> finding twice.

- **Everything saves automatically when you leave a field.** There is no save button to forget.
- The **↑/↓** buttons set your group's 1–5 ranking. **Your top three go to the auction** — the
  workspace draws the line under #3. All five stay on the board and in the record.
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
| **Reset day** (Run of Show tab) | Clears the run-of-show clock and keeps the agenda. Use this between a rehearsal run and the real one. |
| **Clear the audience play-along** | Removes every entry. Run this between the rehearsal and the real session. |
| **Clear all findings** | Removes findings and transactions, keeps panelists and settings. |
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

## What is on the board

**Only each room's top three findings go to auction** — fifteen cards, not twenty-five. All five
are still written, presented, projected on the Strategic Findings Board and kept in the record;
the ranking decides which three the day actually bids on. The board draws the line explicitly:
the facilitator's workspace shows *below the auction line* under #3, and the findings board dims
what sits under it.

Fifteen is exactly five panelists × three picks, so a full draft empties the board. If you change
the round count or the number of seats so that seats × rounds exceeds the pool, Setup warns you —
otherwise the last panelists have nothing left to bid on. `AUCTION_RANK_LIMIT` in
`src/lib/types.ts` is the single place the three lives.

The audience play-along offers the same fifteen, so the closing panel-versus-room comparison is
over one shared pool.

**Hard rules, never overridable:**

- A panelist cannot spend more credits than they hold
- A panelist cannot hold more findings than there are rounds
- A finding cannot be sold twice
- Bids must be whole numbers, at or above the minimum bid

**Deliberately not a rule:** nothing constrains *which* findings a panelist may combine. A whole
room's three, or three Wildcards, is a legitimate portfolio. Judging it against the panelist's
role is the exercise, and the app must not pre-empt that.

**Advisory by default:**

- **Budget reserve.** Before each award the app computes the credits a panelist must keep to fill
  their remaining picks at the minimum bid. A bid that breaks that shows a warning but is
  allowed — a moderator may legitimately let someone go all-in. Setup → *Block bids that break
  the budget reserve* promotes it to a hard rule.
- **Outside the pool.** Awarding a finding ranked below the line warns rather than refuses, so a
  moderator can record a bid taken from the floor instead of the app rewriting what happened.

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

**The Run of Show tab says there is no agenda.**
That event was created before the run of show existed. **Load the default run of show** on
that tab adds it and leaves findings, panelists and the ledger untouched.

**The clock is wrong on the projector but right on the control laptop.**
That would mean `/.info/serverTimeOffset` never arrived. Check the projector's connection
badge reads **Live** — a screen in local-only mode has no server to correct against and
falls back to its own clock.

**A finding is wrong after it was sold.**
Ledger tab → **Edit** on that transaction. You can change the panelist, the price and the note in
place, or delete it entirely.

**Nobody can reach the play-along.**
Check it is **Open** on the Audience tab — a closed play-along shows a "not open yet" message
rather than the form. The QR code is built from the projector's own URL, so if the projector is
on `?event=rehearsal`, the code sends people into the rehearsal event too.

---

# Technical

## Architecture

**Next.js 15 + React 19 + TypeScript + Tailwind v4, exported as a static site, with Firebase
Realtime Database for all state.** There is no server: `npm run build` emits plain HTML and JS
into `out/`, which GitHub Pages serves. Nothing can crash mid-session because nothing is running.

```
src/lib/types.ts            Domain model
src/lib/derive.ts           Pure selectors + every auction rule
src/lib/schedule.ts         Pure run-of-show timing: remaining, drift, phases
src/lib/seed.ts             Event scaffolding + the 25 demo findings + the agenda
src/lib/firebase-config.ts  Firebase project values
src/lib/net.ts              Transport: Firebase adapter | local fallback
src/lib/serialize.ts        EventState (arrays) ⇄ RTDB (keyed objects)
src/lib/actions.ts          Every mutation
src/lib/localAuth.ts        PIN → role, in the browser
src/lib/useEvent.ts         The hook every screen reads from, plus the shared clock
tests/                      Rule + schedule tests, and a live end-to-end walkthrough
```

The pages are `/control`, `/display`, `/breakout/<slug>`, `/summary`, `/play` — the audience
page, public and PIN-free, one entry per phone under `audience/<id>` — and `/agenda`, the
public run of show.

Four decisions carry most of the weight:

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

**No clock writes on a tick.** The run of show stores one start timestamp per segment;
`schedule.ts` is pure and takes `now` as a parameter, so every screen computes remaining
time, overrun and drift locally from that one stamp. Eight screens in a room produce zero
writes a second. The same property is what makes the timing model unit-testable against a
fake clock, and the end-to-end test asserts the `runOfShow` node is byte-identical after
several seconds of a running clock.

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
with `EINVAL: readlink`. Point the build somewhere unsynced:

```bash
NEXT_DIST_DIR=../../../../neis-build npm run build
```

On Windows PowerShell: `$env:NEXT_DIST_DIR="../../../../neis-build"; npm run build`.

The path must be **relative** — Next joins it onto the project root, so an absolute path fails at
the export step. And note that with `output: export` the finished site lands **inside that
directory**, not in `./out`, so serve it from there:

```bash
cd ../../../../neis-build && python -m http.server 3200
```

Stop anything already serving the output before rebuilding, or it fails with `EBUSY`. CI does not
set this variable and is unaffected.

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

55 unit tests, pure and with no network.

`tests/rules.test.mjs` covers the rule engine and the audience arithmetic: budget maths,
double-sale and full-team rejection, minimum bid, the reserve rule in both modes, undo
restoring state exactly, editing a transaction excluding itself from its own checks, both a
five-round and a 3-round/5-panelist draft reconciling to correct totals, the role roster,
audience averages dividing by everyone rather than by backers, the room-versus-panel gap,
the demo findings sitting inside their own length targets, the `whatChanged` → `whyItMatters`
migration losing nothing and being idempotent, and a schema 1 event still loading.

`tests/schedule.test.mjs` covers the timing model, every test driving a fake clock:
remaining time from a fixed start, pause and resume accumulating across two pauses,
overruns going negative rather than clamping, drift against planned cumulative start,
advancing stamping the start and switching the display mode, advancing past the last
segment being a no-op, the clock-skew offset applied consistently across three devices with
three wrong clocks, the seven breakout phases, the presentation sub-timer, projected
wall-clock starts, and an event with no `runOfShow` at all still loading.

```bash
node --import ./tests/ts-resolver.mjs tests/e2e.mjs https://neis-climate-week-default-rtdb.firebaseio.com
```

Checks against live Firebase: event round-trip, keyed-not-array storage, seeding all five rooms,
**five rooms writing simultaneously with nothing lost**, submit and reopen, fifteen awards across
three rounds, rule enforcement against live data, undo, **forty phones submitting a play-along
portfolio at once with nothing lost**, advancing through three segments with every screen's
derived state agreeing (including three devices with three wrong clocks reading the same
remaining time), **no write happening while the clock runs**, and resetting the auction while
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
  **4** Audience vs Panel, **5** Instructions, **6** Segment card, **F** fullscreen. These are a
  local override in case the operator's machine drops off the network; the badge in the header
  says so, and the next change from `/control/` takes back over. Advancing a segment also
  changes the mode — the keys and the buttons then override it without moving the schedule.
- Colour is never the only signal. Every finding type shows its glyph and full name, and
  confidence shows both bars and text.
