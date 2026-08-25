import { NextResponse } from "next/server";

import { canEditBreakout, isAdmin } from "./auth";
import { getState } from "./store";
import type { EventState } from "./types";

/** Never cache anything: every response describes live event state. */
export const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
} as const;

export function ok<T>(body: T): NextResponse {
  return NextResponse.json(body, { headers: NO_STORE });
}

export function fail(message: string, status = 400, extra?: object): NextResponse {
  return NextResponse.json({ error: message, ...extra }, { status, headers: NO_STORE });
}

export async function stateResponse(): Promise<NextResponse> {
  return ok(await getState());
}

/** Guards a route behind the admin PIN. */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (await isAdmin()) return null;
  return fail("Administrator PIN required.", 401);
}

/** Guards a route behind either the admin PIN or that breakout's own PIN. */
export async function requireBreakout(slug: string): Promise<NextResponse | null> {
  if (await canEditBreakout(slug)) return null;
  return fail("Breakout PIN required.", 401);
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

// --- Coercion helpers ------------------------------------------------------
// Input arrives from hand-typed forms during a live event. These keep a stray
// empty string or a pasted "27 credits" from writing NaN into the ledger.

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function asTrimmed(value: unknown, fallback = ""): string {
  return asString(value, fallback).trim();
}

export function asInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function asBool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function findBreakout(state: EventState, slug: string) {
  return state.breakouts.find((b) => b.slug === slug) ?? null;
}
