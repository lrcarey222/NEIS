import {
  asString,
  asTrimmed,
  fail,
  ok,
  oneOf,
  readJson,
  requireAdmin,
  requireBreakout,
} from "@/lib/api";
import { getState, mutate } from "@/lib/store";
import { SUBMISSION_STATUSES, type SubmissionStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface BreakoutPatch {
  slug?: string;
  name?: string;
  shortName?: string;
  description?: string;
  pin?: string;
  submissionStatus?: SubmissionStatus;
}

/**
 * Update a breakout.
 *
 * A facilitator may move their own room between drafting and submitted.
 * Renaming, re-PINning, or reopening a *submitted* room is admin-only — that
 * last one is the "the operator must still be able to reopen findings"
 * requirement, and it should not be something a table can do to itself after
 * the board has gone up on the projector.
 */
export async function PATCH(request: Request) {
  const body = await readJson<BreakoutPatch>(request);
  if (!body) return fail("Malformed request.");

  const slug = asTrimmed(body.slug);
  const state = await getState();
  const existing = state.breakouts.find((b) => b.slug === slug);
  if (!existing) return fail("Unknown breakout.", 404);

  const wantsAdminField =
    body.name !== undefined ||
    body.shortName !== undefined ||
    body.description !== undefined ||
    body.pin !== undefined;

  const reopening =
    existing.submissionStatus === "submitted" &&
    body.submissionStatus !== undefined &&
    body.submissionStatus !== "submitted";

  const denied =
    wantsAdminField || reopening
      ? await requireAdmin()
      : await requireBreakout(slug);
  if (denied) return denied;

  const next = await mutate("breakout.patch", (draft) => {
    const breakout = draft.breakouts.find((b) => b.slug === slug);
    if (!breakout) return;

    if (body.name !== undefined) breakout.name = asTrimmed(body.name) || breakout.name;
    if (body.shortName !== undefined) {
      breakout.shortName = asTrimmed(body.shortName) || breakout.shortName;
    }
    if (body.description !== undefined) {
      breakout.description = asString(body.description).trim();
    }
    if (body.pin !== undefined) breakout.pin = asTrimmed(body.pin) || breakout.pin;

    if (body.submissionStatus !== undefined) {
      const status = oneOf(
        body.submissionStatus,
        SUBMISSION_STATUSES,
        breakout.submissionStatus,
      );
      breakout.submissionStatus = status;
      breakout.submittedAt = status === "submitted" ? Date.now() : null;

      // Submitting the room publishes its findings to the board in one step;
      // reopening pulls them back so a half-edited card is never on screen.
      for (const finding of draft.findings) {
        if (finding.breakoutId === breakout.id) {
          finding.submitted = status === "submitted";
        }
      }
    }
  });

  return ok(next);
}
