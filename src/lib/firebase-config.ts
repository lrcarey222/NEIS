/* ============================================================================
   FIREBASE CONFIG — paste your project's values below to enable live sync.

   Until a real config is pasted here, the app runs in LOCAL mode: everything
   works, but only across tabs of the SAME browser. That is fine for building
   and rehearsing solo; it is NOT enough for five breakout tables on five
   different laptops. Paste the config before the event.

   ONE-TIME SETUP (free, ~5 minutes):
   1. https://console.firebase.google.com → "Add project". Name it something
      like "neis-climate-week". Disable Analytics when asked.
   2. Left sidebar → Build → Realtime Database → "Create Database".
      Pick a location, choose "Start in test mode", Enable.
   3. Gear icon → Project settings → "Your apps" → click the Web icon "</>" →
      register an app (any nickname). Firebase shows a `firebaseConfig = {...}`
      object. Copy its values into FIREBASE_CONFIG below.
      Make sure `databaseURL` is present. If it is not shown, it is
      https://<your-project-id>-default-rtdb.firebaseio.com
   4. Realtime Database → Rules tab → paste the contents of `database.rules.json`
      from this repo → Publish. (Test mode expires after 30 days; these rules
      do not, and they scope access to the `neis` node.)
   5. Commit and push. Live sync is on.

   The apiKey here is not a secret — Firebase web API keys are public by design
   and are safe to commit. Access is controlled by the database rules, not by
   hiding this value. See database.rules.json and the README for the security
   posture and how to harden it.
   ============================================================================ */

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

export const FIREBASE_CONFIG: FirebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://PASTE_YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "PASTE_YOUR_PROJECT",
  storageBucket: "PASTE_YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID",
};

/** Root node for this app, so it can share a database with other projects. */
export const DB_ROOT = "neis";

/**
 * True when the config above has actually been filled in.
 *
 * The whole app checks this one function to decide between live Firebase sync
 * and the local-only fallback, so a half-pasted config degrades to something
 * that still works rather than to a blank screen at the front of the room.
 */
export function isFirebaseConfigured(config: FirebaseConfig = FIREBASE_CONFIG): boolean {
  const placeholderish = /PASTE|YOUR_|^$/;
  return (
    !placeholderish.test(config.apiKey) &&
    !placeholderish.test(config.databaseURL) &&
    config.databaseURL.startsWith("https://")
  );
}

/** `?local=1` forces the offline adapter even when Firebase is configured. */
export function forcedLocal(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URL(window.location.href).searchParams.get("local") === "1";
  } catch {
    return false;
  }
}

/**
 * Which event slot to use. Two fixed slots keep the URLs shareable with no
 * room code to type: `main` for the live session, `rehearsal` for practice.
 */
export function eventKey(): string {
  if (typeof window === "undefined") return "main";
  try {
    const requested = new URL(window.location.href).searchParams.get("event");
    if (requested && /^[a-z0-9-]{1,40}$/i.test(requested)) return requested;
  } catch {
    /* fall through */
  }
  return "main";
}
