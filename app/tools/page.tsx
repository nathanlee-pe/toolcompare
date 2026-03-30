/**
 * app/tools/page.tsx — All tools listing
 *
 * JSON-LD: CollectionPage with embedded ItemList of all published tools.
 * The schema always reflects the full unfiltered catalogue (canonical page).
 * Dynamic filters (category, sort, search) are applied to the rendered UI only.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ToolCard } from "@/components/tool-card";
import { buildCollectionPageSchema, buildBreadcrumbSchema } from "@/lib/seo";

export const revalidate = 3600;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yourdomain.com";
const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? "SaaS Reviews";
const year = new Date().getFullYear();

export const metadata: Metadata = {
  title: `All SaaS Tools (${year}) — Reviews & Ratings`,
  description: `Browse ${year}'s best SaaS tools across every category. Expert reviews, honest ratings, and pricing breakdowns — all in one place.`,
  alternates: { canonical: `${siteUrl}/tools` },
  openGraph: {
    type: "website",
    url: `${siteUrl}/tools`,
    title: `All SaaS Tools (${year}) — Reviews & Ratings`,
    description: `Browse ${year}'s best SaaS tools. Expert reviews, honest ratings, pricing breakdowns.`,
    siteName,
    images: [{ url: `${siteUrl}/og-default.png`, width: 1200, height: 630, alt: siteName }],
  },
  twitter: {
    card: "summary_large_image",
    title: `All SaaS Tools (${year}) — Reviews & Ratings`,
    description: `Browse ${year}'s best SaaS tools. Expert reviews, honest ratings, pricing breakdowns.`,
    images: [`${siteUrl}/og-default.png`],
  },
};

interface PageProps {
  searchParams: Promise<{ category?: string; sort?: string; q?: string }>;
}

export default async function ToolsPage({ searchParams }: PageProps) {
  const { category, sort, q } = await searchParams;

  const [tools, categories, allTools] = await Promise.all([
    // Filtered tools for the UI
    prisma.tool.findMany({
      where: {
        publishedAt: { not: null },
        ...(category ? { category: { slug: category } } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { tagline: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy:
        sort === "name"
          ? { name: "asc" }
          : sort === "newest"
            ? { publishedAt: "desc" }
            : { avgRating: "desc" },
      include: {
        category: true,
        affiliateLinks: { where: { isPrimary: true, isActive: true }, take: 1 },
      },
    }),

    // All categories for filter chips
    prisma.category.findMany({ orderBy: { name: "asc" } }),

    // All published tools for JSON-LD (canonical schema — unfiltered)
    prisma.tool.findMany({
      where: { publishedAt: { not: null } },
      select: { name: true, slug: true, tagline: true },
      orderBy: { avgRating: "desc" },
    }),
  ]);

  // JSON-LD — CollectionPage + ItemList (reflects canonical unfiltered catalogue)
  const collectionSchema = buildCollectionPageSchema({
    name: `All SaaS Tools (${year}) — Reviews & Ratings`,
    description: `Browse ${year}'s best SaaS tools across every category. Expert reviews, honest ratings, and pricing breakdowns.`,
    url: `${siteUrl}/tools`,
    items: allTools.map((t) => ({
      name: t.name,
      url: `${siteUrl}/tools/${t.slug}`,
      ...(t.tagline ? { description: t.tagline } : {}),
    })),
  });

  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "All Tools", url: "/tools" },
  ]);

  const isFiltered = !!(category || sort || q);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="container mx-auto px-4 py-10">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <Link href="/" className="hover:text-foreground hover:underline">
            Home
          </Link>
          <span>/</span>
          <span className="text-foreground">All Tools</span>
        </nav>

        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">
            All SaaS Tools
          </h1>
          <p className="mt-1 text-muted-foreground">
            {isFiltered
              ? `${tools.length} result${tools.length !== 1 ? "s" : ""}`
              : `${allTools.length} tools reviewed and rated`}
          </p>
        </div>

        {/* Filters row */}
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href="/tools"
            className={`rounded-full border px-3 py-1 text-sm transition-colors hover:bg-accent ${
              !category
                ? "border-primary bg-primary text-primary-foreground"
                : ""
            }`}
          >
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/tools?category=${c.slug}${sort ? `&sort=${sort}` : ""}`}
              className={`rounded-full border px-3 py-1 text-sm transition-colors hover:bg-accent ${
                category === c.slug
                  ? "border-primary bg-primary text-primary-foreground"
                  : ""
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>

        {/* Sort controls */}
        <div className="mb-8 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sort:</span>
          {[
            { value: "rating", label: "Top rated" },
            { value: "name", label: "A–Z" },
            { value: "newest", label: "Newest" },
          ].map(({ value, label }) => {
            const currentSort = sort ?? "rating";
            return (
              <Link
                key={value}
                href={`/tools?${category ? `category=${category}&` : ""}sort=${value}`}
                className={`rounded-md px-2.5 py-1 transition-colors ${
                  currentSort === value
                    ? "bg-secondary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {tools.length === 0 ? (
          <div className="rounded-xl border bg-muted/30 py-16 text-center">
            <p className="text-muted-foreground">No tools match your filters.</p>
            <Link
              href="/tools"
              className="mt-3 inline-block text-sm text-primary hover:underline"
            >
              Clear filters →
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool, i) => (
              <ToolCard key={tool.id} tool={tool} rank={!isFiltered ? i + 1 : undefined} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
