import { getState, subscribe } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Server-Sent Events feed. Every connected screen — the projector, the
 * operator's laptop, five breakout tables — receives the complete event state
 * on every mutation.
 *
 * Sending whole snapshots rather than diffs is the deliberate choice: the
 * payload is a few dozen kilobytes, and a client that misses or misorders a
 * message still self-corrects on the next one. During a live auction, "always
 * converges" beats "efficient".
 */
export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      send("state", await getState());

      const unsubscribe = subscribe((state) => send("state", state));

      // Proxies and load balancers drop idle connections; a comment frame every
      // 20s keeps the pipe warm without touching application state.
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          closed = true;
        }
      }, 20_000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      // Tells nginx not to buffer the stream, which would otherwise delay
      // every board update until the buffer filled.
      "X-Accel-Buffering": "no",
    },
  });
}
