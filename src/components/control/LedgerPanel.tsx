"use client";

import { useMemo, useState } from "react";

import { Notice, cx } from "@/components/primitives";
import { byId, sortedObjectives, sortedPanelists } from "@/lib/derive";
import { patchTransaction, undoTransaction } from "@/lib/actions";
import type { EventState, Transaction } from "@/lib/types";

/**
 * The auction ledger: every award in order, with undo and in-place correction.
 *
 * UNDO LAST TRANSACTION is the single most important safety valve in the app —
 * mis-hearing a bid in a loud room is the most likely failure mode of the whole
 * exercise — so it sits at the top, is always reachable, and needs one click
 * plus one confirm.
 */
export function LedgerPanel({ state }: { state: EventState }) {
  const findings = byId(state.findings);
  const panelists = byId(state.panelists);
  const objectives = byId(state.objectives);
  const breakouts = byId(state.breakouts);

  const ordered = useMemo(
    () => [...state.transactions].sort((a, b) => b.timestamp - a.timestamp),
    [state.transactions],
  );

  const [confirmUndo, setConfirmUndo] = useState(false);
  const [rewind, setRewind] = useState(true);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const last = ordered[0] ?? null;

  async function undoLast() {
    setBusy(true);
    const result = await undoTransaction(undefined, rewind);
    setBusy(false);
    setConfirmUndo(false);
    setError(result.ok ? null : (result.error ?? "Could not undo."));
  }

  return (
    <section className="space-y-4">
      {/* Undo */}
      <div className="panel border-fragility/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow text-fragility">Undo last transaction</p>
            {last ? (
              <p className="text-paper-dim mt-1.5 truncate text-sm">
                {panelists.get(last.panelistId)?.name} ·{" "}
                <span className="tabular">{last.price} credits</span> ·{" "}
                {findings.get(last.findingId)?.headline ?? "—"}
              </p>
            ) : (
              <p className="text-paper-faint mt-1.5 text-sm">
                No transactions recorded yet.
              </p>
            )}
          </div>

          {confirmUndo ? (
            <div className="flex shrink-0 items-center gap-2">
              <label className="text-paper-mute flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={rewind}
                  onChange={(event) => setRewind(event.target.checked)}
                  className="accent-signal"
                />
                step round back
              </label>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmUndo(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void undoLast()}
                disabled={busy}
              >
                {busy ? "Undoing…" : "Confirm undo"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-danger shrink-0"
              disabled={!last}
              onClick={() => setConfirmUndo(true)}
            >
              UNDO LAST TRANSACTION
            </button>
          )}
        </div>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      {/* Ledger */}
      <div className="panel overflow-hidden">
        <header className="border-ink-500 flex items-baseline justify-between border-b px-4 py-3">
          <h3 className="eyebrow">Auction ledger</h3>
          <span className="text-paper-faint tabular font-mono text-xs">
            {ordered.length} transaction{ordered.length === 1 ? "" : "s"} ·{" "}
            {ordered.reduce((sum, t) => sum + t.price, 0)} credits
          </span>
        </header>

        {ordered.length === 0 ? (
          <p className="text-paper-faint px-4 py-10 text-center text-sm">
            Awards will appear here as you record them.
          </p>
        ) : (
          <ul className="divide-ink-500 divide-y">
            {ordered.map((transaction) => {
              const finding = findings.get(transaction.findingId);
              const isEditing = editing?.id === transaction.id;

              return (
                <li key={transaction.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-paper-faint font-mono text-[0.625rem] tracking-[0.1em] uppercase">
                        {objectives.get(transaction.objectiveId)?.name ?? "—"}
                        {" · "}
                        {finding ? breakouts.get(finding.breakoutId)?.shortName : "—"}
                      </p>
                      <p className="text-paper mt-1 text-sm leading-snug font-medium">
                        {finding?.headline ?? "(finding removed)"}
                      </p>
                      <p className="text-paper-mute mt-1 text-xs">
                        {panelists.get(transaction.panelistId)?.name ?? "—"} ·{" "}
                        <span className="tabular text-signal font-semibold">
                          {transaction.price} credits
                        </span>
                        {transaction.note ? (
                          <span className="text-paper-faint"> · {transaction.note}</span>
                        ) : null}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost shrink-0 px-2 py-1 text-xs"
                      onClick={() => setEditing(isEditing ? null : transaction)}
                    >
                      {isEditing ? "Close" : "Edit"}
                    </button>
                  </div>

                  {isEditing ? (
                    <EditTransaction
                      state={state}
                      transaction={transaction}
                      onDone={() => setEditing(null)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function EditTransaction({
  state,
  transaction,
  onDone,
}: {
  state: EventState;
  transaction: Transaction;
  onDone: () => void;
}) {
  const [panelistId, setPanelistId] = useState(transaction.panelistId);
  const [objectiveId, setObjectiveId] = useState(transaction.objectiveId);
  const [price, setPrice] = useState(String(transaction.price));
  const [note, setNote] = useState(transaction.note);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const result = await patchTransaction(
      transaction.id,
      { panelistId, objectiveId, price: Number.parseInt(price, 10), note },
      true,
    );
    setBusy(false);
    if (!result.ok) setError(result.error ?? "Could not save.");
    else onDone();
  }

  async function remove() {
    setBusy(true);
    const result = await undoTransaction(transaction.id);
    setBusy(false);
    if (!result.ok) setError(result.error ?? "Could not remove.");
    else onDone();
  }

  return (
    <div className="border-ink-500 mt-3 space-y-3 rounded-sm border p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Panelist</label>
          <select
            className="field"
            value={panelistId}
            onChange={(event) => setPanelistId(event.target.value)}
          >
            {sortedPanelists(state).map((panelist) => (
              <option key={panelist.id} value={panelist.id}>
                {panelist.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Objective</label>
          <select
            className="field"
            value={objectiveId}
            onChange={(event) => setObjectiveId(event.target.value)}
          >
            {sortedObjectives(state).map((objective) => (
              <option key={objective.id} value={objective.id}>
                {objective.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Price</label>
          <input
            className="field tabular"
            type="number"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label">Operator note (optional)</label>
        <input
          className="field"
          value={note}
          placeholder="e.g. corrected from 18"
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="flex justify-between gap-2">
        <button type="button" className="btn btn-danger" onClick={() => void remove()} disabled={busy}>
          Delete transaction
        </button>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost" onClick={onDone} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
