import {
  asInt,
  asString,
  asTrimmed,
  fail,
  ok,
  readJson,
  requireAdmin,
} from "@/lib/api";
import { getState, mutate, newId } from "@/lib/store";
import type { Objective } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ObjectivePayload {
  id?: string;
  name?: string;
  shortName?: string;
  prompt?: string;
  roundOrder?: number;
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await readJson<ObjectivePayload>(request)) ?? {};

  const next = await mutate("objective.create", (draft) => {
    const objective: Objective = {
      id: newId("ob"),
      name: asTrimmed(body.name) || `Objective ${draft.objectives.length + 1}`,
      shortName: asTrimmed(body.shortName) || asTrimmed(body.name) || "Objective",
      prompt: asString(body.prompt).trim(),
      roundOrder: draft.objectives.length,
    };
    draft.objectives.push(objective);
  });

  return ok(next);
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await readJson<ObjectivePayload>(request);
  const id = asTrimmed(body?.id);
  if (!body || !id) return fail("Malformed request.");

  const next = await mutate("objective.patch", (draft) => {
    const objective = draft.objectives.find((o) => o.id === id);
    if (!objective) return;
    if (body.name !== undefined) objective.name = asTrimmed(body.name) || objective.name;
    if (body.shortName !== undefined) {
      objective.shortName = asTrimmed(body.shortName) || objective.shortName;
    }
    if (body.prompt !== undefined) objective.prompt = asString(body.prompt).trim();
    if (body.roundOrder !== undefined) {
      objective.roundOrder = asInt(body.roundOrder, objective.roundOrder);
    }
  });

  return ok(next);
}

/** Reorder the auction rounds. Accepts objective ids in the desired order. */
export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await readJson<{ orderedIds?: string[] }>(request);
  if (!body?.orderedIds) return fail("Malformed request.");

  const next = await mutate("objective.reorder", (draft) => {
    body.orderedIds!.forEach((id, index) => {
      const objective = draft.objectives.find((o) => o.id === id);
      if (objective) objective.roundOrder = index;
    });
  });

  return ok(next);
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await readJson<{ id?: string }>(request);
  const id = asTrimmed(body?.id);

  const state = await getState();
  if (!state.objectives.some((o) => o.id === id)) return fail("Unknown objective.", 404);

  if (state.transactions.some((t) => t.objectiveId === id)) {
    return fail(
      "Findings have already been bought for this objective. Undo those transactions first.",
      409,
    );
  }

  const next = await mutate("objective.delete", (draft) => {
    draft.objectives = draft.objectives
      .filter((o) => o.id !== id)
      .sort((a, b) => a.roundOrder - b.roundOrder)
      .map((o, index) => ({ ...o, roundOrder: index }));
    draft.event.currentRoundIndex = Math.min(
      draft.event.currentRoundIndex,
      draft.objectives.length - 1,
    );
  });

  return ok(next);
}
