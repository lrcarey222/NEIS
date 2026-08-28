"use client";

import { useMemo, useState } from "react";

import { QrCode } from "@/components/QrCode";
import { Notice, RoleChip, cx } from "@/components/primitives";
import { deleteAudienceEntry, setAudienceOpen } from "@/lib/actions";
import { buildAudienceSummary, byId, entrySpend } from "@/lib/derive";
import { useSiteUrl } from "@/lib/useSiteUrl";
import type { EventState } from "@/lib/types";

/**
 * The operator's view of the play-along.
 *
 * Two jobs. During the draft it answers "is this working?" — a count that
 * climbs and a scannable code to hold up if a table cannot find it. At the
 * close it gives the moderator the same comparison the big screen shows, in
 * reading order, so they can narrate it without turning round.
 */
export function AudiencePanel({ state }: { state: EventState }) {
  const summary = useMemo(() => buildAudienceSummary(state), [state]);
  const findings = byId(state.findings);
  const site = useSiteUrl();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const entries = [...state.audience].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <section className="space-y-4">
      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="panel flex flex-wrap items-center gap-5 p-4">
        <QrCode url={site.link("play")} className="w-28 shrink-0 p-1.5" label="Play-along QR code" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h3 className="eyebrow">Play-along</h3>
            <span
              className={cx(
                "rounded-sm border px-1.5 py-0.5 font-mono text-[0.5625rem] font-bold tracking-[0.14em] uppercase",
                state.event.audienceOpen
                  ? "border-momentum/50 text-momentum"
                  : "border-ink-400 text-paper-mute",
              )}
            >
              {state.event.audienceOpen ? "Open" : "Closed"}
            </span>
          </div>
          <p className="text-paper-faint mt-1 font-mono text-xs break-all">
            {site.display || "…"}/play/
          </p>
          <div className="mt-3 flex gap-6">
            <Stat label="Joined" value={summary.joined} />
            <Stat label="Submitted" value={summary.submitted} accent />
            <Stat label="Credits allocated" value={summary.creditsAllocated} />
          </div>
        </div>

        <button
          type="button"
          className={cx("btn shrink-0", state.event.audienceOpen ? "btn-ghost" : "btn-primary")}
          onClick={() =>
            void setAudienceOpen(!state.event.audienceOpen).then((result) =>
              setError(result.ok ? null : (result.error ?? "Could not change that.")),
            )
          }
        >
          {state.event.audienceOpen ? "Close play-along" : "Open play-along"}
        </button>
      </div>

      {summary.submitted === 0 ? (
        <Notice tone="info">
          Nothing submitted yet. Put the big screen on <strong>Live Auction</strong> — the
          code shows in the right-hand column while the panel bids.
        </Notice>
      ) : (
        <div className="panel overflow-hidden">
          <header className="border-ink-500 flex items-baseline justify-between border-b px-4 py-3">
            <h3 className="eyebrow">Room vs panel</h3>
            <span className="text-paper-faint font-mono text-xs">
              credits per participant, out of {state.event.audienceBudget}
            </span>
          </header>
          <ul className="divide-ink-500 divide-y">
            {summary.stats
              .filter((stat) => stat.total > 0)
              .slice(0, 12)
              .map((stat) => (
                <li key={stat.finding.id} className="flex items-start gap-4 px-4 py-2.5">
                  <div
                    data-type={stat.finding.type}
                    className="type-bar min-w-0 flex-1 pl-2.5"
                  >
                    <p className="text-paper text-sm leading-snug font-medium">
                      {stat.finding.headline}
                    </p>
                    <p className="text-paper-faint mt-0.5 font-mono text-[0.625rem] tracking-[0.1em] uppercase">
                      {stat.breakout?.shortName} · {stat.backers} backer
                      {stat.backers === 1 ? "" : "s"}
                      {stat.panelist ? ` · drafted by ${stat.panelist.name}` : " · undrafted"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular text-cyan font-mono text-sm font-bold">
                      {stat.average.toFixed(1)}
                    </p>
                    <p className="text-paper-faint font-mono text-[0.5625rem] tracking-[0.1em] uppercase">
                      room
                    </p>
                  </div>
                  <div className="w-12 shrink-0 text-right">
                    <p
                      className={cx(
                        "tabular font-mono text-sm font-bold",
                        stat.panelPrice === null ? "text-paper-faint" : "text-signal",
                      )}
                    >
                      {stat.panelPrice ?? "—"}
                    </p>
                    <p className="text-paper-faint font-mono text-[0.5625rem] tracking-[0.1em] uppercase">
                      panel
                    </p>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* The roster, mostly so a duplicate or a test entry can be removed. */}
      <div className="panel overflow-hidden">
        <header className="border-ink-500 flex items-baseline justify-between border-b px-4 py-3">
          <h3 className="eyebrow">Entries</h3>
          <span className="text-paper-faint tabular font-mono text-xs">{entries.length}</span>
        </header>

        {entries.length === 0 ? (
          <p className="text-paper-faint px-4 py-8 text-center text-sm">
            Nobody has joined yet.
          </p>
        ) : (
          <ul className="divide-ink-500 divide-y">
            {entries.map((entry) => {
              const isOpen = expanded === entry.id;
              const picks = Object.entries(entry.allocations).sort(([, a], [, b]) => b - a);

              return (
                <li key={entry.id} className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setExpanded(isOpen ? null : entry.id)}
                      aria-expanded={isOpen}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-paper truncate text-sm font-medium">
                          {entry.name || "(no name)"}
                        </span>
                        <RoleChip role={entry.role} />
                        {!entry.submitted ? (
                          <span className="text-paper-faint border-ink-400 rounded-sm border px-1.5 py-0.5 font-mono text-[0.5625rem] tracking-[0.1em] uppercase">
                            drafting
                          </span>
                        ) : null}
                      </div>
                      <p className="text-paper-faint mt-0.5 font-mono text-[0.625rem] tracking-[0.1em] uppercase">
                        {entry.affiliation ? `${entry.affiliation} · ` : ""}
                        {entrySpend(entry)}/{state.event.audienceBudget} credits ·{" "}
                        {picks.length} backed
                      </p>
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost shrink-0 px-2 py-1 text-xs"
                      onClick={() =>
                        void deleteAudienceEntry(entry.id).then((result) =>
                          setError(result.ok ? null : (result.error ?? "Could not remove.")),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>

                  {isOpen ? (
                    <ul className="mt-2 space-y-1 pl-1">
                      {picks.length === 0 ? (
                        <li className="text-paper-faint text-xs">Nothing allocated yet.</li>
                      ) : (
                        picks.map(([findingId, credits]) => (
                          <li key={findingId} className="flex gap-2 text-xs">
                            <span className="tabular text-signal w-8 shrink-0 text-right font-mono font-semibold">
                              {credits}
                            </span>
                            <span className="text-paper-dim min-w-0 flex-1">
                              {findings.get(findingId)?.headline ?? "(finding removed)"}
                            </span>
                          </li>
                        ))
                      )}
                    </ul>
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
      <p className="text-paper-faint font-mono text-[0.5625rem] tracking-[0.12em] uppercase">
        {label}
      </p>
      <p
        className={cx(
          "tabular mt-0.5 text-xl leading-none font-bold",
          accent ? "text-signal" : "text-paper",
        )}
      >
        {value}
      </p>
    </div>
  );
}
