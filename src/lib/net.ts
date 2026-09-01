"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getDatabase,
  ref,
  onValue,
  set,
  update,
  remove,
  runTransaction,
  onDisconnect,
  serverTimestamp,
  type Database,
} from "firebase/database";

import {
  DB_ROOT,
  FIREBASE_CONFIG,
  eventKey,
  forcedLocal,
  isFirebaseConfigured,
} from "./firebase-config";
import { fromSnapshot, stripUndefined, toSnapshot } from "./serialize";
import type { EventState } from "./types";

// ---------------------------------------------------------------------------
// Transport.
//
// Two adapters behind one interface, chosen once at startup:
//
//   FirebaseAdapter — Realtime Database. Real multi-device sync: five breakout
//                     laptops, the projector and the operator all see the same
//                     event within a few hundred milliseconds.
//   LocalAdapter    — localStorage + BroadcastChannel. Same-browser tabs only.
//                     Used automatically when the Firebase config has not been
//                     pasted yet, or when the URL carries ?local=1.
//
// Nothing above this file branches on which one is active, so the app is fully
// usable — and testable — before anyone touches the Firebase console.
// ---------------------------------------------------------------------------

export type Mode = "firebase" | "local";

export interface Presence {
  uid: string;
  room: string;
  ts: number;
}

export interface Adapter {
  mode: Mode;
  /** Subscribe to the whole event. Fires immediately with current state. */
  subscribe(onState: (state: EventState | null) => void): () => void;
  /** Replace the entire event (create, reset, seed). */
  writeEvent(state: EventState): Promise<void>;
  /** Multi-path write. Keys are paths relative to the event root. */
  updatePaths(updates: Record<string, unknown>): Promise<void>;
  /** Delete one path relative to the event root. */
  removePath(path: string): Promise<void>;
  /**
   * Read-modify-write the whole event atomically. `mutator` returns the next
   * state, or null to abort. Resolves to whether it committed.
   */
  transact(mutator: (state: EventState | null) => EventState | null): Promise<boolean>;
  /** Announce this browser as present in `room`; cleared on disconnect. */
  announce(room: string): void;
  subscribePresence(onPresence: (present: Presence[]) => void): () => void;
  /**
   * Signed milliseconds to add to this device's clock to land on the server's.
   *
   * The projector and the operator's laptop will not agree to the second, and
   * a countdown that differs between two screens in the same room is worse
   * than no countdown. Every screen adds this before doing any run-of-show
   * arithmetic, so they all compute the same remaining time from the same
   * stored start stamp. Fires immediately with the current value.
   */
  subscribeClockOffset(onOffset: (offsetMs: number) => void): () => void;
}

// --- Identity --------------------------------------------------------------

const UID_KEY = "neis_uid";

export function myUid(): string {
  if (typeof window === "undefined") return "server";
  try {
    let uid = localStorage.getItem(UID_KEY);
    if (!uid) {
      uid = `u${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(UID_KEY, uid);
    }
    return uid;
  } catch {
    return `u${Math.random().toString(36).slice(2, 10)}`;
  }
}

// --- Firebase --------------------------------------------------------------

let app: FirebaseApp | null = null;
let db: Database | null = null;

function connect(): Database | null {
  try {
    if (!db) {
      app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
      db = getDatabase(app);
    }
    return db;
  } catch (error) {
    console.warn("[neis] Firebase init failed; falling back to local mode.", error);
    return null;
  }
}

function firebaseAdapter(database: Database, key: string): Adapter {
  const root = `${DB_ROOT}/events/${key}`;
  const uid = myUid();

  return {
    mode: "firebase",

    subscribe(onState) {
      const node = ref(database, root);
      const unsubscribe = onValue(
        node,
        (snapshot) => onState(fromSnapshot(snapshot.val())),
        (error) => {
          // A permission error here almost always means the database rules
          // were never published. Say so plainly rather than showing an
          // endlessly "connecting" screen at the front of the room.
          console.error(
            "[neis] Could not read the event. If this says PERMISSION_DENIED, " +
              "publish database.rules.json in the Firebase console.",
            error,
          );
          onState(null);
        },
      );
      return unsubscribe;
    },

    async writeEvent(state) {
      await set(ref(database, root), toSnapshot(state));
    },

    async updatePaths(updates) {
      const scoped: Record<string, unknown> = {};
      for (const [path, value] of Object.entries(updates)) {
        scoped[`${root}/${path}`] = stripUndefined(value);
      }
      await update(ref(database), scoped);
    },

    async removePath(path) {
      await remove(ref(database, `${root}/${path}`));
    },

    async transact(mutator) {
      const result = await runTransaction(ref(database, root), (current) => {
        const next = mutator(fromSnapshot(current));
        // Returning undefined aborts the transaction without writing.
        return next === null ? undefined : toSnapshot(next);
      });
      return result.committed;
    },

    announce(room) {
      try {
        const node = ref(database, `${DB_ROOT}/presence/${key}/${uid}`);
        void set(node, { uid, room, ts: serverTimestamp() });
        void onDisconnect(node).remove();
      } catch {
        /* presence is a nicety, never worth breaking a page over */
      }
    },

    subscribePresence(onPresence) {
      const node = ref(database, `${DB_ROOT}/presence/${key}`);
      return onValue(
        node,
        (snapshot) => {
          const value = (snapshot.val() ?? {}) as Record<string, Presence>;
          onPresence(Object.values(value).filter((p) => p && p.room));
        },
        () => onPresence([]),
      );
    },

    subscribeClockOffset(onOffset) {
      // A synthetic node the SDK maintains locally; reading it costs nothing
      // and it re-fires whenever the estimate is refined.
      return onValue(
        ref(database, ".info/serverTimeOffset"),
        (snapshot) => onOffset(Number(snapshot.val()) || 0),
        // A skewed clock is far better than a broken screen: fall back to
        // this device's own time rather than failing the subscription.
        () => onOffset(0),
      );
    },
  };
}

// --- Local fallback --------------------------------------------------------

function localAdapter(key: string): Adapter {
  const storageKey = `neis_event_${key}`;
  const presenceKey = `neis_presence_${key}`;
  const uid = myUid();

  const channel =
    typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(storageKey) : null;

  // Neither BroadcastChannel nor the `storage` event fires in the tab that did
  // the writing, so a same-tab listener list is required — without it the
  // operator's own screen would never update from their own clicks. Firebase's
  // onValue does echo locally, which is why only this adapter needs it.
  const listeners = new Set<(state: EventState | null) => void>();

  const read = (): EventState | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? fromSnapshot(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  };

  const write = (state: EventState) => {
    localStorage.setItem(storageKey, JSON.stringify(toSnapshot(state)));
    channel?.postMessage("changed");
    for (const listener of listeners) {
      try {
        listener(read());
      } catch {
        /* one broken subscriber must not stop the others */
      }
    }
  };

  const readPresence = (): Presence[] => {
    try {
      const raw = JSON.parse(localStorage.getItem(presenceKey) ?? "{}") as Record<
        string,
        Presence
      >;
      const cutoff = Date.now() - 15_000;
      return Object.values(raw).filter((p) => p && p.ts > cutoff);
    } catch {
      return [];
    }
  };

  /**
   * Applies one write to a list of id-carrying records, exactly as Firebase
   * would: an absent record is created, a null value deletes it, and a deeper
   * path edits one field of it.
   *
   * Returns the list to store, because a whole-collection write replaces it.
   */
  const applyToList = (
    list: { id: string; [k: string]: unknown }[],
    id: string | undefined,
    rest: string[],
    value: unknown,
  ): { id: string; [k: string]: unknown }[] => {
    // Whole-collection write: `findings: null` to clear, or a keyed map to
    // replace. Firebase treats these as ordinary values at that path, so the
    // local adapter has to as well or "clear all findings" silently does
    // nothing here.
    if (id === undefined) {
      return value && typeof value === "object"
        ? Object.entries(value as Record<string, { id?: string }>).map(
            ([recordId, record]) => ({ ...record, id: record.id ?? recordId }),
          )
        : [];
    }

    const index = list.findIndex((item) => item.id === id);

    if (rest.length === 0) {
      const record = value as { id: string } | null;
      if (record === null) {
        if (index >= 0) list.splice(index, 1);
      } else if (index >= 0) list[index] = { ...list[index], ...record, id };
      else list.push({ ...record, id });
      return list;
    }

    if (index < 0) return list;
    let target = list[index] as Record<string, unknown>;
    for (let i = 0; i < rest.length - 1; i++) {
      target = target[rest[i]] as Record<string, unknown>;
      if (!target) return list;
    }
    target[rest[rest.length - 1]] = value;
    return list;
  };

  /** Walks a slash path into the state object and assigns. */
  const applyPath = (state: EventState, path: string, value: unknown) => {
    const parts = path.split("/").filter(Boolean);
    if (parts.length === 0) return;

    // The array-backed collections are addressed as `findings/<id>/<field>`,
    // matching the Firebase paths exactly so both adapters accept the same
    // calls from the action layer.
    //
    // Every array on EventState has to be listed here. A collection that is
    // missing does not error — it falls through to the scalar branch below and
    // sets a string key on an array, which `toMap` then drops on the way to
    // storage. The write appears to succeed and the data is simply gone.
    const [collection, id, ...rest] = parts;
    const collections = [
      "breakouts",
      "findings",
      "panelists",
      "transactions",
      "audience",
    ];

    if (collections.includes(collection)) {
      const list = state[collection as keyof EventState] as unknown as {
        id: string;
        [k: string]: unknown;
      }[];
      (state as unknown as Record<string, unknown>)[collection] = applyToList(
        list,
        id,
        rest,
        value,
      );
      return;
    }

    // The schedule's segments are the one nested collection: they carry ids
    // and are addressed as `runOfShow/segments/<id>/<field>`, so they need the
    // same treatment one level down.
    if (collection === "runOfShow" && id === "segments") {
      const [segmentId, ...fields] = rest;
      state.runOfShow.segments = applyToList(
        state.runOfShow.segments as unknown as { id: string }[],
        segmentId,
        fields,
        value,
      ) as unknown as EventState["runOfShow"]["segments"];
      return;
    }

    // Order lives beside the map rather than in it, because RTDB does not
    // preserve the order of an object's keys. Applying it here keeps a
    // reorder atomic in this adapter too.
    if (collection === "runOfShow" && id === "segmentOrder") {
      const order = (Array.isArray(value) ? value : []) as string[];
      const byId = new Map(state.runOfShow.segments.map((s) => [s.id, s]));
      const ordered = order
        .map((segmentId) => byId.get(segmentId))
        .filter(Boolean) as EventState["runOfShow"]["segments"];
      for (const segment of state.runOfShow.segments) {
        if (!order.includes(segment.id)) ordered.push(segment);
      }
      state.runOfShow.segments = ordered;
      return;
    }

    // Scalar sub-trees: event/*, timer/*, runOfShow/*, revision
    let target = state as unknown as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      target = target[parts[i]] as Record<string, unknown>;
      if (!target) return;
    }
    target[parts[parts.length - 1]] = value;
  };

  return {
    mode: "local",

    subscribe(onState) {
      const emit = () => onState(read());
      emit();
      listeners.add(onState);

      const onMessage = () => emit();
      const onStorage = (event: StorageEvent) => {
        if (event.key === storageKey) emit();
      };
      channel?.addEventListener("message", onMessage);
      window.addEventListener("storage", onStorage);

      return () => {
        listeners.delete(onState);
        channel?.removeEventListener("message", onMessage);
        window.removeEventListener("storage", onStorage);
      };
    },

    async writeEvent(state) {
      write(state);
    },

    async updatePaths(updates) {
      const state = read();
      if (!state) return;
      for (const [path, value] of Object.entries(updates)) {
        applyPath(state, path, value);
      }
      write(state);
    },

    async removePath(path) {
      const state = read();
      if (!state) return;
      applyPath(state, path, null);
      write(state);
    },

    async transact(mutator) {
      const next = mutator(read());
      if (next === null) return false;
      write(next);
      return true;
    },

    announce(room) {
      try {
        const raw = JSON.parse(localStorage.getItem(presenceKey) ?? "{}");
        raw[uid] = { uid, room, ts: Date.now() };
        localStorage.setItem(presenceKey, JSON.stringify(raw));
      } catch {
        /* ignore */
      }
    },

    subscribePresence(onPresence) {
      onPresence(readPresence());
      const id = setInterval(() => onPresence(readPresence()), 4000);
      return () => clearInterval(id);
    },

    /** No server, so this device's clock *is* the shared timebase. */
    subscribeClockOffset(onOffset) {
      onOffset(0);
      return () => {};
    },
  };
}

// --- Selection -------------------------------------------------------------

let cached: Adapter | null = null;

/**
 * The adapter for this browser. Resolved once and reused, so every page shares
 * one database connection and one presence registration.
 */
export function net(): Adapter {
  if (cached) return cached;

  const key = eventKey();
  if (isFirebaseConfigured() && !forcedLocal()) {
    const database = connect();
    if (database) {
      cached = firebaseAdapter(database, key);
      return cached;
    }
  }
  cached = localAdapter(key);
  return cached;
}

/** Exposed so the UI can tell the operator which mode they are actually in. */
export function currentMode(): Mode {
  return net().mode;
}
