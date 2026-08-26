"use client";

import { useEffect, useState } from "react";

import { currentMode, net, type Mode, type Presence } from "./net";
import type { EventState } from "./types";

// ---------------------------------------------------------------------------
// The single client-side data source. Every screen calls useEvent().
//
// With Firebase behind it there is no polling and no reconnect logic to write:
// the SDK holds a websocket, replays missed writes on reconnect, and re-fires
// the listener. The hook's only jobs are to expose the snapshot, say whether
// this browser is really syncing or only talking to its own tabs, and register
// presence so the operator can see which rooms are actually online.
// ---------------------------------------------------------------------------

export type ConnectionStatus = "connecting" | "live" | "local" | "empty";

export interface UseEventResult {
  state: EventState | null;
  status: ConnectionStatus;
  mode: Mode;
  /** True once the first snapshot has arrived, even if the event is empty. */
  loaded: boolean;
}

export function useEvent(room = "viewer"): UseEventResult {
  const [state, setState] = useState<EventState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>("local");

  useEffect(() => {
    const adapter = net();
    setMode(adapter.mode);
    adapter.announce(room);

    const unsubscribe = adapter.subscribe((next) => {
      setState(next);
      setLoaded(true);
    });

    // Re-announce when the tab comes back, so a laptop that slept during the
    // coffee break shows as present again rather than silently missing.
    const onVisible = () => {
      if (document.visibilityState === "visible") adapter.announce(room);
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [room]);

  const status: ConnectionStatus = !loaded
    ? "connecting"
    : state === null
      ? "empty"
      : mode === "firebase"
        ? "live"
        : "local";

  return { state, status, mode, loaded };
}

/** Which rooms currently have a browser open. Used by the control room. */
export function usePresence(): Presence[] {
  const [present, setPresent] = useState<Presence[]>([]);

  useEffect(() => {
    return net().subscribePresence(setPresent);
  }, []);

  return present;
}

export { currentMode };
