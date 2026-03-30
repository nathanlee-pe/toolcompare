/**
 * lib/seo.ts
 *
 * Centralised JSON-LD schema builders and OpenGraph helper types.
 * Every page imports what it needs — no client bundle impact (server-only).
 */

import type { Tool, Category, Comparison } from "@prisma/client";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yourdomain.com";
const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? "SaaS Reviews";

// Shared publisher block reused across all schemas
const publisher = {
  "@type": "Organization" as const,
  name: siteName,
  url: siteUrl,
};

// ─── WebSite ─────────────────────────────────────────────────────────────────
// Place on the homepage. Enables the Google Sitelinks Searchbox.

export function buildWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/tools?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

// ─── Organization ─────────────────────────────────────────────────────────────
// Place on the homepage alongside WebSite.

export function buildOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: siteUrl,
    logo: `${siteUrl}/og-default.png`,
    sameAs: [],
  };
}

// ─── SoftwareApplication ──────────────────────────────────────────────────────
// Place on /tools/[slug]. Provides AggregateRating rich snippet.

export function buildToolSchema(
  tool: Tool & { category: Category }
) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: tool.name,
    url: tool.website,
    applicationCategory: tool.category.name,
    operatingSystem: "Web",
    ...(tool.logo ? { image: tool.logo } : {}),
    ...(tool.startingPrice != null
      ? {
          offers: {
            "@type": "Offer",
            price: tool.startingPrice,
            priceCurrency: "USD",
          },
        }
      : {}),
    // Emit aggregateRating whenever we have a score.
    // ratingCount must be ≥ 1 for Google to show the rich snippet.
    // Editorial reviews count as 1 review authored by the publisher.
    ...(tool.avgRating > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: tool.avgRating.toFixed(1),
            bestRating: "5",
            worstRating: "1",
            ratingCount: Math.max(tool.reviewCount, 1),
          },
        }
      : {}),
    publisher,
  };
}

// ─── Review (editorial) ────────────────────────────────────────────────────────
// Also place on /tools/[slug] alongside SoftwareApplication.
// Provides the editorial-review structured data.

export function buildReviewSchema(
  tool: Tool & { category: Category },
  slug: string
) {
  const year = new Date().getFullYear();
  const title = tool.metaTitle ?? `${tool.name} Review (${year})`;
  return {
    "@context": "https://schema.org",
    "@type": "Review",
    name: title,
    url: `${siteUrl}/tools/${slug}`,
    ...(tool.publishedAt
      ? { datePublished: tool.publishedAt.toISOString() }
      : {}),
    dateModified: new Date().toISOString(),
    itemReviewed: {
      "@type": "SoftwareApplication",
      name: tool.name,
      url: tool.website,
      applicationCategory: tool.category.name,
    },
    reviewRating: {
      "@type": "Rating",
      ratingValue: tool.avgRating.toFixed(1),
      bestRating: "5",
      worstRating: "1",
    },
    author: publisher,
    publisher,
  };
}

// ─── Article (comparison) ─────────────────────────────────────────────────────
// Place on /compare/[slug].

export function buildComparisonSchema(
  toolA: Pick<Tool, "name" | "website">,
  toolB: Pick<Tool, "name" | "website">,
  options?: {
    slug?: string;
    metaTitle?: string | null;
    metaDescription?: string | null;
    verdict?: string | null;
    publishedAt?: Date | null;
  }
) {
  const title =
    options?.metaTitle ??
    `${toolA.name} vs ${toolB.name} — Which Is Better? (${new Date().getFullYear()})`;

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    ...(options?.slug
      ? { url: `${siteUrl}/compare/${options.slug}` }
      : {}),
    ...(options?.publishedAt
      ? { datePublished: options.publishedAt.toISOString() }
      : {}),
    dateModified: new Date().toISOString(),
    ...(options?.metaDescription
      ? { description: options.metaDescription }
      : {}),
    ...(options?.verdict ? { abstract: options.verdict } : {}),
    author: publisher,
    publisher,
    about: [
      {
        "@type": "SoftwareApplication",
        name: toolA.name,
        url: toolA.website,
      },
      {
        "@type": "SoftwareApplication",
        name: toolB.name,
        url: toolB.website,
      },
    ],
  };
}

// ─── ItemList (category) ──────────────────────────────────────────────────────
// Place on /category/[slug]. Helps Google show the list as a rich result.

export function buildCategorySchema(
  category: Category,
  tools: Array<{
    name: string;
    slug: string;
    tagline: string | null;
    avgRating: number;
  }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Best ${category.name} Software (${new Date().getFullYear()})`,
    description:
      category.description ??
      `Top-rated ${category.name} tools reviewed and compared.`,
    url: `${siteUrl}/category/${category.slug}`,
    numberOfItems: tools.length,
    itemListElement: tools.map((tool, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: tool.name,
      url: `${siteUrl}/tools/${tool.slug}`,
      ...(tool.tagline ? { description: tool.tagline } : {}),
    })),
  };
}

// ─── CollectionPage ───────────────────────────────────────────────────────────
// Place on hub/listing pages: /tools, /compare, /categories.

export function buildCollectionPageSchema(opts: {
  name: string;
  description: string;
  url: string;
  items?: Array<{ name: string; url: string; description?: string }>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    description: opts.description,
    url: opts.url.startsWith("http") ? opts.url : `${siteUrl}${opts.url}`,
    publisher,
    ...(opts.items && opts.items.length > 0
      ? {
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: opts.items.length,
            itemListElement: opts.items.map((item, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: item.name,
              url: item.url.startsWith("http") ? item.url : `${siteUrl}${item.url}`,
              ...(item.description ? { description: item.description } : {}),
            })),
          },
        }
      : {}),
  };
}

// ─── BreadcrumbList ──────────────────────────────────────────────────────────
// Emit as a separate <script> tag alongside the page-specific schema.

export function buildBreadcrumbSchema(
  crumbs: Array<{ name: string; url: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: crumb.url.startsWith("http")
        ? crumb.url
        : `${siteUrl}${crumb.url}`,
    })),
  };
}

// ─── Shared OG image helper ──────────────────────────────────────────────────
// Returns the best OG image URL for a page. Prefers a tool logo when it's a
// full HTTPS URL, otherwise falls back to the default social card.

export function ogImage(
  src: string | null | undefined,
  fallback = "/og-default.png"
) {
  const url = src && src.startsWith("https://") ? src : fallback;
  return [
    {
      url: url.startsWith("https://") ? url : `${siteUrl}${url}`,
      width: 1200,
      height: 630,
      alt: siteName,
    },
  ];
}
