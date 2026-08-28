"use client";

import { useMemo, useState } from "react";

import { Notice, RoleChip, TypeChip, cx } from "@/components/primitives";
import {
  allPanelistViews,
  availableFindings,
  roundCount,
  roundNumbers,
  validateAward,
} from "@/lib/derive";
import { awardFinding, setRound } from "@/lib/actions";
import type { EventState } from "@/lib/types";

/**
 * The auction transaction interface — the screen the operator lives on.
 *
 * Design constraints come straight from the room: bidding ends, and the
 * operator has a few seconds to record the result before the moderator moves
 * on. So the finding list is type-to-filter, panelists are one click each, and
 * the whole thing is three inputs and a confirm.
 *
 * There is no slot to choose. A panelist's team is just their picks in the
 * order they won them, so the award lands in the next open position by
 * itself — one less decision under time pressure, and one less thing to get
 * wrong.
 *
 * Validation runs on every keystroke against the same function the database
 * transaction uses, so the operator sees a problem before committing rather
 * than as a rejection.
 */
export function AwardPanel({ state }: { state: EventState }) {
  const panelists = useMemo(() => allPanelistViews(state), [state]);
  const available = useMemo(() => availableFindings(state), [state]);
  const rounds = roundCount(state);
  const roundIndex = state.event.currentRoundIndex;

  const [findingId, setFindingId] = useState("");
  const [panelistId, setPanelistId] = useState("");
  const [price, setPrice] = useState("");
  const [filter, setFilter] = useState("");
  const [advance, setAdvance] = useState(true);

  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return available;
    return available.filter(
      (view) =>
        view.finding.headline.toLowerCase().includes(needle) ||
        view.breakout?.name.toLowerCase().includes(needle) ||
        view.finding.type.includes(needle),
    );
  }, [available, filter]);

  const selectedFinding = available.find((v) => v.finding.id === findingId) ?? null;
  const selectedPanelist = panelists.find((p) => p.panelist.id === panelistId) ?? null;

  const parsedPrice = Number.parseInt(price, 10);
  const ready = Boolean(findingId && panelistId && price.trim());

  const validation = useMemo(() => {
    if (!ready) return null;
    return validateAward(state, { findingId, panelistId, price: parsedPrice });
  }, [ready, state, findingId, panelistId, parsedPrice]);

  function reset() {
    setFindingId("");
    setPanelistId("");
    setPrice("");
    setFilter("");
    setConfirming(false);
  }

  async function award() {
    setBusy(true);
    setError(null);

    const result = await awardFinding({
      findingId,
      panelistId,
      price: parsedPrice,
      acknowledgeWarnings: true,
      advanceWhenRoundComplete: advance,
    });

    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? "Could not record the transaction.");
      setConfirming(false);
      return;
    }

    setFlash(
      `Awarded to ${selectedPanelist?.panelist.name} for ${parsedPrice} credits.`,
    );
    reset();
    setTimeout(() => setFlash(null), 4000);
  }

  // Everyone who has not yet picked in the round on screen. Shown so the
  // operator can see at a glance who the moderator is still waiting on.
  const target = roundIndex + 1;
  const outstanding =
    roundIndex < 0 ? [] : panelists.filter((view) => view.filledCount < target);

  return (
    <section className="space-y-4">
      {/* Round header */}
      <div className="panel flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <p className="eyebrow text-signal">
            {roundIndex < 0
              ? "Auction not started"
              : roundIndex >= rounds
                ? "All rounds complete"
                : `Round ${roundIndex + 1} of ${rounds}`}
          </p>
          <h2 className="text-paper mt-1 text-xl font-semibold">
            {roundIndex < 0
              ? "Standing by"
              : outstanding.length === 0
                ? "Every panelist has picked"
                : `Waiting on ${outstanding.map((v) => v.panelist.name).join(", ")}`}
          </h2>
          <p className="text-paper-mute mt-1 text-sm">
            Any panelist may take any finding. Each award fills their next open pick.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void setRound(state, "prev")}
            disabled={roundIndex < 0}
          >
            ← Prev
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void setRound(state, "next")}
            disabled={roundIndex >= rounds - 1}
          >
            Next →
          </button>
        </div>
      </div>

      {flash ? <Notice tone="success">{flash}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        {/* Finding picker */}
        <div className="panel flex min-h-0 flex-col p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <label className="label mb-0" htmlFor="finding-filter">
              Finding — {available.length} available
            </label>
          </div>
          <input
            id="finding-filter"
            className="field mb-3"
            placeholder="Type to filter by headline, breakout or type…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />

          <div className="max-h-[26rem] space-y-1.5 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <p className="text-paper-faint py-8 text-center text-sm">
                {available.length === 0
                  ? "Every submitted finding has been sold."
                  : "No findings match that filter."}
              </p>
            ) : (
              filtered.map((view) => {
                const active = view.finding.id === findingId;
                return (
                  <button
                    key={view.finding.id}
                    type="button"
                    data-type={view.finding.type}
                    onClick={() => {
                      setFindingId(active ? "" : view.finding.id);
                      setConfirming(false);
                    }}
                    className={cx(
                      "type-bar w-full rounded-sm border p-2.5 text-left transition-colors",
                      active
                        ? "border-signal bg-signal/[0.08]"
                        : "border-ink-500 hover:border-paper-faint",
                    )}
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <TypeChip type={view.finding.type} />
                      <span className="text-paper-faint font-mono text-[0.625rem] tracking-[0.1em] uppercase">
                        {view.breakout?.shortName} · rank {view.finding.breakoutRank}
                      </span>
                    </div>
                    <p className="text-paper text-sm leading-snug font-medium">
                      {view.finding.headline || "Untitled finding"}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Transaction form */}
        <div className="panel flex flex-col gap-4 p-4">
          <div>
            <span className="label">Winning panelist</span>
            <div className="space-y-1.5">
              {panelists.map((view) => {
                const active = view.panelist.id === panelistId;
                const full = view.filledCount >= rounds;

                return (
                  <button
                    key={view.panelist.id}
                    type="button"
                    onClick={() => {
                      setPanelistId(active ? "" : view.panelist.id);
                      setConfirming(false);
                    }}
                    disabled={full}
                    className={cx(
                      "flex w-full items-center justify-between gap-2 rounded-sm border px-3 py-2 text-left transition-colors",
                      active
                        ? "border-signal bg-signal/[0.08]"
                        : "border-ink-500 hover:border-paper-faint",
                      full && "cursor-not-allowed opacity-40",
                    )}
                    title={full ? `${view.panelist.name}'s team is full.` : undefined}
                  >
                    <span className="min-w-0">
                      <span className="text-paper block truncate text-sm font-medium">
                        {view.panelist.name}
                      </span>
                      <span className="text-paper-faint tabular font-mono text-[0.625rem] tracking-[0.1em] uppercase">
                        {view.panelist.role || "no role"} · {view.filledCount}/{rounds}
                      </span>
                    </span>
                    <span className="tabular text-signal shrink-0 font-mono text-sm font-bold">
                      {view.remaining}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="award-price">
              Winning bid
              {selectedPanelist ? (
                <span className="text-paper-faint ml-2 normal-case">
                  max safe {selectedPanelist.maxSafeBid}
                </span>
              ) : null}
            </label>
            <input
              id="award-price"
              className="field tabular text-2xl font-bold"
              type="number"
              inputMode="numeric"
              min={state.event.minBid}
              value={price}
              onChange={(event) => {
                setPrice(event.target.value);
                setConfirming(false);
              }}
              placeholder="0"
            />
          </div>

          {validation && validation.errors.length > 0 ? (
            <Notice tone="error">
              <ul className="space-y-1">
                {validation.errors.map((issue) => (
                  <li key={issue.code}>{issue.message}</li>
                ))}
              </ul>
            </Notice>
          ) : null}

          {validation && validation.errors.length === 0 && validation.warnings.length > 0 ? (
            <Notice tone="warn">
              <ul className="space-y-1">
                {validation.warnings.map((issue) => (
                  <li key={issue.code}>⚠ {issue.message}</li>
                ))}
              </ul>
            </Notice>
          ) : null}

          <label className="text-paper-mute flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={advance}
              onChange={(event) => setAdvance(event.target.checked)}
              className="accent-signal mt-0.5"
            />
            <span>
              Advance the round once every panelist has picked
              <span className="text-paper-faint block">
                Nobody bids in a fixed order, so the round steps on when the board says it
                is over rather than after each award.
              </span>
            </span>
          </label>

          {confirming && validation?.ok ? (
            <div className="border-signal/50 bg-signal/[0.06] space-y-3 rounded-sm border p-3">
              <p className="text-paper text-sm leading-relaxed">
                Award{" "}
                <strong className="text-signal">
                  “{selectedFinding?.finding.headline}”
                </strong>{" "}
                to <strong>{selectedPanelist?.panelist.name}</strong>
                {selectedPanelist?.panelist.role
                  ? ` (${selectedPanelist.panelist.role})`
                  : ""}{" "}
                for <strong className="tabular">{parsedPrice} credits</strong> — pick{" "}
                <strong className="tabular">
                  {(selectedPanelist?.filledCount ?? 0) + 1} of {rounds}
                </strong>
                ?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost flex-1"
                  onClick={() => setConfirming(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary flex-1"
                  onClick={() => void award()}
                  disabled={busy}
                  autoFocus
                >
                  {busy ? "Recording…" : "Confirm award"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-primary w-full py-3 text-base tracking-wide"
              disabled={!ready || !validation?.ok || busy}
              onClick={() => setConfirming(true)}
            >
              AWARD FINDING
            </button>
          )}
        </div>
      </div>

      {/* Teams so far — the operator's read on where the draft has got to. */}
      <div className="panel p-4">
        <h3 className="eyebrow mb-3">Teams</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {panelists.map((view) => (
            <div key={view.panelist.id} className="border-ink-500 rounded-sm border p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-paper truncate text-sm font-semibold">
                  {view.panelist.name}
                </span>
                <RoleChip role={view.panelist.role} />
                <span className="tabular text-signal ml-auto font-mono text-sm font-bold">
                  {view.remaining}
                </span>
              </div>
              <ol className="space-y-1">
                {roundNumbers(state).map((pick, index) => {
                  const slot = view.slots[index];
                  return (
                    <li
                      key={pick}
                      data-type={slot?.finding?.type}
                      className={cx(
                        "type-bar flex items-baseline gap-2 py-0.5 pl-2 text-xs",
                        !slot?.finding && "opacity-45",
                      )}
                    >
                      <span className="text-paper-faint tabular w-3 shrink-0 font-mono">
                        {pick}
                      </span>
                      <span className="text-paper-dim min-w-0 flex-1 truncate">
                        {slot?.finding?.headline ?? "Open"}
                      </span>
                      {slot?.transaction ? (
                        <span className="tabular text-signal shrink-0 font-mono font-semibold">
                          {slot.transaction.price}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
