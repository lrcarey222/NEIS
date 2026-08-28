"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

import { cx } from "@/components/primitives";
import { auctionSlots, breakoutCategories, lexicon, sortedBreakouts } from "@/lib/derive";
import type { EventState } from "@/lib/types";

/**
 * Mode 4 — the briefing screen.
 *
 * This is what is on the projector while the room is being seated and while
 * the moderator explains the exercise: how to get into your breakout, what
 * each table is being asked to write, and what happens to it afterwards. It
 * carries the room PINs, because the failure mode this screen exists to
 * prevent is a table that never finds its link.
 *
 * Steps 2 and 4 read the session format, so the projected brief is always the
 * exercise actually being run — findings by type, or objectives with risks and
 * opportunities.
 *
 * QR codes are generated in the browser, like the landing page — there is no
 * server in a static export, and it keeps the screen working on a conference
 * network that only survived the page load.
 */
export function InstructionsMode({ state }: { state: EventState }) {
  const words = lexicon(state);
  const breakouts = useMemo(() => sortedBreakouts(state), [state]);
  const categories = useMemo(() => breakoutCategories(state), [state]);
  const slots = useMemo(() => auctionSlots(state), [state]);
  const byObjective = state.event.breakoutFraming === "objectives";
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [host, setHost] = useState("");

  const slugs = breakouts.map((b) => b.slug).join(",");

  useEffect(() => {
    // /display/ hangs off the same base path as /breakout/, so drop this page's
    // own segment rather than assuming the site is served from the domain root.
    const base = `${window.location.origin}${window.location.pathname}`
      .replace(/\/display\/?$/, "")
      .replace(/\/$/, "");
    // Carry the event slot through, so a rehearsal projector sends the rooms
    // into the rehearsal event rather than the live one.
    const slot = new URLSearchParams(window.location.search).get("event");
    const query = slot ? `?event=${encodeURIComponent(slot)}` : "";

    setHost(base.replace(/^https?:\/\//, ""));

    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      for (const slug of slugs.split(",").filter(Boolean)) {
        next[slug] = await QRCode.toString(`${base}/breakout/${slug}/${query}`, {
          type: "svg",
          margin: 0,
          color: { dark: "#05080c", light: "#f4f6f8" },
        });
      }
      if (!cancelled) setCodes(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [slugs]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-[1.75em] pb-[1.25em]">
      <div className="mb-[0.8em] flex items-end justify-between gap-[2em]">
        <div>
          <p className="eyebrow text-signal">How this session works</p>
          <h2 className="text-paper mt-[0.15em] text-[1.75em] leading-none font-semibold">
            Scan your table&apos;s code to open your breakout
          </h2>
        </div>
        <p className="text-paper-mute font-mono text-[0.6875em] tracking-[0.12em] uppercase">
          {breakouts.length} breakouts
          <span className="text-paper-faint"> · </span>
          {categories.length} {words.itemPlural} each
          <span className="text-paper-faint"> · </span>then the auction
        </p>
      </div>

      <section className="flex min-h-0 flex-1 flex-col">
        <StepHeading
          number={1}
          title="Join your breakout"
          note="Everyone at the table can be in at once — each field saves separately, so you will not overwrite each other."
        />

        <div
          className="grid flex-1 gap-[0.75em]"
          style={{
            gridTemplateColumns: `repeat(${Math.max(breakouts.length, 1)}, minmax(0, 1fr))`,
          }}
        >
          {breakouts.map((breakout) => (
            <article
              key={breakout.id}
              className="panel flex min-h-0 flex-col items-center p-[0.75em]"
            >
              {/* Sized off the card's width and centred in whatever height the
                  row has left, so the code stays square and stays the largest
                  thing on the card — it has to be scannable from a seat away. */}
              <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                <div
                  className="aspect-square w-full max-w-[14em] bg-[#f4f6f8] p-[0.35em] [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: codes[breakout.slug] ?? "" }}
                  aria-hidden="true"
                />
              </div>
              <h3 className="text-paper mt-[0.6em] text-center text-[0.875em] leading-tight font-semibold text-balance">
                {breakout.name}
              </h3>
              <p className="text-paper-faint mt-[0.35em] text-center font-mono text-[0.5625em] leading-snug break-all">
                {host}/breakout/{breakout.slug}/
              </p>
              <p className="mt-[0.5em] font-mono text-[0.6875em] tracking-[0.12em] uppercase">
                <span className="text-paper-faint">PIN </span>
                <span className="text-signal tabular font-bold">
                  {breakout.pin || "on your table card"}
                </span>
              </p>
            </article>
          ))}
        </div>
      </section>

      <div className="mt-[0.9em] grid shrink-0 grid-cols-[1.5fr_1fr_1.15fr] gap-[0.75em]">
        <section className="panel p-[0.75em]">
          <StepHeading
            number={2}
            title={
              byObjective
                ? `Record risks and opportunities for each of the ${categories.length} objectives`
                : "Agree five findings — one of each type"
            }
            compact
          />
          <ul className="mt-[0.5em] space-y-[0.3em]">
            {categories.map((category) => (
              <li
                key={category.key}
                data-accent={category.accent}
                className="flex items-baseline gap-[0.5em]"
              >
                <span
                  aria-hidden="true"
                  className="type-text w-[1em] shrink-0 text-center text-[0.8125em]"
                >
                  {category.glyph}
                </span>
                <span className="text-paper w-[10em] shrink-0 text-[0.8125em] leading-snug font-semibold">
                  {category.label}
                </span>
                <span className="text-paper-mute line-clamp-2 text-[0.75em] leading-snug">
                  {category.blurb}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel p-[0.75em]">
          <StepHeading number={3} title="Submit to the board" compact />
          <ul className="text-paper-mute mt-[0.5em] space-y-[0.35em] text-[0.75em] leading-snug">
            <Bullet>
              Everything saves automatically when you leave a field. There is no save
              button.
            </Bullet>
            <Bullet>
              Use <span className="text-paper-dim font-semibold">↑ / ↓</span> to rank your{" "}
              {categories.length} cards 1–{categories.length}.
            </Bullet>
            <Bullet>
              <span className="text-paper-dim font-semibold">
                Submit {words.itemPlural}
              </span>{" "}
              puts them on the big screen. After that, corrections go through the operator.
            </Bullet>
          </ul>
        </section>

        <section className="panel p-[0.75em]">
          <StepHeading number={4} title="Then: the auction" compact />
          <p className="text-paper-mute mt-[0.5em] text-[0.75em] leading-snug">
            The panel bids{" "}
            <span className="text-paper-dim font-semibold">
              {state.event.startingBudget} credits
            </span>{" "}
            each, buying one card for every {words.slotFullPlural}:
          </p>
          {slots.length ? (
            <ol className="mt-[0.4em] space-y-[0.2em]">
              {slots.map((slot, index) => (
                <li key={slot.id} className="flex items-baseline gap-[0.5em]">
                  <span className="text-paper-faint tabular w-[1.2em] shrink-0 font-mono text-[0.625em]">
                    {index + 1}
                  </span>
                  <span className="text-paper text-[0.75em] leading-snug font-medium">
                    {slot.name}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-paper-faint mt-[0.4em] text-[0.75em]">
              Objectives are set on the control screen.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function StepHeading({
  number,
  title,
  note,
  compact = false,
}: {
  number: number;
  title: string;
  note?: string;
  compact?: boolean;
}) {
  return (
    <div className={cx("flex items-baseline gap-[0.6em]", compact ? "mb-0" : "mb-[0.6em]")}>
      <span
        className={cx(
          "border-signal text-signal tabular flex shrink-0 items-center justify-center border font-mono font-bold",
          compact
            ? "h-[1.5em] w-[1.5em] text-[0.6875em]"
            : "h-[1.6em] w-[1.6em] text-[0.75em]",
        )}
        aria-hidden="true"
      >
        {number}
      </span>
      <h3
        className={cx(
          "text-paper leading-none font-semibold",
          compact ? "text-[0.875em]" : "text-[1em]",
        )}
      >
        <span className="sr-only">Step {number}. </span>
        {title}
      </h3>
      {note ? (
        <p className="text-paper-mute truncate text-[0.75em] leading-snug">{note}</p>
      ) : null}
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-[0.5em]">
      <span aria-hidden="true" className="text-paper-faint shrink-0 select-none">
        —
      </span>
      <span>{children}</span>
    </li>
  );
}
