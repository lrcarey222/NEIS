"use client";

import { useEffect, useMemo, useState } from "react";

import { Notice, TypeChip, cx } from "@/components/primitives";
import {
  allPanelistViews,
  availableFindings,
  currentObjective,
  sortedObjectives,
  validateAward,
} from "@/lib/derive";
import { awardFinding, setRound } from "@/lib/actions";
import type { EventState } from "@/lib/types";

/**
 * The auction transaction interface — the screen the operator lives on.
 *
 * Design constraints come straight from the room: bidding ends, and the
 * operator has a few seconds to record the result before the moderator moves
 * on. So the objective is pre-selected from the current round, the finding list
 * is type-to-filter, panelists are one click each, and the whole thing is four
 * inputs and a confirm.
 *
 * Validation runs on every keystroke against the same function the server uses,
 * so the operator sees a problem before committing rather than as a rejection.
 */
export function AwardPanel({ state }: { state: EventState }) {
  const objectives = sortedObjectives(state);
  const panelists = useMemo(() => allPanelistViews(state), [state]);
  const available = useMemo(() => availableFindings(state), [state]);
  const round = currentObjective(state);

  const [objectiveId, setObjectiveId] = useState(round?.id ?? objectives[0]?.id ?? "");
  const [findingId, setFindingId] = useState("");
  const [panelistId, setPanelistId] = useState("");
  const [price, setPrice] = useState("");
  const [filter, setFilter] = useState("");
  const [advanceRound, setAdvanceRound] = useState(true);

  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Follow the operator's own round controls so the objective is right by default.
  useEffect(() => {
    if (round?.id) setObjectiveId(round.id);
  }, [round?.id]);

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
  const selectedObjective = objectives.find((o) => o.id === objectiveId) ?? null;

  const parsedPrice = Number.parseInt(price, 10);
  const ready = Boolean(findingId && panelistId && objectiveId && price.trim());

  const validation = useMemo(() => {
    if (!ready) return null;
    return validateAward(state, {
      findingId,
      panelistId,
      objectiveId,
      price: parsedPrice,
    });
  }, [ready, state, findingId, panelistId, objectiveId, parsedPrice]);

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
      objectiveId,
      price: parsedPrice,
      acknowledgeWarnings: true,
      advanceRound,
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

  return (
    <section className="space-y-4">
      {/* Round header */}
      <div className="panel flex items-center justify-between gap-4 p-4">
        <div className="min-w-0">
          <p className="eyebrow text-signal">
            {round
              ? `Round ${state.event.currentRoundIndex + 1} of ${objectives.length}`
              : state.event.currentRoundIndex < 0
                ? "Auction not started"
                : "All rounds complete"}
          </p>
          <h2 className="text-paper mt-1 truncate text-xl font-semibold">
            {round?.name ?? "—"}
          </h2>
          {round?.prompt ? (
            <p className="text-paper-mute mt-1 line-clamp-2 text-sm">{round.prompt}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void setRound(state, "prev")}
            disabled={state.event.currentRoundIndex < 0}
          >
            ← Prev
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void setRound(state, "next")}
            disabled={state.event.currentRoundIndex >= objectives.length - 1}
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
            <label className="label" htmlFor="award-objective">
              Objective
            </label>
            <select
              id="award-objective"
              className="field"
              value={objectiveId}
              onChange={(event) => {
                setObjectiveId(event.target.value);
                setConfirming(false);
              }}
            >
              {objectives.map((objective, index) => (
                <option key={objective.id} value={objective.id}>
                  {index + 1}. {objective.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="label">Winning panelist</span>
            <div className="space-y-1.5">
              {panelists.map((view) => {
                const active = view.panelist.id === panelistId;
                const filledThis = view.slots.find(
                  (slot) => slot.objective.id === objectiveId,
                )?.transaction;

                return (
                  <button
                    key={view.panelist.id}
                    type="button"
                    onClick={() => {
                      setPanelistId(active ? "" : view.panelist.id);
                      setConfirming(false);
                    }}
                    disabled={Boolean(filledThis)}
                    className={cx(
                      "flex w-full items-center justify-between gap-2 rounded-sm border px-3 py-2 text-left transition-colors",
                      active
                        ? "border-signal bg-signal/[0.08]"
                        : "border-ink-500 hover:border-paper-faint",
                      filledThis && "cursor-not-allowed opacity-40",
                    )}
                    title={
                      filledThis
                        ? `${view.panelist.name} has already filled this objective.`
                        : undefined
                    }
                  >
                    <span className="text-paper min-w-0 truncate text-sm font-medium">
                      {view.panelist.name}
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

          <label className="text-paper-mute flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={advanceRound}
              onChange={(event) => setAdvanceRound(event.target.checked)}
              className="accent-signal"
            />
            Advance to the next round after awarding
          </label>

          {confirming && validation?.ok ? (
            <div className="border-signal/50 bg-signal/[0.06] space-y-3 rounded-sm border p-3">
              <p className="text-paper text-sm leading-relaxed">
                Award{" "}
                <strong className="text-signal">
                  “{selectedFinding?.finding.headline}”
                </strong>{" "}
                to <strong>{selectedPanelist?.panelist.name}</strong> for{" "}
                <strong className="tabular">{parsedPrice} credits</strong> under{" "}
                <strong>{selectedObjective?.name}</strong>?
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
    </section>
  );
}
