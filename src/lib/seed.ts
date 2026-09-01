// ---------------------------------------------------------------------------
// Default event scaffolding + demo content.
//
// IMPORTANT: the 25 findings below are *illustrative placeholders* written so
// the board, the auction and the portfolio screens can be rehearsed end to end
// with realistic-looking material. Each is true in direction and correct in
// shape; none has been verified for the day, and all are meant to be replaced
// by what the breakouts actually produce. `/control` can wipe them in one click
// ("Clear findings").
//
// The evidence lines carry no statistics, deliberately. A demo board covered in
// precise-looking numbers is a hazard: someone photographs it, or a room copies
// the style and invents figures of its own under time pressure. Qualitative
// evidence also models the right behaviour for a room writing with no data in
// front of it. If you want a hard figure on the board, put in a real one.
// ---------------------------------------------------------------------------

import { emptySchedule } from "./schedule";
import {
  type Breakout,
  DEFAULT_ROLES,
  type EventState,
  type Finding,
  FINDING_TYPES,
  type FindingType,
  type Panelist,
  SCHEMA_VERSION,
  type ScheduleState,
  type Segment,
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

// --- The run of show -------------------------------------------------------

/**
 * The breakout's internal run of show.
 *
 * This exists because of one failure mode: a room that discusses for seventy
 * minutes and then discovers it has five to write in. The phase at minute 35
 * is the whole point of the strip, and it is written as an instruction rather
 * than a topic so it cannot be read as "keep talking".
 */
export const BREAKOUT_PHASES: Segment["phases"] = [
  {
    title: "Set the frame",
    minutes: 5,
    note: "Sector boundary. Candid assessment, not consensus",
  },
  {
    title: "Status update",
    minutes: 15,
    note: "The 5–7 most consequential changes since March 2025",
  },
  {
    title: "Interrogate",
    minutes: 15,
    note: "Separate announcements from implementation and outcomes",
  },
  {
    title: "Diagnose",
    minutes: 20,
    note: "Typists: open your cards now and start typing headlines",
  },
  {
    title: "Draft the five findings",
    minutes: 13,
    note: "Headline, why it matters, confidence. Evidence if you have it",
  },
  {
    title: "Sharpen and rank",
    minutes: 5,
    note: "Merge overlaps. Set the 1–5 order",
  },
  {
    title: "Presenter and submit",
    minutes: 2,
    note: "Name your presenter. Submit",
  },
];

/**
 * The day, as planned.
 *
 * Wall-clock starts are stored as well as derived: the printed agenda and the
 * table cards carry these times, so the record has to keep saying 9:50 even
 * after the opening panel has taken an extra five minutes. `projectedStarts`
 * in lib/schedule.ts is what shows the operator the knock-on effect.
 */
export function createRunOfShow(): ScheduleState {
  const segments: Segment[] = [
    {
      id: "sg-welcome",
      title: "Welcome and Framing",
      description:
        "What this session is for, how the morning runs, and what the room is being asked to produce.",
      plannedStart: "8:30",
      plannedMinutes: 15,
      displayMode: "card",
    },
    {
      id: "sg-standing",
      title: "Where Do Things Stand Today",
      description:
        "Three takes on the last eighteen months, before the rooms go and argue about them.",
      speakers: ["Jon Larsen", "Brian Deese / Charlie Anderson", "Mike Catanzaro"],
      plannedStart: "8:45",
      plannedMinutes: 55,
      displayMode: "card",
    },
    {
      id: "sg-move",
      title: "Move to Breakout Rooms",
      description: "Find your room, open your link, enter the PIN on your table card.",
      plannedStart: "9:40",
      plannedMinutes: 10,
      displayMode: "instructions",
    },
    {
      id: "sg-breakouts",
      title: "Breakout Sessions",
      description: "Five rooms, five Strategic Findings each, written as you go.",
      plannedStart: "9:50",
      plannedMinutes: 75,
      displayMode: "findings",
      phases: BREAKOUT_PHASES,
    },
    {
      id: "sg-seating",
      title: "Transition and Seating",
      description: "Back to the main room. Presenters to the front.",
      plannedStart: "11:05",
      plannedMinutes: 10,
      displayMode: "instructions",
    },
    {
      id: "sg-presentations",
      title: "Breakout Presentations",
      description: "Two and a half minutes each. Five rooms, hard-timed.",
      plannedStart: "11:15",
      plannedMinutes: 15,
      displayMode: "findings",
      presentationTimer: true,
      presentationSeconds: 150,
      presenterCount: 5,
      operatorNotes:
        "Hard-timed. Click NEXT PRESENTER as each one starts, not as they finish.",
    },
    {
      id: "sg-questions",
      title: "Panel Questions",
      description: "The panel puts its questions to the rooms before bidding opens.",
      plannedStart: "11:30",
      plannedMinutes: 5,
      displayMode: "findings",
    },
    {
      id: "sg-auction",
      title: "Strategic Findings Auction",
      description:
        "Each panelist drafts the strongest set of findings for the question under their name.",
      plannedStart: "11:35",
      plannedMinutes: 35,
      displayMode: "auction",
      operatorNotes:
        "If still in round 2 at 12:00, call the final round at 60 seconds a lot with no rationale until the defenses.",
    },
    {
      id: "sg-defenses",
      title: "Team Defenses",
      description: "Each panelist makes the case for the portfolio they built.",
      plannedStart: "12:10",
      plannedMinutes: 8,
      displayMode: "portfolios",
    },
    {
      id: "sg-synthesis",
      title: "Audience vs Panel and Synthesis",
      description: "What the room would have paid, against what the panel actually paid.",
      plannedStart: "12:18",
      plannedMinutes: 10,
      displayMode: "audience",
    },
    {
      id: "sg-close",
      title: "Close",
      description: "What happens with this material next.",
      plannedStart: "12:28",
      plannedMinutes: 2,
      displayMode: "card",
    },
    {
      id: "sg-lunch",
      title: "Lunch",
      description: "Thank you for coming.",
      plannedStart: "12:30",
      plannedMinutes: 60,
      displayMode: "card",
    },
  ];

  return { ...emptySchedule(), segments };
}

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
      type: "bottleneck",
      headline:
        "Power-ready sites, not incentive packages, are now the binding constraint on where manufacturing actually lands.",
      evidence:
        "• Site selection increasingly turns on interconnection date rather than incentive value\n• Every state can match a subsidy; few can match a powered site",
      whyItMatters:
        "This reprices the entire economic development toolkit. The marginal public dollar now returns more in site preparation and interconnection than in incentives, and few states are set up to spend it that way.",
      confidence: "high",
      breakoutRank: 1,
    },
    {
      type: "momentum",
      headline:
        "Grid equipment is the one manufacturing segment where order books, not incentives, justify new domestic capacity.",
      evidence:
        "• Transformer and switchgear lead times remain multi-year despite three years of additions\n• Utility and hyperscaler procurement is contracted forward, not speculative",
      whyItMatters:
        "The rare segment where demand is contracted rather than policy-dependent, so the capacity survives a change of administration. It is also the segment most binding on everything else.",
      confidence: "high",
      breakoutRank: 2,
    },
    {
      type: "fragility",
      headline:
        "The battery cell pipeline is sized for a domestic demand curve that policy has since removed.",
      evidence:
        "• Announced cell capacity far exceeds credible US vehicle and storage demand\n• Consumer credit repeal removed the demand assumption plants were financed against",
      whyItMatters:
        "Idle or cancelled plants in the districts that were promised them are the most direct route to political discreditation of industrial policy generally.",
      confidence: "high",
      breakoutRank: 3,
    },
    {
      type: "opportunity",
      headline:
        "Machinery, automation and power electronics may hold domestic advantage longer than the final assembly they enable.",
      evidence:
        "• Capital equipment is harder to relocate and carries higher margins than assembly\n• US industrial policy has focused almost entirely on the assembled product",
      whyItMatters:
        "Whoever supplies the tools captures value across every downstream factory, including foreign ones. This is the layer where an export position is still available and where no programme is currently aimed.",
      confidence: "medium",
      breakoutRank: 4,
    },
    {
      type: "wildcard",
      headline:
        "A federal price floor for critical minerals may prove more durable industrial policy than any tax credit.",
      evidence:
        "• Offtake floors survive appropriations cycles in a way credits and grants do not\n• The model is being tested in magnets and could extend further",
      whyItMatters:
        "If price floors work, the template transfers to any mineral where China sets the marginal price. If they do not, the US has underwritten a captive supplier without a competitive industry.",
      confidence: "medium",
      breakoutRank: 5,
    },
  ],
  "bk-auto": [
    {
      type: "fragility",
      headline:
        "Magnet and cell dependence gives one government the ability to stop American vehicle production within weeks.",
      evidence:
        "• Export controls on magnets have already idled production lines once\n• No qualified non-Chinese source exists at automotive volume or price",
      whyItMatters:
        "The clearest live example of industrial dependence functioning as a coercive lever, and it applies to defence systems and grid equipment using the same magnets, not only to cars.",
      confidence: "high",
      breakoutRank: 1,
    },
    {
      type: "bottleneck",
      headline:
        "Affordability, not charging or range, is what now caps the addressable market for electric vehicles.",
      evidence:
        "• No US-built EV reaches the price segment where most vehicles actually sell\n• Tariffs and content rules raise the floor price further",
      whyItMatters:
        "Every other decarbonisation and industrial goal in the sector runs through volume, and volume runs through a price point no domestic product currently occupies.",
      confidence: "high",
      breakoutRank: 2,
    },
    {
      type: "momentum",
      headline:
        "Hybrid capacity is the one auto investment thesis that survived the policy reversal intact.",
      evidence:
        "• OEM capital shifted to hybrids as EV credit support was withdrawn\n• Hybrids carry domestic content without depending on cell supply at scale",
      whyItMatters:
        "It keeps assembly plants and supplier employment intact through the downturn, but defers the battery scale the US needs to compete later. Resilience now, disadvantage later.",
      confidence: "medium",
      breakoutRank: 3,
    },
    {
      type: "opportunity",
      headline:
        "The competitive battle has moved to vehicle software and electronics, where the US still holds a position.",
      evidence:
        "• Chinese cost advantage is in cells and assembly, not in vehicle software\n• US industrial policy has almost no instruments aimed at this layer",
      whyItMatters:
        "If margin migrates from the powertrain to the software stack, the US position is stronger than the cell numbers suggest, and current policy is aimed at the wrong part of the vehicle.",
      confidence: "low",
      breakoutRank: 4,
    },
    {
      type: "wildcard",
      headline:
        "Losing third-country export markets to Chinese vehicles may matter more than losing share at home.",
      evidence:
        "• Chinese OEMs are taking share across Latin America, Southeast Asia and Europe\n• The domestic market can be protected by tariff; export markets cannot",
      whyItMatters:
        "Scale is earned globally and spent domestically. A protected home market with no export position produces a permanently subscale industry, which is the outcome nobody is measuring.",
      confidence: "medium",
      breakoutRank: 5,
    },
  ],
  "bk-clean-firm": [
    {
      type: "momentum",
      headline:
        "Enhanced geothermal has crossed from demonstration to a repeatable cost curve borrowed from shale drilling.",
      evidence:
        "• Drilling times and well costs have fallen across successive projects\n• The workforce, rigs and supply chain already exist domestically",
      whyItMatters:
        "The only clean firm technology improving on repeat rather than on promise, and the only one whose supply chain is already American and politically uncontested.",
      confidence: "high",
      breakoutRank: 1,
    },
    {
      type: "fragility",
      headline:
        "Nuclear's order book is almost entirely announcements; nothing yet shows a second unit costs less than the first.",
      evidence:
        "• Hyperscaler agreements are largely contingent, not financed construction starts\n• No US small modular reactor has completed a first commercial unit",
      whyItMatters:
        "The entire clean firm investment case rests on a learning rate nobody has demonstrated. If the first repeat unit does not come in cheaper, the sector reprices in a quarter.",
      confidence: "high",
      breakoutRank: 2,
    },
    {
      type: "bottleneck",
      headline:
        "The binding constraint is the absence of a repeat buyer, not the absence of capital or permits.",
      evidence:
        "• Every project is financed as a one-off, so no learning accrues\n• Licensing reform has moved faster than procurement has",
      whyItMatters:
        "Cost declines come from order books, not from demonstrations. Until one buyer commits to a sequence of identical units, each project pays first-of-a-kind cost and the curve never starts.",
      confidence: "medium",
      breakoutRank: 3,
    },
    {
      type: "opportunity",
      headline:
        "Gas turbine scarcity has quietly made clean firm competitive on schedule rather than on cost.",
      evidence:
        "• Turbine order backlogs now stretch years beyond most project timelines\n• Buyers are comparing available dates, not levelised costs",
      whyItMatters:
        "The competitive comparison has shifted from price per megawatt-hour to who can deliver in the required year. That changes the case for clean firm without any change in its cost.",
      confidence: "medium",
      breakoutRank: 4,
    },
    {
      type: "wildcard",
      headline:
        "The first public cost overrun at a modular reactor will price the whole sector, fairly or not.",
      evidence:
        "• Investor appetite is built on an unproven claim about repeat-unit cost\n• One project's schedule slip gets read as the technology's",
      whyItMatters:
        "Sector confidence rests on projects not yet built. A single visible failure would reset financing terms for every developer, including those with different designs and better records.",
      confidence: "medium",
      breakoutRank: 5,
    },
  ],
  "bk-grid": [
    {
      type: "fragility",
      headline:
        "Electricity affordability has become the binding political constraint, and it now limits what the grid can build.",
      evidence:
        "• Rate increases and data centre siting are now the same political fight\n• Multiple states have moved to restrict or condition new large loads",
      whyItMatters:
        "Public consent, not capital or capability, now determines build rates. An agenda that raises bills loses the authority it needs to keep building, and it loses it in both parties.",
      confidence: "high",
      breakoutRank: 1,
    },
    {
      type: "momentum",
      headline:
        "Regulators have begun treating large loads as a distinct class with their own reliability obligations.",
      evidence:
        "• Every major market now has an open proceeding on large load interconnection\n• Flexibility obligations are appearing in tariffs rather than only in pilots",
      whyItMatters:
        "This is the mechanism that converts data centre demand from a grid problem into a grid resource. It moves faster than transmission construction and requires no new steel.",
      confidence: "medium",
      breakoutRank: 2,
    },
    {
      type: "bottleneck",
      headline:
        "Equipment lead times and construction labour, not permits or queue position, now set the pace of grid expansion.",
      evidence:
        "• Transformer and high-voltage equipment lead times remain measured in years\n• Queue reform has outpaced the ability to build what clears it",
      whyItMatters:
        "Reform effort is concentrated where the constraint used to be. Clearing queues faster produces projects that then wait on a transformer, which no permitting bill addresses.",
      confidence: "high",
      breakoutRank: 3,
    },
    {
      type: "opportunity",
      headline:
        "The cheapest available capacity is unused headroom on existing lines, and almost no regulator measures it.",
      evidence:
        "• The system is engineered for a few hundred hours a year\n• No standard utilization metric exists for regulators to allocate capital against",
      whyItMatters:
        "Capital cannot be directed at headroom nobody measures. A reporting requirement costing almost nothing would unlock capacity that otherwise takes a decade and a rate case to build.",
      confidence: "medium",
      breakoutRank: 4,
    },
    {
      type: "wildcard",
      headline:
        "If load growth forecasts prove overstated, ratepayers are left holding infrastructure built for demand that never arrived.",
      evidence:
        "• Interconnection requests substantially exceed any plausible connected load\n• Speculative applications sit in the same queues as firm ones",
      whyItMatters:
        "The affordability backlash following a stranded build would do more damage than the shortage it was meant to prevent, and the cost allocation rules to prevent it are not written.",
      confidence: "medium",
      breakoutRank: 5,
    },
  ],
  "bk-ai": [
    {
      type: "momentum",
      headline:
        "Curtailable data centres have moved from research idea to contracted product in under two years.",
      evidence:
        "• Flexibility is appearing in signed interconnection agreements, not only in pilots\n• Operators accept curtailment in exchange for years of earlier energisation",
      whyItMatters:
        "The only mechanism that adds large load on the timescale AI investment actually needs, and it converts the sector's biggest political liability into a grid asset.",
      confidence: "medium",
      breakoutRank: 1,
    },
    {
      type: "fragility",
      headline:
        "The gap between announced and connectable compute is a financial exposure, not a planning error.",
      evidence:
        "• Announced capacity exceeds what interconnection can deliver this decade\n• Capital is committed against energisation dates utilities have not confirmed",
      whyItMatters:
        "Compute schedules have been financed against power that does not exist. The correction lands on developers, then on utilities that overbuilt for them, then on ratepayers.",
      confidence: "medium",
      breakoutRank: 2,
    },
    {
      type: "bottleneck",
      headline:
        "Utilities and regulators cannot adopt AI tools because of procurement and staffing, not because of technology.",
      evidence:
        "• Planning and interconnection studies remain largely manual at most utilities\n• Cost recovery rules do not accommodate software the way they do steel",
      whyItMatters:
        "The tools that would compress interconnection timelines already exist. No regulatory mechanism lets a utility earn on buying them, so the bottleneck persists for institutional reasons.",
      confidence: "medium",
      breakoutRank: 3,
    },
    {
      type: "opportunity",
      headline:
        "AI process optimisation is available to large manufacturers and effectively out of reach for their suppliers.",
      evidence:
        "• Adoption is concentrated in firms with in-house data science capability\n• Small and mid-sized suppliers lack both the capital and the integration skills",
      whyItMatters:
        "Reindustrialisation depends on supplier productivity, not on flagship plants. If the gain accrues only to the largest firms, the cost gap with China closes at the top and nowhere else.",
      confidence: "medium",
      breakoutRank: 4,
    },
    {
      type: "wildcard",
      headline:
        "Quantum's first real energy application is likely to be breaking grid cryptography, not optimising dispatch.",
      evidence:
        "• Grid control systems have replacement cycles measured in decades\n• Post-quantum migration has barely begun in operational technology",
      whyItMatters:
        "The sector treats quantum as an optimisation upside. The nearer-term consequence is that long-lived control systems being installed now will outlast the cryptography protecting them.",
      confidence: "low",
      breakoutRank: 5,
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
    runOfShow: createRunOfShow(),
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
