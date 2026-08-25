import { asInt, asString, fail, ok, readJson, requireAdmin } from "@/lib/api";
import { mutate } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface TimerPatch {
  action: "start" | "pause" | "resume" | "reset" | "hide" | "show";
  /** Duration in seconds, for `start`. */
  seconds?: number;
  label?: string;
}

/**
 * The countdown shown on /display during breakouts.
 *
 * Only the absolute end time is stored, never a ticking counter. Clients render
 * the remaining time themselves, so a screen that reconnects halfway through
 * lands on exactly the right number instead of resuming from a stale one.
 */
export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await readJson<TimerPatch>(request);
  if (!body) return fail("Malformed request.");

  const next = await mutate(`timer.${body.action}`, (state) => {
    const timer = state.timer;
    const now = Date.now();

    switch (body.action) {
      case "start": {
        const seconds = Math.max(0, asInt(body.seconds, 600));
        timer.endsAt = now + seconds * 1000;
        timer.pausedRemainingMs = null;
        timer.running = true;
        timer.visible = true;
        if (body.label !== undefined) timer.label = asString(body.label).trim();
        break;
      }
      case "pause": {
        if (timer.running && timer.endsAt) {
          timer.pausedRemainingMs = Math.max(0, timer.endsAt - now);
          timer.running = false;
        }
        break;
      }
      case "resume": {
        if (!timer.running && timer.pausedRemainingMs !== null) {
          timer.endsAt = now + timer.pausedRemainingMs;
          timer.pausedRemainingMs = null;
          timer.running = true;
          timer.visible = true;
        }
        break;
      }
      case "reset": {
        timer.endsAt = null;
        timer.pausedRemainingMs = null;
        timer.running = false;
        break;
      }
      case "hide":
        timer.visible = false;
        break;
      case "show":
        timer.visible = true;
        break;
    }

    if (body.label !== undefined && body.action !== "start") {
      timer.label = asString(body.label).trim();
    }
  });

  return ok(next);
}
