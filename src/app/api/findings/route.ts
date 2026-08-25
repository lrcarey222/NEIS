import {
  asBool,
  asInt,
  asString,
  asTrimmed,
  clamp,
  fail,
  ok,
  oneOf,
  readJson,
  requireBreakout,
} from "@/lib/api";
import { getState, mutate, newId } from "@/lib/store";
import {
  CONFIDENCE_LEVELS,
  FINDING_TYPES,
  type Confidence,
  type Finding,
  type FindingType,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface FindingPayload {
  id?: string;
  breakoutSlug?: string;
  type?: FindingType;
  headline?: string;
  whatChanged?: string;
  evidence?: string;
  whyItMatters?: string;
  confidence?: Confidence;
  breakoutRank?: number;
  dissent?: string;
  submitted?: boolean;
}

function applyFields(finding: Finding, body: FindingPayload): void {
  if (body.type !== undefined) {
    finding.type = oneOf(body.type, FINDING_TYPES, finding.type);
  }
  if (body.headline !== undefined) finding.headline = asString(body.headline).trim();
  if (body.whatChanged !== undefined) finding.whatChanged = asString(body.whatChanged);
  if (body.evidence !== undefined) finding.evidence = asString(body.evidence);
  if (body.whyItMatters !== undefined) finding.whyItMatters = asString(body.whyItMatters);
  if (body.dissent !== undefined) finding.dissent = asString(body.dissent);
  if (body.confidence !== undefined) {
    finding.confidence = oneOf(body.confidence, CONFIDENCE_LEVELS, finding.confidence);
  }
  if (body.breakoutRank !== undefined) {
    finding.breakoutRank = clamp(asInt(body.breakoutRank, finding.breakoutRank), 1, 99);
  }
  finding.updatedAt = Date.now();
}

/** Create a finding. Breakouts may add to their own; admins may add anywhere. */
export async function POST(request: Request) {
  const body = await readJson<FindingPayload>(request);
  if (!body) return fail("Malformed request.");

  const slug = asTrimmed(body.breakoutSlug);
  const denied = await requireBreakout(slug);
  if (denied) return denied;

  const state = await getState();
  const breakout = state.breakouts.find((b) => b.slug === slug);
  if (!breakout) return fail("Unknown breakout.", 404);

  const next = await mutate("finding.create", (draft) => {
    const siblings = draft.findings.filter((f) => f.breakoutId === breakout.id);
    const finding: Finding = {
      id: newId("fd"),
      breakoutId: breakout.id,
      type: "momentum",
      headline: "",
      whatChanged: "",
      evidence: "",
      whyItMatters: "",
      confidence: "medium",
      breakoutRank: siblings.length + 1,
      dissent: "",
      submitted: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    applyFields(finding, body);
    if (body.submitted !== undefined) finding.submitted = asBool(body.submitted);
    draft.findings.push(finding);
  });

  return ok(next);
}

/** Edit a finding, including typo fixes the operator makes mid-event. */
export async function PATCH(request: Request) {
  const body = await readJson<FindingPayload>(request);
  if (!body) return fail("Malformed request.");

  const id = asTrimmed(body.id);
  const state = await getState();
  const existing = state.findings.find((f) => f.id === id);
  if (!existing) return fail("Unknown finding.", 404);

  const breakout = state.breakouts.find((b) => b.id === existing.breakoutId);
  const denied = await requireBreakout(breakout?.slug ?? "");
  if (denied) return denied;

  const next = await mutate("finding.patch", (draft) => {
    const finding = draft.findings.find((f) => f.id === id);
    if (!finding) return;
    applyFields(finding, body);
    if (body.submitted !== undefined) finding.submitted = asBool(body.submitted);
  });

  return ok(next);
}

/**
 * Delete a finding. Refused once it has been sold — removing it would leave a
 * transaction pointing at nothing and blank out a panelist's portfolio slot.
 */
export async function DELETE(request: Request) {
  const body = await readJson<{ id?: string }>(request);
  const id = asTrimmed(body?.id);

  const state = await getState();
  const existing = state.findings.find((f) => f.id === id);
  if (!existing) return fail("Unknown finding.", 404);

  const breakout = state.breakouts.find((b) => b.id === existing.breakoutId);
  const denied = await requireBreakout(breakout?.slug ?? "");
  if (denied) return denied;

  if (state.transactions.some((t) => t.findingId === id)) {
    return fail(
      "This finding has been sold at auction. Undo the transaction first.",
      409,
    );
  }

  const next = await mutate("finding.delete", (draft) => {
    draft.findings = draft.findings.filter((f) => f.id !== id);
  });

  return ok(next);
}

/** Bulk reorder: accepts an ordered list of finding ids and rewrites ranks 1..n. */
export async function PUT(request: Request) {
  const body = await readJson<{ breakoutSlug?: string; orderedIds?: string[] }>(request);
  if (!body?.orderedIds) return fail("Malformed request.");

  const slug = asTrimmed(body.breakoutSlug);
  const denied = await requireBreakout(slug);
  if (denied) return denied;

  const next = await mutate("finding.reorder", (draft) => {
    const breakout = draft.breakouts.find((b) => b.slug === slug);
    if (!breakout) return;
    body.orderedIds!.forEach((id, index) => {
      const finding = draft.findings.find(
        (f) => f.id === id && f.breakoutId === breakout.id,
      );
      if (finding) {
        finding.breakoutRank = index + 1;
        finding.updatedAt = Date.now();
      }
    });
  });

  return ok(next);
}
