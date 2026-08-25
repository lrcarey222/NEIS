import { headers } from "next/headers";
import QRCode from "qrcode";

import { sortedBreakouts } from "@/lib/derive";
import { getState } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Room landing page.
 *
 * Printed or projected between sessions so facilitators can scan straight into
 * their own workspace. The QR codes are rendered server-side as inline SVG —
 * no external image service, nothing to load over the conference network.
 */
export default async function LandingPage() {
  const state = await getState();
  const base = await resolveBaseUrl();
  const breakouts = sortedBreakouts(state);

  const cards = await Promise.all(
    breakouts.map(async (breakout) => ({
      breakout,
      url: `${base}/breakout/${breakout.slug}`,
      svg: await QRCode.toString(`${base}/breakout/${breakout.slug}`, {
        type: "svg",
        margin: 0,
        color: { dark: "#05080c", light: "#f4f6f8" },
      }),
    })),
  );

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-6 py-12">
      <header className="rule-signal mb-10">
        <p className="eyebrow mb-2">{state.event.subtitle || "Live session"}</p>
        <h1 className="text-paper text-3xl leading-tight font-semibold sm:text-4xl">
          {state.event.title}
        </h1>
        <p className="text-paper-mute mt-3 max-w-2xl leading-relaxed">
          Five breakouts each record five Strategic Findings. Every finding then goes to
          auction against five strategic objectives. Scan your room&apos;s code to open its
          workspace.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="eyebrow mb-4">Breakout rooms</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ breakout, url, svg }) => (
            <a
              key={breakout.id}
              href={`/breakout/${breakout.slug}`}
              className="panel hover:border-paper-faint flex gap-4 p-4 transition-colors"
            >
              <div
                className="h-24 w-24 shrink-0 rounded-sm bg-[#f4f6f8] p-1.5 [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: svg }}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <h3 className="text-paper text-sm leading-snug font-semibold text-balance">
                  {breakout.name}
                </h3>
                <p className="text-paper-faint mt-1.5 font-mono text-[0.625rem] break-all">
                  {url.replace(/^https?:\/\//, "")}
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
        <div className="grid gap-3 sm:grid-cols-3">
          <LinkCard
            href="/display"
            title="Big screen display"
            hint="Findings board, live auction, final portfolios. Press F for fullscreen."
          />
          <LinkCard
            href="/control"
            title="Operator control room"
            hint="Record auction results and drive the display. Administrator PIN required."
          />
          <LinkCard
            href="/summary"
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

/**
 * Prefers an explicitly configured public URL, then the proxy headers, then the
 * Host header — so the QR codes point at the address participants can actually
 * reach, including a bare LAN IP when the app runs off the operator's laptop.
 */
async function resolveBaseUrl(): Promise<string> {
  const configured = process.env.NEIS_PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || /^\d+\.\d+\.\d+\.\d+/.test(host) ? "http" : "https");

  return `${proto}://${host}`;
}
