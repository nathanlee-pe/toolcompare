/**
 * app/categories/page.tsx — Category index / hub
 *
 * JSON-LD: CollectionPage with embedded ItemList of all categories.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CategoryNav } from "@/components/category-nav";
import { buildCollectionPageSchema, buildBreadcrumbSchema } from "@/lib/seo";

export const revalidate = 3600;

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yourdomain.com";
const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? "SaaS Reviews";
const year = new Date().getFullYear();

export const metadata: Metadata = {
  title: `Browse SaaS Categories (${year}) — Find the Best Software`,
  description: `Explore SaaS tools by category. Find the best ${year} software for project management, CRM, marketing, analytics, and more.`,
  alternates: { canonical: `${siteUrl}/categories` },
  openGraph: {
    type: "website",
    url: `${siteUrl}/categories`,
    title: `Browse SaaS Categories (${year}) — Find the Best Software`,
    description: `Find the best SaaS tools for every use case — project management, CRM, marketing, analytics, and more.`,
    siteName,
    images: [{ url: `${siteUrl}/og-default.png`, width: 1200, height: 630, alt: siteName }],
  },
  twitter: {
    card: "summary_large_image",
    title: `Browse SaaS Categories (${year}) — Find the Best Software`,
    description: `Find the best SaaS tools for every use case.`,
    images: [`${siteUrl}/og-default.png`],
  },
};

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    where: { parentId: null }, // top-level only
    orderBy: { name: "asc" },
    include: {
      _count: { select: { tools: true } },
      children: {
        include: { _count: { select: { tools: true } } },
        orderBy: { name: "asc" },
      },
    },
  });

  // JSON-LD — CollectionPage with all categories as list items
  const collectionSchema = buildCollectionPageSchema({
    name: `Browse SaaS Software Categories (${year})`,
    description: `Find the best SaaS tools for every business use case — ${categories.length} categories reviewed.`,
    url: `${siteUrl}/categories`,
    items: categories.map((cat) => ({
      name: cat.name,
      url: `${siteUrl}/category/${cat.slug}`,
      ...(cat.description ? { description: cat.description } : {}),
    })),
  });

  const breadcrumbSchema = buildBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Categories", url: "/categories" },
  ]);

  const totalTools = categories.reduce(
    (sum, cat) => sum + cat._count.tools,
    0
  );

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
          <span className="text-foreground">Categories</span>
        </nav>

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Browse by Category
          </h1>
          <p className="mt-2 text-muted-foreground">
            {categories.length} categories · {totalTools} tools reviewed and
            ranked by our editorial team
          </p>
        </div>

        {/* Top-level category grid */}
        <CategoryNav categories={categories} />

        {/* Subcategory breakdown */}
        {categories.some((c) => c.children.length > 0) && (
          <div className="mt-12 space-y-8">
            <h2 className="text-xl font-bold">All Subcategories</h2>
            {categories
              .filter((c) => c.children.length > 0)
              .map((cat) => (
                <section key={cat.id}>
                  <Link
                    href={`/category/${cat.slug}`}
                    className="mb-3 flex items-center gap-2 font-semibold hover:underline"
                  >
                    {cat.icon && <span>{cat.icon}</span>}
                    {cat.name}
                    <span className="text-sm font-normal text-muted-foreground">
                      ({cat._count.tools} tools)
                    </span>
                  </Link>
                  <div className="flex flex-wrap gap-2">
                    {cat.children.map((sub) => (
                      <Link
                        key={sub.id}
                        href={`/category/${sub.slug}`}
                        className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-sm shadow-sm hover:border-primary/50 hover:bg-accent transition-colors"
                      >
                        {sub.icon && <span>{sub.icon}</span>}
                        {sub.name}
                        <span className="text-xs text-muted-foreground">
                          ({sub._count.tools})
                        </span>
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
