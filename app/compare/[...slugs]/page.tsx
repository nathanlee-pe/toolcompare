/**
 * app/compare/[...slugs]/page.tsx — Tool vs Tool comparison page
 *
 * Supports two URL shapes:
 *   /compare/notion-vs-confluence    (single segment, from DB slug)
 *   /compare/notion/confluence        (two segments, dynamic fallback)
 *
 * Static-generated with ISR. Includes:
 *   • Article JSON-LD (comparison article structured data)
 *   • BreadcrumbList JSON-LD
 *   • Full OpenGraph + Twitter Card metadata
 *   • Canonical URL (single-slug canonical)
 *   • Tool hero cards (side-by-side, winner highlighted)
 *   • Feature comparison table
 *   • Editorial body (markdown prose)
 *   • Related comparisons for each tool
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { StarRating } from "@/components/star-rating";
import { ComparisonTable } from "@/components/comparison-table";
import { AffiliateCta } from "@/components/affiliate-cta";
import {
  buildComparisonSchema,
  buildBreadcrumbSchema,
  ogImage,
} from "@/lib/seo";
import { formatPrice } from "@/lib/utils";
import { AdSenseUnit } from "@/components/adsense-unit";
import { EmailCapture } from "@/components/email-capture";
import { TopPicks } from "@/components/top-picks";

export const revalidate = 3600;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yourdomain.com";
const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? "SaaS Reviews";

interface PageProps {
  params: Promise<{ slugs: string[] }>;
}

// ─── Slug parsing ─────────────────────────────────────────────────────────────

function parseSlug(
  slugs: string[]
): { toolASlug: string; toolBSlug: string; canonicalSlug: string } | null {
  if (slugs.length === 1) {
    const parts = slugs[0].split("-vs-");
    if (parts.length !== 2) return null;
    return {
      toolASlug: parts[0],
      toolBSlug: parts[1],
      canonicalSlug: slugs[0],
    };
  }
  if (slugs.length === 2) {
    const [a, b] = [slugs[0], slugs[1]].sort();
    return {
      toolASlug: slugs[0],
      toolBSlug: slugs[1],
      canonicalSlug: `${a}-vs-${b}`,
    };
  }
  return null;
}

// ─── Static params ────────────────────────────────────────────────────────────

export async function generateStaticParams() {
  const comparisons = await prisma.comparison.findMany({
    where: { publishedAt: { not: null } },
    select: { slug: true },
  });
  return comparisons.map((c) => ({ slugs: [c.slug] }));
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slugs } = await params;
  const parsed = parseSlug(slugs);
  if (!parsed) return {};

  // Try the DB record first (has editorial meta)
  const comparison = await prisma.comparison.findUnique({
    where: { slug: parsed.canonicalSlug },
    include: {
      toolA: { select: { name: true, logo: true } },
      toolB: { select: { name: true, logo: true } },
    },
  });

  const year = new Date().getFullYear();
  const toolAName = comparison?.toolA.name ?? parsed.toolASlug;
  const toolBName = comparison?.toolB.name ?? parsed.toolBSlug;
  const title =
    comparison?.metaTitle ??
    `${toolAName} vs ${toolBName} (${year}) — Which Is Better?`;
  const description =
    comparison?.metaDescription ??
    `${toolAName} vs ${toolBName}: features, pricing, pros & cons compared side-by-side. Find out which tool wins in ${year}.`;
  const canonicalUrl = `${siteUrl}/compare/${parsed.canonicalSlug}`;
  const images = ogImage(comparison?.toolA.logo);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title,
      description,
      siteName,
      images,
      ...(comparison?.publishedAt
        ? { publishedTime: comparison.publishedAt.toISOString() }
        : {}),
      modifiedTime: new Date().toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images.map((i) => i.url),
    },
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ComparisonPage({ params }: PageProps) {
  const { slugs } = await params;
  const parsed = parseSlug(slugs);
  if (!parsed) notFound();

  // Try editorial comparison first
  const comparison = await prisma.comparison.findUnique({
    where: { slug: parsed.canonicalSlug },
    include: {
      toolA: {
        include: {
          category: true,
          pricingTiers: { orderBy: { price: "asc" } },
          affiliateLinks: {
            where: { isPrimary: true, isActive: true },
            take: 1,
          },
          comparisonsAsA: {
            where: { publishedAt: { not: null } },
            include: { toolB: { select: { name: true, slug: true } } },
            take: 4,
          },
          comparisonsAsB: {
            where: { publishedAt: { not: null } },
            include: { toolA: { select: { name: true, slug: true } } },
            take: 4,
          },
        },
      },
      toolB: {
        include: {
          category: true,
          pricingTiers: { orderBy: { price: "asc" } },
          affiliateLinks: {
            where: { isPrimary: true, isActive: true },
            take: 1,
          },
          comparisonsAsA: {
            where: { publishedAt: { not: null } },
            include: { toolB: { select: { name: true, slug: true } } },
            take: 4,
          },
          comparisonsAsB: {
            where: { publishedAt: { not: null } },
            include: { toolA: { select: { name: true, slug: true } } },
            take: 4,
          },
        },
      },
    },
  });

  // If no editorial record, try dynamic (both tools must exist)
  if (!comparison || !comparison.publishedAt) {
    const [toolA, toolB] = await Promise.all([
      prisma.tool.findUnique({
        where: { slug: parsed.toolASlug },
        include: {
          category: true,
          pricingTiers: { orderBy: { price: "asc" } },
          affiliateLinks: {
            where: { isPrimary: true, isActive: true },
            take: 1,
          },
          comparisonsAsA: {
            where: { publishedAt: { not: null } },
            include: { toolB: { select: { name: true, slug: true } } },
            take: 4,
          },
          comparisonsAsB: {
            where: { publishedAt: { not: null } },
            include: { toolA: { select: { name: true, slug: true } } },
            take: 4,
          },
        },
      }),
      prisma.tool.findUnique({
        where: { slug: parsed.toolBSlug },
        include: {
          category: true,
          pricingTiers: { orderBy: { price: "asc" } },
          affiliateLinks: {
            where: { isPrimary: true, isActive: true },
            take: 1,
          },
          comparisonsAsA: {
            where: { publishedAt: { not: null } },
            include: { toolB: { select: { name: true, slug: true } } },
            take: 4,
          },
          comparisonsAsB: {
            where: { publishedAt: { not: null } },
            include: { toolA: { select: { name: true, slug: true } } },
            take: 4,
          },
        },
      }),
    ]);
    if (!toolA || !toolB) notFound();

    return (
      <ComparisonLayout
        toolA={toolA}
        toolB={toolB}
        canonicalSlug={parsed.canonicalSlug}
      />
    );
  }

  return (
    <ComparisonLayout
      toolA={comparison.toolA}
      toolB={comparison.toolB}
      verdict={comparison.verdict ?? undefined}
      winnerToolId={comparison.winnerToolId ?? undefined}
      body={comparison.body ?? undefined}
      metaTitle={comparison.metaTitle ?? undefined}
      metaDescription={comparison.metaDescription ?? undefined}
      publishedAt={comparison.publishedAt ?? undefined}
      canonicalSlug={parsed.canonicalSlug}
    />
  );
}

// ─── Reusable layout ──────────────────────────────────────────────────────────

type ToolWithRelations = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  tagline: string | null;
  website: string;
  pricingModel: string;
  startingPrice: number | null;
  hasFreeplan: boolean;
  hasFreeTrial: boolean;
  avgRating: number;
  reviewCount: number;
  pros: string[];
  cons: string[];
  features: unknown;
  category: { id: string; name: string; slug: string };
  pricingTiers: Array<{
    id: string;
    name: string;
    price: number | null;
    isFree: boolean;
    isPopular: boolean;
    billingCycle: string;
    features: string[];
  }>;
  affiliateLinks: Array<{
    id: string;
    label: string;
    url: string;
    trackedUrl: string | null;
    commission: string | null;
    isPrimary: boolean;
  }>;
  comparisonsAsA: Array<{ slug: string; toolB: { name: string; slug: string } }>;
  comparisonsAsB: Array<{ slug: string; toolA: { name: string; slug: string } }>;
};

function ComparisonLayout({
  toolA,
  toolB,
  verdict,
  winnerToolId,
  body,
  metaTitle,
  metaDescription,
  publishedAt,
  canonicalSlug,
}: {
  toolA: ToolWithRelations;
  toolB: ToolWithRelations;
  verdict?: string;
  winnerToolId?: string;
  body?: string;
  metaTitle?: string;
  metaDescription?: string;
  publishedAt?: Date;
  canonicalSlug: string;
}) {
  const year = new Date().getFullYear();
  const title = metaTitle ?? `${toolA.name} vs ${toolB.name} (${year})`;

  // JSON-LD schemas
  const comparisonSchema = buildComparisonSchema(toolA, toolB, {
    slug: canonicalSlug,
    metaTitle,
    metaDescription,
    verdict,
    publishedAt,
  });
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Compare", url: "/compare" },
    { name: `${toolA.name} vs ${toolB.name}`, url: `/compare/${canonicalSlug}` },
  ]);

  const relatedA = [
    ...toolA.comparisonsAsA.map((c) => ({ slug: c.slug, other: c.toolB })),
    ...toolA.comparisonsAsB.map((c) => ({ slug: c.slug, other: c.toolA })),
  ].filter((c) => c.slug !== canonicalSlug);

  const relatedB = [
    ...toolB.comparisonsAsA.map((c) => ({ slug: c.slug, other: c.toolB })),
    ...toolB.comparisonsAsB.map((c) => ({ slug: c.slug, other: c.toolA })),
  ].filter((c) => c.slug !== canonicalSlug);

  // Deduplicate related comparisons
  const seen = new Set<string>();
  const related = [...relatedA, ...relatedB].filter((c) => {
    if (seen.has(c.slug)) return false;
    seen.add(c.slug);
    return true;
  });

  return (
    <>
      {/* JSON-LD — Article */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(comparisonSchema) }}
      />
      {/* JSON-LD — Breadcrumb */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="container mx-auto max-w-5xl px-4 py-10">
        {/* ── Breadcrumb ── */}
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <Link href="/" className="hover:text-foreground hover:underline">
            Home
          </Link>
          <span>/</span>
          <Link href="/compare" className="hover:text-foreground hover:underline">
            Compare
          </Link>
          <span>/</span>
          <span className="text-foreground">
            {toolA.name} vs {toolB.name}
          </span>
        </nav>

        {/* ── Heading ── */}
        <div className="mb-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h1>
          {publishedAt && (
            <p className="mt-1 text-sm text-muted-foreground">
              Last updated{" "}
              {publishedAt.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
        </div>

        {/* ── Verdict box ── */}
        {verdict && (
          <div className="my-6 rounded-xl border border-primary/30 bg-primary/5 p-5">
            <p className="mb-1 flex items-center gap-2 font-semibold text-primary">
              <span>⭐</span> Our Verdict
            </p>
            <p className="text-sm leading-relaxed">{verdict}</p>
          </div>
        )}

        {/* ── Tool hero cards ── */}
        <div className="mb-10 grid grid-cols-2 gap-4 sm:gap-6">
          {[toolA, toolB].map((tool) => {
            const link = tool.affiliateLinks[0];
            const isWinner = winnerToolId === tool.id;
            return (
              <div
                key={tool.id}
                className={`relative flex flex-col rounded-xl border p-5 shadow-sm transition-shadow hover:shadow-md ${
                  isWinner
                    ? "border-primary ring-2 ring-primary/30"
                    : "bg-card"
                }`}
              >
                {isWinner && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                      ✓ Our Pick
                    </span>
                  </div>
                )}

                <div className="mb-3 flex items-center gap-3">
                  {tool.logo ? (
                    <Image
                      src={tool.logo}
                      alt={`${tool.name} logo`}
                      width={44}
                      height={44}
                      className="rounded-lg border"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg border bg-muted text-lg font-bold text-muted-foreground">
                      {tool.name[0]}
                    </div>
                  )}
                  <div>
                    <Link
                      href={`/tools/${tool.slug}`}
                      className="font-semibold hover:underline"
                    >
                      {tool.name}
                    </Link>
                    <div className="mt-0.5">
                      <StarRating rating={tool.avgRating} size="sm" showNumber />
                    </div>
                  </div>
                </div>

                {tool.tagline && (
                  <p className="mb-3 text-xs text-muted-foreground line-clamp-2">
                    {tool.tagline}
                  </p>
                )}

                <dl className="mb-4 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Starting at</dt>
                    <dd className="font-medium">
                      {formatPrice(tool.startingPrice)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Free plan</dt>
                    <dd
                      className={
                        tool.hasFreeplan ? "text-green-600" : "text-muted-foreground"
                      }
                    >
                      {tool.hasFreeplan ? "✓ Yes" : "No"}
                    </dd>
                  </div>
                </dl>

                {link && (
                  <div className="mt-auto">
                    <AffiliateCta
                      link={link}
                      size="sm"
                      source={`compare-card-${tool.slug}`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Feature comparison table ── */}
        <section id="comparison-table" className="mb-12">
          <h2 className="mb-4 text-2xl font-bold">Feature Comparison</h2>
          <ComparisonTable
            toolA={toolA as any}
            toolB={toolB as any}
            toolALink={toolA.affiliateLinks[0] ?? null}
            toolBLink={toolB.affiliateLinks[0] ?? null}
          />
        </section>

        {/* AdSense — between comparison table and pricing */}
        <AdSenseUnit
          slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_COMPARE_BANNER ?? ""}
          format="horizontal"
          className="mb-12"
        />

        {/* ── Pricing comparison ── */}
        {(toolA.pricingTiers.length > 0 || toolB.pricingTiers.length > 0) && (
          <section id="pricing" className="mb-12">
            <h2 className="mb-4 text-2xl font-bold">Pricing Comparison</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {[toolA, toolB].map((tool) => (
                <div key={tool.id}>
                  <h3 className="mb-3 font-semibold">{tool.name}</h3>
                  {tool.pricingTiers.length > 0 ? (
                    <div className="space-y-2">
                      {tool.pricingTiers.map((tier) => (
                        <div
                          key={tier.id}
                          className={`rounded-lg border p-3 text-sm ${
                            tier.isPopular
                              ? "border-primary bg-primary/5"
                              : "bg-card"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              {tier.name}
                              {tier.isPopular && (
                                <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                                  Popular
                                </span>
                              )}
                            </span>
                            <span className="font-semibold">
                              {tier.isFree
                                ? "Free"
                                : tier.price == null
                                  ? "Custom"
                                  : `$${tier.price}/mo`}
                            </span>
                          </div>
                          {tier.features.length > 0 && (
                            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                              {tier.features.slice(0, 3).map((f, i) => (
                                <li key={i}>• {f}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No pricing data available.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Editorial body (markdown) ── */}
        {body && (
          <section id="analysis" className="mb-12">
            <h2 className="mb-4 text-2xl font-bold">In-Depth Analysis</h2>
            {/* body is markdown from generate-comparison.ts. Add react-markdown for full rendering. */}
            <div className="prose prose-slate max-w-none whitespace-pre-wrap text-sm leading-relaxed">
              {body}
            </div>
          </section>
        )}

        {/* Email capture + top picks — between analysis body and related comparisons */}
        <div className="mb-12 space-y-8">
          <TopPicks
            categoryId={toolA.category.id}
            variant="section"
            title="Top Picks in This Category"
            source={`compare-${canonicalSlug}`}
          />
          <EmailCapture variant="banner" source={`compare-page-${canonicalSlug}`} />
        </div>

        {/* ── Related comparisons ── */}
        {related.length > 0 && (
          <section id="related" className="mb-12">
            <h2 className="mb-4 text-xl font-bold">Related Comparisons</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {related.slice(0, 6).map((c) => (
                <Link
                  key={c.slug}
                  href={`/compare/${c.slug}`}
                  className="flex items-center gap-2 rounded-lg border bg-card p-3 text-sm hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <span className="flex-1 font-medium">
                    {c.slug.replace("-vs-", " vs ").replace(/-/g, " ")}
                  </span>
                  <span className="text-primary">→</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── CTA strip ── */}
        <div className="rounded-xl border bg-muted/30 p-6 text-center">
          <p className="mb-4 text-sm font-medium">
            Ready to choose? See full reviews for each tool.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href={`/tools/${toolA.slug}`}
              className="inline-flex h-9 items-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent transition-colors"
            >
              {toolA.name} Review →
            </Link>
            <Link
              href={`/tools/${toolB.slug}`}
              className="inline-flex h-9 items-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent transition-colors"
            >
              {toolB.name} Review →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
