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
  type EventState,
  type Finding,
  type FindingType,
  type Objective,
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

export const OBJECTIVE_BLUEPRINT: Objective[] = [
  {
    id: "ob-political",
    name: "Political Durability",
    shortName: "Political",
    prompt:
      "Which finding from anywhere on the board matters most for building or maintaining durable political support for U.S. energy industrial strategy?",
    roundOrder: 0,
  },
  {
    id: "ob-security",
    name: "National Security",
    shortName: "Security",
    prompt:
      "Which finding matters most for the security of U.S. supply chains, critical inputs, and strategic industrial capability?",
    roundOrder: 1,
  },
  {
    id: "ob-competitiveness",
    name: "Economic Competitiveness",
    shortName: "Competitiveness",
    prompt:
      "Which finding matters most for whether U.S. firms and workers win in the industries that define the next decade?",
    roundOrder: 2,
  },
  {
    id: "ob-climate",
    name: "Climate & Technological Progress",
    shortName: "Climate & Tech",
    prompt:
      "Which finding matters most for the pace of emissions reduction and the advance of the underlying technology base?",
    roundOrder: 3,
  },
  {
    id: "ob-affordability",
    name: "Energy Security & Affordability",
    shortName: "Affordability",
    prompt:
      "Which finding matters most for reliable, affordable energy for American households and businesses?",
    roundOrder: 4,
  },
];

export const PANELIST_BLUEPRINT: Omit<Panelist, "startingBudget">[] = [
  { id: "pl-1", name: "Panelist 1", affiliation: "", sortOrder: 0 },
  { id: "pl-2", name: "Panelist 2", affiliation: "", sortOrder: 1 },
  { id: "pl-3", name: "Panelist 3", affiliation: "", sortOrder: 2 },
  { id: "pl-4", name: "Panelist 4", affiliation: "", sortOrder: 3 },
];

// --- Demo findings ---------------------------------------------------------

interface SeedFinding {
  type: FindingType;
  headline: string;
  whatChanged: string;
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
        "Grid-equipment manufacturing is moving from policy ambition to bankable industrial demand.",
      whatChanged:
        "Transformer, switchgear, cable and breaker orders have shifted from speculative to contracted, with multi-year backlogs giving manufacturers the demand visibility they said was missing. Domestic capacity announcements are increasingly tied to signed offtake rather than to incentive availability alone.",
      evidence:
        "• Multi-year order backlogs reported across large-power-transformer and medium-voltage equipment suppliers\n• Utility procurement moving to framework agreements and reserved slots rather than project-by-project bidding\n• New and expanded U.S. plants tied to named utility customers instead of speculative capacity",
      whyItMatters:
        "Equipment demand is the one segment where U.S. industrial expansion is being pulled by physical need rather than pushed by subsidy — which makes it far more resilient to policy reversal.",
      confidence: "high",
      breakoutRank: 1,
    },
    {
      type: "fragility",
      headline:
        "The battery manufacturing pipeline remains substantially larger than credible near-term domestic demand.",
      whatChanged:
        "Announced U.S. cell capacity continues to exceed plausible domestic offtake through the end of the decade, and the gap widened as EV sales growth moderated. Several announced plants have been delayed, rescoped toward storage, or quietly shelved.",
      evidence:
        "• Announced nameplate cell capacity materially above realistic domestic demand ranges\n• Repeated schedule slips and rescoping of announced greenfield plants\n• Grid-storage offtake absorbing some, but not all, of the redirected volume",
      whyItMatters:
        "An overbuilt pipeline that consolidates disorderly produces stranded assets, regional job losses, and exactly the political backlash that makes the next industrial policy harder to pass.",
      confidence: "medium",
      breakoutRank: 2,
      dissent:
        "A minority view held that storage and export demand will absorb most of the apparent overhang, and that the pipeline is closer to right-sized than headline figures suggest.",
    },
    {
      type: "bottleneck",
      headline:
        "Power-ready sites and project-delivery capacity increasingly matter more than headline incentive packages.",
      whatChanged:
        "The binding constraint on new plants has migrated from capital cost to time-to-power. Sites with secured interconnection, water, and permits now command large premiums, and the scarce input is the engineering and construction workforce that can actually deliver them.",
      evidence:
        "• Interconnection and energisation timelines cited as the top siting factor in recent industrial location decisions\n• Premiums paid for pre-permitted, power-ready industrial parcels\n• Persistent shortages of electricians, pipefitters and construction managers in active industrial corridors",
      whyItMatters:
        "If time-to-power rather than capital is the constraint, then incentive competitions between states are largely redistributive, and the policy lever that matters is site readiness.",
      confidence: "high",
      breakoutRank: 3,
    },
    {
      type: "opportunity",
      headline:
        "Manufacturing machinery, automation, and power electronics may create more durable competitive advantage than additional final assembly.",
      whatChanged:
        "Attention has concentrated on final assembly, while the capital-equipment and power-electronics layers beneath it remain heavily imported. These are higher-margin, more defensible, and harder for competitors to displace once established.",
      evidence:
        "• Continued import dependence for coating, calendering and forming equipment\n• Power-electronics content rising as a share of value in both vehicles and grid equipment\n• Capital-equipment suppliers historically retaining margin through demand cycles better than assemblers",
      whyItMatters:
        "Assembly plants can be relocated; toolmakers and power-electronics suppliers accumulate process knowledge that travels much less easily.",
      confidence: "medium",
      breakoutRank: 4,
    },
    {
      type: "wildcard",
      headline:
        "The United States may establish minimum strategic magnet capacity without creating a globally competitive commercial industry.",
      whatChanged:
        "Mine-to-magnet investment has advanced far enough to plausibly cover defence and critical civilian needs, but not far enough to compete on cost in open commercial markets. The likely landing point is a small protected industry rather than a competitive one.",
      evidence:
        "• Announced separation and magnet facilities sized closer to strategic minimums than to merchant scale\n• Persistent cost gap against incumbent producers at current input prices\n• Offtake concentrated in defence and price-insensitive segments",
      whyItMatters:
        "A strategic-minimum outcome is a legitimate policy choice, but it should be chosen deliberately and funded as such rather than arrived at by accident while claiming commercial success.",
      confidence: "low",
      breakoutRank: 5,
    },
  ],
  "bk-auto": [
    {
      type: "momentum",
      headline:
        "U.S. battery cell output has reached the scale where domestic cost curves, not import parity, set the benchmark.",
      whatChanged:
        "Operating domestic gigafactories moved from commissioning into steady-state yields, and cell costs from mature U.S. lines are now close enough to imported benchmarks that sourcing decisions turn on logistics and contract terms rather than on a structural cost penalty.",
      evidence:
        "• Multiple large U.S. cell plants running at or near design yield\n• Narrowing gap between domestic and landed imported cell costs\n• Automaker sourcing decisions citing supply security alongside price",
      whyItMatters:
        "Once domestic cells are cost-competitive without a subsidy bridge, the entire downstream vehicle strategy stops depending on trade policy holding still.",
      confidence: "medium",
      breakoutRank: 2,
    },
    {
      type: "fragility",
      headline:
        "Vehicle affordability, not charging or range, is now the binding barrier to sustained EV adoption.",
      whatChanged:
        "Consumer objections have shifted decisively toward sticker price and insurance and repair costs. Incentive changes exposed how much of recent demand was price-supported, and the sub-$30,000 segment remains thinly served by domestic manufacturers.",
      evidence:
        "• Demand softening concentrated in entry price bands after incentive changes\n• Insurance and collision-repair costs rising faster for EVs than for comparable ICE vehicles\n• Few domestically built models positioned below the mass-market price threshold",
      whyItMatters:
        "A transition that only serves buyers above the median income is politically fragile and commercially capped, regardless of how good the technology gets.",
      confidence: "high",
      breakoutRank: 1,
    },
    {
      type: "bottleneck",
      headline:
        "Cathode and anode active material capacity, not cell assembly, is the real chokepoint in the domestic battery chain.",
      whatChanged:
        "Cell assembly capacity scaled far faster than the upstream materials that feed it. Domestic cathode qualification runs years behind cell commissioning, leaving nominally domestic cells dependent on imported active material.",
      evidence:
        "• Domestic CAM and AAM capacity lagging announced cell capacity by a wide margin\n• Multi-year qualification cycles for new cathode sources\n• Graphite and precursor supply still concentrated in a small number of overseas suppliers",
      whyItMatters:
        "Content rules and supply-security claims are only as strong as the weakest upstream link, and today that link is materials rather than cells.",
      confidence: "high",
      breakoutRank: 3,
    },
    {
      type: "opportunity",
      headline:
        "Commercial fleets and medium-duty vehicles offer better near-term economics than the consumer market receiving most attention.",
      whatChanged:
        "Depot-charged fleets with predictable duty cycles reached total-cost parity ahead of consumer segments, and operators buy on spreadsheet economics rather than sentiment. This demand is largely invisible in the consumer-focused public debate.",
      evidence:
        "• Total-cost-of-ownership crossover reached earlier for high-utilisation depot fleets\n• Fleet purchasers citing fuel and maintenance savings as the deciding factor\n• Predictable duty cycles removing range and charging objections",
      whyItMatters:
        "Fleet volume stabilises factory utilisation while the consumer market works through its affordability problem, and it is far less exposed to political mood.",
      confidence: "medium",
      breakoutRank: 4,
    },
    {
      type: "wildcard",
      headline:
        "Low-cost vehicles from non-U.S. producers entering third markets could reset global cost expectations faster than domestic policy can respond.",
      whatChanged:
        "Competitive low-cost EVs have scaled rapidly across Europe, Latin America and Southeast Asia. Even fully excluded from the U.S. market, they reset what global buyers and suppliers consider a normal price for a competent electric vehicle.",
      evidence:
        "• Rapid share gains for low-cost exporters in open third markets\n• Price points well below comparable U.S.-built models\n• Supplier and component pricing increasingly benchmarked to those platforms",
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
      whatChanged:
        "Large compute buyers signed long-tenor, high-price contracts for nuclear, geothermal and firm hybrid supply — including restart and uprate deals that no utility procurement process would have produced. Clean firm now has a customer willing to pay for reliability.",
      evidence:
        "• Multi-decade PPAs signed for existing and restarted nuclear capacity\n• Next-generation geothermal contracted directly with compute buyers\n• Contract prices well above prevailing wholesale benchmarks",
      whyItMatters:
        "First-of-a-kind clean firm projects failed for lack of a creditworthy buyer. That buyer now exists, and it is not the regulated utility everyone was waiting for.",
      confidence: "high",
      breakoutRank: 1,
    },
    {
      type: "fragility",
      headline:
        "Advanced nuclear cost credibility still rests on a very small number of projects that have not yet been built.",
      whatChanged:
        "Order books and site agreements grew considerably, but the cost claims underpinning them remain largely unvalidated by completed construction. The sector is being financed on projected nth-of-a-kind economics while still executing first-of-a-kind builds.",
      evidence:
        "• Order announcements substantially outnumbering units under active construction\n• Cost projections premised on learning rates not yet demonstrated in the sector\n• Historical first-of-a-kind overruns not yet clearly broken",
      whyItMatters:
        "If the first completed advanced units land far above projection, the financing market that just opened could close for a decade.",
      confidence: "medium",
      breakoutRank: 2,
    },
    {
      type: "bottleneck",
      headline:
        "Nuclear-qualified supply chain and workforce capacity constrain deployment more tightly than licensing does.",
      whatChanged:
        "Licensing reform advanced meaningfully, revealing the deeper constraint: too few qualified forging, large-component, and welding suppliers, and too few workers carrying nuclear-grade quality credentials. Lead times for critical components did not improve with the regulatory timeline.",
      evidence:
        "• Long lead times persisting for large forgings and reactor-grade components\n• Small number of suppliers holding the relevant quality certifications\n• Nuclear-qualified welder and inspector shortages cited across active projects",
      whyItMatters:
        "Regulatory reform was the visible fight; the supply chain is the slow one, and it cannot be legislated into existence on the same timeline.",
      confidence: "high",
      breakoutRank: 3,
    },
    {
      type: "opportunity",
      headline:
        "Next-generation geothermal can reuse oil and gas drilling capability at a scale the debate consistently understates.",
      whatChanged:
        "Enhanced geothermal has been demonstrated at commercial flow rates using directional drilling and completion techniques transferred directly from unconventional oil and gas, with costs falling quickly across successive well sets.",
      evidence:
        "• Commercial-scale demonstration projects delivering contracted power\n• Well costs declining materially across successive drilling campaigns\n• Crews, rigs and service companies transferring directly from shale operations",
      whyItMatters:
        "It is the rare clean firm option with an existing skilled workforce, an existing supply chain, and a political constituency in energy-producing states.",
      confidence: "medium",
      breakoutRank: 4,
    },
    {
      type: "wildcard",
      headline:
        "Compute demand could shift location or intensity fast enough to strand firm capacity contracted against it.",
      whatChanged:
        "Efficiency gains in model training and inference, alongside aggressive international siting of new capacity, introduce real uncertainty about whether U.S. compute load grows along the trajectory that clean firm investment currently assumes.",
      evidence:
        "• Rapid efficiency improvements reducing energy per unit of useful compute\n• Growing share of announced capacity sited outside the United States\n• Load forecasts revised repeatedly and in both directions",
      whyItMatters:
        "Clean firm assets last sixty years; the demand signal underwriting them has been stable for about three.",
      confidence: "low",
      breakoutRank: 5,
    },
  ],
  "bk-grid": [
    {
      type: "momentum",
      headline:
        "Grid-enhancing technologies and advanced reconductoring moved from pilots into standard utility practice.",
      whatChanged:
        "Dynamic line rating, advanced power flow control and advanced conductors shifted from demonstration projects to line items in approved capital plans, unlocking capacity on existing rights of way in months rather than the decade a new corridor requires.",
      evidence:
        "• Multiple utilities embedding GETs and reconductoring in approved capital plans\n• Measured capacity gains on existing corridors without new right-of-way\n• Regulators beginning to require GETs analysis before approving new-build alternatives",
      whyItMatters:
        "It is the only transmission capacity available on a timescale that matches the load growth already in the interconnection queue.",
      confidence: "high",
      breakoutRank: 2,
    },
    {
      type: "fragility",
      headline:
        "Retail rate increases are converting grid investment into a live political liability.",
      whatChanged:
        "Bills rose faster than general inflation across many service territories, and the connection between data-centre load growth and residential rates became a mainstream political argument. Cost-allocation fights are now the central risk to the build-out.",
      evidence:
        "• Residential rate increases outpacing inflation in numerous jurisdictions\n• Large-load cost allocation emerging as a contested issue in rate cases\n• Affordability featuring prominently in state utility-commission politics",
      whyItMatters:
        "Every dollar of needed grid investment now has to survive an affordability argument, and that argument is currently being lost.",
      confidence: "high",
      breakoutRank: 1,
    },
    {
      type: "bottleneck",
      headline:
        "Interconnection reform has improved queue process without materially shortening time-to-energisation.",
      whatChanged:
        "Cluster studies and transition processes cleared substantial backlog, but projects still wait years between a completed study and actual energisation because the constraint moved downstream to network upgrades, equipment lead times and construction crews.",
      evidence:
        "• Queue backlogs reduced without proportionate improvement in energisation timelines\n• Network upgrade construction now the dominant share of total wait\n• Equipment lead times extending in parallel with process improvements",
      whyItMatters:
        "Reform effort concentrated on the part of the problem that was easiest to see, while the physical bottleneck went largely unaddressed.",
      confidence: "high",
      breakoutRank: 3,
    },
    {
      type: "opportunity",
      headline:
        "Flexible large-load interconnection lets new demand connect years earlier in exchange for curtailment during peak hours.",
      whatChanged:
        "Utilities and large-load customers began signing agreements in which the customer accepts curtailment during a small number of peak hours in return for dramatically faster connection. A handful of hours of flexibility unlocks a large share of existing headroom.",
      evidence:
        "• Flexible-load tariffs and bespoke agreements approved in several jurisdictions\n• Analysis showing large headroom available at modest curtailment obligations\n• Compute customers accepting curtailment terms to secure earlier energisation",
      whyItMatters:
        "It is the cheapest available capacity on the system and it requires contracts rather than construction.",
      confidence: "medium",
      breakoutRank: 4,
    },
    {
      type: "wildcard",
      headline:
        "A severe reliability event in a high-growth region could reset the politics of both load growth and transmission spending overnight.",
      whatChanged:
        "Reserve margins tightened in several regions where load growth is concentrated. A significant loss-of-load event attributed publicly to data-centre demand would reshape siting politics far faster than any planning process.",
      evidence:
        "• Tightening reserve margins flagged in reliability assessments for high-growth regions\n• Load growth concentrated in a limited number of territories\n• Public attribution of grid stress to large new loads already appearing in local coverage",
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
        "AI-driven capital expenditure has become a primary driver of U.S. industrial and electrical investment.",
      whatChanged:
        "Compute build-out moved from a technology-sector story to a macroeconomic one, pulling through electrical equipment, construction, gas turbines and skilled trades at a scale that now registers in national investment statistics.",
      evidence:
        "• Data-centre construction a leading category of non-residential structures investment\n• Turbine, transformer and switchgear order books lengthened substantially by compute demand\n• Regional construction employment gains concentrated around announced campuses",
      whyItMatters:
        "For the first time in decades a private demand signal, not a public programme, is pulling the domestic electrical industrial base forward.",
      confidence: "high",
      breakoutRank: 1,
    },
    {
      type: "fragility",
      headline:
        "Energy investment is being underwritten against compute demand forecasts that have proven repeatedly unstable.",
      whatChanged:
        "Load forecasts were revised sharply and in both directions as efficiency gains, model architecture changes and siting decisions landed. Utilities are nonetheless planning multi-decade assets against the current version of those forecasts.",
      evidence:
        "• Large revisions to utility load forecasts within short intervals\n• Speculative interconnection requests inflating apparent demand through duplicate applications\n• Efficiency improvements repeatedly outrunning projected energy intensity",
      whyItMatters:
        "Over-building against a soft forecast puts the cost on ratepayers; under-building puts it on reliability. Neither error is recoverable quickly.",
      confidence: "medium",
      breakoutRank: 2,
    },
    {
      type: "bottleneck",
      headline:
        "Electrical infrastructure lead times, not chips, now set the pace of U.S. compute deployment.",
      whatChanged:
        "Chip supply eased relative to demand while transformers, switchgear, turbines and substation construction became the binding constraint. Operators are buying and warehousing electrical equipment years ahead of need.",
      evidence:
        "• Multi-year lead times for large power transformers and high-voltage switchgear\n• Gas turbine order books effectively sold out well into the next decade\n• Operators pre-purchasing and stockpiling long-lead electrical equipment",
      whyItMatters:
        "The AI race is currently an electrical-equipment manufacturing race, and that is a competition the United States can actually choose to win.",
      confidence: "high",
      breakoutRank: 3,
    },
    {
      type: "opportunity",
      headline:
        "AI applied to grid operations, permitting and industrial process control is far more valuable near-term than AI-driven materials discovery.",
      whatChanged:
        "Practical deployments in outage prediction, interconnection study automation, permit review and process optimisation delivered measurable results, while the headline promise of AI-accelerated materials discovery remains largely prospective.",
      evidence:
        "• Documented cycle-time reductions in utility engineering and study workflows\n• Automated review tools cutting permitting and environmental review timelines\n• Process-control deployments delivering measured energy-intensity improvements",
      whyItMatters:
        "The near-term energy value of AI is in clearing the administrative and operational bottlenecks that already constrain the build-out.",
      confidence: "medium",
      breakoutRank: 4,
    },
    {
      type: "wildcard",
      headline:
        "A step change in compute efficiency could decouple AI capability growth from electricity demand growth.",
      whatChanged:
        "Efficiency gains from architecture, sparsity, specialised silicon and improved utilisation have repeatedly outpaced projections. A sustained step change would break the assumed link between AI capability and load growth that underpins current energy planning.",
      evidence:
        "• Energy per unit of useful output falling faster than most published projections\n• Specialised inference silicon delivering large efficiency gains over general-purpose hardware\n• Utilisation improvements reducing energy per deployed unit of capacity",
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
        whatChanged: seed.whatChanged,
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
  /** Include the 25 demo findings, pre-submitted and ready to auction. */
  demo?: boolean;
  panelistNames?: string[];
}

export function createEvent(options: CreateEventOptions = {}): EventState {
  const demo = options.demo ?? false;
  const startingBudget = options.startingBudget ?? 100;
  const now = Date.now();

  const panelists: Panelist[] = (
    options.panelistNames?.length
      ? options.panelistNames.map((name, i) => ({
          id: `pl-${i + 1}`,
          name,
          affiliation: "",
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
      currentRoundIndex: demo ? 0 : -1,
      displayMode: "board",
      status: demo ? "auction" : "setup",
      declareWinner: false,
      showSummary: false,
      enforceBudgetReserve: false,
      isDemo: demo,
      createdAt: now,
    },
    breakouts: makeBreakouts(demo),
    findings: demo ? makeFindings(true) : [],
    panelists,
    objectives: OBJECTIVE_BLUEPRINT.map((o) => ({ ...o })),
    transactions: [],
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
  const types: FindingType[] = [
    "momentum",
    "fragility",
    "bottleneck",
    "opportunity",
    "wildcard",
  ];
  return types.map((type, index) => ({
    id: `fd-${breakoutId}-${type}-${now.toString(36)}${index}`,
    breakoutId,
    type,
    headline: "",
    whatChanged: "",
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
