/**
 * app/sitemap.ts — Dynamic sitemap index
 *
 * Uses Next.js generateSitemaps() to split into 4 named chunks so Google
 * never hits the 50 000-URL-per-file limit as the catalogue grows.
 *
 * Generated URLs:
 *   /sitemap.xml          → auto-generated index referencing the 4 below
 *   /sitemap/0.xml        → static & hub pages
 *   /sitemap/1.xml        → individual tool review pages  (+ image entries)
 *   /sitemap/2.xml        → category listing pages
 *   /sitemap/3.xml        → comparison pages
 *
 * Priority scale used here:
 *   1.0  homepage
 *   0.9  hub pages (/tools, /compare, /categories)
 *   0.8  individual tool reviews   ← highest-value programmatic pages
 *   0.7  category listings         ← keyword-rich "best X software" pages
 *   0.6  comparison pages
 *
 * changeFrequency values:
 *   daily   → pages that get new content often (hubs)
 *   weekly  → tool reviews (pricing/features change)
 *   monthly → comparison articles
 */

import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yourdomain.com";

// ─── Sitemap index: tell Next.js how many chunks exist ──────────────────────
// Called at build time and on ISR revalidation.
export async function generateSitemaps() {
  return [
    { id: 0 }, // static pages
    { id: 1 }, // tool pages
    { id: 2 }, // category pages
    { id: 3 }, // comparison pages
  ];
}

// ─── Chunk router ─────────────────────────────────────────────────────────────
export default async function sitemap({
  id,
}: {
  id: number;
}): Promise<MetadataRoute.Sitemap> {
  switch (id) {
    case 0:
      return buildStaticSitemap();
    case 1:
      return buildToolsSitemap();
    case 2:
      return buildCategoriesSitemap();
    case 3:
      return buildComparisonsSitemap();
    default:
      return [];
  }
}

// ─── Chunk 0: static & hub pages ─────────────────────────────────────────────
async function buildStaticSitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  return [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${siteUrl}/tools`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/compare`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/categories`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}

// ─── Chunk 1: tool review pages ───────────────────────────────────────────────
// Includes `images` entries so Google can index tool logos via the image sitemap.
// If the catalogue exceeds 50 000 tools, add a CHUNK_SIZE + offset loop here.
async function buildToolsSitemap(): Promise<MetadataRoute.Sitemap> {
  const tools = await prisma.tool.findMany({
    where: { publishedAt: { not: null } },
    select: {
      slug: true,
      logo: true,
      name: true,
      updatedAt: true,
      publishedAt: true,
    },
    orderBy: { avgRating: "desc" },
  });

  return tools.map((tool) => {
    // Only include logos that are fully-qualified HTTPS URLs (sitemap spec requires absolute URLs)
    const images: string[] =
      tool.logo?.startsWith("https://") ? [tool.logo] : [];

    return {
      url: `${siteUrl}/tools/${tool.slug}`,
      lastModified: tool.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
      ...(images.length > 0 ? { images } : {}),
    };
  });
}

// ─── Chunk 2: category listing pages ─────────────────────────────────────────
async function buildCategoriesSitemap(): Promise<MetadataRoute.Sitemap> {
  const categories = await prisma.category.findMany({
    select: { slug: true, updatedAt: true },
    orderBy: { name: "asc" },
  });

  return categories.map((cat) => ({
    url: `${siteUrl}/category/${cat.slug}`, // canonical route (not /categories/)
    lastModified: cat.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));
}

// ─── Chunk 3: comparison pages ────────────────────────────────────────────────
async function buildComparisonsSitemap(): Promise<MetadataRoute.Sitemap> {
  const comparisons = await prisma.comparison.findMany({
    where: { publishedAt: { not: null } },
    select: { slug: true, updatedAt: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
  });

  return comparisons.map((c) => ({
    url: `${siteUrl}/compare/${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
}
