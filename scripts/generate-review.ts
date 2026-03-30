#!/usr/bin/env tsx
/**
 * scripts/generate-review.ts
 *
 * Generates an AI-written SaaS tool review using Claude and saves it to
 * the Prisma/PostgreSQL database.
 *
 * Two-phase approach:
 *   Phase 1 — Streaming: writes the ~1500-word markdown review to stdout in
 *             real time so you can watch it being generated.
 *   Phase 2 — Structured: extracts all structured fields (pros, cons, pricing
 *             tiers, feature flags, SEO metadata, rating) via Zod schema.
 *   Save    — Upserts the tool + tiers + optional affiliate link, then prints
 *             the generated JSON-LD schema markup.
 *
 * Usage:
 *   npm run generate:review "Notion"
 *   npm run generate:review "HubSpot" -- --affiliate "https://hubspot.com/?ref=xxx"
 *   npm run generate:review "Linear" -- --affiliate "https://linear.app" --publish
 *   npm run generate:review "Figma" -- --dry-run        # skip DB write
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { PrismaClient, PricingModel, BillingCycle } from "@prisma/client";

// ─── Clients ────────────────────────────────────────────────────────────────

const prisma = new PrismaClient({ log: ["error"] });
const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

// ─── Zod schema for Phase 2 structured extraction ───────────────────────────

const ReviewDataSchema = z.object({
  name: z.string().describe("Official product name exactly as the company uses it"),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .describe("kebab-case URL slug, e.g. 'hub-spot-crm'"),
  tagline: z
    .string()
    .max(120)
    .describe("One-sentence value proposition, ≤120 chars"),
  website: z
    .string()
    .describe("Official homepage URL starting with https://"),
  foundedYear: z
    .number()
    .int()
    .min(1990)
    .max(2030)
    .nullable()
    .describe("Year the company was founded, or null if unknown"),
  categoryName: z
    .string()
    .describe(
      "Primary software category, e.g. 'Project Management', 'CRM', 'Email Marketing'"
    ),

  // Review highlights
  pros: z
    .array(z.string().max(120))
    .min(3)
    .max(6)
    .describe("4–6 concrete advantages a user would notice"),
  cons: z
    .array(z.string().max(120))
    .min(2)
    .max(5)
    .describe("3–5 genuine weaknesses or limitations"),
  bestFor: z
    .array(z.string().max(120))
    .min(2)
    .max(5)
    .describe("3–5 specific user types or team sizes this tool suits best"),

  // Pricing
  pricingModel: z
    .enum(["FREE", "FREEMIUM", "PAID", "QUOTE_BASED"])
    .describe("Overall pricing model"),
  startingPrice: z
    .number()
    .nullable()
    .describe("Lowest paid tier in USD/month (per user if seat-based), or null if free-only or quote-based"),
  hasFreeTrial: z.boolean().describe("Is there a free trial (not just a free plan)?"),
  hasFreePlan: z.boolean().describe("Is there a permanently free tier?"),
  pricingTiers: z
    .array(
      z.object({
        name: z.string().describe("Tier name, e.g. 'Free', 'Pro', 'Business', 'Enterprise'"),
        price: z
          .number()
          .nullable()
          .describe("USD/month per user, or null for custom/enterprise pricing"),
        billingCycle: z.enum([
          "MONTHLY",
          "ANNUAL",
          "LIFETIME",
          "PER_SEAT",
          "USAGE_BASED",
        ]),
        isFree: z.boolean(),
        isPopular: z.boolean().describe("Mark the tier most customers choose"),
        features: z
          .array(z.string())
          .min(3)
          .max(8)
          .describe("3–8 key features or limits included in this tier"),
      })
    )
    .min(1)
    .max(5)
    .describe("All publicly documented pricing tiers"),

  // Feature flags for comparison table
  features: z
    .object({
      api: z.boolean().describe("REST or GraphQL API available"),
      sso: z.boolean().describe("SAML/SSO support"),
      mobileApp: z.boolean().describe("Native iOS or Android app"),
      audit: z.boolean().describe("Audit log / activity history"),
      customDomain: z.boolean().describe("Custom domain / white-labelling"),
      webhooks: z.boolean().describe("Webhook integrations"),
      exportData: z.boolean().describe("Bulk data export (CSV, JSON, etc.)"),
      "2fa": z.boolean().describe("Two-factor authentication"),
    })
    .describe("True/false capability flags used in comparison tables"),

  // SEO
  metaTitle: z
    .string()
    .max(65)
    .describe("Page <title>, ≤60 chars, include the current year"),
  metaDescription: z
    .string()
    .min(120)
    .max(165)
    .describe("Meta description, 140–160 chars, include primary keyword"),

  // Editorial score
  editorialRating: z
    .number()
    .min(1)
    .max(5)
    .describe("Overall score out of 5 to one decimal place, e.g. 4.2"),
});

type ReviewData = z.infer<typeof ReviewDataSchema>;

// ─── Prompts ─────────────────────────────────────────────────────────────────

const REVIEW_SYSTEM_PROMPT = `You are a senior SaaS analyst writing for a respected B2B software review publication.

Your reviews are:
- Honest and balanced — acknowledge real limitations, never feel like marketing copy
- Specific — cite actual plan names, real prices, concrete feature names
- ~1500 words in the markdown body, not counting headings
- Written for buyers who are actively evaluating tools, not general readers

Always structure the review with exactly these H2 sections:
## Overview
(2–3 paragraphs: what the product is, who makes it, where it fits in the market)

## Key Features
(bullet list with brief explanation of each major capability)

## Pricing
(paragraph overview + markdown table of tiers: Plan | Price | Best for)

## Pros & Cons
(two side-by-side bullet lists)

## Who Is It Best For?
(3–5 specific user types or company sizes with brief reasoning)

## Verdict
(1–2 paragraphs: recommendation, who should buy, who should look elsewhere, score /5)

Use **bold** for product names and plan names. Use inline code for technical terms like \`REST API\`.`;

const EXTRACT_SYSTEM_PROMPT = `You are a structured data extractor. Given a product review, output accurate JSON that strictly matches the provided schema. Use only information present in or clearly inferable from the review. Do not invent numbers or features.`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hr(char = "─", width = 70) {
  return char.repeat(width);
}

function buildJsonLd(tool: ReviewData, siteUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: tool.name,
    url: tool.website,
    applicationCategory: tool.categoryName,
    operatingSystem: "Web",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: tool.editorialRating.toFixed(1),
      bestRating: "5",
      worstRating: "1",
      ratingCount: "1",
    },
    ...(tool.startingPrice != null
      ? {
          offers: {
            "@type": "Offer",
            price: tool.startingPrice,
            priceCurrency: "USD",
          },
        }
      : {}),
    publisher: {
      "@type": "Organization",
      name: process.env.NEXT_PUBLIC_SITE_NAME ?? "SaaS Reviews",
      url: siteUrl,
    },
  };
}

// ─── Phase 1: Streaming review generation ────────────────────────────────────

async function generateReviewMarkdown(toolName: string): Promise<string> {
  console.log(`\n${hr()}`);
  console.log(`  Generating review: ${toolName}`);
  console.log(`${hr()}\n`);

  const stream = anthropic.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: REVIEW_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Write a comprehensive ~1500-word review of **${toolName}**.

Cover all required sections. Use real, accurate information from your knowledge about this product.`,
      },
    ],
  });

  let reviewMarkdown = "";

  stream.on("text", (delta) => {
    process.stdout.write(delta);
    reviewMarkdown += delta;
  });

  const final = await stream.finalMessage();

  console.log(
    `\n\n${hr("─", 40)}\n` +
      `  Tokens — input: ${final.usage.input_tokens} | output: ${final.usage.output_tokens}\n` +
      `${hr("─", 40)}\n`
  );

  return reviewMarkdown;
}

// ─── Phase 2: Structured data extraction ─────────────────────────────────────

async function extractStructuredData(
  toolName: string,
  reviewMarkdown: string
): Promise<ReviewData> {
  console.log("  Extracting structured metadata...\n");

  const response = await anthropic.messages.parse({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    system: EXTRACT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content:
          `Extract structured data from this review of ${toolName}:\n\n` +
          reviewMarkdown,
      },
    ],
    output_config: {
      format: zodOutputFormat(ReviewDataSchema, "review_data"),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Structured extraction returned null — check the review content.");
  }

  return response.parsed_output;
}

// ─── Save to database ─────────────────────────────────────────────────────────

async function saveToDatabase(
  reviewMarkdown: string,
  data: ReviewData,
  affiliateUrl?: string,
  publish = false
): Promise<string> {
  // 1. Upsert category
  const category = await prisma.category.upsert({
    where: { slug: data.categoryName.toLowerCase().replace(/\s+/g, "-") },
    create: {
      name: data.categoryName,
      slug: data.categoryName.toLowerCase().replace(/\s+/g, "-"),
    },
    update: {},
  });

  // 2. Upsert tool
  const tool = await prisma.tool.upsert({
    where: { slug: data.slug },
    create: {
      name: data.name,
      slug: data.slug,
      tagline: data.tagline,
      description: reviewMarkdown,
      website: data.website,
      foundedYear: data.foundedYear ?? undefined,
      pricingModel: data.pricingModel as PricingModel,
      startingPrice: data.startingPrice ?? undefined,
      hasFreeTrial: data.hasFreeTrial,
      hasFreeplan: data.hasFreePlan,
      pros: data.pros,
      cons: data.cons,
      features: data.features as object,
      avgRating: data.editorialRating,
      reviewCount: 0,
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
      categoryId: category.id,
      publishedAt: publish ? new Date() : null,
    },
    update: {
      name: data.name,
      tagline: data.tagline,
      description: reviewMarkdown,
      website: data.website,
      foundedYear: data.foundedYear ?? undefined,
      pricingModel: data.pricingModel as PricingModel,
      startingPrice: data.startingPrice ?? undefined,
      hasFreeTrial: data.hasFreeTrial,
      hasFreeplan: data.hasFreePlan,
      pros: data.pros,
      cons: data.cons,
      features: data.features as object,
      avgRating: data.editorialRating,
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
      categoryId: category.id,
      ...(publish ? { publishedAt: new Date() } : {}),
    },
  });

  // 3. Replace pricing tiers
  await prisma.pricingTier.deleteMany({ where: { toolId: tool.id } });
  if (data.pricingTiers.length > 0) {
    await prisma.pricingTier.createMany({
      data: data.pricingTiers.map((t) => ({
        toolId: tool.id,
        name: t.name,
        price: t.price ?? undefined,
        billingCycle: t.billingCycle as BillingCycle,
        isFree: t.isFree,
        isPopular: t.isPopular,
        features: t.features,
      })),
    });
  }

  // 4. Create primary affiliate link if provided
  if (affiliateUrl) {
    await prisma.affiliateLink.upsert({
      where: {
        id: (
          await prisma.affiliateLink.findFirst({
            where: { toolId: tool.id, isPrimary: true },
            select: { id: true },
          })
        )?.id ?? "nonexistent",
      },
      create: {
        toolId: tool.id,
        label: `Try ${data.name}`,
        url: affiliateUrl,
        isPrimary: true,
        isActive: true,
      },
      update: {
        url: affiliateUrl,
        isActive: true,
      },
    });
  }

  return tool.id;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // ── Parse CLI args ──
  const rawArgs = process.argv.slice(2);
  const toolName = rawArgs.find((a) => !a.startsWith("--"));
  const affiliateIdx = rawArgs.indexOf("--affiliate");
  const affiliateUrl =
    affiliateIdx !== -1 ? rawArgs[affiliateIdx + 1] : undefined;
  const publish = rawArgs.includes("--publish");
  const dryRun = rawArgs.includes("--dry-run");

  if (!toolName) {
    console.error(
      "Usage: npm run generate:review <tool-name> [-- --affiliate <url>] [--publish] [--dry-run]"
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
    // Phase 1: Generate review (streaming)
    const reviewMarkdown = await generateReviewMarkdown(toolName);

    // Phase 2: Extract structured data
    const data = await extractStructuredData(toolName, reviewMarkdown);

    // Display extracted summary
    console.log(`${hr()}`);
    console.log(`  Extracted data for: ${data.name} (${data.slug})`);
    console.log(`${hr()}`);
    console.log(`  Category:      ${data.categoryName}`);
    console.log(`  Rating:        ${data.editorialRating}/5`);
    console.log(`  Pricing model: ${data.pricingModel}`);
    console.log(`  Starting at:   ${data.startingPrice != null ? `$${data.startingPrice}/mo` : "Free / Quote"}`);
    console.log(`  Free plan:     ${data.hasFreePlan ? "Yes" : "No"}`);
    console.log(`  Free trial:    ${data.hasFreeTrial ? "Yes" : "No"}`);
    console.log(`\n  Pros (${data.pros.length}):`);
    data.pros.forEach((p) => console.log(`    + ${p}`));
    console.log(`\n  Cons (${data.cons.length}):`);
    data.cons.forEach((c) => console.log(`    - ${c}`));
    console.log(`\n  Best for:`);
    data.bestFor.forEach((b) => console.log(`    • ${b}`));
    console.log(`\n  Pricing tiers:`);
    data.pricingTiers.forEach((t) =>
      console.log(
        `    ${t.isPopular ? "★ " : "  "}${t.name.padEnd(12)} ` +
          (t.price != null ? `$${t.price}/mo` : t.isFree ? "Free" : "Custom")
      )
    );
    console.log(`\n  Meta title:    ${data.metaTitle}`);
    console.log(`  Meta desc:     ${data.metaDescription}`);

    // JSON-LD schema markup
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yourdomain.com";
    const jsonLd = buildJsonLd(data, siteUrl);
    console.log(`\n${hr()}`);
    console.log("  JSON-LD Schema Markup");
    console.log(`${hr()}`);
    console.log(JSON.stringify(jsonLd, null, 2));

    // Save to DB (unless dry-run)
    if (dryRun) {
      console.log(`\n${hr("─", 40)}`);
      console.log("  DRY RUN — skipping database write.");
      console.log(`${hr("─", 40)}`);
    } else {
      console.log(`\n${hr("─", 40)}`);
      console.log("  Saving to database...");
      const toolId = await saveToDatabase(reviewMarkdown, data, affiliateUrl, publish);
      console.log(`  ✓ Tool saved  id: ${toolId}`);
      if (publish) {
        console.log(`  ✓ Published at /tools/${data.slug}`);
      } else {
        console.log(`  ℹ  Saved as draft. Re-run with --publish to make it live.`);
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
