"use client";

import { useEffect, useState } from "react";

import { Notice, cx } from "@/components/primitives";
import { sortedBreakouts, sortedObjectives, sortedPanelists } from "@/lib/derive";
import { api } from "@/lib/useEvent";
import type { EventState } from "@/lib/types";

/** Pre-event configuration, plus the reset/demo tools used for rehearsal. */
export function SetupPanel({ state }: { state: EventState }) {
  const [error, setError] = useState<string | null>(null);
  const notify = (result: { ok: boolean; error?: string }) =>
    setError(result.ok ? null : (result.error ?? "Something went wrong."));

  return (
    <section className="space-y-4">
      {error ? <Notice tone="error">{error}</Notice> : null}

      <EventSettings state={state} notify={notify} />
      <PanelistSettings state={state} notify={notify} />
      <ObjectiveSettings state={state} notify={notify} />
      <BreakoutSettings state={state} notify={notify} />
      <DangerZone state={state} notify={notify} />
    </section>
  );
}

type Notify = (result: { ok: boolean; error?: string }) => void;

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel p-4">
      <header className="mb-4">
        <h3 className="eyebrow">{title}</h3>
        {hint ? <p className="text-paper-faint mt-1 text-xs">{hint}</p> : null}
      </header>
      {children}
    </div>
  );
}

/** Text input that commits on blur, matching the rest of the app's feel. */
function LiveField({
  label,
  value,
  onCommit,
  type = "text",
  disabled,
  hint,
}: {
  label: string;
  value: string | number;
  onCommit: (value: string) => void;
  type?: string;
  disabled?: boolean;
  hint?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  return (
    <div>
      <label className="label">{label}</label>
      <input
        className={cx("field", type === "number" && "tabular")}
        type={type}
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft !== String(value)) onCommit(draft);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      {hint ? <p className="text-paper-faint mt-1 text-[0.6875rem]">{hint}</p> : null}
    </div>
  );
}

function EventSettings({ state, notify }: { state: EventState; notify: Notify }) {
  const locked = state.transactions.length > 0;

  return (
    <Card title="Event" hint="Shown across the top of the big screen.">
      <div className="grid gap-4 sm:grid-cols-2">
        <LiveField
          label="Event title"
          value={state.event.title}
          onCommit={(title) => void api("/api/event", "PATCH", { title }).then(notify)}
        />
        <LiveField
          label="Subtitle"
          value={state.event.subtitle}
          onCommit={(subtitle) => void api("/api/event", "PATCH", { subtitle }).then(notify)}
        />
        <LiveField
          label="Starting budget (credits)"
          type="number"
          value={state.event.startingBudget}
          disabled={locked}
          hint={
            locked
              ? "Locked — the auction has started. Adjust an individual panelist below instead."
              : "Applies to every panelist."
          }
          onCommit={(value) =>
            void api("/api/event", "PATCH", {
              startingBudget: Number(value),
              applyBudgetToPanelists: true,
            }).then(notify)
          }
        />
        <LiveField
          label="Minimum bid"
          type="number"
          value={state.event.minBid}
          hint="Used for the budget-reserve warning."
          onCommit={(value) =>
            void api("/api/event", "PATCH", { minBid: Number(value) }).then(notify)
          }
        />
      </div>

      <div className="border-ink-500 mt-4 space-y-2 border-t pt-4">
        <Toggle
          label="Block bids that break the budget reserve"
          hint="Off by default — the operator sees a warning but can still record an all-in bid."
          checked={state.event.enforceBudgetReserve}
          onChange={(enforceBudgetReserve) =>
            void api("/api/event", "PATCH", { enforceBudgetReserve }).then(notify)
          }
        />
        <Toggle
          label="Declare a leader on the Final Portfolios screen"
          hint="Off by default. Ranks by slots filled, then credits held back."
          checked={state.event.declareWinner}
          onChange={(declareWinner) =>
            void api("/api/event", "PATCH", { declareWinner }).then(notify)
          }
        />
      </div>
    </Card>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-signal mt-0.5"
      />
      <span className="min-w-0">
        <span className="text-paper block text-sm">{label}</span>
        {hint ? <span className="text-paper-faint block text-xs">{hint}</span> : null}
      </span>
    </label>
  );
}

function PanelistSettings({ state, notify }: { state: EventState; notify: Notify }) {
  const panelists = sortedPanelists(state);

  return (
    <Card title="Panelists" hint="Each starts with the event budget unless overridden.">
      <ul className="space-y-3">
        {panelists.map((panelist) => (
          <li key={panelist.id} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_7rem_auto]">
            <LiveField
              label="Name"
              value={panelist.name}
              onCommit={(name) =>
                void api("/api/panelists", "PATCH", { id: panelist.id, name }).then(notify)
              }
            />
            <LiveField
              label="Affiliation (optional)"
              value={panelist.affiliation}
              onCommit={(affiliation) =>
                void api("/api/panelists", "PATCH", { id: panelist.id, affiliation }).then(notify)
              }
            />
            <LiveField
              label="Budget"
              type="number"
              value={panelist.startingBudget}
              onCommit={(value) =>
                void api("/api/panelists", "PATCH", {
                  id: panelist.id,
                  startingBudget: Number(value),
                }).then(notify)
              }
            />
            <button
              type="button"
              className="btn btn-ghost mb-0.5"
              onClick={() =>
                void api("/api/panelists", "DELETE", { id: panelist.id }).then(notify)
              }
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="btn btn-ghost mt-4"
        onClick={() => void api("/api/panelists", "POST", {}).then(notify)}
      >
        + Add panelist
      </button>
    </Card>
  );
}

function ObjectiveSettings({ state, notify }: { state: EventState; notify: Notify }) {
  const objectives = sortedObjectives(state);

  async function move(index: number, direction: -1 | 1) {
    const ordered = [...objectives];
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    notify(await api("/api/objectives", "PUT", { orderedIds: ordered.map((o) => o.id) }));
  }

  return (
    <Card title="Strategic objectives" hint="The order here is the order of the auction rounds.">
      <ul className="space-y-4">
        {objectives.map((objective, index) => (
          <li key={objective.id} className="border-ink-500 rounded-sm border p-3">
            <div className="mb-3 flex items-center gap-2">
              <span className="tabular text-signal font-mono text-sm font-bold">
                {index + 1}
              </span>
              <div className="flex-1">
                <LiveField
                  label="Name"
                  value={objective.name}
                  onCommit={(name) =>
                    void api("/api/objectives", "PATCH", { id: objective.id, name }).then(notify)
                  }
                />
              </div>
              <div className="w-36">
                <LiveField
                  label="Short label"
                  value={objective.shortName}
                  onCommit={(shortName) =>
                    void api("/api/objectives", "PATCH", { id: objective.id, shortName }).then(
                      notify,
                    )
                  }
                />
              </div>
              <div className="mb-0.5 flex gap-1">
                <button
                  type="button"
                  className="btn btn-ghost px-2 py-1"
                  onClick={() => void move(index, -1)}
                  disabled={index === 0}
                  aria-label="Move earlier"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn-ghost px-2 py-1"
                  onClick={() => void move(index, 1)}
                  disabled={index === objectives.length - 1}
                  aria-label="Move later"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn btn-ghost px-2 py-1"
                  onClick={() =>
                    void api("/api/objectives", "DELETE", { id: objective.id }).then(notify)
                  }
                  aria-label="Remove objective"
                >
                  ×
                </button>
              </div>
            </div>

            <label className="label">Moderator prompt</label>
            <PromptField
              value={objective.prompt}
              onCommit={(prompt) =>
                void api("/api/objectives", "PATCH", { id: objective.id, prompt }).then(notify)
              }
            />
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="btn btn-ghost mt-4"
        onClick={() => void api("/api/objectives", "POST", {}).then(notify)}
      >
        + Add objective
      </button>
    </Card>
  );
}

function PromptField({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <textarea
      className="field"
      rows={2}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
    />
  );
}

function BreakoutSettings({ state, notify }: { state: EventState; notify: Notify }) {
  return (
    <Card title="Breakouts" hint="Names appear as the board columns. PINs unlock each room's form.">
      <ul className="space-y-3">
        {sortedBreakouts(state).map((breakout) => (
          <li key={breakout.id} className="grid items-end gap-3 sm:grid-cols-[1fr_9rem_6rem]">
            <LiveField
              label={`Name — /breakout/${breakout.slug}`}
              value={breakout.name}
              onCommit={(name) =>
                void api("/api/breakouts", "PATCH", { slug: breakout.slug, name }).then(notify)
              }
            />
            <LiveField
              label="Short label"
              value={breakout.shortName}
              onCommit={(shortName) =>
                void api("/api/breakouts", "PATCH", { slug: breakout.slug, shortName }).then(
                  notify,
                )
              }
            />
            <LiveField
              label="PIN"
              value={breakout.pin}
              onCommit={(pin) =>
                void api("/api/breakouts", "PATCH", { slug: breakout.slug, pin }).then(notify)
              }
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DangerZone({ state, notify }: { state: EventState; notify: Notify }) {
  const [confirm, setConfirm] = useState("");

  return (
    <Card
      title="Event lifecycle"
      hint="Rehearse freely here before the session, then create the live event."
    >
      <div className="space-y-3">
        <Action
          label="Seed empty finding templates"
          hint="Gives every breakout its five blank cards. Skips rooms that already have findings."
          onClick={() =>
            void api("/api/admin", "POST", { action: "seed_blank_findings" }).then(notify)
          }
        />
        <Action
          label="Submit all breakouts"
          hint="Publishes everything currently written to the board — useful mid-rehearsal."
          onClick={() =>
            void api("/api/admin", "POST", { action: "submit_all_breakouts" }).then(notify)
          }
        />
        <Action
          label="Reset the auction"
          hint="Clears every transaction and returns to Round 0. Keeps all findings."
          tone="danger"
          onClick={() => void api("/api/admin", "POST", { action: "reset_auction" }).then(notify)}
        />
      </div>

      <div className="border-fragility/30 mt-5 rounded-sm border p-3">
        <p className="text-fragility mb-2 font-mono text-[0.6875rem] font-semibold tracking-[0.12em] uppercase">
          Destructive
        </p>
        <p className="text-paper-mute mb-3 text-xs leading-relaxed">
          These replace or erase event content. Type <strong className="text-paper">RESET</strong>{" "}
          to enable them.
        </p>
        <input
          className="field mb-3 max-w-40"
          placeholder="RESET"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-danger"
            disabled={confirm.toUpperCase() !== "RESET"}
            onClick={() =>
              void api("/api/admin", "POST", {
                action: "clear_findings",
                confirm,
              }).then(notify)
            }
          >
            Clear all findings
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={confirm.toUpperCase() !== "RESET"}
            onClick={() =>
              void api("/api/admin", "POST", {
                action: "create_demo_event",
                confirm,
                startingBudget: state.event.startingBudget,
              }).then(notify)
            }
          >
            New demo event (with sample findings)
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={confirm.toUpperCase() !== "RESET"}
            onClick={() =>
              void api("/api/admin", "POST", {
                action: "create_live_event",
                confirm,
                title: state.event.title,
                startingBudget: state.event.startingBudget,
              }).then(notify)
            }
          >
            New live event (empty)
          </button>
        </div>
      </div>
    </Card>
  );
}

function Action({
  label,
  hint,
  onClick,
  tone = "ghost",
}: {
  label: string;
  hint: string;
  onClick: () => void;
  tone?: "ghost" | "danger";
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-paper text-sm">{label}</p>
        <p className="text-paper-faint text-xs">{hint}</p>
      </div>
      <button
        type="button"
        className={cx("btn shrink-0", tone === "danger" ? "btn-danger" : "btn-ghost")}
        onClick={onClick}
      >
        Run
      </button>
    </div>
  );
}
