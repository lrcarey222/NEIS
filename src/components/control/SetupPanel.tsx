"use client";

import { useEffect, useState } from "react";

import { Notice, cx } from "@/components/primitives";
import {
  clearFindings,
  createNewEvent,
  createObjective,
  createPanelist,
  deleteObjective,
  deletePanelist,
  patchBreakout,
  patchEvent,
  patchObjective,
  patchPanelist,
  rebuildBreakoutCards,
  reorderObjectives,
  resetAuction,
  seedBlankFindings,
  setFraming,
  submitAllBreakouts,
  type Result,
} from "@/lib/actions";
import {
  blankCardPlan,
  lexicon,
  sortedBreakouts,
  sortedObjectives,
  sortedPanelists,
} from "@/lib/derive";
import { adminPin } from "@/lib/localAuth";
import { currentMode } from "@/lib/net";
import type { EventState, Framing } from "@/lib/types";

/** Pre-event configuration, plus the reset/demo tools used for rehearsal. */
export function SetupPanel({ state }: { state: EventState }) {
  const [error, setError] = useState<string | null>(null);
  const notify: Notify = (result) =>
    setError(result.ok ? null : (result.error ?? "Something went wrong."));

  return (
    <section className="space-y-4">
      {error ? <Notice tone="error">{error}</Notice> : null}

      <ConnectionCard />
      <FormatSettings state={state} notify={notify} />
      <EventSettings state={state} notify={notify} />
      <PanelistSettings state={state} notify={notify} />
      <ObjectiveSettings state={state} notify={notify} />
      <BreakoutSettings state={state} notify={notify} />
      <DangerZone state={state} notify={notify} />
    </section>
  );
}

type Notify = (result: Result) => void;

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

/**
 * Says plainly whether this browser is actually syncing. The single most
 * expensive mistake available on the day is running the whole breakout session
 * in local-only mode and discovering at the auction that no findings arrived.
 */
function ConnectionCard() {
  const [mode, setMode] = useState<string>("local");
  useEffect(() => setMode(currentMode()), []);

  return (
    <Card title="Sync" hint="Where this event is stored.">
      {mode === "firebase" ? (
        <Notice tone="success">
          Connected to Firebase. Breakout rooms on other devices see the same event.
        </Notice>
      ) : (
        <Notice tone="error">
          <strong>Local only.</strong> Firebase is not configured (or the URL has{" "}
          <code>?local=1</code>), so this event lives in this browser and nothing is shared.
          Paste your project values into <code>src/lib/firebase-config.ts</code>, publish{" "}
          <code>database.rules.json</code> in the Firebase console, and redeploy.
        </Notice>
      )}
    </Card>
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

/**
 * The shape of the whole exercise: what the rooms write, and what the panel
 * builds. First card after Sync because everything below it — the objectives,
 * the seeded cards, the auction rounds — reads differently depending on it.
 */
function FormatSettings({ state, notify }: { state: EventState; notify: Notify }) {
  const { breakoutFraming, auctionFraming } = state.event;
  const auctionLocked = state.transactions.length > 0;
  const objectives = sortedObjectives(state);

  // Cards seeded under the other framing carry the wrong roster: five typed
  // findings where the room now needs one card per objective, or vice versa.
  // Detected by asking whether each room's cards cover the roster this framing
  // would seed, exactly once each.
  const roster = blankCardPlan(state).map((entry) =>
    breakoutFraming === "objectives" ? entry.objectiveId : entry.type,
  );
  const mismatched = sortedBreakouts(state).filter((breakout) => {
    const mine = state.findings.filter((f) => f.breakoutId === breakout.id);
    if (mine.length === 0) return false;
    if (mine.length !== roster.length) return true;
    const covered = new Set(
      mine.map((f) => (breakoutFraming === "objectives" ? f.objectiveId : f.type)),
    );
    return roster.some((key) => !covered.has(key));
  });

  return (
    <Card
      title="Session format"
      hint="Whether this session runs on Strategic Findings or Strategic Objectives. Set it before the rooms start writing."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <FramingChoice
          legend="Breakout sessions produce"
          value={breakoutFraming}
          options={[
            {
              value: "findings",
              label: "Strategic Findings",
              hint: "Five cards per room, one of each type — Momentum, Fragility, Bottleneck, Underappreciated Opportunity, Wildcard — with what changed and the evidence.",
            },
            {
              value: "objectives",
              label: "Strategic Objectives",
              hint: `One card per objective (${objectives.length || "none set"}), each recording the risks and the opportunities that room sees against it.`,
            },
          ]}
          onChange={(value) =>
            void setFraming(state, { breakoutFraming: value }).then(notify)
          }
        />

        <FramingChoice
          legend="The panel bids to fill a team of"
          value={auctionFraming}
          disabled={auctionLocked}
          disabledHint="Locked — the auction has started and every recorded award points at a slot in this format. Reset the auction to change it."
          options={[
            {
              value: "objectives",
              label: "Strategic Objectives",
              hint: `One slot per objective (${objectives.length || "none set"}). Each round contests one objective, in the order set below.`,
            },
            {
              value: "findings",
              label: "Strategic Findings",
              hint: "One slot per finding type. Each round contests one type, in the fixed order Momentum → Fragility → Bottleneck → Opportunity → Wildcard.",
            },
          ]}
          onChange={(value) =>
            void setFraming(state, { auctionFraming: value }).then(notify)
          }
        />
      </div>

      {breakoutFraming === "objectives" && objectives.length === 0 ? (
        <div className="mt-4">
          <Notice tone="error">
            There are no strategic objectives yet, so there is nothing for the rooms to
            write against. Add them below first.
          </Notice>
        </div>
      ) : null}

      {mismatched.length > 0 ? (
        <div className="mt-4">
          <Notice tone="warn">
            {mismatched.length} breakout{mismatched.length === 1 ? "" : "s"} still hold
            cards from a different format ({mismatched.map((b) => b.shortName).join(", ")}).
            Use <strong>Rebuild breakout cards</strong> in Event lifecycle below.
          </Notice>
        </div>
      ) : null}

      <p className="text-paper-faint mt-4 text-xs leading-relaxed">
        The two are independent. Matching them is the usual choice — rooms write by
        objective, panelists collect a team of objectives — and when they match, the
        operator is warned if a card is bought for a slot it does not belong to.
      </p>
    </Card>
  );
}

function FramingChoice({
  legend,
  value,
  options,
  onChange,
  disabled = false,
  disabledHint,
}: {
  legend: string;
  value: Framing;
  options: { value: Framing; label: string; hint: string }[];
  onChange: (value: Framing) => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  // A stable name per group, so the two radio sets do not fight each other.
  const name = `framing-${legend.replace(/\W+/g, "-").toLowerCase()}`;

  return (
    <fieldset className="border-ink-500 rounded-sm border p-3">
      <legend className="label mb-0 px-1">{legend}</legend>
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cx(
              "flex items-start gap-3 rounded-sm border p-2.5 transition-colors",
              value === option.value
                ? "border-signal bg-signal/[0.07]"
                : "border-ink-500",
              disabled ? "cursor-not-allowed opacity-55" : "hover:border-paper-faint cursor-pointer",
            )}
          >
            <input
              type="radio"
              name={name}
              className="accent-signal mt-1"
              checked={value === option.value}
              disabled={disabled}
              onChange={() => onChange(option.value)}
            />
            <span className="min-w-0">
              <span className="text-paper block text-sm font-semibold">{option.label}</span>
              <span className="text-paper-mute block text-xs leading-relaxed">
                {option.hint}
              </span>
            </span>
          </label>
        ))}
      </div>
      {disabled && disabledHint ? (
        <p className="text-paper-faint mt-2 text-[0.6875rem] leading-relaxed">
          {disabledHint}
        </p>
      ) : null}
    </fieldset>
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
          onCommit={(title) => void patchEvent(state, { title }).then(notify)}
        />
        <LiveField
          label="Subtitle"
          value={state.event.subtitle}
          onCommit={(subtitle) => void patchEvent(state, { subtitle }).then(notify)}
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
            void patchEvent(state, {
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
          onCommit={(value) => void patchEvent(state, { minBid: Number(value) }).then(notify)}
        />
      </div>

      <div className="border-ink-500 mt-4 space-y-2 border-t pt-4">
        <Toggle
          label="Block bids that break the budget reserve"
          hint="Off by default — the operator sees a warning but can still record an all-in bid."
          checked={state.event.enforceBudgetReserve}
          onChange={(enforceBudgetReserve) =>
            void patchEvent(state, { enforceBudgetReserve }).then(notify)
          }
        />
        <Toggle
          label="Declare a leader on the Final Portfolios screen"
          hint="Off by default. Ranks by slots filled, then credits held back."
          checked={state.event.declareWinner}
          onChange={(declareWinner) => void patchEvent(state, { declareWinner }).then(notify)}
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
  return (
    <Card title="Panelists" hint="Each starts with the event budget unless overridden.">
      <ul className="space-y-3">
        {sortedPanelists(state).map((panelist) => (
          <li key={panelist.id} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_7rem_auto]">
            <LiveField
              label="Name"
              value={panelist.name}
              onCommit={(name) =>
                void patchPanelist(state, panelist.id, { name }).then(notify)
              }
            />
            <LiveField
              label="Affiliation (optional)"
              value={panelist.affiliation}
              onCommit={(affiliation) =>
                void patchPanelist(state, panelist.id, { affiliation }).then(notify)
              }
            />
            <LiveField
              label="Budget"
              type="number"
              value={panelist.startingBudget}
              onCommit={(value) =>
                void patchPanelist(state, panelist.id, {
                  startingBudget: Number(value),
                }).then(notify)
              }
            />
            <button
              type="button"
              className="btn btn-ghost mb-0.5"
              onClick={() => void deletePanelist(state, panelist.id).then(notify)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="btn btn-ghost mt-4"
        onClick={() => void createPanelist(state).then(notify)}
      >
        + Add panelist
      </button>
    </Card>
  );
}

function ObjectiveSettings({ state, notify }: { state: EventState; notify: Notify }) {
  const objectives = sortedObjectives(state);
  const { breakoutFraming, auctionFraming } = state.event;

  // What the objectives are *for* depends on the format, and the answer changes
  // how carefully they need writing — a prompt read aloud to open a round is a
  // different thing from a heading five rooms write risks underneath.
  const hint = [
    auctionFraming === "objectives"
      ? "The order here is the order of the auction rounds."
      : "The auction runs on finding types, so these do not set the round order.",
    breakoutFraming === "objectives"
      ? "Each breakout writes one card per objective, so the prompt is the brief they see."
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  async function move(index: number, direction: -1 | 1) {
    const ordered = [...objectives];
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    notify(await reorderObjectives(ordered.map((o) => o.id)));
  }

  return (
    <Card title="Strategic objectives" hint={hint}>
      <ul className="space-y-4">
        {objectives.map((objective, index) => (
          <li key={objective.id} className="border-ink-500 rounded-sm border p-3">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="tabular text-signal font-mono text-sm font-bold">
                {index + 1}
              </span>
              <div className="min-w-40 flex-1">
                <LiveField
                  label="Name"
                  value={objective.name}
                  onCommit={(name) => void patchObjective(objective.id, { name }).then(notify)}
                />
              </div>
              <div className="w-36">
                <LiveField
                  label="Short label"
                  value={objective.shortName}
                  onCommit={(shortName) =>
                    void patchObjective(objective.id, { shortName }).then(notify)
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
                  onClick={() => void deleteObjective(state, objective.id).then(notify)}
                  aria-label="Remove objective"
                >
                  ×
                </button>
              </div>
            </div>

            <label className="label">Moderator prompt</label>
            <PromptField
              value={objective.prompt}
              onCommit={(prompt) => void patchObjective(objective.id, { prompt }).then(notify)}
            />
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="btn btn-ghost mt-4"
        onClick={() => void createObjective(state).then(notify)}
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
    <Card
      title="Breakouts"
      hint={`Names appear as the board columns. PINs unlock each room's form; the admin PIN (${adminPin()}) opens all of them.`}
    >
      <ul className="space-y-3">
        {sortedBreakouts(state).map((breakout) => (
          <li key={breakout.id} className="grid items-end gap-3 sm:grid-cols-[1fr_9rem_6rem]">
            <LiveField
              label={`Name — /breakout/${breakout.slug}`}
              value={breakout.name}
              onCommit={(name) => void patchBreakout(state, breakout.slug, { name }).then(notify)}
            />
            <LiveField
              label="Short label"
              value={breakout.shortName}
              onCommit={(shortName) =>
                void patchBreakout(state, breakout.slug, { shortName }).then(notify)
              }
            />
            <LiveField
              label="PIN"
              value={breakout.pin}
              onCommit={(pin) => void patchBreakout(state, breakout.slug, { pin }).then(notify)}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DangerZone({ state, notify }: { state: EventState; notify: Notify }) {
  const [confirm, setConfirm] = useState("");
  const armed = confirm.toUpperCase() === "RESET";
  const words = lexicon(state);
  const perRoom = blankCardPlan(state).length;

  return (
    <Card
      title="Event lifecycle"
      hint="Rehearse freely here before the session, then create the live event."
    >
      <div className="space-y-3">
        <Action
          label={`Seed empty ${words.item} templates`}
          hint={`Gives every breakout its ${perRoom} blank card${perRoom === 1 ? "" : "s"}, one per ${
            state.event.breakoutFraming === "objectives" ? "strategic objective" : "finding type"
          }. Skips rooms that already have cards.`}
          onClick={() => void seedBlankFindings(state).then(notify)}
        />
        <Action
          label="Submit all breakouts"
          hint="Publishes everything currently written to the board — useful mid-rehearsal."
          onClick={() => void submitAllBreakouts(state).then(notify)}
        />
        <Action
          label="Reset the auction"
          hint="Clears every transaction and returns to Round 0. Keeps all cards."
          tone="danger"
          onClick={() => void resetAuction().then(notify)}
        />
      </div>

      <div className="border-fragility/30 mt-5 rounded-sm border p-3">
        <p className="text-fragility mb-2 font-mono text-[0.6875rem] font-semibold tracking-[0.12em] uppercase">
          Destructive
        </p>
        <p className="text-paper-mute mb-3 text-xs leading-relaxed">
          These replace or erase event content for <strong>everyone</strong>, including any
          breakout room currently typing. Type <strong className="text-paper">RESET</strong>{" "}
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
            disabled={!armed}
            onClick={() => void rebuildBreakoutCards(state).then(notify)}
            title="Throws away every card and re-seeds blanks matching the session format."
          >
            Rebuild breakout cards
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={!armed}
            onClick={() => void clearFindings(state).then(notify)}
          >
            Clear all {words.itemPlural}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={!armed}
            onClick={() =>
              void createNewEvent({
                demo: true,
                startingBudget: state.event.startingBudget,
              }).then(notify)
            }
          >
            New demo event (with sample findings)
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={!armed}
            onClick={() =>
              void createNewEvent({
                demo: false,
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
