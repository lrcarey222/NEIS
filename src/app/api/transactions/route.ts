import {
  asBool,
  asInt,
  asString,
  asTrimmed,
  fail,
  ok,
  readJson,
  requireAdmin,
} from "@/lib/api";
import { validateAward } from "@/lib/derive";
import { getState, mutate, newId } from "@/lib/store";
import type { Transaction } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface AwardPayload {
  findingId?: string;
  panelistId?: string;
  objectiveId?: string;
  price?: number;
  note?: string;
  /** Operator has read the warnings and wants to proceed anyway. */
  acknowledgeWarnings?: boolean;
  /** Advance /display to the next objective after a successful award. */
  advanceRound?: boolean;
}

/**
 * Award a finding — the single most important write in the application.
 *
 * Validation runs inside the mutation, against the state being written rather
 * than a copy read moments earlier. Two operators on two laptops clicking
 * AWARD on the same finding cannot both succeed: the second call re-validates
 * after the first has committed and is refused.
 */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await readJson<AwardPayload>(request);
  if (!body) return fail("Malformed request.");

  const input = {
    findingId: asTrimmed(body.findingId),
    panelistId: asTrimmed(body.panelistId),
    objectiveId: asTrimmed(body.objectiveId),
    price: asInt(body.price, Number.NaN),
  };

  let rejection: { message: string; warnings?: string[] } | null = null;
  let created: Transaction | null = null;

  const next = await mutate("transaction.award", (draft) => {
    const validation = validateAward(draft, input);

    if (!validation.ok) {
      rejection = { message: validation.errors.map((e) => e.message).join(" ") };
      return;
    }
    if (validation.warnings.length > 0 && !asBool(body.acknowledgeWarnings)) {
      rejection = {
        message: "Confirm the warnings before awarding.",
        warnings: validation.warnings.map((w) => w.message),
      };
      return;
    }

    created = {
      id: newId("tx"),
      findingId: input.findingId,
      panelistId: input.panelistId,
      objectiveId: input.objectiveId,
      price: input.price,
      timestamp: Date.now(),
      note: asString(body.note).trim(),
    };
    draft.transactions.push(created);

    if (draft.event.status === "setup" || draft.event.status === "breakouts") {
      draft.event.status = "auction";
    }

    if (asBool(body.advanceRound)) {
      const lastRound = draft.objectives.length - 1;
      draft.event.currentRoundIndex = Math.min(
        draft.event.currentRoundIndex + 1,
        lastRound,
      );
    }
  });

  if (rejection) {
    const { message, warnings } = rejection as { message: string; warnings?: string[] };
    return fail(message, 409, warnings ? { warnings } : undefined);
  }

  return ok({ ...next, lastTransactionId: (created as Transaction | null)?.id ?? null });
}

/**
 * Undo. `id` omitted means "the most recent transaction", which is the big red
 * button on /control.
 */
export async function DELETE(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await readJson<{ id?: string; rewindRound?: boolean }>(request);
  const id = asTrimmed(body?.id);

  const state = await getState();
  if (state.transactions.length === 0) {
    return fail("There is nothing to undo.", 409);
  }

  const target = id
    ? state.transactions.find((t) => t.id === id)
    : [...state.transactions].sort((a, b) => b.timestamp - a.timestamp)[0];
  if (!target) return fail("Unknown transaction.", 404);

  const next = await mutate("transaction.undo", (draft) => {
    draft.transactions = draft.transactions.filter((t) => t.id !== target.id);
    if (asBool(body?.rewindRound)) {
      draft.event.currentRoundIndex = Math.max(-1, draft.event.currentRoundIndex - 1);
    }
  });

  // The finding's availability and the panelist's balance are both derived from
  // the transaction list, so removing the row above is the entire rollback.
  return ok({ ...next, undone: target });
}

/** Correct a recorded transaction in place — wrong price, wrong panelist. */
export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await readJson<AwardPayload & { id?: string }>(request);
  const id = asTrimmed(body?.id);
  if (!body || !id) return fail("Malformed request.");

  const state = await getState();
  const existing = state.transactions.find((t) => t.id === id);
  if (!existing) return fail("Unknown transaction.", 404);

  const input = {
    findingId: asTrimmed(body.findingId) || existing.findingId,
    panelistId: asTrimmed(body.panelistId) || existing.panelistId,
    objectiveId: asTrimmed(body.objectiveId) || existing.objectiveId,
    price: body.price === undefined ? existing.price : asInt(body.price, existing.price),
    excludeTransactionId: id,
  };

  let rejection: { message: string; warnings?: string[] } | null = null;

  const next = await mutate("transaction.patch", (draft) => {
    const validation = validateAward(draft, input);
    if (!validation.ok) {
      rejection = { message: validation.errors.map((e) => e.message).join(" ") };
      return;
    }
    if (validation.warnings.length > 0 && !asBool(body.acknowledgeWarnings)) {
      rejection = {
        message: "Confirm the warnings before saving.",
        warnings: validation.warnings.map((w) => w.message),
      };
      return;
    }

    const transaction = draft.transactions.find((t) => t.id === id);
    if (!transaction) return;
    transaction.findingId = input.findingId;
    transaction.panelistId = input.panelistId;
    transaction.objectiveId = input.objectiveId;
    transaction.price = input.price;
    if (body.note !== undefined) transaction.note = asString(body.note).trim();
  });

  if (rejection) {
    const { message, warnings } = rejection as { message: string; warnings?: string[] };
    return fail(message, 409, warnings ? { warnings } : undefined);
  }

  return ok(next);
}
