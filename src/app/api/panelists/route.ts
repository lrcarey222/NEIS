import {
  asInt,
  asString,
  asTrimmed,
  clamp,
  fail,
  ok,
  readJson,
  requireAdmin,
} from "@/lib/api";
import { getState, mutate, newId } from "@/lib/store";
import type { Panelist } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PanelistPayload {
  id?: string;
  name?: string;
  affiliation?: string;
  startingBudget?: number;
  sortOrder?: number;
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await readJson<PanelistPayload>(request)) ?? {};

  const next = await mutate("panelist.create", (draft) => {
    const panelist: Panelist = {
      id: newId("pl"),
      name: asTrimmed(body.name) || `Panelist ${draft.panelists.length + 1}`,
      affiliation: asString(body.affiliation).trim(),
      startingBudget: clamp(
        asInt(body.startingBudget, draft.event.startingBudget),
        0,
        100_000,
      ),
      sortOrder: draft.panelists.length,
    };
    draft.panelists.push(panelist);
  });

  return ok(next);
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await readJson<PanelistPayload>(request);
  const id = asTrimmed(body?.id);
  if (!body || !id) return fail("Malformed request.");

  const state = await getState();
  const target = state.panelists.find((p) => p.id === id);
  if (!target) return fail("Unknown panelist.", 404);

  // Cutting a budget below what has already been spent would show a negative
  // balance on the big screen. Refuse rather than render nonsense.
  if (body.startingBudget !== undefined) {
    const spent = state.transactions
      .filter((t) => t.panelistId === id)
      .reduce((sum, t) => sum + t.price, 0);
    const proposed = asInt(body.startingBudget, target.startingBudget);
    if (proposed < spent) {
      return fail(
        `${target.name} has already spent ${spent} credits. Set the budget to at least that, or undo a transaction first.`,
        409,
      );
    }
  }

  const next = await mutate("panelist.patch", (draft) => {
    const panelist = draft.panelists.find((p) => p.id === id);
    if (!panelist) return;
    if (body.name !== undefined) panelist.name = asTrimmed(body.name) || panelist.name;
    if (body.affiliation !== undefined) {
      panelist.affiliation = asString(body.affiliation).trim();
    }
    if (body.startingBudget !== undefined) {
      panelist.startingBudget = clamp(
        asInt(body.startingBudget, panelist.startingBudget),
        0,
        100_000,
      );
    }
    if (body.sortOrder !== undefined) {
      panelist.sortOrder = asInt(body.sortOrder, panelist.sortOrder);
    }
  });

  return ok(next);
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await readJson<{ id?: string }>(request);
  const id = asTrimmed(body?.id);

  const state = await getState();
  if (!state.panelists.some((p) => p.id === id)) return fail("Unknown panelist.", 404);

  if (state.transactions.some((t) => t.panelistId === id)) {
    return fail(
      "This panelist has already acquired findings. Undo their transactions first.",
      409,
    );
  }

  const next = await mutate("panelist.delete", (draft) => {
    draft.panelists = draft.panelists
      .filter((p) => p.id !== id)
      .map((p, index) => ({ ...p, sortOrder: index }));
  });

  return ok(next);
}
