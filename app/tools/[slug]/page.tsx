/**
 * app/tools/[slug]/page.tsx — Individual tool review page
 *
 * Static-generated with ISR. Includes:
 *   • SoftwareApplication JSON-LD (AggregateRating rich snippet)
 *   • Review JSON-LD (editorial review structured data)
 *   • BreadcrumbList JSON-LD
 *   • Full OpenGraph + Twitter Card metadata per tool
 *   • Canonical URL (absolute)
 *   • Two-column layout: review body + sticky sidebar
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StarRating } from "@/components/star-rating";
import { AffiliateCta } from "@/components/affiliate-cta";
import { PricingTable } from "@/components/pricing-table";
import { ReviewList } from "@/components/review-list";
import {
  buildToolSchema,
  buildReviewSchema,
  buildBreadcrumbSchema,
  ogImage,
} from "@/lib/seo";
import { AdSenseUnit } from "@/components/adsense-unit";
import { EmailCapture } from "@/components/email-capture";
import { TopPicks } from "@/components/top-picks";

export const revalidate = 3600;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yourdomain.com";
const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? "SaaS Reviews";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// ─── Static params ────────────────────────────────────────────────────────────

export async function generateStaticParams() {
  const tools = await prisma.tool.findMany({
    where: { publishedAt: { not: null } },
    select: { slug: true },
  });
  return tools.map((t) => ({ slug: t.slug }));
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = await prisma.tool.findUnique({
    where: { slug },
    include: { category: true },
  });

  if (!tool) return {};

  const year = new Date().getFullYear();
  const title =
    tool.metaTitle ?? `${tool.name} Review (${year}) — Is It Worth It?`;
  const description =
    tool.metaDescription ??
    `Honest ${tool.name} review: pricing, features, pros & cons. Is ${tool.name} worth it in ${year}? Read our in-depth analysis.`;
  const images = ogImage(tool.logo);
  const canonicalUrl = `${siteUrl}/tools/${slug}`;

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
      ...(tool.publishedAt
        ? { publishedTime: tool.publishedAt.toISOString() }
        : {}),
      modifiedTime: new Date().toISOString(),
      section: tool.category.name,
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

export default async function ToolPage({ params }: PageProps) {
  const { slug } = await params;

  const tool = await prisma.tool.findUnique({
    where: { slug },
    include: {
      category: true,
      tags: { include: { tag: true } },
      pricingTiers: { orderBy: { price: "asc" } },
      reviews: {
        where: { isPublished: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      affiliateLinks: { where: { isActive: true } },
      comparisonsAsA: {
        where: { publishedAt: { not: null } },
        include: { toolB: { select: { name: true, slug: true, logo: true } } },
        take: 5,
      },
      comparisonsAsB: {
        where: { publishedAt: { not: null } },
        include: { toolA: { select: { name: true, slug: true, logo: true } } },
        take: 5,
      },
    },
  });

  if (!tool || !tool.publishedAt) notFound();

  const primaryLink =
    tool.affiliateLinks.find((l) => l.isPrimary) ?? tool.affiliateLinks[0];

  const relatedComparisons = [
    ...tool.comparisonsAsA.map((c) => ({ slug: c.slug, other: c.toolB })),
    ...tool.comparisonsAsB.map((c) => ({ slug: c.slug, other: c.toolA })),
  ];

  const features = (tool.features as Record<string, unknown>) ?? {};

  // JSON-LD schemas (3 separate blocks for clarity in Google's parser)
  const toolSchema = buildToolSchema(tool);
  const reviewSchema = buildReviewSchema(tool, slug);
  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: tool.category.name, url: `/category/${tool.category.slug}` },
    { name: tool.name, url: `/tools/${slug}` },
  ]);

  return (
    <>
      {/* JSON-LD — SoftwareApplication */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }}
      />
      {/* JSON-LD — Review */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewSchema) }}
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
          <Link
            href={`/category/${tool.category.slug}`}
            className="hover:text-foreground hover:underline"
          >
            {tool.category.name}
          </Link>
          <span>/</span>
          <span className="text-foreground">{tool.name}</span>
        </nav>

        {/* ── Hero ── */}
        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-start">
          {/* Logo */}
          <div className="shrink-0">
            {tool.logo ? (
              <Image
                src={tool.logo}
                alt={`${tool.name} logo`}
                width={80}
                height={80}
                className="rounded-2xl border shadow-sm"
                priority
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border bg-muted text-2xl font-bold text-muted-foreground shadow-sm">
                {tool.name[0]}
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{tool.name}</h1>
              <span className="rounded-full bg-secondary px-3 py-0.5 text-xs font-medium">
                {tool.category.name}
              </span>
              {tool.hasFreeplan && (
                <span className="rounded-full bg-green-100 px-3 py-0.5 text-xs font-medium text-green-700">
                  Free plan
                </span>
              )}
            </div>

            {tool.tagline && (
              <p className="text-lg text-muted-foreground">{tool.tagline}</p>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <StarRating rating={tool.avgRating} size="md" />
                <span className="text-sm font-medium">
                  {tool.avgRating.toFixed(1)}
                </span>
                <span className="text-sm text-muted-foreground">
                  ({tool.reviewCount} {tool.reviewCount === 1 ? "review" : "reviews"})
                </span>
              </div>
              {tool.website && (
                <a
                  href={tool.website}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Visit website →
                </a>
              )}
            </div>
          </div>

          {/* Primary CTA */}
          {primaryLink && (
            <div className="shrink-0">
              <AffiliateCta link={primaryLink} size="lg" source="tool-hero" />
            </div>
          )}
        </div>

        {/* ── Two-column layout ── */}
        <div className="grid gap-12 lg:grid-cols-[1fr_280px]">
          {/* Main content */}
          <div className="space-y-12">
            {/* Overview */}
            <section id="overview">
              <h2 className="mb-4 text-2xl font-bold">Overview</h2>
              {/* description is stored as markdown from generate-review.ts.
                  Add react-markdown to render with full formatting. */}
              <div className="prose prose-slate max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                {tool.description}
              </div>
            </section>

            {/* Feature Highlights */}
            {Object.keys(features).length > 0 && (
              <section id="features">
                <h2 className="mb-4 text-2xl font-bold">Key Features</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { key: "api", label: "API Access", icon: "🔌" },
                    { key: "sso", label: "SSO / SAML", icon: "🔐" },
                    { key: "mobileApp", label: "Mobile App", icon: "📱" },
                    { key: "audit", label: "Audit Logs", icon: "📋" },
                    { key: "customDomain", label: "Custom Domain", icon: "🌐" },
                    { key: "webhooks", label: "Webhooks", icon: "🔗" },
                    { key: "exportData", label: "Data Export", icon: "📤" },
                    { key: "2fa", label: "Two-Factor Auth", icon: "🛡️" },
                  ]
                    .filter(({ key }) => features[key] !== undefined)
                    .map(({ key, label, icon }) => (
                      <div
                        key={key}
                        className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm"
                      >
                        <span className="text-lg">{icon}</span>
                        <span className="flex-1 text-sm font-medium">{label}</span>
                        {features[key] === true ? (
                          <span className="text-green-500">✓</span>
                        ) : features[key] === false ? (
                          <span className="text-red-400">✗</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {String(features[key])}
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </section>
            )}

            {/* Pros & Cons */}
            {(tool.pros.length > 0 || tool.cons.length > 0) && (
              <section id="pros-cons">
                <h2 className="mb-4 text-2xl font-bold">Pros & Cons</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {tool.pros.length > 0 && (
                    <div className="rounded-xl border border-green-200 bg-green-50/60 p-5">
                      <h3 className="mb-3 flex items-center gap-2 font-semibold text-green-800">
                        <span className="text-green-500">✓</span> Pros
                      </h3>
                      <ul className="space-y-2">
                        {tool.pros.map((p, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-green-700"
                          >
                            <span className="mt-0.5 shrink-0 text-green-500">
                              •
                            </span>
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {tool.cons.length > 0 && (
                    <div className="rounded-xl border border-red-200 bg-red-50/60 p-5">
                      <h3 className="mb-3 flex items-center gap-2 font-semibold text-red-800">
                        <span className="text-red-400">✗</span> Cons
                      </h3>
                      <ul className="space-y-2">
                        {tool.cons.map((c, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-red-700"
                          >
                            <span className="mt-0.5 shrink-0 text-red-400">
                              •
                            </span>
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* AdSense — horizontal banner after pros/cons, before pricing */}
            <AdSenseUnit
              slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOOL_BANNER ?? ""}
              format="horizontal"
              className="my-2"
            />

            {/* Pricing */}
            {tool.pricingTiers.length > 0 && (
              <section id="pricing">
                <div className="mb-4 flex items-end justify-between">
                  <h2 className="text-2xl font-bold">Pricing</h2>
                  <span className="text-xs text-muted-foreground">
                    All prices in USD/month
                  </span>
                </div>
                <PricingTable
                  tiers={tool.pricingTiers}
                  affiliateLinks={tool.affiliateLinks}
                  toolSlug={slug}
                />
                {tool.hasFreeTrial && (
                  <p className="mt-3 text-center text-sm text-muted-foreground">
                    ✓ Free trial available — no credit card required
                  </p>
                )}
              </section>
            )}

            {/* Email capture — between pricing and user reviews */}
            <EmailCapture variant="banner" source={`tool-page-${slug}`} />

            {/* User Reviews */}
            {tool.reviews.length > 0 && (
              <section id="reviews">
                <div className="mb-4 flex items-end justify-between">
                  <h2 className="text-2xl font-bold">User Reviews</h2>
                  <span className="text-sm text-muted-foreground">
                    {tool.reviewCount} total
                  </span>
                </div>
                <ReviewList reviews={tool.reviews} />
              </section>
            )}
          </div>

          {/* ── Sidebar ── */}
          <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            {/* Quick facts */}
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h3 className="mb-3 font-semibold">Quick Facts</h3>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Pricing</dt>
                  <dd className="font-medium capitalize">
                    {tool.pricingModel.toLowerCase().replace("_", " ")}
                  </dd>
                </div>
                {tool.startingPrice != null && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Starts at</dt>
                    <dd className="font-medium">
                      ${tool.startingPrice}/mo
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Free plan</dt>
                  <dd
                    className={
                      tool.hasFreeplan
                        ? "font-medium text-green-600"
                        : "text-muted-foreground"
                    }
                  >
                    {tool.hasFreeplan ? "✓ Yes" : "No"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Free trial</dt>
                  <dd
                    className={
                      tool.hasFreeTrial
                        ? "font-medium text-green-600"
                        : "text-muted-foreground"
                    }
                  >
                    {tool.hasFreeTrial ? "✓ Yes" : "No"}
                  </dd>
                </div>
                {tool.foundedYear && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Founded</dt>
                    <dd>{tool.foundedYear}</dd>
                  </div>
                )}
                {tool.headquarters && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">HQ</dt>
                    <dd>{tool.headquarters}</dd>
                  </div>
                )}
                {tool.employeeRange && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Team size</dt>
                    <dd>{tool.employeeRange} employees</dd>
                  </div>
                )}
                {tool.website && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Website</dt>
                    <dd>
                      <a
                        href={tool.website}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Visit →
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Affiliate CTAs */}
            {tool.affiliateLinks.length > 0 && (
              <div className="rounded-xl border bg-card p-5 shadow-sm">
                <h3 className="mb-3 font-semibold">Get Started</h3>
                <div className="space-y-2">
                  {tool.affiliateLinks.map((link) => (
                    <AffiliateCta
                      key={link.id}
                      link={link}
                      source="tool-sidebar"
                    />
                  ))}
                </div>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  We may earn a commission at no extra cost to you.
                </p>
              </div>
            )}

            {/* Top picks in same category */}
            <TopPicks
              categoryId={tool.categoryId}
              variant="sidebar"
              title="Top Picks in This Category"
              source={`tool-sidebar-${slug}`}
            />

            {/* Compare with */}
            {relatedComparisons.length > 0 && (
              <div className="rounded-xl border bg-card p-5 shadow-sm">
                <h3 className="mb-3 font-semibold">
                  Compare {tool.name}
                </h3>
                <ul className="space-y-2">
                  {relatedComparisons.map((c) => (
                    <li key={c.slug}>
                      <Link
                        href={`/compare/${c.slug}`}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-primary hover:bg-accent hover:underline transition-colors"
                      >
                        {c.other.logo && (
                          <Image
                            src={c.other.logo}
                            alt={c.other.name}
                            width={16}
                            height={16}
                            className="rounded"
                          />
                        )}
                        {tool.name} vs {c.other.name} →
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tags */}
            {tool.tags.length > 0 && (
              <div className="rounded-xl border bg-card p-5 shadow-sm">
                <h3 className="mb-3 font-semibold">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {tool.tags.map(({ tag }) => (
                    <span
                      key={tag.id}
                      className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Last updated */}
            <p className="text-center text-xs text-muted-foreground">
              Last reviewed{" "}
              {new Date().toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </aside>
        </div>
      </div>
    </>
  );
}
