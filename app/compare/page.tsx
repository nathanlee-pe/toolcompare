/**
 * app/compare/page.tsx — Comparison index / hub
 *
 * JSON-LD: CollectionPage with embedded ItemList of all published comparisons.
 */

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { buildCollectionPageSchema, buildBreadcrumbSchema } from "@/lib/seo";

export const revalidate = 3600;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yourdomain.com";
const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? "SaaS Reviews";
const year = new Date().getFullYear();

export const metadata: Metadata = {
  title: `SaaS Tool Comparisons (${year}) — Side-by-Side Reviews`,
  description: `Head-to-head comparisons of the top SaaS tools in ${year}. Features, pricing, and pros & cons compared side-by-side — so you can pick the winner.`,
  alternates: { canonical: `${siteUrl}/compare` },
  openGraph: {
    type: "website",
    url: `${siteUrl}/compare`,
    title: `SaaS Tool Comparisons (${year}) — Side-by-Side Reviews`,
    description: `Head-to-head comparisons of top SaaS tools. Features, pricing, and pros & cons side-by-side.`,
    siteName,
    images: [{ url: `${siteUrl}/og-default.png`, width: 1200, height: 630, alt: siteName }],
  },
  twitter: {
    card: "summary_large_image",
    title: `SaaS Tool Comparisons (${year}) — Side-by-Side Reviews`,
    description: `Head-to-head comparisons of top SaaS tools. Features, pricing, and pros & cons side-by-side.`,
    images: [`${siteUrl}/og-default.png`],
  },
};

export default async function ComparePage() {
  const comparisons = await prisma.comparison.findMany({
    where: { publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
    include: {
      toolA: { include: { category: true } },
      toolB: { include: { category: true } },
    },
  });

  // Group by the Tool A's category name for display
  const grouped = comparisons.reduce<
    Record<string, typeof comparisons>
  >((acc, c) => {
    const cat = c.toolA.category.name;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(c);
    return acc;
  }, {});

  // JSON-LD
  const collectionSchema = buildCollectionPageSchema({
    name: `SaaS Tool Comparisons (${year})`,
    description: `Head-to-head comparisons of popular SaaS tools — features, pricing, and verdict.`,
    url: `${siteUrl}/compare`,
    items: comparisons.map((c) => ({
      name: `${c.toolA.name} vs ${c.toolB.name}`,
      url: `${siteUrl}/compare/${c.slug}`,
      ...(c.verdict ? { description: c.verdict } : {}),
    })),
  });

  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Compare", url: "/compare" },
  ]);

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
          <span className="text-foreground">Compare</span>
        </nav>

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Tool Comparisons
          </h1>
          <p className="mt-2 text-muted-foreground">
            {comparisons.length} head-to-head comparisons to help you pick the
            right tool.
          </p>
        </div>

        {comparisons.length === 0 ? (
          <div className="rounded-xl border bg-muted/30 py-16 text-center">
            <p className="text-muted-foreground">
              No comparisons published yet.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Run{" "}
              <code className="rounded bg-muted px-1 text-xs">
                npm run generate:comparison
              </code>{" "}
              to create one.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {Object.entries(grouped).map(([category, items]) => (
              <section key={category}>
                <h2 className="mb-4 border-b pb-2 text-xl font-semibold">
                  {category}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((c) => (
                    <Link
                      key={c.id}
                      href={`/compare/${c.slug}`}
                      className="group flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
                    >
                      {/* Logos */}
                      <div className="flex shrink-0 items-center gap-1">
                        {c.toolA.logo ? (
                          <Image
                            src={c.toolA.logo}
                            alt={c.toolA.name}
                            width={28}
                            height={28}
                            className="rounded border"
                          />
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded border bg-muted text-xs font-bold text-muted-foreground">
                            {c.toolA.name[0]}
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground">vs</span>
                        {c.toolB.logo ? (
                          <Image
                            src={c.toolB.logo}
                            alt={c.toolB.name}
                            width={28}
                            height={28}
                            className="rounded border"
                          />
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded border bg-muted text-xs font-bold text-muted-foreground">
                            {c.toolB.name[0]}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium group-hover:text-primary transition-colors">
                          {c.toolA.name} vs {c.toolB.name}
                        </p>
                        {c.verdict ? (
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {c.verdict}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Side-by-side feature comparison →
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
