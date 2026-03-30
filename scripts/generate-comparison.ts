#!/usr/bin/env tsx
/**
 * scripts/generate-comparison.ts
 *
 * Generates an AI-written "Tool A vs Tool B" comparison using Claude and saves
 * it to the Prisma/PostgreSQL database.
 *
 * Two-phase approach:
 *   Phase 1 — Streaming: writes the ~1500-word markdown comparison to stdout
 *             in real time, seeded with both tools' DB data for accuracy.
 *   Phase 2 — Structured: extracts slug, verdict, winner, and SEO fields via
 *             Zod schema using messages.parse().
 *   Save    — Upserts the Comparison record, then prints the JSON-LD markup.
 *
 * Usage:
 *   npm run generate:comparison "Notion" "Confluence"
 *   npm run generate:comparison "HubSpot" "Salesforce" -- --publish
 *   npm run generate:comparison "Linear" "Jira" -- --dry-run
 *   npm run generate:comparison "Figma" "Sketch" -- --force   # re-generate even if exists
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

// ─── Clients ────────────────────────────────────────────────────────────────

const prisma = new PrismaClient({ log: ["error"] });
const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

// ─── Types ───────────────────────────────────────────────────────────────────

type ToolWithRelations = Awaited<ReturnType<typeof fetchTool>>;

// ─── Zod schema for Phase 2 structured extraction ───────────────────────────

const ComparisonDataSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+-vs-[a-z0-9-]+$/)
    .describe("kebab-case slug in format 'tool-a-vs-tool-b' (alphabetical order)"),

  winnerSlug: z
    .string()
    .nullable()
    .describe(
      "slug of the recommended tool (must match one of the two tool slugs), or null if it's a draw"
    ),

  verdict: z
    .string()
    .min(100)
    .max(500)
    .describe(
      "1–3 sentence editorial verdict summarising which tool wins and for whom. Start with the winner's name or 'It depends' for a draw."
    ),

  toolAScore: z
    .number()
    .min(1)
    .max(10)
    .describe("Overall score for Tool A out of 10"),

  toolBScore: z
    .number()
    .min(1)
    .max(10)
    .describe("Overall score for Tool B out of 10"),

  metaTitle: z
    .string()
    .max(65)
    .describe("Page <title> for the comparison, ≤60 chars, include year"),

  metaDescription: z
    .string()
    .min(120)
    .max(165)
    .describe("Meta description, 140–160 chars, include both tool names and primary keyword"),
});

type ComparisonData = z.infer<typeof ComparisonDataSchema>;

// ─── Prompts ─────────────────────────────────────────────────────────────────

const COMPARISON_SYSTEM_PROMPT = `You are a senior SaaS analyst writing head-to-head comparisons for a respected B2B software review publication.

Your comparisons are:
- Objective and data-driven — base claims on the tool data provided, not vague assertions
- Specific — cite actual plan names, real prices, concrete feature differences
- ~1500 words in the markdown body, not counting headings
- Oriented toward buyers who must choose between these two tools

Always structure the comparison with exactly these H2 sections:

## Overview
(Brief intro to both tools and the competitive landscape — 2 paragraphs)

## Feature Comparison
(Prose discussion of the most important capability differences, then a markdown table:
| Feature | Tool A | Tool B |
|---------|--------|--------|
Include 8–12 rows covering the most decision-relevant features)

## Pricing Comparison
(Side-by-side breakdown of tiers — a markdown table then a paragraph on value)

## Use Case Recommendations
(3–5 specific scenarios. For each: describe the user/team type, then say which tool wins and why)

## Verdict
(2–3 paragraphs: overall winner or "it depends", who should pick each tool, and a score out of 10 for each)

Use **bold** for product names. Use inline code for technical terms like \`REST API\`.`;

const EXTRACT_SYSTEM_PROMPT = `You are a structured data extractor. Given a product comparison article, output accurate JSON that strictly matches the provided schema. Use only information present in the article. Do not invent scores or claims.`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hr(char = "─", width = 70) {
  return char.repeat(width);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function comparisonSlug(slugA: string, slugB: string): string {
  // Alphabetical ordering ensures /notion-vs-confluence and /confluence-vs-notion
  // both resolve to the same canonical slug.
  const [first, second] = [slugA, slugB].sort();
  return `${first}-vs-${second}`;
}

function formatToolContext(tool: ToolWithRelations): string {
  const tiers =
    tool.pricingTiers.length > 0
      ? tool.pricingTiers
          .map(
            (t) =>
              `  - ${t.name}: ${t.price != null ? `$${t.price}/mo` : t.isFree ? "Free" : "Custom"} — ${(t.features as string[]).slice(0, 4).join(", ")}`
          )
          .join("\n")
      : "  - (no tier data in DB)";

  const features = tool.features as Record<string, boolean>;
  const featureLines = Object.entries(features)
    .map(([k, v]) => `  ${k}: ${v ? "Yes" : "No"}`)
    .join("\n");

  return `### ${tool.name}
Tagline: ${tool.tagline ?? "(none)"}
Website: ${tool.website ?? "(none)"}
Pricing model: ${tool.pricingModel}
Starting price: ${tool.startingPrice != null ? `$${tool.startingPrice}/mo` : "Free / Custom"}
Free plan: ${tool.hasFreeplan ? "Yes" : "No"} | Free trial: ${tool.hasFreeTrial ? "Yes" : "No"}
Editorial rating: ${tool.avgRating ?? "N/A"}/5

Pricing tiers:
${tiers}

Feature flags:
${featureLines}

Pros:
${tool.pros.map((p) => `  + ${p}`).join("\n")}

Cons:
${tool.cons.map((c) => `  - ${c}`).join("\n")}`;
}

function buildJsonLd(
  toolA: ToolWithRelations,
  toolB: ToolWithRelations,
  data: ComparisonData,
  siteUrl: string
) {
  const pageUrl = `${siteUrl}/compare/${data.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: data.metaTitle,
    description: data.metaDescription,
    url: pageUrl,
    datePublished: new Date().toISOString(),
    dateModified: new Date().toISOString(),
    publisher: {
      "@type": "Organization",
      name: process.env.NEXT_PUBLIC_SITE_NAME ?? "SaaS Reviews",
      url: siteUrl,
    },
    about: [
      { "@type": "SoftwareApplication", name: toolA.name, url: toolA.website ?? undefined },
      { "@type": "SoftwareApplication", name: toolB.name, url: toolB.website ?? undefined },
    ],
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Compare", item: `${siteUrl}/compare` },
        { "@type": "ListItem", position: 3, name: `${toolA.name} vs ${toolB.name}`, item: pageUrl },
      ],
    },
  };
}

// ─── DB fetch ────────────────────────────────────────────────────────────────

async function fetchTool(nameOrSlug: string) {
  const slug = slugify(nameOrSlug);
  const tool = await prisma.tool.findFirst({
    where: { OR: [{ slug }, { name: { equals: nameOrSlug, mode: "insensitive" } }] },
    include: { pricingTiers: true },
  });
  return tool;
}

// ─── Phase 1: Streaming comparison generation ─────────────────────────────────

async function generateComparisonMarkdown(
  toolA: ToolWithRelations,
  toolB: ToolWithRelations
): Promise<string> {
  const title = `${toolA!.name} vs ${toolB!.name}`;

  console.log(`\n${hr()}`);
  console.log(`  Generating comparison: ${title}`);
  console.log(`${hr()}\n`);

  const toolContext = `Here is structured data from our database for both tools:\n\n${formatToolContext(toolA!)}\n\n${formatToolContext(toolB!)}`;

  const stream = anthropic.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 5000,
    thinking: { type: "adaptive" },
    system: COMPARISON_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `${toolContext}\n\n---\n\nNow write a comprehensive ~1500-word comparison article titled **${title}**.

Use the data above to ensure accuracy. Cover all required sections. If you have additional knowledge about these tools beyond what's provided, include it — but do not contradict the data above.`,
      },
    ],
  });

  let comparisonMarkdown = "";

  stream.on("text", (delta) => {
    process.stdout.write(delta);
    comparisonMarkdown += delta;
  });

  const final = await stream.finalMessage();

  console.log(
    `\n\n${hr("─", 40)}\n` +
      `  Tokens — input: ${final.usage.input_tokens} | output: ${final.usage.output_tokens}\n` +
      `${hr("─", 40)}\n`
  );

  return comparisonMarkdown;
}

// ─── Phase 2: Structured data extraction ─────────────────────────────────────

async function extractStructuredData(
  toolA: ToolWithRelations,
  toolB: ToolWithRelations,
  comparisonMarkdown: string
): Promise<ComparisonData> {
  console.log("  Extracting structured metadata...\n");

  const response = await anthropic.messages.parse({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    system: EXTRACT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content:
          `Extract structured data from this comparison of **${toolA!.name}** (slug: \`${toolA!.slug}\`) ` +
          `vs **${toolB!.name}** (slug: \`${toolB!.slug}\`):\n\n` +
          comparisonMarkdown,
      },
    ],
    output_config: {
      format: zodOutputFormat(ComparisonDataSchema, "comparison_data"),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Structured extraction returned null — check the comparison content.");
  }

  return response.parsed_output;
}

// ─── Save to database ─────────────────────────────────────────────────────────

async function saveToDatabase(
  toolA: ToolWithRelations,
  toolB: ToolWithRelations,
  comparisonMarkdown: string,
  data: ComparisonData,
  publish = false
): Promise<string> {
  const winnerToolId =
    data.winnerSlug === toolA!.slug
      ? toolA!.id
      : data.winnerSlug === toolB!.slug
        ? toolB!.id
        : null;

  // Canonical slug is alphabetical — ensures idempotent upsert regardless of arg order
  const canonicalSlug = comparisonSlug(toolA!.slug, toolB!.slug);

  const comparison = await prisma.comparison.upsert({
    where: { slug: canonicalSlug },
    create: {
      slug: canonicalSlug,
      toolAId: toolA!.id,
      toolBId: toolB!.id,
      body: comparisonMarkdown,
      verdict: data.verdict,
      winnerToolId,
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
      publishedAt: publish ? new Date() : null,
    },
    update: {
      body: comparisonMarkdown,
      verdict: data.verdict,
      winnerToolId,
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
      ...(publish ? { publishedAt: new Date() } : {}),
    },
  });

  return comparison.id;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // ── Parse CLI args ──
  const rawArgs = process.argv.slice(2);
  const positional = rawArgs.filter((a) => !a.startsWith("--"));
  const [toolNameA, toolNameB] = positional;
  const publish = rawArgs.includes("--publish");
  const dryRun = rawArgs.includes("--dry-run");
  const force = rawArgs.includes("--force");

  if (!toolNameA || !toolNameB) {
    console.error(
      "Usage: npm run generate:comparison <tool-a> <tool-b> [-- --publish] [--dry-run] [--force]"
    );
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY is not set.");
    process.exit(1);
  }

  if (!dryRun && !process.env.DATABASE_URL) {
    console.error("Error: DATABASE_URL is not set. Use --dry-run to skip DB write.");
    process.exit(1);
  }

  try {
    // ── Fetch tools from DB ──
    console.log(`\n  Looking up tools in database...`);

    let toolA: ToolWithRelations | null = null;
    let toolB: ToolWithRelations | null = null;

    if (!dryRun) {
      [toolA, toolB] = await Promise.all([fetchTool(toolNameA), fetchTool(toolNameB)]);

      if (!toolA) {
        console.error(
          `  Error: "${toolNameA}" not found in DB. Run: npm run generate:review "${toolNameA}"`
        );
        process.exit(1);
      }
      if (!toolB) {
        console.error(
          `  Error: "${toolNameB}" not found in DB. Run: npm run generate:review "${toolNameB}"`
        );
        process.exit(1);
      }

      console.log(`  ✓ Found: ${toolA.name} (${toolA.slug})`);
      console.log(`  ✓ Found: ${toolB.name} (${toolB.slug})`);

      // Check if comparison already exists
      const canonicalSlug = comparisonSlug(toolA.slug, toolB.slug);
      const existing = await prisma.comparison.findUnique({ where: { slug: canonicalSlug } });
      if (existing && !force) {
        console.log(
          `\n  Comparison already exists: /compare/${canonicalSlug}\n` +
            `  Use --force to re-generate it.`
        );
        process.exit(0);
      }
    } else {
      // Dry run: build minimal stub objects so we can still test the AI pipeline
      const stub = (name: string) =>
        ({
          id: "dry-run-id",
          slug: slugify(name),
          name,
          tagline: null,
          website: null,
          pricingModel: "FREEMIUM" as const,
          startingPrice: null,
          hasFreeplan: false,
          hasFreeTrial: false,
          avgRating: null,
          pros: [],
          cons: [],
          features: {},
          pricingTiers: [],
        }) as unknown as ToolWithRelations;
      toolA = stub(toolNameA);
      toolB = stub(toolNameB);
      console.log(`  (dry-run) Skipping DB lookup — using stub data for "${toolNameA}" & "${toolNameB}"`);
    }

    // ── Phase 1: Generate comparison (streaming) ──
    const comparisonMarkdown = await generateComparisonMarkdown(toolA, toolB);

    // ── Phase 2: Extract structured data ──
    const data = await extractStructuredData(toolA, toolB, comparisonMarkdown);

    // ── Display summary ──
    console.log(`${hr()}`);
    console.log(`  Extracted data`);
    console.log(`${hr()}`);
    console.log(`  Slug:        ${data.slug}`);
    console.log(`  Winner:      ${data.winnerSlug ?? "Draw / It depends"}`);
    console.log(`  ${toolA.name} score:  ${data.toolAScore}/10`);
    console.log(`  ${toolB.name} score:  ${data.toolBScore}/10`);
    console.log(`\n  Verdict:\n  ${data.verdict}\n`);
    console.log(`  Meta title:  ${data.metaTitle}`);
    console.log(`  Meta desc:   ${data.metaDescription}`);

    // ── JSON-LD schema markup ──
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yourdomain.com";
    const jsonLd = buildJsonLd(toolA, toolB, data, siteUrl);
    console.log(`\n${hr()}`);
    console.log("  JSON-LD Schema Markup");
    console.log(`${hr()}`);
    console.log(JSON.stringify(jsonLd, null, 2));

    // ── Save to DB (unless dry-run) ──
    if (dryRun) {
      console.log(`\n${hr("─", 40)}`);
      console.log("  DRY RUN — skipping database write.");
      console.log(`${hr("─", 40)}`);
    } else {
      console.log(`\n${hr("─", 40)}`);
      console.log("  Saving to database...");
      const comparisonId = await saveToDatabase(toolA, toolB, comparisonMarkdown, data, publish);
      const canonicalSlug = comparisonSlug(toolA.slug, toolB.slug);
      console.log(`  ✓ Comparison saved  id: ${comparisonId}`);
      if (publish) {
        console.log(`  ✓ Published at /compare/${canonicalSlug}`);
      } else {
        console.log(
          `  ℹ  Saved as draft. Re-run with --publish to make it live.`
        );
      }
      console.log(`${hr("─", 40)}`);
    }
  } catch (err) {
    console.error("\nError:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
