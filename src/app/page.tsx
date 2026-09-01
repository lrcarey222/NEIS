"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

import { Logo } from "@/components/Logo";
import { StatusDot } from "@/components/primitives";
import { sortedBreakouts } from "@/lib/derive";
import { BREAKOUT_BLUEPRINT } from "@/lib/seed";
import { useEvent } from "@/lib/useEvent";

/**
 * Room landing page.
 *
 * Printed or projected between sessions so facilitators can scan straight into
 * their own workspace. QR codes are generated in the browser — there is no
 * server in a static export, and this keeps the page working with no network
 * beyond the page load itself.
 */
export default function LandingPage() {
  const { state, status } = useEvent("landing");
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [origin, setOrigin] = useState("");

  // The event's own breakout names once it exists; the blueprint before that,
  // so the QR codes can be printed before anyone has created the event.
  const breakouts = state
    ? sortedBreakouts(state)
    : BREAKOUT_BLUEPRINT.map((b) => ({ ...b, pin: "", submissionStatus: "not_started" as const, submittedAt: null }));

  useEffect(() => {
    const base = `${window.location.origin}${window.location.pathname}`.replace(/\/$/, "");
    setOrigin(base);

    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      for (const breakout of breakouts) {
        next[breakout.slug] = await QRCode.toString(`${base}/breakout/${breakout.slug}/`, {
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
    // Regenerate when the set of rooms changes, not on every snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakouts.map((b) => b.slug).join(",")]);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-6 py-12">
      <header className="mb-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Logo className="text-paper h-12 w-auto sm:h-14" />
          <StatusDot status={status} />
        </div>
        <div className="rule-signal">
          <p className="eyebrow mb-2">{state?.event.subtitle || "Live session"}</p>
          <h1 className="text-paper text-3xl leading-tight font-medium sm:text-4xl">
            {state?.event.title ?? "NEIS Strategic Findings Auction"}
          </h1>
        </div>
        <p className="text-paper-mute mt-3 max-w-2xl leading-relaxed">
          Five breakouts each record five Strategic Findings. A panel of experts then bids
          for them — each drafting the strongest set for the question their role is
          answering. Scan your room&apos;s code to open its workspace.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="eyebrow mb-4">Breakout rooms</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {breakouts.map((breakout) => (
            <a
              key={breakout.id}
              href={`breakout/${breakout.slug}/`}
              className="panel hover:border-paper-faint flex gap-4 p-4 transition-colors"
            >
              <div
                className="h-24 w-24 shrink-0 rounded-sm bg-[#f4f6f8] p-1.5 [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: codes[breakout.slug] ?? "" }}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <h3 className="text-paper text-sm leading-snug font-semibold text-balance">
                  {breakout.name}
                </h3>
                <p className="text-paper-faint mt-1.5 font-mono text-[0.625rem] break-all">
                  {origin.replace(/^https?:\/\//, "")}/breakout/{breakout.slug}/
                </p>
                <p className="text-paper-mute mt-2 font-mono text-[0.625rem] tracking-[0.1em] uppercase">
                  PIN on your table card
                </p>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section>
        <h2 className="eyebrow mb-4">Screens</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <LinkCard
            href="agenda/"
            title="Run of show"
            hint="Today's agenda on a phone, updating live as the session runs. No PIN."
          />
          <LinkCard
            href="display/"
            title="Big screen display"
            hint="Instructions, findings board, live auction, final portfolios. Press F for fullscreen."
          />
          <LinkCard
            href="control/"
            title="Operator control room"
            hint="Record auction results and drive the display. Administrator PIN required."
          />
          <LinkCard
            href="summary/"
            title="Printable summary"
            hint="Full results for print or PDF export at the end of the session."
          />
        </div>
      </section>
    </main>
  );
}

function LinkCard({ href, title, hint }: { href: string; title: string; hint: string }) {
  return (
    <a href={href} className="panel hover:border-paper-faint block p-4 transition-colors">
      <h3 className="text-paper text-sm font-semibold">{title}</h3>
      <p className="text-paper-mute mt-1.5 text-xs leading-relaxed">{hint}</p>
    </a>
  );
}
