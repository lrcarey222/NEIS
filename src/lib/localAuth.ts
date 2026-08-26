"use client";

import { useEffect, useState } from "react";

import type { EventState, Role } from "./types";

// ---------------------------------------------------------------------------
// PIN gating, client-side.
//
// Be clear-eyed about what this is: with a static site and a public database,
// the PIN keeps an attendee from wandering into the wrong room's form or
// idly opening the control screen. It is NOT a security boundary — anyone
// determined can read the PINs out of the database or bypass the check in
// devtools.
//
// That is an accepted trade for this event: the data is a policy exercise that
// gets projected on a wall for everyone in the room to read anyway, and the
// alternative (real auth) buys nothing worth the extra failure modes on the
// day. The README says the same thing, and database.rules.json is where to go
// if the posture ever needs to change.
// ---------------------------------------------------------------------------

const ROLE_KEY = "neis_role";

function read(): Role {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ROLE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Role;
    if (parsed && (parsed.kind === "admin" || parsed.kind === "breakout")) return parsed;
    return null;
  } catch {
    return null;
  }
}

function write(role: Role): void {
  try {
    if (role) localStorage.setItem(ROLE_KEY, JSON.stringify(role));
    else localStorage.removeItem(ROLE_KEY);
  } catch {
    /* private browsing — the session just will not persist */
  }
}

/** Admin PIN. Baked into the build so a static export needs no server. */
export function adminPin(): string {
  return process.env.NEXT_PUBLIC_ADMIN_PIN?.trim() || "2026";
}

export interface LoginOutcome {
  ok: boolean;
  role?: Role;
  error?: string;
}

/**
 * Resolves a PIN to a role. The admin PIN is checked first so the operator can
 * get into any breakout screen with the one PIN they memorised.
 */
export function attemptLogin(
  state: EventState | null,
  pin: string,
  wantedSlug?: string,
): LoginOutcome {
  const trimmed = pin.trim();
  if (!trimmed) return { ok: false, error: "Enter a PIN." };

  if (trimmed === adminPin()) {
    const role: Role = { kind: "admin" };
    write(role);
    return { ok: true, role };
  }

  const candidates = wantedSlug
    ? (state?.breakouts ?? []).filter((b) => b.slug === wantedSlug)
    : (state?.breakouts ?? []);

  const match = candidates.find((b) => b.pin === trimmed);
  if (match) {
    const role: Role = { kind: "breakout", slug: match.slug };
    write(role);
    return { ok: true, role };
  }

  return { ok: false, error: "That PIN was not recognised." };
}

export function signOut(): void {
  write(null);
}

/** Current role, kept in sync across tabs of the same browser. */
export function useRole(): [Role, (role: Role) => void] {
  const [role, setRole] = useState<Role>(null);

  useEffect(() => {
    setRole(read());
    const onStorage = (event: StorageEvent) => {
      if (event.key === ROLE_KEY) setRole(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return [
    role,
    (next: Role) => {
      write(next);
      setRole(next);
    },
  ];
}

export function isAdmin(role: Role): boolean {
  return role?.kind === "admin";
}

export function canEditBreakout(role: Role, slug: string): boolean {
  if (!role) return false;
  return role.kind === "admin" || role.slug === slug;
}
