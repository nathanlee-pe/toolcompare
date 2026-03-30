#!/usr/bin/env tsx
/**
 * scripts/seed-catalogue.ts
 *
 * Seeds 20 SaaS categories and 100 tools (5 per category) by calling
 * scripts/generate-review.ts for each tool. Every review is a full
 * AI-generated article written by Claude with real pricing, pros/cons,
 * and SEO metadata.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   npm run seed:catalogue
 *
 * Flags:
 *   --publish          Publish each tool immediately after generation
 *   --force            Re-generate tools already in the DB (default: skip them)
 *   --dry-run          Print the full plan without calling the API or writing to DB
 *   --from=N           Resume from the Nth tool (1-based). Useful after a failure.
 *   --category=slug    Only generate tools in one category (e.g. --category=crm)
 *   --delay=N          Milliseconds between API calls (default: 2000)
 *
 * ─── How it works ────────────────────────────────────────────────────────────
 *
 *   1. Upserts all 20 category rows into the DB.
 *   2. For each tool (in order):
 *      a. If already in DB and --force not set → skip.
 *      b. Spawns `tsx scripts/generate-review.ts "<name>" [--publish]` as a
 *         child process with stdio: "inherit" so Claude's streaming output
 *         prints to your terminal in real time.
 *      c. After success, updates the tool's categoryId to the intended category
 *         so the catalogue structure matches what you defined here.
 *      d. Waits DELAY_MS before the next call.
 *   3. Prints a summary: generated / skipped / failed counts + total time.
 *
 * ─── Estimated runtime ───────────────────────────────────────────────────────
 *
 *   Each tool takes ~40–90 s (2× Claude API calls: streaming review + structured
 *   extraction). 100 tools with 2 s delay ≈ 70–90 minutes total.
 *   Use --from=N to resume mid-run if needed.
 */

import { spawnSync } from "child_process";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

// ─── CLI flags ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const PUBLISH   = args.includes("--publish");
const FORCE     = args.includes("--force");
const DRY_RUN   = args.includes("--dry-run");
const FROM      = parseInt(args.find((a) => a.startsWith("--from="))?.split("=")[1] ?? "1", 10);
const ONLY_CAT  = args.find((a) => a.startsWith("--category="))?.split("=")[1];
const DELAY_MS  = parseInt(args.find((a) => a.startsWith("--delay="))?.split("=")[1] ?? "2000", 10);

// ─── Catalogue definition ─────────────────────────────────────────────────────

interface CategoryDef {
  name:            string;
  slug:            string;
  description:     string;
  icon:            string;
  metaTitle?:      string;
  metaDescription?: string;
}

interface ToolDef {
  /** Passed to Claude verbatim — use the official product name */
  name:         string;
  categorySlug: string;
  /** Optional pre-filled affiliate URL */
  affiliate?:   string;
}

const CATEGORIES: CategoryDef[] = [
  {
    name: "Project Management",
    slug: "project-management",
    description: "Tools for planning, tracking, and shipping projects on time.",
    icon: "📋",
    metaTitle: "Best Project Management Software",
    metaDescription: "Compare the top project management tools for teams of all sizes. Expert reviews, pricing, and feature breakdowns.",
  },
  {
    name: "CRM",
    slug: "crm",
    description: "Customer relationship management software to track leads, deals, and customers.",
    icon: "🤝",
    metaTitle: "Best CRM Software",
    metaDescription: "Find the best CRM for your sales team. Compare HubSpot, Salesforce, Pipedrive, and more.",
  },
  {
    name: "Email Marketing",
    slug: "email-marketing",
    description: "Email automation and campaign management platforms.",
    icon: "📧",
    metaTitle: "Best Email Marketing Software",
    metaDescription: "Compare the top email marketing platforms. Pricing, deliverability, and automation features reviewed.",
  },
  {
    name: "Web Analytics",
    slug: "web-analytics",
    description: "Product and website analytics tools that help you understand user behavior.",
    icon: "📊",
    metaTitle: "Best Web Analytics Tools",
    metaDescription: "Compare Mixpanel, Amplitude, Heap, and more. Find the right analytics tool for your product team.",
  },
  {
    name: "Customer Support",
    slug: "customer-support",
    description: "Help desk and live chat platforms for delivering great customer service.",
    icon: "💬",
    metaTitle: "Best Customer Support Software",
    metaDescription: "Compare Zendesk, Intercom, Freshdesk, and more. Find the right support tool for your team.",
  },
  {
    name: "HR & People Ops",
    slug: "hr-people-ops",
    description: "HR software for payroll, benefits, performance management, and team growth.",
    icon: "👥",
    metaTitle: "Best HR Software",
    metaDescription: "Compare BambooHR, Rippling, Gusto, and more. Find the best HR platform for your company size.",
  },
  {
    name: "Accounting",
    slug: "accounting",
    description: "Accounting and bookkeeping software for small businesses and enterprises.",
    icon: "💰",
    metaTitle: "Best Accounting Software",
    metaDescription: "Compare QuickBooks, Xero, FreshBooks, and more. Find the right accounting tool for your business.",
  },
  {
    name: "Marketing Automation",
    slug: "marketing-automation",
    description: "Platforms that automate multi-channel marketing campaigns and lead nurturing.",
    icon: "🎯",
    metaTitle: "Best Marketing Automation Software",
    metaDescription: "Compare Marketo, Pardot, Drip, and more. Find the right marketing automation platform.",
  },
  {
    name: "Video Conferencing",
    slug: "video-conferencing",
    description: "Video meeting, webinar, and async video platforms for remote teams.",
    icon: "🎥",
    metaTitle: "Best Video Conferencing Software",
    metaDescription: "Compare Zoom, Google Meet, Webex, Loom, and more. Find the right video tool for your team.",
  },
  {
    name: "Design & Prototyping",
    slug: "design-prototyping",
    description: "UI/UX design, prototyping, and visual collaboration tools.",
    icon: "🎨",
    metaTitle: "Best Design & Prototyping Tools",
    metaDescription: "Compare Figma, Adobe XD, Canva, and more. Find the best design tool for your workflow.",
  },
  {
    name: "Sales Intelligence",
    slug: "sales-intelligence",
    description: "Data enrichment and prospecting tools that help sales teams find and reach buyers.",
    icon: "🔍",
    metaTitle: "Best Sales Intelligence Tools",
    metaDescription: "Compare ZoomInfo, Apollo.io, Cognism, and more. Find the best prospecting data platform.",
  },
  {
    name: "CMS & Website Builder",
    slug: "cms-website-builder",
    description: "Content management systems and no-code website builders.",
    icon: "🌐",
    metaTitle: "Best CMS & Website Builder",
    metaDescription: "Compare WordPress, Webflow, Contentful, and more. Find the right CMS for your project.",
  },
  {
    name: "Business Intelligence",
    slug: "business-intelligence",
    description: "BI and data visualization tools that turn raw data into actionable insights.",
    icon: "📈",
    metaTitle: "Best Business Intelligence Software",
    metaDescription: "Compare Tableau, Power BI, Looker, Metabase, and more. Find the right BI tool for your team.",
  },
  {
    name: "Developer Tools",
    slug: "developer-tools",
    description: "Code hosting, CI/CD, monitoring, and error tracking tools for engineering teams.",
    icon: "🛠️",
    metaTitle: "Best Developer Tools",
    metaDescription: "Compare GitHub, GitLab, Sentry, Datadog, and more. Find the best dev tools for your stack.",
  },
  {
    name: "Identity & Security",
    slug: "identity-security",
    description: "Password managers, identity providers, and zero-trust security platforms.",
    icon: "🔒",
    metaTitle: "Best Identity & Security Software",
    metaDescription: "Compare 1Password, Okta, Bitwarden, and more. Find the right security tool for your team.",
  },
  {
    name: "E-commerce",
    slug: "e-commerce",
    description: "Platforms for building and running online stores.",
    icon: "🛒",
    metaTitle: "Best E-commerce Platforms",
    metaDescription: "Compare Shopify, BigCommerce, WooCommerce, and more. Find the right e-commerce platform.",
  },
  {
    name: "Social Media Management",
    slug: "social-media-management",
    description: "Tools for scheduling, publishing, and analyzing social media content.",
    icon: "📱",
    metaTitle: "Best Social Media Management Tools",
    metaDescription: "Compare Buffer, Hootsuite, Sprout Social, and more. Find the best social media tool.",
  },
  {
    name: "E-signature & Contracts",
    slug: "esignature-contracts",
    description: "Electronic signature and contract lifecycle management platforms.",
    icon: "✍️",
    metaTitle: "Best E-signature Software",
    metaDescription: "Compare DocuSign, PandaDoc, HelloSign, and more. Find the right e-signature platform.",
  },
  {
    name: "Cloud Infrastructure",
    slug: "cloud-infrastructure",
    description: "Cloud hosting, deployment, and infrastructure platforms.",
    icon: "☁️",
    metaTitle: "Best Cloud Infrastructure Platforms",
    metaDescription: "Compare DigitalOcean, Heroku, Vercel, Cloudflare, and more. Find the right cloud platform.",
  },
  {
    name: "Team Collaboration",
    slug: "team-collaboration",
    description: "Messaging, wikis, whiteboards, and async collaboration tools for remote teams.",
    icon: "💡",
    metaTitle: "Best Team Collaboration Software",
    metaDescription: "Compare Slack, Notion, Confluence, Miro, and more. Find the best collaboration tool.",
  },
];

// 5 tools per category — listed in the order we want to generate them.
// Tool names are passed verbatim to Claude, so use official product names.
const TOOLS: ToolDef[] = [
  // ── Project Management ────────────────────────────────────────────────────
  { name: "Asana",       categorySlug: "project-management" },
  { name: "Monday.com",  categorySlug: "project-management" },
  { name: "Jira",        categorySlug: "project-management" },
  { name: "Linear",      categorySlug: "project-management" },
  { name: "ClickUp",     categorySlug: "project-management" },

  // ── CRM ───────────────────────────────────────────────────────────────────
  { name: "HubSpot CRM",  categorySlug: "crm" },
  { name: "Salesforce",   categorySlug: "crm" },
  { name: "Pipedrive",    categorySlug: "crm" },
  { name: "Zoho CRM",     categorySlug: "crm" },
  { name: "Freshsales",   categorySlug: "crm" },

  // ── Email Marketing ───────────────────────────────────────────────────────
  { name: "Mailchimp",       categorySlug: "email-marketing" },
  { name: "Klaviyo",         categorySlug: "email-marketing" },
  { name: "ConvertKit",      categorySlug: "email-marketing" },
  { name: "ActiveCampaign",  categorySlug: "email-marketing" },
  { name: "Brevo",           categorySlug: "email-marketing" },

  // ── Web Analytics ─────────────────────────────────────────────────────────
  { name: "Mixpanel",          categorySlug: "web-analytics" },
  { name: "Amplitude",         categorySlug: "web-analytics" },
  { name: "Heap Analytics",    categorySlug: "web-analytics" },
  { name: "Plausible Analytics", categorySlug: "web-analytics" },
  { name: "PostHog",           categorySlug: "web-analytics" },

  // ── Customer Support ──────────────────────────────────────────────────────
  { name: "Zendesk",    categorySlug: "customer-support" },
  { name: "Intercom",   categorySlug: "customer-support" },
  { name: "Freshdesk",  categorySlug: "customer-support" },
  { name: "Help Scout", categorySlug: "customer-support" },
  { name: "Gorgias",    categorySlug: "customer-support" },

  // ── HR & People Ops ───────────────────────────────────────────────────────
  { name: "BambooHR",  categorySlug: "hr-people-ops" },
  { name: "Rippling",  categorySlug: "hr-people-ops" },
  { name: "Lattice",   categorySlug: "hr-people-ops" },
  { name: "Gusto",     categorySlug: "hr-people-ops" },
  { name: "Workday",   categorySlug: "hr-people-ops" },

  // ── Accounting ────────────────────────────────────────────────────────────
  { name: "QuickBooks Online", categorySlug: "accounting" },
  { name: "Xero",              categorySlug: "accounting" },
  { name: "FreshBooks",        categorySlug: "accounting" },
  { name: "Wave Accounting",   categorySlug: "accounting" },
  { name: "Sage Intacct",      categorySlug: "accounting" },

  // ── Marketing Automation ──────────────────────────────────────────────────
  { name: "Marketo",         categorySlug: "marketing-automation" },
  { name: "Pardot",          categorySlug: "marketing-automation" },
  { name: "Drip",            categorySlug: "marketing-automation" },
  { name: "Keap",            categorySlug: "marketing-automation" },
  { name: "GetResponse",     categorySlug: "marketing-automation" },

  // ── Video Conferencing ────────────────────────────────────────────────────
  { name: "Zoom",         categorySlug: "video-conferencing" },
  { name: "Google Meet",  categorySlug: "video-conferencing" },
  { name: "Webex",        categorySlug: "video-conferencing" },
  { name: "Loom",         categorySlug: "video-conferencing" },
  { name: "Whereby",      categorySlug: "video-conferencing" },

  // ── Design & Prototyping ──────────────────────────────────────────────────
  { name: "Figma",     categorySlug: "design-prototyping" },
  { name: "Adobe XD",  categorySlug: "design-prototyping" },
  { name: "Canva",     categorySlug: "design-prototyping" },
  { name: "Sketch",    categorySlug: "design-prototyping" },
  { name: "InVision",  categorySlug: "design-prototyping" },

  // ── Sales Intelligence ────────────────────────────────────────────────────
  { name: "ZoomInfo",   categorySlug: "sales-intelligence" },
  { name: "Apollo.io",  categorySlug: "sales-intelligence" },
  { name: "Cognism",    categorySlug: "sales-intelligence" },
  { name: "Lusha",      categorySlug: "sales-intelligence" },
  { name: "LeadIQ",     categorySlug: "sales-intelligence" },

  // ── CMS & Website Builder ─────────────────────────────────────────────────
  { name: "WordPress",   categorySlug: "cms-website-builder" },
  { name: "Webflow",     categorySlug: "cms-website-builder" },
  { name: "Contentful",  categorySlug: "cms-website-builder" },
  { name: "Sanity",      categorySlug: "cms-website-builder" },
  { name: "Ghost",       categorySlug: "cms-website-builder" },

  // ── Business Intelligence ─────────────────────────────────────────────────
  { name: "Tableau",    categorySlug: "business-intelligence" },
  { name: "Power BI",   categorySlug: "business-intelligence" },
  { name: "Looker",     categorySlug: "business-intelligence" },
  { name: "Metabase",   categorySlug: "business-intelligence" },
  { name: "Sisense",    categorySlug: "business-intelligence" },

  // ── Developer Tools ───────────────────────────────────────────────────────
  { name: "GitHub",      categorySlug: "developer-tools" },
  { name: "GitLab",      categorySlug: "developer-tools" },
  { name: "Sentry",      categorySlug: "developer-tools" },
  { name: "Datadog",     categorySlug: "developer-tools" },
  { name: "CircleCI",    categorySlug: "developer-tools" },

  // ── Identity & Security ───────────────────────────────────────────────────
  { name: "1Password",  categorySlug: "identity-security" },
  { name: "Okta",       categorySlug: "identity-security" },
  { name: "Bitwarden",  categorySlug: "identity-security" },
  { name: "Keeper",     categorySlug: "identity-security" },
  { name: "Dashlane",   categorySlug: "identity-security" },

  // ── E-commerce ────────────────────────────────────────────────────────────
  { name: "Shopify",      categorySlug: "e-commerce" },
  { name: "BigCommerce",  categorySlug: "e-commerce" },
  { name: "WooCommerce",  categorySlug: "e-commerce" },
  { name: "Squarespace",  categorySlug: "e-commerce" },
  { name: "Wix",          categorySlug: "e-commerce" },

  // ── Social Media Management ───────────────────────────────────────────────
  { name: "Buffer",         categorySlug: "social-media-management" },
  { name: "Hootsuite",      categorySlug: "social-media-management" },
  { name: "Sprout Social",  categorySlug: "social-media-management" },
  { name: "Later",          categorySlug: "social-media-management" },
  { name: "Loomly",         categorySlug: "social-media-management" },

  // ── E-signature & Contracts ───────────────────────────────────────────────
  { name: "DocuSign",    categorySlug: "esignature-contracts" },
  { name: "PandaDoc",    categorySlug: "esignature-contracts" },
  { name: "HelloSign",   categorySlug: "esignature-contracts" },
  { name: "Adobe Sign",  categorySlug: "esignature-contracts" },
  { name: "SignNow",     categorySlug: "esignature-contracts" },

  // ── Cloud Infrastructure ──────────────────────────────────────────────────
  { name: "DigitalOcean",  categorySlug: "cloud-infrastructure" },
  { name: "Heroku",        categorySlug: "cloud-infrastructure" },
  { name: "Cloudflare",    categorySlug: "cloud-infrastructure" },
  { name: "Vercel",        categorySlug: "cloud-infrastructure" },
  { name: "Render",        categorySlug: "cloud-infrastructure" },

  // ── Team Collaboration ────────────────────────────────────────────────────
  { name: "Slack",       categorySlug: "team-collaboration" },
  { name: "Notion",      categorySlug: "team-collaboration" },
  { name: "Confluence",  categorySlug: "team-collaboration" },
  { name: "Coda",        categorySlug: "team-collaboration" },
  { name: "Miro",        categorySlug: "team-collaboration" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hr(char = "═", width = 70) {
  return char.repeat(width);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Platform-safe path to the local tsx binary */
function getTsxBin(): string {
  const bin = process.platform === "win32" ? "tsx.cmd" : "tsx";
  return path.join(process.cwd(), "node_modules", ".bin", bin);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/, "");
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function formatEta(
  elapsedMs: number,
  done: number,
  total: number
): string {
  if (done === 0) return "calculating…";
  const avgMs = elapsedMs / done;
  const remainingMs = avgMs * (total - done);
  return formatDuration(remainingMs);
}

// ─── Step 1: Seed categories ──────────────────────────────────────────────────

async function seedCategories(): Promise<Map<string, string>> {
  const slugToId = new Map<string, string>();

  for (const cat of CATEGORIES) {
    const record = await prisma.category.upsert({
      where:  { slug: cat.slug },
      create: {
        name:            cat.name,
        slug:            cat.slug,
        description:     cat.description,
        icon:            cat.icon,
        metaTitle:       cat.metaTitle,
        metaDescription: cat.metaDescription,
      },
      update: {
        // Update display fields but preserve custom edits to metaTitle/Description
        description: cat.description,
        icon:        cat.icon,
      },
    });
    slugToId.set(cat.slug, record.id);
  }

  return slugToId;
}

// ─── Step 2: Generate one tool via subprocess ─────────────────────────────────

interface GenerateResult {
  status:    "generated" | "skipped" | "failed";
  durationMs?: number;
  reason?:   string;
}

async function generateTool(
  tool:        ToolDef,
  categoryId:  string,
  totalIndex:  number,
  totalCount:  number,
): Promise<GenerateResult> {
  const start = Date.now();

  // ── Check if tool already exists ──
  if (!FORCE) {
    const existingSlug = slugify(tool.name);
    const existing = await prisma.tool.findFirst({
      where: {
        OR: [
          { slug: existingSlug },
          { name: { equals: tool.name, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, slug: true },
    });
    if (existing) {
      // Still reassign category in case it changed
      await prisma.tool.update({
        where: { id: existing.id },
        data:  { categoryId },
      });
      return { status: "skipped", reason: `already in DB as "${existing.name}"` };
    }
  }

  if (DRY_RUN) {
    return { status: "generated", durationMs: 0 };
  }

  // ── Spawn generate-review.ts ──
  const tsxBin = getTsxBin();
  const spawnArgs = [
    path.join("scripts", "generate-review.ts"),
    tool.name,
    ...(tool.affiliate ? ["--affiliate", tool.affiliate] : []),
    ...(PUBLISH ? ["--publish"] : []),
  ];

  console.log(); // blank line before streaming output
  const result = spawnSync(tsxBin, spawnArgs, {
    stdio:   "inherit",        // stream Claude output directly to terminal
    env:     { ...process.env },
    cwd:     process.cwd(),
    timeout: 5 * 60 * 1000,   // 5-minute hard cap per tool
  });

  const durationMs = Date.now() - start;

  if (result.status !== 0) {
    const reason =
      result.error?.message ??
      (result.signal ? `killed by signal ${result.signal}` : `exit code ${result.status}`);
    return { status: "failed", durationMs, reason };
  }

  // ── Reassign to the intended category ──
  // generate-review.ts lets Claude decide the category name, which may differ
  // from our catalogue structure. This step enforces the intended grouping.
  try {
    const toolRecord = await prisma.tool.findFirst({
      where: {
        OR: [
          { slug: slugify(tool.name) },
          { name: { equals: tool.name, mode: "insensitive" } },
          // Some tools get slugified differently by Claude (e.g. "Monday.com" → "monday-com")
          { slug: { contains: tool.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) } },
        ],
      },
      select: { id: true },
    });
    if (toolRecord) {
      await prisma.tool.update({
        where: { id: toolRecord.id },
        data:  { categoryId },
      });
    }
  } catch {
    // Non-fatal — the tool was saved, just the category link might be off
  }

  return { status: "generated", durationMs };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // ── Validate environment ──
  if (!DRY_RUN) {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("✗  ANTHROPIC_API_KEY is not set.\n   Set it in .env before running this script.");
      process.exit(1);
    }
    if (!process.env.DATABASE_URL) {
      console.error("✗  DATABASE_URL is not set.\n   Set it in .env or use --dry-run to preview without DB writes.");
      process.exit(1);
    }
  }

  // ── Filter tool list ──
  let tools = TOOLS;
  if (ONLY_CAT) {
    tools = TOOLS.filter((t) => t.categorySlug === ONLY_CAT);
    if (tools.length === 0) {
      console.error(`✗  No tools found for category slug "${ONLY_CAT}".`);
      console.error(`   Valid slugs: ${[...new Set(TOOLS.map((t) => t.categorySlug))].join(", ")}`);
      process.exit(1);
    }
  }

  const fromIndex = Math.max(1, FROM) - 1; // convert 1-based to 0-based
  const toolsToRun = tools.slice(fromIndex);
  const totalCount = toolsToRun.length;

  // ── Print header ──
  console.log(`\n${hr()}`);
  console.log(`  SaaS Catalogue Seed`);
  console.log(`${hr()}`);
  console.log(`  Categories:  ${CATEGORIES.length}`);
  console.log(`  Tools total: ${TOOLS.length}${ONLY_CAT ? ` (filtered to ${totalCount})` : ""}`);
  console.log(`  This run:    ${totalCount} tools${fromIndex > 0 ? ` (starting from #${fromIndex + 1})` : ""}`);
  console.log(`  Mode:        ${DRY_RUN ? "DRY RUN (no API calls)" : "generate"}`);
  console.log(`  Publish:     ${PUBLISH ? "yes" : "no (draft)"}`);
  console.log(`  Overwrite:   ${FORCE ? "yes (--force)" : "no (skip existing)"}`);
  console.log(`  Delay:       ${DELAY_MS}ms between calls`);
  if (!DRY_RUN) {
    const estSec = totalCount * (45 + DELAY_MS / 1000);
    console.log(`  Est. time:   ~${formatDuration(estSec * 1000)}`);
  }
  console.log(`${hr()}\n`);

  // ── Seed categories first ──
  console.log("  Upserting categories…");
  const categoryIdMap = DRY_RUN
    ? new Map(CATEGORIES.map((c) => [c.slug, `dry-run-${c.slug}`]))
    : await seedCategories();
  console.log(`  ✓ ${CATEGORIES.length} categories ready\n`);

  if (DRY_RUN) {
    console.log("  Tools that would be generated:\n");
    toolsToRun.forEach((t, i) => {
      const cat = CATEGORIES.find((c) => c.slug === t.categorySlug);
      console.log(`    [${fromIndex + i + 1}/${TOOLS.length}] ${t.name.padEnd(24)} → ${cat?.name ?? t.categorySlug}`);
    });
    console.log(`\n  Total: ${totalCount} tools`);
    console.log("  (No API calls were made. Remove --dry-run to generate.)\n");
    return;
  }

  // ── Generate tools sequentially ──
  const results: { tool: ToolDef; result: GenerateResult }[] = [];
  const runStart = Date.now();

  for (let i = 0; i < toolsToRun.length; i++) {
    const tool       = toolsToRun[i];
    const globalIdx  = fromIndex + i + 1;
    const catDef     = CATEGORIES.find((c) => c.slug === tool.categorySlug);
    const categoryId = categoryIdMap.get(tool.categorySlug) ?? "";
    const elapsed    = Date.now() - runStart;
    const eta        = formatEta(elapsed, i, totalCount);

    console.log(`\n${hr("─")}`);
    console.log(
      `  [${globalIdx}/${TOOLS.length}]  ${tool.name}  ·  ${catDef?.name ?? tool.categorySlug}` +
      (i > 0 ? `  ·  ETA ${eta}` : "")
    );
    console.log(`${hr("─")}`);

    const result = await generateTool(tool, categoryId, globalIdx, totalCount);
    results.push({ tool, result });

    if (result.status === "skipped") {
      console.log(`  ⏭   Skipped — ${result.reason}`);
    } else if (result.status === "failed") {
      console.error(`  ✗   Failed — ${result.reason}`);
    } else {
      console.log(
        `\n  ✓   Generated${result.durationMs ? ` in ${formatDuration(result.durationMs)}` : ""}`
      );
    }

    // Wait between calls (skip delay after the last tool)
    if (i < toolsToRun.length - 1 && result.status !== "skipped") {
      console.log(`  ⏳  Waiting ${DELAY_MS}ms…`);
      await sleep(DELAY_MS);
    }
  }

  // ── Final summary ──
  const generated = results.filter((r) => r.result.status === "generated");
  const skipped   = results.filter((r) => r.result.status === "skipped");
  const failed    = results.filter((r) => r.result.status === "failed");
  const totalMs   = Date.now() - runStart;

  console.log(`\n${hr()}`);
  console.log(`  Catalogue Seed Complete`);
  console.log(`${hr()}`);
  console.log(`  ✓  Generated: ${generated.length}`);
  console.log(`  ⏭  Skipped:   ${skipped.length}`);
  console.log(`  ✗  Failed:    ${failed.length}`);
  console.log(`  ⏱   Duration:  ${formatDuration(totalMs)}`);

  if (failed.length > 0) {
    console.log(`\n  Failed tools (re-run individually or use --from=N):`);
    failed.forEach(({ tool, result }) => {
      const idx = TOOLS.indexOf(tool) + 1;
      console.log(`    [${idx}] ${tool.name}  — ${result.reason ?? "unknown error"}`);
      console.log(
        `         Retry: npm run generate:review "${tool.name}"${PUBLISH ? " -- --publish" : ""}`
      );
    });
  }

  if (skipped.length > 0 && TOOLS.length === totalCount) {
    console.log(`\n  To regenerate skipped tools, re-run with --force`);
  }

  if (!PUBLISH && generated.length > 0) {
    console.log(
      `\n  Tools were saved as drafts. Run again with --publish to make them live,`
    );
    console.log(`  or publish individually in Prisma Studio: npm run db:studio`);
  }

  console.log(`\n  Next step — generate comparisons:`);
  console.log(`    npm run generate:comparison "Asana" "Monday.com" -- --publish`);
  console.log();
}

main()
  .catch((err) => {
    console.error("\nFatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
