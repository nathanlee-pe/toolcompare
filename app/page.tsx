/**
 * app/page.tsx — Homepage
 *
 * Static-generated with ISR. Includes:
 *   • WebSite JSON-LD (enables Sitelinks Searchbox)
 *   • Organization JSON-LD
 *   • Hero with search CTA
 *   • Live stats strip (tool / comparison / category counts)
 *   • Category grid
 *   • Top-rated tools grid
 *   • Latest editorial comparisons
 *   • "How we review" trust section
 */

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { CategoryNav } from "@/components/category-nav";
import { ToolCard } from "@/components/tool-card";
import { StarRating } from "@/components/star-rating";
import {
  buildWebSiteSchema,
  buildOrganizationSchema,
} from "@/lib/seo";

export const revalidate = 3600; // ISR: revalidate every hour

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yourdomain.com";
const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? "SaaS Reviews";

// ─── Metadata ────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: `${siteName} — Honest SaaS Tool Reviews & Comparisons`,
  description:
    "In-depth reviews, side-by-side comparisons, and expert picks for the best SaaS tools. Find the right software for your business — without the guesswork.",
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    title: `${siteName} — Honest SaaS Tool Reviews & Comparisons`,
    description:
      "In-depth reviews, side-by-side comparisons, and expert picks for the best SaaS tools.",
    images: [
      {
        url: `${siteUrl}/og-default.png`,
        width: 1200,
        height: 630,
        alt: `${siteName} — SaaS Reviews & Comparisons`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteName} — Honest SaaS Tool Reviews & Comparisons`,
    description:
      "In-depth reviews, side-by-side comparisons, and expert picks for the best SaaS tools.",
    images: [`${siteUrl}/og-default.png`],
  },
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const [categories, featuredTools, recentComparisons, counts] =
    await Promise.all([
      prisma.category.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { tools: true } } },
      }),
      prisma.tool.findMany({
        where: { publishedAt: { not: null } },
        orderBy: { avgRating: "desc" },
        take: 6,
        include: {
          category: true,
          affiliateLinks: {
            where: { isPrimary: true, isActive: true },
            take: 1,
          },
        },
      }),
      prisma.comparison.findMany({
        where: { publishedAt: { not: null } },
        orderBy: { publishedAt: "desc" },
        take: 6,
        include: { toolA: true, toolB: true },
      }),
      Promise.all([
        prisma.tool.count({ where: { publishedAt: { not: null } } }),
        prisma.comparison.count({ where: { publishedAt: { not: null } } }),
        prisma.category.count(),
      ]),
    ]);

  const [toolCount, comparisonCount, categoryCount] = counts;

  // JSON-LD schemas
  const websiteSchema = buildWebSiteSchema();
  const orgSchema = buildOrganizationSchema();

  return (
    <>
      {/* JSON-LD — WebSite (Sitelinks Searchbox) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      {/* JSON-LD — Organization */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />

      {/* ── Hero ── */}
      <section className="border-b bg-gradient-to-b from-muted/60 to-background py-20 text-center">
        <div className="container mx-auto max-w-3xl space-y-6 px-4">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Continuously updated — last reviewed {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Find the right SaaS tool —{" "}
            <br className="hidden sm:block" />
            <span className="text-primary">without the guesswork</span>
          </h1>

          <p className="text-lg text-muted-foreground">
            Honest expert reviews, head-to-head comparisons, and pricing
            breakdowns for every category of business software.
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/tools"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              Browse All Tools
            </Link>
            <Link
              href="/compare"
              className="inline-flex h-11 items-center justify-center rounded-md border bg-background px-8 text-sm font-semibold shadow-sm hover:bg-accent transition-colors"
            >
              Compare Tools
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats Strip ── */}
      <section className="border-b bg-muted/30">
        <div className="container mx-auto px-4">
          <dl className="grid divide-x divide-border sm:grid-cols-3">
            {[
              { value: toolCount, label: "Tools reviewed" },
              { value: comparisonCount, label: "Head-to-head comparisons" },
              { value: categoryCount, label: "Software categories" },
            ].map(({ value, label }) => (
              <div
                key={label}
                className="flex flex-col items-center justify-center py-6 text-center"
              >
                <dt className="order-2 mt-1 text-sm text-muted-foreground">
                  {label}
                </dt>
                <dd className="order-1 text-3xl font-bold tracking-tight">
                  {value.toLocaleString()}+
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Browse by Category ── */}
      <section className="container mx-auto px-4 py-14">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Browse by Category</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {categoryCount} software categories covered
            </p>
          </div>
          <Link
            href="/categories"
            className="text-sm text-primary hover:underline"
          >
            All categories →
          </Link>
        </div>
        <CategoryNav categories={categories} />
      </section>

      {/* ── Top-Rated Tools ── */}
      {featuredTools.length > 0 && (
        <section className="border-t bg-muted/20 py-14">
          <div className="container mx-auto px-4">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Top-Rated Tools</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Highest-rated by our editorial team
                </p>
              </div>
              <Link
                href="/tools"
                className="text-sm text-primary hover:underline"
              >
                View all {toolCount} tools →
              </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featuredTools.map((tool, i) => (
                <ToolCard key={tool.id} tool={tool} rank={i + 1} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Latest Comparisons ── */}
      {recentComparisons.length > 0 && (
        <section className="py-14">
          <div className="container mx-auto px-4">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Popular Comparisons</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Side-by-side breakdowns from our editors
                </p>
              </div>
              <Link
                href="/compare"
                className="text-sm text-primary hover:underline"
              >
                See all {comparisonCount} →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentComparisons.map((c) => (
                <Link
                  key={c.id}
                  href={`/compare/${c.slug}`}
                  className="group flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm hover:shadow-md hover:border-primary/40 transition-all"
                >
                  {c.toolA.logo && (
                    <Image
                      src={c.toolA.logo}
                      alt={c.toolA.name}
                      width={32}
                      height={32}
                      className="rounded border"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium group-hover:text-primary transition-colors">
                      {c.toolA.name}{" "}
                      <span className="font-normal text-muted-foreground">
                        vs
                      </span>{" "}
                      {c.toolB.name}
                    </p>
                    {c.toolA.avgRating > 0 && c.toolB.avgRating > 0 && (
                      <div className="mt-0.5 flex items-center gap-2">
                        <StarRating rating={c.toolA.avgRating} size="sm" />
                        <span className="text-xs text-muted-foreground">vs</span>
                        <StarRating rating={c.toolB.avgRating} size="sm" />
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-primary">
                    Compare →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── How We Review ── */}
      <section className="border-t bg-muted/20 py-14">
        <div className="container mx-auto max-w-4xl px-4">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold">How We Review Tools</h2>
            <p className="mt-2 text-muted-foreground">
              Every review follows the same rigorous methodology — no sponsored
              placements, no pay-to-win rankings.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: "🔬",
                title: "Independent Testing",
                body: "Our analysts hands-on test every tool we review. We sign up, explore every plan, and push features to their limits.",
              },
              {
                icon: "💰",
                title: "Transparent Pricing",
                body: "We break down every pricing tier with real numbers. No vague 'contact sales' hand-waves — we get actual quotes.",
              },
              {
                icon: "⭐",
                title: "Honest Ratings",
                body: "Affiliate relationships never influence our ratings. Tools are scored on value, features, support, and ease of use.",
              },
            ].map(({ icon, title, body }) => (
              <div
                key={title}
                className="rounded-xl border bg-card p-6 shadow-sm"
              >
                <div className="mb-3 text-3xl">{icon}</div>
                <h3 className="mb-2 font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
