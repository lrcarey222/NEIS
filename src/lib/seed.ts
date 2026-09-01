// ---------------------------------------------------------------------------
// Default event scaffolding + demo content.
//
// IMPORTANT: the 25 findings below are *illustrative placeholders* written so
// the board, the auction and the portfolio screens can be rehearsed end to end
// with realistic-looking material. The evidence lines are directional
// characterisations, not verified citations, and are meant to be replaced by
// what the breakouts actually produce in the room. `/control` can wipe them in
// one click ("Clear findings").
// ---------------------------------------------------------------------------

import {
  type Breakout,
  DEFAULT_ROLES,
  type EventState,
  type Finding,
  FINDING_TYPES,
  type FindingType,
  type Panelist,
  SCHEMA_VERSION,
} from "./types";

const DEFAULT_BREAKOUT_PIN = process.env.BREAKOUT_PIN?.trim() || "1234";

export const BREAKOUT_BLUEPRINT: Omit<
  Breakout,
  "submissionStatus" | "submittedAt" | "pin"
>[] = [
  {
    id: "bk-manufacturing",
    slug: "manufacturing",
    name: "Building Local / Regional Manufacturing",
    shortName: "Manufacturing",
    description:
      "Industrial base, supply chains, and the regional economics of making energy equipment in the United States.",
    sortOrder: 0,
  },
  {
    id: "bk-auto",
    slug: "auto",
    name: "Supporting a Competitive Auto Strategy",
    shortName: "Auto",
    description:
      "Vehicle manufacturing, batteries, charging, and the competitive position of the U.S. auto sector.",
    sortOrder: 1,
  },
  {
    id: "bk-clean-firm",
    slug: "clean-firm",
    name: "Accelerating Clean Firm Deployment",
    shortName: "Clean Firm",
    description:
      "Nuclear, geothermal, long-duration storage, and other always-available clean capacity.",
    sortOrder: 2,
  },
  {
    id: "bk-grid",
    slug: "grid",
    name: "Affordable Grid Expansion",
    shortName: "Grid",
    description:
      "Transmission, interconnection, distribution capacity, and who pays for the build-out.",
    sortOrder: 3,
  },
  {
    id: "bk-ai",
    slug: "ai",
    name: "AI / Quantum / Innovation",
    shortName: "AI & Innovation",
    description:
      "Compute demand, frontier research, and the innovation pipeline behind the next industrial cycle.",
    sortOrder: 4,
  },
];

/**
 * One seat per default role.
 *
 * The names are placeholders the operator overwrites in Setup; the roles are
 * the point, because they are what the panel drafts against and what the
 * audience picks from at /play.
 */
export const PANELIST_BLUEPRINT: Omit<Panelist, "startingBudget">[] =
  DEFAULT_ROLES.map((role, index) => ({
    id: `pl-${index + 1}`,
    name: `Panelist ${index + 1}`,
    affiliation: "",
    role: role.name,
    rolePrompt: role.prompt,
    sortOrder: index,
  }));

/**
 * Findings each panelist ends up holding, and therefore rounds of bidding.
 *
 * Three, not five: the auction has 35 minutes in the run of show and five
 * panelists to get round, and three picks each is what actually fits. It also
 * makes each pick cost something to make, which is the point of the exercise.
 */
export const DEFAULT_ROUND_COUNT = 3;

/**
 * What a schema 1 event ran, before `roundCount` existed.
 *
 * Deliberately a separate constant from the default above: those events had
 * five strategic objectives and therefore five picks, and lowering the new
 * default must not retroactively shrink a portfolio someone already drafted.
 */
export const LEGACY_ROUND_COUNT = 5;

// --- Demo findings ---------------------------------------------------------

/**
 * These are the room's model of what a good finding looks like, so they are
 * written to the same targets the form asks for: a headline that is a
 * conclusion in under twenty words, two evidence bullets of under fifteen, and
 * a why-it-matters under forty. A demo finding that ran long would teach every
 * facilitator to run long.
 */
interface SeedFinding {
  type: FindingType;
  headline: string;
  evidence: string;
  whyItMatters: string;
  confidence: Finding["confidence"];
  breakoutRank: number;
  dissent?: string;
}

const DEMO_FINDINGS: Record<string, SeedFinding[]> = {
  "bk-manufacturing": [
    {
      type: "momentum",
      headline:
        "Grid-equipment orders have moved from speculative to contracted, with multi-year backlogs giving manufacturers real demand visibility.",
      evidence:
        "• Multi-year order backlogs across transformer, switchgear and medium-voltage suppliers\n• New U.S. plants tied to named utility customers, not to incentives",
      whyItMatters:
        "This is the one segment where U.S. industrial expansion is pulled by physical need rather than pushed by subsidy, which makes it far more resilient to policy reversal.",
      confidence: "high",
      breakoutRank: 1,
    },
    {
      type: "fragility",
      headline:
        "Announced U.S. battery cell capacity still exceeds credible domestic demand through 2030, and the gap widened.",
      evidence:
        "• Nameplate cell capacity well above realistic domestic demand ranges\n• Announced greenfield plants repeatedly delayed, rescoped toward storage, or shelved",
      whyItMatters:
        "An overbuilt pipeline that consolidates disorderly produces stranded assets, regional job losses, and exactly the political backlash that makes the next industrial policy harder to pass.",
      confidence: "medium",
      breakoutRank: 2,
      dissent:
        "A minority held that storage and export demand will absorb most of the apparent overhang, and the pipeline is closer to right-sized than headline figures suggest.",
    },
    {
      type: "bottleneck",
      headline:
        "Time-to-power, not capital cost, is now the binding constraint on new industrial plants.",
      evidence:
        "• Interconnection timelines cited as the top factor in recent siting decisions\n• Large premiums paid for pre-permitted, power-ready industrial parcels",
      whyItMatters:
        "If time-to-power rather than capital is the constraint, incentive competitions between states are largely redistributive, and the policy lever that actually matters is site readiness.",
      confidence: "high",
      breakoutRank: 3,
    },
    {
      type: "opportunity",
      headline:
        "Machinery, automation and power electronics build more durable advantage than another final assembly plant.",
      evidence:
        "• Coating, calendering and forming equipment still overwhelmingly imported\n• Power electronics a rising share of value in vehicles and grid equipment",
      whyItMatters:
        "Assembly plants can be relocated. Toolmakers and power-electronics suppliers accumulate process knowledge that travels much less easily, so the advantage compounds instead of moving with the next incentive.",
      confidence: "medium",
      breakoutRank: 4,
    },
    {
      type: "wildcard",
      headline:
        "The U.S. may end up with strategic-minimum magnet capacity but no commercially competitive magnet industry.",
      evidence:
        "• Announced separation and magnet plants sized near strategic minimums, not merchant scale\n• Persistent cost gap against incumbents, with offtake concentrated in defence",
      whyItMatters:
        "A strategic minimum is a legitimate choice, but it should be chosen deliberately and funded as such, not arrived at by accident while claiming commercial success.",
      confidence: "low",
      breakoutRank: 5,
    },
  ],
  "bk-auto": [
    {
      type: "momentum",
      headline:
        "Mature U.S. cell lines now price close enough to imports that sourcing turns on logistics, not cost.",
      evidence:
        "• Multiple large U.S. cell plants running at or near design yield\n• Sourcing decisions citing supply security alongside price",
      whyItMatters:
        "Once domestic cells compete without a subsidy bridge, the whole downstream vehicle strategy stops depending on trade policy holding still.",
      confidence: "medium",
      breakoutRank: 2,
    },
    {
      type: "fragility",
      headline:
        "Vehicle affordability, not charging or range, is now the binding barrier to sustained EV adoption.",
      evidence:
        "• Demand softening concentrated in entry price bands after incentive changes\n• Insurance and repair costs rising faster for EVs than comparable ICE vehicles",
      whyItMatters:
        "A transition that only serves buyers above the median income is politically fragile and commercially capped, however good the technology gets.",
      confidence: "high",
      breakoutRank: 1,
    },
    {
      type: "bottleneck",
      headline:
        "Cathode and anode material capacity, not cell assembly, is the real chokepoint in the battery chain.",
      evidence:
        "• Domestic CAM and AAM capacity lags announced cell capacity by a wide margin\n• Graphite and precursor supply concentrated in a few overseas suppliers",
      whyItMatters:
        "Content rules and supply-security claims are only as strong as the weakest upstream link, and today that link is materials rather than cells.",
      confidence: "high",
      breakoutRank: 3,
    },
    {
      type: "opportunity",
      headline:
        "Depot-charged commercial fleets reached total-cost parity ahead of the consumer market getting all the attention.",
      evidence:
        "• Cost-of-ownership crossover reached earlier for high-utilisation depot fleets\n• Fleet buyers citing fuel and maintenance savings as the deciding factor",
      whyItMatters:
        "Fleet volume stabilises factory utilisation while the consumer market works through its affordability problem, and it is far less exposed to political mood.",
      confidence: "medium",
      breakoutRank: 4,
    },
    {
      type: "wildcard",
      headline:
        "Low-cost EVs scaling in third markets could reset global price expectations faster than U.S. policy can respond.",
      evidence:
        "• Rapid share gains for low-cost exporters across Europe, Latin America, Southeast Asia\n• Supplier and component pricing increasingly benchmarked to those platforms",
      whyItMatters:
        "Tariffs can protect a domestic market but cannot protect domestic exporters, and a cost benchmark set elsewhere eventually reaches U.S. balance sheets.",
      confidence: "low",
      breakoutRank: 5,
    },
  ],
  "bk-clean-firm": [
    {
      type: "momentum",
      headline:
        "Hyperscaler power purchase agreements have created a genuine merchant market for clean firm capacity.",
      evidence:
        "• Multi-decade PPAs signed for existing, restarted and uprated nuclear capacity\n• Contract prices well above prevailing wholesale benchmarks",
      whyItMatters:
        "First-of-a-kind clean firm projects failed for want of a creditworthy buyer. That buyer now exists, and it is not the regulated utility everyone was waiting for.",
      confidence: "high",
      breakoutRank: 1,
    },
    {
      type: "fragility",
      headline:
        "Advanced nuclear is being financed on nth-of-a-kind costs while still executing first-of-a-kind builds.",
      evidence:
        "• Order announcements far outnumber units under active construction\n• Cost projections assume learning rates the sector has not yet demonstrated",
      whyItMatters:
        "If the first completed advanced units land far above projection, the financing market that just opened could close again for a decade.",
      confidence: "medium",
      breakoutRank: 2,
    },
    {
      type: "bottleneck",
      headline:
        "Nuclear-qualified suppliers and welders now constrain deployment more tightly than licensing does.",
      evidence:
        "• Long lead times persist for large forgings and reactor-grade components\n• Nuclear-qualified welder and inspector shortages cited across active projects",
      whyItMatters:
        "Regulatory reform was the visible fight; the supply chain is the slow one, and it cannot be legislated into existence on the same timeline.",
      confidence: "high",
      breakoutRank: 3,
    },
    {
      type: "opportunity",
      headline:
        "Next-generation geothermal can reuse oil and gas drilling capability at a scale the debate understates.",
      evidence:
        "• Commercial-scale demonstrations delivering contracted power at falling well costs\n• Crews, rigs and service companies transferring directly from shale operations",
      whyItMatters:
        "It is the rare clean firm option with an existing skilled workforce, an existing supply chain, and a political constituency in energy-producing states.",
      confidence: "medium",
      breakoutRank: 4,
    },
    {
      type: "wildcard",
      headline:
        "Compute demand could move or thin out fast enough to strand the firm capacity contracted against it.",
      evidence:
        "• Efficiency gains cutting energy per unit of useful compute\n• Growing share of announced capacity sited outside the United States",
      whyItMatters:
        "Clean firm assets last sixty years. The demand signal underwriting them has been stable for about three.",
      confidence: "low",
      breakoutRank: 5,
    },
  ],
  "bk-grid": [
    {
      type: "momentum",
      headline:
        "Grid-enhancing technologies and advanced reconductoring have moved from pilots into standard utility capital plans.",
      evidence:
        "• Measured capacity gains on existing corridors without new right-of-way\n• Regulators starting to require GETs analysis before approving new build",
      whyItMatters:
        "It is the only transmission capacity available on a timescale that matches the load growth already sitting in the interconnection queue.",
      confidence: "high",
      breakoutRank: 2,
    },
    {
      type: "fragility",
      headline:
        "Retail rate increases have turned grid investment into a live political liability.",
      evidence:
        "• Residential rates outpacing inflation across many service territories\n• Large-load cost allocation now contested in rate cases and commission politics",
      whyItMatters:
        "Every dollar of needed grid investment now has to survive an affordability argument, and that argument is currently being lost.",
      confidence: "high",
      breakoutRank: 1,
    },
    {
      type: "bottleneck",
      headline:
        "Interconnection reform cleared queue backlog without shortening the years between study and energisation.",
      evidence:
        "• Network upgrade construction now the dominant share of total wait\n• Equipment lead times extending in parallel with process improvements",
      whyItMatters:
        "Reform concentrated on the part of the problem that was easiest to see, while the physical bottleneck went largely unaddressed.",
      confidence: "high",
      breakoutRank: 3,
    },
    {
      type: "opportunity",
      headline:
        "Flexible interconnection buys large loads years of earlier connection for a handful of curtailed hours.",
      evidence:
        "• Flexible-load tariffs and bespoke agreements approved in several jurisdictions\n• Large headroom available at modest curtailment obligations",
      whyItMatters:
        "It is the cheapest capacity available on the system and it requires contracts rather than construction, which is the only lever that moves on this timescale.",
      confidence: "medium",
      breakoutRank: 4,
    },
    {
      type: "wildcard",
      headline:
        "A severe reliability event in a high-growth region would reset the politics of load growth overnight.",
      evidence:
        "• Reserve margins tightening where load growth is most concentrated\n• Grid stress already attributed publicly to large new loads",
      whyItMatters:
        "The response to a visible failure is rarely proportionate, and it would arrive as moratoria rather than as investment.",
      confidence: "low",
      breakoutRank: 5,
    },
  ],
  "bk-ai": [
    {
      type: "momentum",
      headline:
        "AI capital expenditure has become a primary driver of U.S. industrial and electrical investment.",
      evidence:
        "• Data-centre construction a leading category of non-residential structures investment\n• Turbine, transformer and switchgear order books lengthened by compute demand",
      whyItMatters:
        "For the first time in decades a private demand signal, not a public programme, is pulling the domestic electrical industrial base forward.",
      confidence: "high",
      breakoutRank: 1,
    },
    {
      type: "fragility",
      headline:
        "Multi-decade energy assets are being underwritten against compute forecasts that have proven repeatedly unstable.",
      evidence:
        "• Large utility load forecast revisions within short intervals, in both directions\n• Duplicate speculative interconnection requests inflating apparent demand",
      whyItMatters:
        "Over-building against a soft forecast puts the cost on ratepayers; under-building puts it on reliability. Neither error is recoverable quickly.",
      confidence: "medium",
      breakoutRank: 2,
    },
    {
      type: "bottleneck",
      headline:
        "Electrical infrastructure lead times, not chips, now set the pace of U.S. compute deployment.",
      evidence:
        "• Multi-year lead times for large transformers and high-voltage switchgear\n• Gas turbine order books effectively sold out into the next decade",
      whyItMatters:
        "The AI race is currently an electrical-equipment manufacturing race, and that is a competition the United States can actually choose to win.",
      confidence: "high",
      breakoutRank: 3,
    },
    {
      type: "opportunity",
      headline:
        "AI applied to grid operations, permitting and process control pays off sooner than AI-driven materials discovery.",
      evidence:
        "• Documented cycle-time reductions in utility engineering and study workflows\n• Automated review tools cutting permitting and environmental review timelines",
      whyItMatters:
        "The near-term energy value of AI is in clearing the administrative and operational bottlenecks that already constrain the build-out.",
      confidence: "medium",
      breakoutRank: 4,
    },
    {
      type: "wildcard",
      headline:
        "A step change in compute efficiency could decouple AI capability growth from electricity demand growth.",
      evidence:
        "• Energy per unit of useful output falling faster than published projections\n• Specialised inference silicon delivering large gains over general-purpose hardware",
      whyItMatters:
        "It would be excellent news for emissions and affordability, and severely disruptive for everyone who committed capital to serving the forecast.",
      confidence: "low",
      breakoutRank: 5,
      dissent:
        "Several participants argued Jevons-style rebound makes this close to irrelevant: cheaper compute expands usage enough to keep total load rising regardless.",
    },
  ],
};
// --- Builders --------------------------------------------------------------

function makeBreakouts(submitted: boolean): Breakout[] {
  return BREAKOUT_BLUEPRINT.map((b) => ({
    ...b,
    pin: DEFAULT_BREAKOUT_PIN,
    submissionStatus: submitted ? ("submitted" as const) : ("not_started" as const),
    submittedAt: submitted ? Date.now() : null,
  }));
}

function makeFindings(submitted: boolean): Finding[] {
  const now = Date.now();
  const findings: Finding[] = [];
  for (const breakout of BREAKOUT_BLUEPRINT) {
    const seeds = DEMO_FINDINGS[breakout.id] ?? [];
    seeds.forEach((seed, index) => {
      findings.push({
        id: `fd-${breakout.slug}-${seed.type}`,
        breakoutId: breakout.id,
        type: seed.type,
        headline: seed.headline,
        evidence: seed.evidence,
        whyItMatters: seed.whyItMatters,
        confidence: seed.confidence,
        breakoutRank: seed.breakoutRank,
        dissent: seed.dissent ?? "",
        submitted,
        createdAt: now + index,
        updatedAt: now + index,
      });
    });
  }
  return findings;
}

export interface CreateEventOptions {
  title?: string;
  subtitle?: string;
  startingBudget?: number;
  minBid?: number;
  /** Findings each panelist ends up holding. Defaults to 3. */
  roundCount?: number;
  /** Include the 25 demo findings, pre-submitted and ready to auction. */
  demo?: boolean;
  panelistNames?: string[];
}

export function createEvent(options: CreateEventOptions = {}): EventState {
  const demo = options.demo ?? false;
  const startingBudget = options.startingBudget ?? 100;
  const now = Date.now();

  // Named panelists still inherit the default roles in seat order, so a fresh
  // event always arrives with the five lenses filled in rather than blank.
  const panelists: Panelist[] = (
    options.panelistNames?.length
      ? options.panelistNames.map((name, i) => ({
          id: `pl-${i + 1}`,
          name,
          affiliation: "",
          role: DEFAULT_ROLES[i % DEFAULT_ROLES.length].name,
          rolePrompt: DEFAULT_ROLES[i % DEFAULT_ROLES.length].prompt,
          sortOrder: i,
        }))
      : PANELIST_BLUEPRINT
  ).map((p) => ({ ...p, startingBudget }));

  return {
    schemaVersion: SCHEMA_VERSION,
    event: {
      id: `ev-${now.toString(36)}`,
      title: options.title ?? "NEIS Strategic Findings Auction",
      subtitle:
        options.subtitle ??
        (demo ? "Rehearsal event — demo data" : "NYC Climate Week"),
      startingBudget,
      minBid: options.minBid ?? 1,
      roundCount: options.roundCount ?? DEFAULT_ROUND_COUNT,
      currentRoundIndex: demo ? 0 : -1,
      displayMode: "board",
      status: demo ? "auction" : "setup",
      audienceOpen: false,
      audienceBudget: 100,
      declareWinner: false,
      showSummary: false,
      enforceBudgetReserve: false,
      isDemo: demo,
      createdAt: now,
    },
    breakouts: makeBreakouts(demo),
    findings: demo ? makeFindings(true) : [],
    panelists,
    transactions: [],
    audience: [],
    timer: {
      endsAt: null,
      pausedRemainingMs: null,
      running: false,
      label: "Breakout working session",
      visible: false,
    },
    revision: 1,
  };
}

/** Blank findings for a breakout that is starting from scratch in the room. */
export function createBlankFindings(breakoutId: string): Finding[] {
  const now = Date.now();
  return FINDING_TYPES.map((type, index) => ({
    id: `fd-${breakoutId}-${type}-${now.toString(36)}${index}`,
    breakoutId,
    type,
    headline: "",
    evidence: "",
    whyItMatters: "",
    confidence: "medium" as const,
    breakoutRank: index + 1,
    dissent: "",
    submitted: false,
    createdAt: now + index,
    updatedAt: now + index,
  }));
}
