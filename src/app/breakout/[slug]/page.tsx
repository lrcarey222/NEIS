"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";

import { FindingCard } from "@/components/FindingCard";
import { FindingDetail } from "@/components/FindingDetail";
import { PinGate } from "@/components/PinGate";
import { CountdownDisplay } from "@/components/Timer";
import { Notice, StatusDot, cx } from "@/components/primitives";
import { buildFindingView, findingsForBreakout, type FindingView } from "@/lib/derive";
import { api, useEvent } from "@/lib/useEvent";
import {
  CONFIDENCE_LEVELS,
  FINDING_TYPES,
  FINDING_TYPE_META,
  type Confidence,
  type Finding,
  type FindingType,
} from "@/lib/types";

/**
 * The breakout facilitator's workspace — one room, five findings.
 *
 * Optimised for a laptop on a round table with six people talking: every field
 * saves on blur, there is no "save" button to forget, and the submit action is
 * a deliberate two-step so nobody publishes half a card by hitting Enter.
 */
export default function BreakoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { state, role, status, refresh } = useEvent();
  const [detail, setDetail] = useState<FindingView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const breakout = useMemo(
    () => state?.breakouts.find((b) => b.slug === slug) ?? null,
    [state, slug],
  );

  const findings = useMemo(
    () => (state && breakout ? findingsForBreakout(state, breakout.id) : []),
    [state, breakout],
  );

  const authorised = role?.kind === "admin" || (role?.kind === "breakout" && role.slug === slug);

  const save = useCallback(
    async (payload: Record<string, unknown>) => {
      const result = await api("/api/findings", "PATCH", payload);
      if (!result.ok) setError(result.error ?? "Could not save.");
      else setError(null);
    },
    [],
  );

  if (!state) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="eyebrow animate-pulse">Loading…</p>
      </main>
    );
  }

  if (!breakout) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <div className="panel max-w-md p-8 text-center">
          <h1 className="text-paper text-lg font-semibold">Unknown breakout</h1>
          <p className="text-paper-mute mt-2 text-sm">
            No breakout is registered at <code className="text-signal">/breakout/{slug}</code>.
            Check the link on your table card.
          </p>
        </div>
      </main>
    );
  }

  if (!authorised) {
    return (
      <PinGate
        title={breakout.name}
        hint="Enter the PIN printed on your table card to open this room's workspace."
        slug={slug}
        onAuthenticated={refresh}
      />
    );
  }

  const submitted = breakout.submissionStatus === "submitted";
  const complete = findings.filter((f) => f.headline.trim().length > 0).length;

  async function setStatus(next: "drafting" | "submitted") {
    const result = await api("/api/breakouts", "PATCH", {
      slug,
      submissionStatus: next,
    });
    if (!result.ok) setError(result.error ?? "Could not update status.");
    else setError(null);
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="mb-8">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow">Breakout workspace</p>
            <h1 className="text-paper mt-1 text-2xl leading-tight font-semibold sm:text-3xl">
              {breakout.name}
            </h1>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {state.timer.visible ? <CountdownDisplay timer={state.timer} size="sm" /> : null}
            <StatusDot status={status} />
          </div>
        </div>

        <p className="text-paper-mute max-w-2xl text-sm leading-relaxed">
          {breakout.description}
        </p>

        <div className="panel mt-5 p-4">
          <p className="text-paper-dim text-sm leading-relaxed">
            Record <strong className="text-paper">five Strategic Findings</strong> covering
            developments over the last 18 months — one of each type below. Rank them 1–5 by
            how much your group thinks they matter. Everything saves automatically as you
            type; nothing reaches the main board until you submit.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <StatusPill status={breakout.submissionStatus} />
          <span className="text-paper-faint tabular font-mono text-xs tracking-[0.1em] uppercase">
            {complete} / {findings.length || 5} drafted
          </span>
          <button
            type="button"
            className="btn btn-ghost ml-auto"
            onClick={() => setShowPreview((value) => !value)}
          >
            {showPreview ? "Back to editing" : "Preview on board"}
          </button>
        </div>
      </header>

      {error ? (
        <div className="mb-6">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}

      {submitted ? (
        <div className="mb-6">
          <Notice tone="success">
            Submitted — these findings are live on the main board. Ask the operator to reopen
            the room if you need to make a correction.
          </Notice>
        </div>
      ) : null}

      {showPreview ? (
        <section>
          <p className="eyebrow mb-3">Board preview</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {findings.map((finding) => (
              <FindingCard
                key={finding.id}
                view={buildFindingView(state, finding)}
                onOpen={setDetail}
              />
            ))}
          </div>
        </section>
      ) : (
        <div className="space-y-4">
          {findings.length === 0 ? (
            <Notice tone="info">
              No finding templates yet. Ask the operator to seed this room from the control
              screen.
            </Notice>
          ) : (
            findings.map((finding, index) => (
              <FindingEditor
                key={finding.id}
                finding={finding}
                index={index}
                total={findings.length}
                disabled={submitted}
                onSave={save}
                onMove={async (direction) => {
                  const ordered = [...findings];
                  const target = index + direction;
                  if (target < 0 || target >= ordered.length) return;
                  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
                  await api("/api/findings", "PUT", {
                    breakoutSlug: slug,
                    orderedIds: ordered.map((f) => f.id),
                  });
                }}
              />
            ))
          )}
        </div>
      )}

      <footer className="border-ink-500 mt-10 flex flex-wrap items-center justify-between gap-4 border-t pt-6">
        <p className="text-paper-faint max-w-md text-xs leading-relaxed">
          {submitted
            ? "Your findings are on the board."
            : "Submitting publishes all five findings to the main screen at once."}
        </p>
        <div className="flex gap-2">
          {submitted ? (
            <p className="text-paper-mute self-center text-xs">
              Reopening is handled by the operator.
            </p>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void setStatus("drafting")}
                disabled={breakout.submissionStatus === "drafting"}
              >
                Mark as drafting
              </button>
              <SubmitButton
                disabled={complete === 0}
                onConfirm={() => void setStatus("submitted")}
                incomplete={complete < findings.length}
              />
            </>
          )}
        </div>
      </footer>

      <FindingDetail view={detail} onClose={() => setDetail(null)} />
    </main>
  );
}

// --- Submit ----------------------------------------------------------------

function SubmitButton({
  disabled,
  incomplete,
  onConfirm,
}: {
  disabled: boolean;
  incomplete: boolean;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        className="btn btn-primary"
        disabled={disabled}
        onClick={() => setConfirming(true)}
      >
        Submit findings
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <span className="text-paper-mute text-xs">
        {incomplete ? "Some findings are blank. Submit anyway?" : "Publish to the board?"}
      </span>
      <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>
        Cancel
      </button>
      <button type="button" className="btn btn-primary" onClick={onConfirm}>
        Confirm
      </button>
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    not_started: { label: "Not started", className: "border-ink-400 text-paper-mute" },
    drafting: { label: "Drafting", className: "border-signal/50 text-signal" },
    submitted: { label: "Submitted", className: "border-momentum/50 text-momentum" },
  };
  const entry = map[status] ?? map.not_started;

  return (
    <span
      className={cx(
        "rounded-sm border px-2 py-1 font-mono text-[0.6875rem] font-semibold tracking-[0.12em] uppercase",
        entry.className,
      )}
    >
      {entry.label}
    </span>
  );
}

// --- Editor ----------------------------------------------------------------

/**
 * A single finding card in edit mode.
 *
 * Local state mirrors the field being typed into, and commits on blur. Without
 * that mirror every keystroke would round-trip and the SSE echo would fight
 * the cursor; with it, two facilitators editing different cards still see each
 * other's work land.
 */
function FindingEditor({
  finding,
  index,
  total,
  disabled,
  onSave,
  onMove,
}: {
  finding: Finding;
  index: number;
  total: number;
  disabled: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  onMove: (direction: -1 | 1) => Promise<void>;
}) {
  const meta = FINDING_TYPE_META[finding.type];
  const [draft, setDraft] = useState(finding);
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState(index === 0);

  // Adopt server updates only when this card is not being edited, so a
  // teammate's change does not overwrite the sentence in progress.
  useEffect(() => {
    if (!dirty) setDraft(finding);
  }, [finding, dirty]);

  const commit = useCallback(
    async (patch: Partial<Finding>) => {
      setDirty(false);
      await onSave({ id: finding.id, ...patch });
    },
    [finding.id, onSave],
  );

  function field<K extends keyof Finding>(key: K) {
    return {
      value: draft[key] as string,
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
      ) => {
        setDirty(true);
        setDraft((current) => ({ ...current, [key]: event.target.value }));
      },
      onBlur: () => {
        if (draft[key] !== finding[key]) void commit({ [key]: draft[key] } as Partial<Finding>);
        else setDirty(false);
      },
      disabled,
    };
  }

  return (
    <section data-type={finding.type} className="type-bar panel overflow-hidden">
      <header className="flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={expanded}
        >
          <span className="type-text shrink-0 text-lg" aria-hidden="true">
            {meta.glyph}
          </span>
          <span className="min-w-0 flex-1">
            <span className="type-text block font-mono text-[0.6875rem] font-semibold tracking-[0.12em] uppercase">
              {meta.label}
            </span>
            <span className="text-paper mt-0.5 block truncate text-sm font-medium">
              {draft.headline || (
                <span className="text-paper-faint italic">{meta.blurb}</span>
              )}
            </span>
          </span>
          <span className="text-paper-faint shrink-0 font-mono text-xs">
            {expanded ? "−" : "+"}
          </span>
        </button>

        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            className="btn btn-ghost px-2 py-1 text-xs"
            onClick={() => void onMove(-1)}
            disabled={disabled || index === 0}
            aria-label="Move up in ranking"
            title="Move up in ranking"
          >
            ↑
          </button>
          <button
            type="button"
            className="btn btn-ghost px-2 py-1 text-xs"
            onClick={() => void onMove(1)}
            disabled={disabled || index === total - 1}
            aria-label="Move down in ranking"
            title="Move down in ranking"
          >
            ↓
          </button>
          <span className="tabular text-paper-faint self-center px-1.5 font-mono text-xs">
            #{finding.breakoutRank}
          </span>
        </div>
      </header>

      {expanded ? (
        <div className="border-ink-500 space-y-4 border-t p-4">
          <div>
            <label className="label" htmlFor={`headline-${finding.id}`}>
              Headline — a short declarative sentence
            </label>
            <input
              id={`headline-${finding.id}`}
              className="field text-base"
              placeholder={meta.blurb}
              maxLength={200}
              {...field("headline")}
            />
          </div>

          <div>
            <label className="label" htmlFor={`changed-${finding.id}`}>
              What changed? — 1–3 sentences
            </label>
            <textarea
              id={`changed-${finding.id}`}
              className="field"
              rows={3}
              {...field("whatChanged")}
            />
          </div>

          <div>
            <label className="label" htmlFor={`evidence-${finding.id}`}>
              Evidence — one point per line
            </label>
            <textarea
              id={`evidence-${finding.id}`}
              className="field font-mono text-sm"
              rows={4}
              placeholder={"• …\n• …"}
              {...field("evidence")}
            />
          </div>

          <div>
            <label className="label" htmlFor={`matters-${finding.id}`}>
              Why does it matter?
            </label>
            <textarea
              id={`matters-${finding.id}`}
              className="field"
              rows={2}
              {...field("whyItMatters")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor={`confidence-${finding.id}`}>
                Confidence
              </label>
              <select
                id={`confidence-${finding.id}`}
                className="field"
                value={draft.confidence}
                disabled={disabled}
                onChange={(event) => {
                  const confidence = event.target.value as Confidence;
                  setDraft((current) => ({ ...current, confidence }));
                  void commit({ confidence });
                }}
              >
                {CONFIDENCE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level[0].toUpperCase() + level.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor={`type-${finding.id}`}>
                Finding type
              </label>
              <select
                id={`type-${finding.id}`}
                className="field"
                value={draft.type}
                disabled={disabled}
                onChange={(event) => {
                  const type = event.target.value as FindingType;
                  setDraft((current) => ({ ...current, type }));
                  void commit({ type });
                }}
              >
                {FINDING_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {FINDING_TYPE_META[type].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <details className="group">
            <summary className="text-paper-mute hover:text-paper cursor-pointer text-xs select-none">
              Add a dissenting view (optional)
            </summary>
            <div className="mt-3">
              <textarea
                className="field"
                rows={2}
                placeholder="A minority of the group argued that…"
                {...field("dissent")}
              />
            </div>
          </details>
        </div>
      ) : null}
    </section>
  );
}
