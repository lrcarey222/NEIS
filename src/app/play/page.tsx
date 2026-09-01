"use client";

import { useEffect, useMemo, useState } from "react";

import { Logo } from "@/components/Logo";
import {
  ConfidenceTag,
  EvidenceBlock,
  Notice,
  RankTag,
  StatusDot,
  TypeChip,
  cx,
} from "@/components/primitives";
import { saveAudienceEntry } from "@/lib/actions";
import { findingsForBreakout, panelRoles, sortedBreakouts } from "@/lib/derive";
import { eventKey } from "@/lib/firebase-config";
import { useEvent } from "@/lib/useEvent";
import {
  FINDING_TYPES,
  FINDING_TYPE_META,
  type AudienceEntry,
  type EventState,
  type Finding,
  type FindingType,
} from "@/lib/types";

/**
 * The audience play-along, on a phone.
 *
 * Same board, same budget, same question — one entry per person, joined by QR
 * code from the auction screen. Everything here is built for a handset held at
 * arm's length in a dim room: thumb-sized steppers rather than sliders, the
 * remaining balance pinned where it cannot scroll away, and no step that
 * cannot be undone.
 *
 * Two writes reach the database in the normal case: one when someone joins, so
 * the operator can watch the room arrive, and one when they submit. Streaming
 * every keystroke from 150 handsets is what would actually break this on a
 * conference network, and half-finished allocations would skew the averages on
 * the closing screen anyway.
 */
export default function PlayPage() {
  const { state, status } = useEvent("play");
  const [entry, setEntry] = useState<AudienceEntry | null>(null);
  const [restored, setRestored] = useState(false);

  const storageKey = `neis_play_${eventKey()}`;

  // Resume where this phone left off. A dropped connection or an accidental
  // reload mid-allocation is the likeliest thing to happen to this page.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setEntry(JSON.parse(raw) as AudienceEntry);
    } catch {
      /* private browsing, or someone cleared it. Start fresh. */
    }
    setRestored(true);
  }, [storageKey]);

  function persist(next: AudienceEntry | null) {
    setEntry(next);
    try {
      if (next) localStorage.setItem(storageKey, JSON.stringify(next));
      else localStorage.removeItem(storageKey);
    } catch {
      /* the entry still reaches the database; only resume-on-reload is lost */
    }
  }

  if (status === "connecting" || !restored) {
    return <Centred>Loading…</Centred>;
  }

  if (!state) {
    return (
      <Centred>
        <p className="text-paper text-base font-semibold">Nothing to play yet</p>
        <p className="text-paper-mute mt-2 text-sm leading-relaxed">
          The session has not started. Leave this page open — it will appear on its own.
        </p>
      </Centred>
    );
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-4 py-6">
      <header className="mb-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <Logo className="text-paper h-7 w-auto" />
          <StatusDot status={status} />
        </div>
        <p className="eyebrow">Play along</p>
        <h1 className="text-paper mt-1 text-2xl leading-tight font-medium">
          {state.event.title}
        </h1>
      </header>

      <PlaySurface state={state} entry={entry} onChange={persist} />
    </main>
  );
}

function Centred({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="panel max-w-sm p-8 text-center">{children}</div>
    </main>
  );
}

/** Routes between the three states this page can be in. */
function PlaySurface({
  state,
  entry,
  onChange,
}: {
  state: EventState;
  entry: AudienceEntry | null;
  onChange: (entry: AudienceEntry | null) => void;
}) {
  const board = state.findings.filter((f) => f.submitted);

  if (!state.event.audienceOpen && !entry) {
    return (
      <Notice tone="info">
        The play-along is not open yet. Keep this page open — it will unlock when the
        moderator starts the draft.
      </Notice>
    );
  }

  if (board.length === 0) {
    return (
      <Notice tone="info">
        The breakout rooms have not published their findings yet. Keep this page open.
      </Notice>
    );
  }

  if (!entry) {
    return <JoinForm state={state} onJoined={onChange} />;
  }

  return <Allocator state={state} entry={entry} onChange={onChange} />;
}

// --- Joining ---------------------------------------------------------------

function JoinForm({
  state,
  onJoined,
}: {
  state: EventState;
  onJoined: (entry: AudienceEntry) => void;
}) {
  const roles = useMemo(() => panelRoles(state), [state]);
  const [name, setName] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = roles.find((r) => r.name === role) ?? null;
  const ready = name.trim().length > 0 && role.length > 0;

  async function join() {
    setBusy(true);
    setError(null);

    const entry: AudienceEntry = {
      id: newEntryId(),
      name: name.trim(),
      affiliation: affiliation.trim(),
      role,
      allocations: {},
      submitted: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const result = await saveAudienceEntry(entry);
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? "Could not join. Check your connection and try again.");
      return;
    }
    onJoined(entry);
  }

  return (
    <div className="space-y-5">
      <div className="panel p-4">
        <p className="text-paper-dim text-sm leading-relaxed">
          You get <strong className="text-paper">{state.event.audienceBudget} credits</strong>{" "}
          to spend across the findings on the board — the same exercise the panel is doing on
          stage. At the end we put the two side by side.
        </p>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="panel space-y-4 p-4">
        <div>
          <label className="label" htmlFor="play-name">
            Your name
          </label>
          <input
            id="play-name"
            className="field"
            value={name}
            maxLength={60}
            autoComplete="name"
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="play-affiliation">
            Organisation (optional)
          </label>
          <input
            id="play-affiliation"
            className="field"
            value={affiliation}
            maxLength={80}
            autoComplete="organization"
            onChange={(event) => setAffiliation(event.target.value)}
          />
        </div>

        <div>
          <span className="label">Which lens are you drafting through?</span>
          {roles.length === 0 ? (
            <Notice tone="warn">
              The panel&apos;s roles have not been set yet. Try again in a moment.
            </Notice>
          ) : (
            <div className="space-y-2">
              {roles.map((option) => (
                <label
                  key={option.name}
                  className={cx(
                    "flex cursor-pointer items-start gap-3 rounded-sm border p-3 transition-colors",
                    role === option.name
                      ? "border-signal bg-signal/[0.08]"
                      : "border-ink-500 hover:border-paper-faint",
                  )}
                >
                  <input
                    type="radio"
                    name="play-role"
                    className="accent-signal mt-1"
                    checked={role === option.name}
                    onChange={() => setRole(option.name)}
                  />
                  <span className="min-w-0">
                    <span className="text-paper block text-sm font-semibold">
                      {option.name}
                    </span>
                    {option.prompt ? (
                      <span className="text-paper-mute block text-xs leading-relaxed italic">
                        {option.prompt}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {chosen?.panelists.length ? (
        <p className="text-paper-faint text-xs">
          On stage, {chosen.panelists.map((p) => p.name).join(" and ")} is drafting against
          the same question.
        </p>
      ) : null}

      <button
        type="button"
        className="btn btn-primary w-full py-3 text-base"
        disabled={!ready || busy}
        onClick={() => void join()}
      >
        {busy ? "Joining…" : "Start drafting"}
      </button>
    </div>
  );
}

/** A collision here would silently merge two people's portfolios. */
function newEntryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `au-${crypto.randomUUID()}`;
  }
  return `au-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// --- Allocating ------------------------------------------------------------

function Allocator({
  state,
  entry,
  onChange,
}: {
  state: EventState;
  entry: AudienceEntry;
  onChange: (entry: AudienceEntry) => void;
}) {
  const budget = state.event.audienceBudget;
  const [allocations, setAllocations] = useState<Record<string, number>>(
    entry.allocations,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  /**
   * Twenty-five findings will not fit on a phone as a list, so they arrive
   * folded into groups.
   *
   * Both cuts are offered because they answer different questions. By session
   * is how the room heard them — five findings from the people who spent the
   * hour on that subject. By type is how you compare across the whole board:
   * every Fragility next to every other one. Neither is a subset of the other,
   * and picking for someone would be picking their reasoning for them.
   */
  const [groupBy, setGroupBy] = useState<"session" | "type">("session");

  const groups = useMemo(() => {
    const board = state.findings.filter((f) => f.submitted);

    if (groupBy === "type") {
      return FINDING_TYPES.map((type) => ({
        key: type,
        label: FINDING_TYPE_META[type].label,
        hint: FINDING_TYPE_META[type].blurb,
        accentType: type as FindingType | undefined,
        findings: board
          .filter((f) => f.type === type)
          .sort((a, b) => a.breakoutRank - b.breakoutRank),
      })).filter((group) => group.findings.length > 0);
    }

    return sortedBreakouts(state)
      .map((breakout) => ({
        key: breakout.id,
        label: breakout.name,
        hint: breakout.description,
        accentType: undefined,
        findings: findingsForBreakout(state, breakout.id).filter((f) => f.submitted),
      }))
      .filter((group) => group.findings.length > 0);
  }, [state, groupBy]);

  // One group open at a time, so the page never grows back into a long list.
  // Re-seeded whenever the cut changes, because the old key means nothing.
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  useEffect(() => {
    setOpenGroup(groups[0]?.key ?? null);
  }, [groups]);

  const spent = Object.values(allocations).reduce((sum, value) => sum + value, 0);
  const remaining = budget - spent;
  const backed = Object.values(allocations).filter((value) => value > 0).length;
  const role = panelRoles(state).find((r) => r.name === entry.role);

  /**
   * Change one finding's allocation.
   *
   * The caller gets the current value and the current balance rather than
   * closing over them, because on a phone the steppers are tapped faster than
   * React re-renders: reading `credits` from the enclosing render would make
   * three quick taps register as one.
   */
  function setCredits(
    findingId: string,
    next: (credits: number, unspent: number) => number,
  ) {
    setAllocations((current) => {
      const updated = { ...current };
      const others = Object.entries(updated)
        .filter(([id]) => id !== findingId)
        .reduce((sum, [, credits]) => sum + credits, 0);
      // Clamped here rather than validated on submit: nobody should be able to
      // build a portfolio they are then told to take apart.
      const value = next(updated[findingId] ?? 0, budget - others - (updated[findingId] ?? 0));
      const capped = Math.max(0, Math.min(Math.floor(value) || 0, budget - others));
      if (capped > 0) updated[findingId] = capped;
      else delete updated[findingId];
      return updated;
    });
  }

  async function save(submitted: boolean) {
    setBusy(true);
    setError(null);

    const next: AudienceEntry = { ...entry, allocations, submitted, updatedAt: Date.now() };
    const result = await saveAudienceEntry(next);
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? "Could not save. Check your connection and try again.");
      return;
    }
    onChange(next);
    if (submitted) window.scrollTo({ top: 0, behavior: "smooth" });
    else {
      setFlash(true);
      setTimeout(() => setFlash(false), 2500);
    }
  }

  return (
    <div className="space-y-4">
      {entry.submitted ? (
        <Notice tone="success">
          <strong>Submitted.</strong> Your portfolio is in the comparison on the big screen.
          You can still change it until the moderator closes the play-along.
        </Notice>
      ) : null}
      {flash ? <Notice tone="success">Saved.</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      {/* The balance follows the thumb down the page — it is the only number
          that matters while allocating, and it must never scroll away. */}
      <div className="bg-ink-900 sticky top-0 z-10 -mx-4 px-4 py-3">
        <div className="panel p-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="text-paper-faint font-mono text-[0.625rem] tracking-[0.12em] uppercase">
                {entry.name}
                {entry.role ? <span className="text-signal"> · {entry.role}</span> : null}
              </p>
              <p className="text-paper-mute mt-0.5 text-xs">
                {backed} finding{backed === 1 ? "" : "s"} backed
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p
                className={cx(
                  "tabular text-3xl leading-none font-bold",
                  remaining === 0 ? "text-momentum" : "text-signal",
                )}
              >
                {remaining}
              </p>
              <p className="text-paper-faint font-mono text-[0.625rem] tracking-[0.1em] uppercase">
                left of {budget}
              </p>
            </div>
          </div>
          <div className="bg-ink-600 mt-2 h-1 w-full overflow-hidden rounded-full">
            <div
              className="bg-signal h-full rounded-full transition-[width] duration-300"
              style={{ width: `${budget > 0 ? (spent / budget) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {role?.prompt ? (
        <p className="text-paper-mute px-1 text-sm leading-relaxed italic">
          &ldquo;{role.prompt}&rdquo;
        </p>
      ) : null}

      <div className="flex items-center gap-2 px-1">
        <span className="text-paper-faint font-mono text-[0.625rem] tracking-[0.12em] uppercase">
          Group by
        </span>
        {(["session", "type"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setGroupBy(option)}
            className={cx(
              "rounded-sm border px-2.5 py-1 font-mono text-[0.625rem] font-semibold tracking-[0.1em] uppercase transition-colors",
              groupBy === option
                ? "border-signal bg-signal text-ink-900"
                : "border-ink-400 text-paper-mute",
            )}
          >
            {option === "session" ? "Session" : "Finding type"}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {groups.map((group) => {
          const inGroup = group.findings.reduce(
            (sum, finding) => sum + (allocations[finding.id] ?? 0),
            0,
          );
          const isOpen = openGroup === group.key;

          return (
            <section
              key={group.key}
              data-type={group.accentType}
              className={cx("panel overflow-hidden", group.accentType && "type-bar")}
            >
              <button
                type="button"
                className="flex w-full items-center gap-3 p-3 text-left"
                onClick={() => setOpenGroup(isOpen ? null : group.key)}
                aria-expanded={isOpen}
              >
                <span className="min-w-0 flex-1">
                  <span className="text-paper block text-sm leading-snug font-semibold">
                    {group.label}
                  </span>
                  <span className="text-paper-faint mt-0.5 block font-mono text-[0.625rem] tracking-[0.1em] uppercase">
                    {group.findings.length} finding
                    {group.findings.length === 1 ? "" : "s"}
                    {inGroup > 0 ? (
                      <span className="text-signal"> · {inGroup} credits</span>
                    ) : null}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="text-paper-faint shrink-0 font-mono text-lg leading-none"
                >
                  {isOpen ? "−" : "+"}
                </span>
              </button>

              {isOpen ? (
                <div className="border-ink-500 space-y-2 border-t p-2">
                  {group.hint ? (
                    <p className="text-paper-mute px-1 pt-1 text-xs leading-relaxed">
                      {group.hint}
                    </p>
                  ) : null}
                  {group.findings.map((finding) => (
                    <AllocationRow
                      key={finding.id}
                      state={state}
                      finding={finding}
                      // Shown on each row only when the group does not already
                      // say it — otherwise every card repeats its own heading.
                      showType={groupBy === "session"}
                      showBreakout={groupBy === "type"}
                      credits={allocations[finding.id] ?? 0}
                      remaining={remaining}
                      onChange={(next) => setCredits(finding.id, next)}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <div className="border-ink-500 sticky bottom-0 -mx-4 border-t bg-[color:var(--color-ink-900)] px-4 py-3">
        <button
          type="button"
          className="btn btn-primary w-full py-3 text-base"
          disabled={busy || backed === 0}
          onClick={() => void save(true)}
        >
          {busy
            ? "Saving…"
            : entry.submitted
              ? "Update my portfolio"
              : `Submit ${spent} credits`}
        </button>
        {!entry.submitted ? (
          <button
            type="button"
            className="btn btn-ghost mt-2 w-full"
            disabled={busy}
            onClick={() => void save(false)}
          >
            Save and finish later
          </button>
        ) : null}
        {backed === 0 ? (
          <p className="text-paper-faint mt-2 text-center text-xs">
            Put credits on at least one finding to submit.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * One finding: tap the headline for the case behind it, then allocate.
 *
 * The full record sits under the headline rather than behind a link, because
 * this is the one screen where somebody is being asked to price a finding they
 * have only heard read aloud once. Everything the breakout wrote down — what
 * changed, the evidence, why it matters, the dissent — is one tap away without
 * losing your place in the list.
 *
 * Steps of 5 out of 100: fine enough to express a real ranking, coarse enough
 * that a full portfolio is a handful of taps rather than forty. The number is
 * still typeable for anyone who wants to be precise.
 */
function AllocationRow({
  state,
  finding,
  credits,
  remaining,
  showType,
  showBreakout,
  onChange,
}: {
  state: EventState;
  finding: Finding;
  credits: number;
  remaining: number;
  showType: boolean;
  showBreakout: boolean;
  /** Receives the live value and unspent balance; returns the new value. */
  onChange: (next: (credits: number, unspent: number) => number) => void;
}) {
  const STEP = 5;
  const [expanded, setExpanded] = useState(false);
  const breakout = state.breakouts.find((b) => b.id === finding.breakoutId);

  return (
    <article
      data-type={finding.type}
      className={cx(
        "type-bar panel p-3 transition-colors",
        credits > 0 && "border-signal/45",
      )}
    >
      {/* The whole heading is the target — a 12px "More" link is not something
          to ask a thumb to find in a dim room. */}
      <button
        type="button"
        className="w-full text-left"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span className="mb-2 flex items-start justify-between gap-2">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            {showType ? <TypeChip type={finding.type} /> : null}
            {showBreakout && breakout ? (
              <span className="text-paper-mute border-ink-400 rounded-sm border px-1.5 py-0.5 font-mono text-[0.5625rem] font-semibold tracking-[0.1em] uppercase">
                {breakout.shortName}
              </span>
            ) : null}
          </span>
          <span className="text-paper-faint shrink-0 font-mono text-[0.625rem] tracking-[0.1em] uppercase">
            {expanded ? "Hide −" : "Detail +"}
          </span>
        </span>

        <span className="text-paper block text-sm leading-snug font-medium">
          {finding.headline}
        </span>
      </button>

      {expanded ? (
        <div className="border-ink-500 mt-3 space-y-3 border-t pt-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <ConfidenceTag level={finding.confidence} />
            <RankTag rank={finding.breakoutRank} />
            {breakout ? (
              <span className="text-paper-faint font-mono text-[0.625em] tracking-[0.1em] uppercase">
                {breakout.name}
              </span>
            ) : null}
          </div>

          {finding.evidence ? (
            <Detail label="Evidence">
              <EvidenceBlock
                text={finding.evidence}
                className="text-paper-mute text-xs leading-relaxed"
              />
            </Detail>
          ) : null}

          {finding.whyItMatters ? (
            <Detail label="Why it matters">{finding.whyItMatters}</Detail>
          ) : null}

          {finding.dissent ? (
            <Detail label="Dissenting view">
              <p className="border-ink-400 text-paper-mute border-l-2 pl-2 text-xs leading-relaxed italic">
                {finding.dissent}
              </p>
            </Detail>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          className="btn btn-ghost h-11 w-11 shrink-0 text-lg"
          disabled={credits === 0}
          onClick={() => onChange((value) => value - STEP)}
          aria-label={`Remove ${STEP} credits from ${finding.headline}`}
        >
          −
        </button>
        <input
          className="field tabular h-11 w-20 shrink-0 text-center text-lg font-bold"
          type="number"
          inputMode="numeric"
          min={0}
          value={credits}
          aria-label={`Credits on ${finding.headline}`}
          onChange={(event) => {
            const typed = Number(event.target.value);
            onChange(() => typed);
          }}
        />
        <button
          type="button"
          className="btn btn-ghost h-11 w-11 shrink-0 text-lg"
          disabled={remaining === 0}
          onClick={() => onChange((value) => value + STEP)}
          aria-label={`Add ${STEP} credits to ${finding.headline}`}
        >
          +
        </button>
        {remaining > 0 ? (
          <button
            type="button"
            className="btn btn-ghost ml-auto shrink-0 text-xs"
            onClick={() => onChange((value, unspent) => value + unspent)}
          >
            All {remaining}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-paper-faint mb-1 font-mono text-[0.5625rem] font-semibold tracking-[0.12em] uppercase">
        {label}
      </p>
      {typeof children === "string" ? (
        <p className="text-paper-mute text-xs leading-relaxed whitespace-pre-line">
          {children}
        </p>
      ) : (
        children
      )}
    </div>
  );
}
