import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { createEvent } from "./seed";
import { type EventState, SCHEMA_VERSION } from "./types";

// ---------------------------------------------------------------------------
// Persistence + in-process pub/sub.
//
// The whole event is a single JSON document of a few dozen records. At that
// size a file store beats a database on every axis that matters for a live
// conference: no network dependency, no credentials to expire, no connection
// pool to exhaust, and a state file the operator can read, back up or hand-fix
// with a text editor if something goes badly wrong on stage.
//
// Writes are serialised through a promise chain and land via write-to-temp +
// rename, so a crash mid-write can never leave a truncated file behind. Every
// mutation is also appended to a JSONL audit log for post-event analysis.
// ---------------------------------------------------------------------------

const DATA_DIR = path.resolve(
  process.env.NEIS_DATA_DIR?.trim() || path.join(process.cwd(), "data"),
);
const STATE_FILE = path.join(DATA_DIR, "event.json");
const AUDIT_FILE = path.join(DATA_DIR, "audit.jsonl");

type Listener = (state: EventState) => void;

// Next.js dev recompiles modules on edit. Hanging the singletons off
// globalThis keeps the cache and the SSE subscriber list alive across reloads,
// so open display screens do not silently stop receiving updates.
interface StoreGlobals {
  cache: EventState | null;
  listeners: Set<Listener>;
  writeQueue: Promise<unknown>;
}

const globalRef = globalThis as typeof globalThis & {
  __neisStore?: StoreGlobals;
};

const store: StoreGlobals = (globalRef.__neisStore ??= {
  cache: null,
  listeners: new Set(),
  writeQueue: Promise.resolve(),
});

export function newId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

/** Fills in fields added after a state file was first written. */
function migrate(state: EventState): EventState {
  const event = state.event ?? {};
  return {
    ...state,
    schemaVersion: SCHEMA_VERSION,
    event: {
      ...event,
      minBid: event.minBid ?? 1,
      declareWinner: event.declareWinner ?? false,
      showSummary: event.showSummary ?? false,
      enforceBudgetReserve: event.enforceBudgetReserve ?? false,
      isDemo: event.isDemo ?? false,
      subtitle: event.subtitle ?? "",
    },
    breakouts: (state.breakouts ?? []).map((b) => ({
      ...b,
      pin: b.pin ?? "1234",
      submittedAt: b.submittedAt ?? null,
    })),
    findings: (state.findings ?? []).map((f) => ({ ...f, dissent: f.dissent ?? "" })),
    transactions: (state.transactions ?? []).map((t) => ({ ...t, note: t.note ?? "" })),
    timer: state.timer ?? {
      endsAt: null,
      pausedRemainingMs: null,
      running: false,
      label: "Breakout working session",
      visible: false,
    },
    revision: state.revision ?? 1,
  };
}

async function readFromDisk(): Promise<EventState> {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    return migrate(JSON.parse(raw) as EventState);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") {
      // A corrupt file must not be silently replaced — the operator would lose
      // the auction results. Preserve it and start clean so the event can go on.
      const backup = `${STATE_FILE}.corrupt-${Date.now()}`;
      await fs.rename(STATE_FILE, backup).catch(() => {});
      console.error(
        `[neis] Could not parse ${STATE_FILE}. Moved to ${backup} and started a fresh event.`,
        error,
      );
    }
    const fresh = createEvent({ demo: true });
    await writeToDisk(fresh);
    return fresh;
  }
}

async function writeToDisk(state: EventState): Promise<void> {
  await ensureDir();
  const tmp = `${STATE_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(tmp, STATE_FILE);
}

async function appendAudit(action: string, detail: unknown): Promise<void> {
  try {
    await ensureDir();
    await fs.appendFile(
      AUDIT_FILE,
      `${JSON.stringify({ at: new Date().toISOString(), action, detail })}\n`,
      "utf8",
    );
  } catch {
    // Audit logging is best-effort. Never let it break a live transaction.
  }
}

/** Current event state, loading from disk on first use. */
export async function getState(): Promise<EventState> {
  if (!store.cache) {
    store.cache = await readFromDisk();
  }
  return store.cache;
}

/**
 * Applies `mutator` to the current state and persists the result.
 *
 * Calls are serialised through a queue, so two API requests arriving at the
 * same moment (operator awards a finding while a breakout submits) can never
 * interleave and lose one of the two writes.
 */
export async function mutate(
  action: string,
  mutator: (state: EventState) => EventState | void,
): Promise<EventState> {
  const run = store.writeQueue.then(async () => {
    const current = await getState();
    // Deep clone so a mutator that throws part-way cannot leave the in-memory
    // cache holding a partially applied change.
    const draft: EventState = structuredClone(current);
    const result = mutator(draft) ?? draft;
    result.revision = (current.revision ?? 0) + 1;

    await writeToDisk(result);
    store.cache = result;
    void appendAudit(action, { revision: result.revision });
    emit(result);
    return result;
  });

  // Keep the queue alive even if this mutation rejects.
  store.writeQueue = run.catch(() => {});
  return run;
}

/** Replaces the entire event (reset, demo seed, import). */
export async function replaceState(
  action: string,
  next: EventState,
): Promise<EventState> {
  return mutate(action, () => next);
}

// --- Real-time fan-out -----------------------------------------------------

function emit(state: EventState): void {
  for (const listener of store.listeners) {
    try {
      listener(state);
    } catch {
      // A broken pipe on one display must not stop the others updating.
    }
  }
}

export function subscribe(listener: Listener): () => void {
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

export function subscriberCount(): number {
  return store.listeners.size;
}

export const paths = { DATA_DIR, STATE_FILE, AUDIT_FILE };
