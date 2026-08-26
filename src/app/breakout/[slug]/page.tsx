import { BREAKOUT_BLUEPRINT } from "@/lib/seed";
import { BreakoutWorkspace } from "./BreakoutWorkspace";

/**
 * A static export has to know every breakout URL at build time. Slugs come
 * from the blueprint and are fixed — an operator can rename a room in Setup,
 * but the slug (and so the QR code on the table card) never moves.
 */
export function generateStaticParams() {
  return BREAKOUT_BLUEPRINT.map((breakout) => ({ slug: breakout.slug }));
}

export default async function BreakoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <BreakoutWorkspace slug={slug} />;
}
