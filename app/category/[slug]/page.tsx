/**
 * app/category/[slug]/page.tsx — Category listing page
 *
 * Static-generated with ISR. Includes:
 *   • ItemList JSON-LD (enables list-type rich results)
 *   • BreadcrumbList JSON-LD
 *   • Full OpenGraph + Twitter Card metadata
 *   • Canonical URL
 *   • Subcategory chips (if any exist)
 *   • Ranked tool grid with sorting controls
 *   • "Best of" callout box for the #1 tool
 */

import type { Metadata } from "next";
import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { ToolCard } from "@/components/tool-card";
import { StarRating } from "@/components/star-rating";
import { AffiliateCta } from "@/components/affiliate-cta";
import {
  buildCategorySchema,
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
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string }>;
}

// ─── Static params ────────────────────────────────────────────────────────────

export async function generateStaticParams() {
  const categories = await prisma.category.findMany({
    select: { slug: true },
  });
  return categories.map((c) => ({ slug: c.slug }));
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await prisma.category.findUnique({ where: { slug } });
  if (!category) return {};

  const year = new Date().getFullYear();
  const title =
    category.metaTitle ??
    `Best ${category.name} Software (${year}) — Reviews & Comparisons`;
  const description =
    category.metaDescription ??
    `Compare the best ${category.name} tools of ${year}. Expert reviews, pricing breakdowns, feature comparisons, and honest picks for every team size.`;
  const canonicalUrl = `${siteUrl}/category/${slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: "website",
      url: canonicalUrl,
      title,
      description,
      siteName,
      images: ogImage(null), // categories don't have logos — use default OG card
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${siteUrl}/og-default.png`],
    },
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { sort = "rating" } = await searchParams;

  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      children: {
        include: { _count: { select: { tools: true } } },
        orderBy: { name: "asc" },
      },
      parent: true,
    },
  });

  if (!category) notFound();

  // Sort options
  const orderBy =
    sort === "name"
      ? { name: "asc" as const }
      : sort === "price"
        ? { startingPrice: "asc" as const }
        : { avgRating: "desc" as const }; // default: rating

  const tools = await prisma.tool.findMany({
    where: {
      categoryId: category.id,
      publishedAt: { not: null },
    },
    orderBy,
    include: {
      category: true,
      affiliateLinks: {
        where: { isPrimary: true, isActive: true },
        take: 1,
      },
    },
  });

  // Comparisons within the category (tools in this category vs each other)
  const toolIds = tools.map((t) => t.id);
  const internalComparisons = await prisma.comparison.findMany({
    where: {
      publishedAt: { not: null },
      OR: [
        { toolAId: { in: toolIds } },
        { toolBId: { in: toolIds } },
      ],
    },
    include: {
      toolA: { select: { name: true, slug: true, logo: true } },
      toolB: { select: { name: true, slug: true, logo: true } },
    },
    take: 6,
    orderBy: { publishedAt: "desc" },
  });

  const year = new Date().getFullYear();
  const topTool = tools[0];

  // JSON-LD schemas
  const itemListSchema = buildCategorySchema(category, tools);
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Categories", url: "/categories" },
    ...(category.parent
      ? [{ name: category.parent.name, url: `/category/${category.parent.slug}` }]
      : []),
    { name: category.name, url: `/category/${slug}` },
  ]);

  return (
    <>
      {/* JSON-LD — ItemList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      {/* JSON-LD — Breadcrumb */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* ── Hero ── */}
      <section className="border-b bg-gradient-to-b from-muted/50 to-background py-12">
        <div className="container mx-auto px-4">
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground"
          >
            <Link href="/" className="hover:text-foreground hover:underline">
              Home
            </Link>
            <span>/</span>
            <Link
              href="/categories"
              className="hover:text-foreground hover:underline"
            >
              Categories
            </Link>
            {category.parent && (
              <>
                <span>/</span>
                <Link
                  href={`/category/${category.parent.slug}`}
                  className="hover:text-foreground hover:underline"
                >
                  {category.parent.name}
                </Link>
              </>
            )}
            <span>/</span>
            <span className="text-foreground">{category.name}</span>
          </nav>

          <div className="flex items-start gap-4">
            {category.icon && (
              <span className="text-5xl" role="img" aria-label={category.name}>
                {category.icon}
              </span>
            )}
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Best {category.name} Software ({year})
              </h1>
              {category.description && (
                <p className="mt-2 max-w-2xl text-muted-foreground">
                  {category.description}
                </p>
              )}
              <p className="mt-3 text-sm text-muted-foreground">
                {tools.length} {tools.length === 1 ? "tool" : "tools"} reviewed
                and ranked by our editorial team
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-10">
        {/* ── Subcategory chips ── */}
        {category.children.length > 0 && (
          <div className="mb-8">
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              Subcategories
            </p>
            <div className="flex flex-wrap gap-2">
              {category.children.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/category/${sub.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-sm shadow-sm hover:border-primary/50 hover:bg-accent transition-colors"
                >
                  {sub.icon && <span>{sub.icon}</span>}
                  {sub.name}
                  {sub._count && (
                    <span className="ml-0.5 text-xs text-muted-foreground">
                      ({sub._count.tools})
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── #1 Pick spotlight ── */}
        {topTool && sort === "rating" && (
          <div className="mb-10 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/5 to-background shadow-sm">
            <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
              <div className="shrink-0">
                {topTool.logo ? (
                  <Image
                    src={topTool.logo}
                    alt={`${topTool.name} logo`}
                    width={64}
                    height={64}
                    className="rounded-xl border shadow-sm"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border bg-muted text-2xl font-bold text-muted-foreground">
                    {topTool.name[0]}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                    #1 Best {category.name} Tool
                  </span>
                </div>
                <h2 className="text-xl font-bold">{topTool.name}</h2>
                {topTool.tagline && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {topTool.tagline}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <StarRating
                    rating={topTool.avgRating}
                    size="sm"
                    showNumber
                  />
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">
                    {topTool.hasFreeplan
                      ? "Free plan available"
                      : formatPrice(topTool.startingPrice)}
                  </span>
                  {topTool.hasFreeTrial && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-green-600">Free trial</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  href={`/tools/${topTool.slug}`}
                  className="inline-flex h-9 items-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent transition-colors"
                >
                  Read review
                </Link>
                {topTool.affiliateLinks[0] && (
                  <AffiliateCta
                    link={topTool.affiliateLinks[0]}
                    size="sm"
                    source="category-spotlight"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Sort controls + tool grid ── */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">
            All {category.name} Tools
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({tools.length})
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sort by:</span>
            {[
              { value: "rating", label: "Top rated" },
              { value: "name", label: "Name" },
              { value: "price", label: "Price" },
            ].map(({ value, label }) => (
              <Link
                key={value}
                href={`/category/${slug}?sort=${value}`}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  sort === value
                    ? "bg-primary text-primary-foreground"
                    : "border bg-background hover:bg-accent"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        {tools.length === 0 ? (
          <div className="rounded-xl border bg-muted/30 py-16 text-center">
            <p className="text-muted-foreground">
              No tools reviewed in this category yet.
            </p>
            <Link
              href="/tools"
              className="mt-3 inline-block text-sm text-primary hover:underline"
            >
              Browse all tools →
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool, i) => (
              <React.Fragment key={tool.id}>
                <ToolCard tool={tool} rank={i + 1} />
                {/* AdSense unit injected after the 3rd card (index 2), spanning full width */}
                {i === 2 && (
                  <div className="col-span-full">
                    <AdSenseUnit
                      slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_CATEGORY_MID ?? ""}
                      format="horizontal"
                    />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* ── In-category comparisons ── */}
        {internalComparisons.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-4 text-xl font-bold">
              {category.name} Tool Comparisons
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {internalComparisons.map((c) => (
                <Link
                  key={c.id}
                  href={`/compare/${c.slug}`}
                  className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-1.5">
                    {c.toolA.logo && (
                      <Image
                        src={c.toolA.logo}
                        alt={c.toolA.name}
                        width={24}
                        height={24}
                        className="rounded border"
                      />
                    )}
                  </div>
                  <span className="flex-1 text-sm font-medium">
                    {c.toolA.name}{" "}
                    <span className="text-muted-foreground">vs</span>{" "}
                    {c.toolB.name}
                  </span>
                  <span className="shrink-0 text-xs text-primary">→</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Top picks + email capture — between comparisons grid and FAQ */}
        <div className="mt-14 space-y-8">
          <TopPicks
            categoryId={category.id}
            variant="section"
            title={`Top ${category.name} Tools with Affiliate Deals`}
            source={`category-page-${slug}`}
          />
          <EmailCapture variant="banner" source={`category-page-${slug}`} />
        </div>

        {/* ── FAQ (lightweight, no dependency) ── */}
        <section className="mt-14">
          <h2 className="mb-5 text-xl font-bold">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {[
              {
                q: `What is the best ${category.name} tool?`,
                a: topTool
                  ? `Based on our testing, ${topTool.name} is our top-rated ${category.name} tool in ${year}, scoring ${topTool.avgRating.toFixed(1)}/5. That said, the best tool depends on your team size and use case — browse the full list above to find your fit.`
                  : `The best ${category.name} tool depends on your specific needs, team size, and budget. Browse our ranked list above to find the right fit.`,
              },
              {
                q: `Is there a free ${category.name} tool?`,
                a: tools.some((t) => t.hasFreeplan)
                  ? `Yes — ${tools.filter((t) => t.hasFreeplan).map((t) => t.name).join(", ")} offer free plans. Check each tool's review page for details on what's included.`
                  : `Most ${category.name} tools offer free trials. Check each tool's pricing section for the latest details.`,
              },
              {
                q: `How do we pick the best ${category.name} software?`,
                a: `Our editorial team independently tests every tool we review. We evaluate features, pricing value, ease of use, customer support, and how well each tool serves different team sizes. No tool pays to be ranked — our ratings are 100% independent.`,
              },
            ].map(({ q, a }) => (
              <details
                key={q}
                className="group rounded-xl border bg-card shadow-sm"
              >
                <summary className="flex cursor-pointer items-center justify-between p-5 font-medium hover:bg-accent/30 transition-colors">
                  {q}
                  <span className="ml-3 shrink-0 text-muted-foreground transition-transform group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <div className="border-t px-5 pb-5 pt-4 text-sm text-muted-foreground leading-relaxed">
                  {a}
                </div>
              </details>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
