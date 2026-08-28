"use client";

import { useEffect, useState } from "react";

import { Notice, cx } from "@/components/primitives";
import {
  clearAudience,
  clearFindings,
  createNewEvent,
  createPanelist,
  deletePanelist,
  patchBreakout,
  patchEvent,
  patchPanelist,
  resetAuction,
  seedBlankFindings,
  setAudienceOpen,
  setRoundCount,
  submitAllBreakouts,
  type Result,
} from "@/lib/actions";
import { roundCount, sortedBreakouts, sortedPanelists } from "@/lib/derive";
import { adminPin } from "@/lib/localAuth";
import { currentMode } from "@/lib/net";
import { DEFAULT_ROLES, defaultPromptForRole, type EventState } from "@/lib/types";

/** Pre-event configuration, plus the reset/demo tools used for rehearsal. */
export function SetupPanel({ state }: { state: EventState }) {
  const [error, setError] = useState<string | null>(null);
  const notify: Notify = (result) =>
    setError(result.ok ? null : (result.error ?? "Something went wrong."));

  return (
    <section className="space-y-4">
      {error ? <Notice tone="error">{error}</Notice> : null}

      <ConnectionCard />
      <EventSettings state={state} notify={notify} />
      <PanelistSettings state={state} notify={notify} />
      <AudienceSettings state={state} notify={notify} />
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
  placeholder,
  list,
}: {
  label: string;
  value: string | number;
  onCommit: (value: string) => void;
  type?: string;
  disabled?: boolean;
  hint?: string;
  placeholder?: string;
  /** id of a <datalist>, for a typed field with suggestions. */
  list?: string;
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
        placeholder={placeholder}
        list={list}
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
  const rounds = roundCount(state);

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
        <LiveField
          label="Rounds"
          type="number"
          value={rounds}
          hint={`Each panelist ends up holding ${rounds} finding${rounds === 1 ? "" : "s"}. They may pick any finding, for any reason — their role is the brief, not a rule.`}
          onCommit={(value) => void setRoundCount(state, Number(value)).then(notify)}
        />
        <div className="self-end">
          <p className="label">Panelists</p>
          <p className="text-paper tabular text-2xl leading-none font-bold">
            {state.panelists.length}
          </p>
          <p className="text-paper-faint mt-1 text-[0.6875rem]">
            Add or remove seats below.
          </p>
        </div>
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
          hint="Off by default. Ranks by findings held, then credits held back."
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

/**
 * The panel, and the lens each seat drafts through.
 *
 * Role and prompt are both free text — the panel is whoever turns up — but
 * typing a role that matches one of the defaults fills in its question, so the
 * common case is one field and a tab.
 */
function PanelistSettings({ state, notify }: { state: EventState; notify: Notify }) {
  const panelists = sortedPanelists(state);
  const missingPrompt = panelists.filter((p) => p.role.trim() && !p.rolePrompt.trim());

  /** Commits the role, and its default question when there is nothing there. */
  async function commitRole(id: string, role: string) {
    const panelist = state.panelists.find((p) => p.id === id);
    const suggested = defaultPromptForRole(role);
    const fillPrompt = suggested && !panelist?.rolePrompt.trim();
    notify(
      await patchPanelist(state, id, {
        role,
        ...(fillPrompt ? { rolePrompt: suggested } : {}),
      }),
    );
  }

  return (
    <Card
      title="Panelists"
      hint="Each starts with the event budget unless overridden. The role is the question they are answering, and the big screen projects it beside their picks."
    >
      {/* Suggestions rather than a fixed list: the field stays typed. */}
      <datalist id="role-suggestions">
        {DEFAULT_ROLES.map((role) => (
          <option key={role.name} value={role.name} />
        ))}
      </datalist>

      <ul className="space-y-5">
        {panelists.map((panelist) => (
          <li key={panelist.id} className="border-ink-500 rounded-sm border p-3">
            <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_9rem_6rem_auto]">
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
                label="Role"
                value={panelist.role}
                list="role-suggestions"
                placeholder="Investor"
                onCommit={(role) => void commitRole(panelist.id, role)}
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
            </div>

            <div className="mt-3">
              <LiveField
                label="Action prompt — the question this role is answering"
                value={panelist.rolePrompt}
                placeholder={
                  defaultPromptForRole(panelist.role) ??
                  "What is this panelist trying to build with the findings they pick?"
                }
                onCommit={(rolePrompt) =>
                  void patchPanelist(state, panelist.id, { rolePrompt }).then(notify)
                }
              />
            </div>
          </li>
        ))}
      </ul>

      {missingPrompt.length > 0 ? (
        <div className="mt-4">
          <Notice tone="warn">
            {missingPrompt.map((p) => p.name).join(", ")} — role set, no action prompt. The
            big screen will show the role on its own.
          </Notice>
        </div>
      ) : null}

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

/**
 * The play-along.
 *
 * Opening it puts a QR code on the auction screen; the room joins at /play,
 * picks one of the panel's roles, and allocates its own budget across the
 * board. Closing it stops new entries without touching the ones already in.
 */
function AudienceSettings({ state, notify }: { state: EventState; notify: Notify }) {
  const joined = state.audience.length;
  const submitted = state.audience.filter((entry) => entry.submitted).length;
  const roles = sortedPanelists(state).filter((p) => p.role.trim()).length;

  return (
    <Card
      title="Audience play-along"
      hint="A QR code on the auction screen lets the room draft its own portfolio. The closing screen compares what the panel paid with what the room would have."
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-6">
          <Stat label="Joined" value={joined} />
          <Stat label="Submitted" value={submitted} accent />
        </div>
        <button
          type="button"
          className={cx("btn", state.event.audienceOpen ? "btn-ghost" : "btn-primary")}
          onClick={() => void setAudienceOpen(!state.event.audienceOpen).then(notify)}
        >
          {state.event.audienceOpen ? "Close play-along" : "Open play-along"}
        </button>
      </div>

      <div className="mt-4 max-w-xs">
        <LiveField
          label="Credits per audience member"
          type="number"
          value={state.event.audienceBudget}
          hint="Match the panel budget to make the average directly comparable to a price paid."
          onCommit={(value) =>
            void patchEvent(state, { audienceBudget: Number(value) }).then(notify)
          }
        />
      </div>

      {roles === 0 ? (
        <div className="mt-4">
          <Notice tone="warn">
            No panelist has a role yet, so the audience has nothing to pick from. Set the
            roles above before opening this.
          </Notice>
        </div>
      ) : null}

      {state.event.audienceOpen ? (
        <div className="mt-4">
          <Notice tone="success">
            Open. The QR code shows on the <strong>Live Auction</strong> screen, and the
            comparison is the <strong>Audience vs Panel</strong> big-screen mode.
          </Notice>
        </div>
      ) : null}
    </Card>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="label mb-1">{label}</p>
      <p
        className={cx(
          "tabular text-2xl leading-none font-bold",
          accent ? "text-signal" : "text-paper",
        )}
      >
        {value}
      </p>
    </div>
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

  return (
    <Card
      title="Event lifecycle"
      hint="Rehearse freely here before the session, then create the live event."
    >
      <div className="space-y-3">
        <Action
          label="Seed empty finding templates"
          hint="Gives every breakout its five blank cards. Skips rooms that already have findings."
          onClick={() => void seedBlankFindings(state).then(notify)}
        />
        <Action
          label="Submit all breakouts"
          hint="Publishes everything currently written to the board — useful mid-rehearsal."
          onClick={() => void submitAllBreakouts(state).then(notify)}
        />
        <Action
          label="Reset the auction"
          hint="Clears every transaction and returns to Round 0. Keeps all findings."
          tone="danger"
          onClick={() => void resetAuction().then(notify)}
        />
        <Action
          label="Clear the audience play-along"
          hint={`Removes all ${state.audience.length} entries. Run this between the rehearsal and the real session.`}
          tone="danger"
          onClick={() => void clearAudience().then(notify)}
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
            onClick={() => void clearFindings(state).then(notify)}
          >
            Clear all findings
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={!armed}
            onClick={() =>
              void createNewEvent({
                demo: true,
                startingBudget: state.event.startingBudget,
                roundCount: roundCount(state),
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
                roundCount: roundCount(state),
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
