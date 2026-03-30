/**
 * app/go/[slug]/route.ts — Affiliate redirect handler
 *
 * GET /go/[tool-slug]               → primary affiliate link for this tool
 * GET /go/[tool-slug]?source=foo    → same, with source attribution logged
 * GET /go/[tool-slug]?lid=[linkId]  → specific affiliate link (non-primary)
 *
 * Flow:
 *   1. Resolve the tool and affiliate link from the DB
 *   2. Log: tool, link, timestamp, referrer, user-agent, hashed IP, country
 *   3. 302 redirect to destination (trackedUrl ?? url) + UTM params
 *
 * Notes:
 *   • 302 (temporary) prevents search engines from caching the redirect URL
 *   • Cache-Control: no-store stops CDN edge caches from serving stale redirects
 *   • Referrer-Policy: strict-origin-when-cross-origin passes our domain to the
 *     affiliate network (needed for attribution) but not the full path
 */

import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAffiliateClick, getAffiliateUrl } from "@/lib/affiliate";

export const runtime = "nodejs"; // needs crypto + Prisma (not Edge-compatible)
export const dynamic = "force-dynamic"; // never cache this route

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source") ?? undefined;
  const specificLinkId = searchParams.get("lid") ?? undefined;

  // ── 1. Resolve tool ──────────────────────────────────────────────────────
  const tool = await prisma.tool.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      publishedAt: true,
      affiliateLinks: {
        where: { isActive: true },
        orderBy: [
          { isPrimary: "desc" }, // primary first
          { createdAt: "asc" },
        ],
      },
    },
  });

  // Tool not found → bounce to homepage
  if (!tool) {
    return NextResponse.redirect(new URL("/", request.url), {
      status: 302,
      headers: noCacheHeaders(),
    });
  }

  // Unpublished tool → bounce to the review page (show the draft notice)
  if (!tool.publishedAt) {
    return NextResponse.redirect(new URL(`/tools/${slug}`, request.url), {
      status: 302,
      headers: noCacheHeaders(),
    });
  }

  // ── 2. Pick the right affiliate link ────────────────────────────────────
  let link = tool.affiliateLinks[0]; // primary (or first active)

  if (specificLinkId) {
    const specific = tool.affiliateLinks.find((l) => l.id === specificLinkId);
    if (specific) link = specific;
  }

  // No affiliate link at all → send to the tool's own website or review page
  if (!link) {
    const fallback = await prisma.tool.findUnique({
      where: { slug },
      select: { website: true },
    });
    const dest = fallback?.website
      ? fallback.website
      : new URL(`/tools/${slug}`, request.url).toString();
    return NextResponse.redirect(dest, {
      status: 302,
      headers: noCacheHeaders(),
    });
  }

  // ── 3. Log the click (synchronous — adds ~10–30 ms before redirect) ─────
  try {
    await logAffiliateClick({
      link: { id: link.id, toolId: link.toolId },
      tool: { id: tool.id },
      request,
      source,
    });
  } catch (err) {
    // Never block the redirect if logging fails — just log the error
    console.error("[/go] click logging failed:", err);
  }

  // ── 4. Build destination URL with UTM params ─────────────────────────────
  const destination = getAffiliateUrl(link, source ?? "go-redirect");

  // ── 5. Redirect ──────────────────────────────────────────────────────────
  return NextResponse.redirect(destination, {
    status: 302,
    headers: {
      ...noCacheHeaders(),
      // Pass our origin to the affiliate network (needed for attribution)
      // but strip the path so they can't see which tool page the user came from.
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function noCacheHeaders(): Record<string, string> {
  return {
    // Stop CDN edges and browsers from caching the redirect target
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    // Vary ensures different users get different responses if headers differ
    Vary: "Accept-Encoding",
  };
}
