import { currentRole } from "@/lib/auth";
import { ok } from "@/lib/api";
import { getState } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Full event snapshot. Used for the initial paint and as the polling fallback
 * when a browser or proxy will not hold an SSE connection open.
 */
export async function GET() {
  const [state, role] = await Promise.all([getState(), currentRole()]);
  return ok({ state, role });
}
