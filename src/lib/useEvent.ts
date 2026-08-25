"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { EventState, Role } from "./types";

// ---------------------------------------------------------------------------
// The single client-side data source. Every screen calls useEvent() and reads
// from the snapshot it returns.
//
// Two independent channels keep a screen current: an SSE stream for instant
// push, and a slow poll that runs whenever the stream is not confirmed live.
// A conference network that blocks or buffers event-streams degrades the app
// to a few seconds of latency instead of freezing the projector mid-auction.
// ---------------------------------------------------------------------------

export type ConnectionStatus = "connecting" | "live" | "polling" | "offline";

export interface UseEventResult {
  state: EventState | null;
  role: Role;
  status: ConnectionStatus;
  /** Force an immediate refetch (used after a mutation, as a belt-and-braces). */
  refresh: () => Promise<void>;
  setRole: (role: Role) => void;
}

const POLL_INTERVAL_MS = 4000;

export function useEvent(): UseEventResult {
  const [state, setState] = useState<EventState | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  // Snapshots can arrive from the stream and a poll at nearly the same moment.
  // Tracking the highest revision seen keeps an older one from overwriting a
  // newer one and briefly un-selling a finding on the big screen.
  const revisionRef = useRef(-1);

  const accept = useCallback((incoming: EventState | null | undefined) => {
    if (!incoming) return;
    const revision = incoming.revision ?? 0;
    if (revision < revisionRef.current) return;
    revisionRef.current = revision;
    setState(incoming);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { state: EventState; role: Role };
      accept(payload.state);
      setRole(payload.role ?? null);
    } catch {
      setStatus((current) => (current === "live" ? current : "offline"));
    }
  }, [accept]);

  // Initial load. Runs before the stream connects so the first paint is never
  // blocked on the SSE handshake.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // SSE.
  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      source = new EventSource("/api/stream");

      source.addEventListener("state", (event) => {
        try {
          accept(JSON.parse((event as MessageEvent).data) as EventState);
          attempt = 0;
          setStatus("live");
        } catch {
          /* ignore a malformed frame; the next one will be fine */
        }
      });

      source.onopen = () => {
        attempt = 0;
        setStatus("live");
      };

      source.onerror = () => {
        source?.close();
        source = null;
        setStatus("polling");
        // Back off, but never past 8s — an operator should not be waiting a
        // minute for the board to come back after the wifi blips.
        const delay = Math.min(8000, 500 * 2 ** attempt++);
        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
    };
  }, [accept]);

  // Polling fallback, active only while the stream is not confirmed live.
  useEffect(() => {
    if (status === "live") return;
    const id = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [status, refresh]);

  // A projector left running all afternoon can have its SSE connection dropped
  // by a sleeping network stack without firing onerror. Re-syncing whenever the
  // tab becomes visible again covers that case.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [refresh]);

  return { state, role, status, refresh, setRole };
}

// --- Mutation helper -------------------------------------------------------

export interface ApiResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
}

/** Thin fetch wrapper that surfaces the server's own error text to the UI. */
export async function api<T = unknown>(
  path: string,
  method: "POST" | "PATCH" | "DELETE" | "PUT",
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (!response.ok) {
      return {
        ok: false,
        error: (payload.error as string) ?? `Request failed (${response.status}).`,
        warnings: payload.warnings as string[] | undefined,
      };
    }
    return { ok: true, data: payload as T };
  } catch {
    return { ok: false, error: "Could not reach the server. Check the connection." };
  }
}
