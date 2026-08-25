import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

import { getState } from "./store";
import type { Role } from "./types";

// ---------------------------------------------------------------------------
// Deliberately minimal access control.
//
// There are no user accounts: the operator holds an admin PIN, each breakout
// table holds a room PIN, and /display is open to anyone with the URL. The PIN
// is never stored in the cookie — the cookie holds an HMAC of the granted role,
// so a participant who reads their own cookie learns nothing reusable.
//
// This protects against a curious attendee poking at URLs. It is not designed
// to withstand a determined attacker, and it does not need to be: the app runs
// for one afternoon and holds no personal data.
// ---------------------------------------------------------------------------

const COOKIE_NAME = "neis_session";
const COOKIE_MAX_AGE = 60 * 60 * 14; // one long conference day

export type { Role };

function secret(): string {
  return (
    process.env.SESSION_SECRET?.trim() ||
    process.env.ADMIN_PIN?.trim() ||
    "neis-dev-secret"
  );
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function tokenFor(role: Exclude<Role, null>): string {
  const payload = role.kind === "admin" ? "admin" : `breakout:${role.slug}`;
  return `${payload}.${sign(payload)}`;
}

function parseToken(token: string | undefined): Role {
  if (!token) return null;
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const payload = token.slice(0, separator);
  const provided = Buffer.from(token.slice(separator + 1));
  const expected = Buffer.from(sign(payload));
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  if (payload === "admin") return { kind: "admin" };
  if (payload.startsWith("breakout:")) {
    return { kind: "breakout", slug: payload.slice("breakout:".length) };
  }
  return null;
}

function pinsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function adminPin(): string {
  return process.env.ADMIN_PIN?.trim() || "2026";
}

export async function currentRole(): Promise<Role> {
  const jar = await cookies();
  return parseToken(jar.get(COOKIE_NAME)?.value);
}

export async function isAdmin(): Promise<boolean> {
  return (await currentRole())?.kind === "admin";
}

/** Admins can act on any breakout; a facilitator only on their own. */
export async function canEditBreakout(slug: string): Promise<boolean> {
  const role = await currentRole();
  if (!role) return false;
  if (role.kind === "admin") return true;
  return role.slug === slug;
}

export interface LoginResult {
  ok: boolean;
  role?: Exclude<Role, null>;
  error?: string;
}

/**
 * Resolves a PIN to a role. The admin PIN is checked first so the operator can
 * always get into any breakout screen with the one PIN they memorised.
 */
export async function login(pin: string, wantedSlug?: string): Promise<LoginResult> {
  const trimmed = pin.trim();
  if (!trimmed) return { ok: false, error: "Enter a PIN." };

  if (pinsMatch(trimmed, adminPin())) {
    return { ok: true, role: { kind: "admin" } };
  }

  const state = await getState();
  const candidates = wantedSlug
    ? state.breakouts.filter((b) => b.slug === wantedSlug)
    : state.breakouts;

  const match = candidates.find((b) => pinsMatch(trimmed, b.pin));
  if (match) return { ok: true, role: { kind: "breakout", slug: match.slug } };

  return { ok: false, error: "That PIN was not recognised." };
}

export async function setSession(role: Exclude<Role, null>): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, tokenFor(role), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    // Not tied to NODE_ENV: a production build served over plain HTTP on the
    // conference LAN would hand out cookies the browser silently drops, and
    // nobody could log in. Opt in explicitly when running behind TLS.
    secure: process.env.NEIS_SECURE_COOKIES === "1",
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
