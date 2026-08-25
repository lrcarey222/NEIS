import { asTrimmed, fail, ok, readJson } from "@/lib/api";
import { clearSession, currentRole, login, setSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return ok({ role: await currentRole() });
}

export async function POST(request: Request) {
  const body = await readJson<{ pin?: string; slug?: string }>(request);
  if (!body) return fail("Malformed request.");

  const result = await login(asTrimmed(body.pin), asTrimmed(body.slug) || undefined);
  if (!result.ok || !result.role) {
    return fail(result.error ?? "That PIN was not recognised.", 401);
  }

  await setSession(result.role);
  return ok({ role: result.role });
}

export async function DELETE() {
  await clearSession();
  return ok({ role: null });
}
