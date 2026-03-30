/**
 * lib/affiliate.ts
 *
 * Affiliate URL helpers and server-side click logging.
 * All DB calls in this file are server-only (never imported on the client).
 */

import type { AffiliateLink, Tool } from "@prisma/client";
import { createHash } from "crypto";
import type { NextRequest } from "next/server";

// Salt makes the IP hash non-reversible even with a rainbow table.
// Set CLICK_IP_SALT in your .env — any random string works.
const IP_SALT = process.env.CLICK_IP_SALT ?? "saas-reviews-default-salt";

// ─── URL helper (client-safe) ─────────────────────────────────────────────────

/**
 * Returns the best affiliate URL for a link, optionally with UTM params.
 * Falls back to raw url if trackedUrl is not set.
 */
export function getAffiliateUrl(
  link: Pick<AffiliateLink, "url" | "trackedUrl">,
  source?: string
): string {
  const base = link.trackedUrl ?? link.url;
  if (!source) return base;

  try {
    const url = new URL(base);
    url.searchParams.set(
      "utm_source",
      process.env.NEXT_PUBLIC_SITE_NAME ?? "saasreviews"
    );
    url.searchParams.set("utm_medium", "affiliate");
    url.searchParams.set("utm_campaign", source);
    return url.toString();
  } catch {
    return base;
  }
}

/**
 * Builds the /go/[slug] redirect URL for a tool.
 * Use this in components instead of the raw affiliate URL so every click is
 * routed through the logging endpoint.
 */
export function getGoUrl(toolSlug: string, source?: string): string {
  const base = `/go/${toolSlug}`;
  if (!source) return base;
  return `${base}?source=${encodeURIComponent(source)}`;
}

// ─── IP hashing (server-only) ─────────────────────────────────────────────────

function hashIp(ip: string): string {
  return createHash("sha256")
    .update(IP_SALT + ip)
    .digest("hex")
    .slice(0, 24); // 24 hex chars — enough for dedup, short enough to index well
}

function extractIp(request: NextRequest): string | null {
  // Vercel / Cloudflare / nginx proxy headers in priority order
  const candidates = [
    request.headers.get("x-real-ip"),
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    request.headers.get("cf-connecting-ip"),
  ];
  return candidates.find(Boolean) ?? null;
}

function extractCountry(request: NextRequest): string | null {
  // Vercel edge, Cloudflare Workers, or custom header
  return (
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry") ??
    null
  );
}

// ─── Click logging (server-only) ──────────────────────────────────────────────

interface LogClickOptions {
  link: Pick<AffiliateLink, "id" | "toolId">;
  tool: Pick<Tool, "id">;
  request: NextRequest;
  source?: string;
}

/**
 * Writes one ClickLog row and increments the AffiliateLink.clicks counter.
 * Call this from /go/[slug]/route.ts only — never from client components.
 *
 * Both writes run in a Prisma transaction so the counter stays consistent.
 */
export async function logAffiliateClick({
  link,
  tool,
  request,
  source,
}: LogClickOptions): Promise<void> {
  const { prisma } = await import("@/lib/prisma");

  const rawIp = extractIp(request);
  const ipHash = rawIp ? hashIp(rawIp) : null;
  const country = extractCountry(request);
  const referrer =
    request.headers.get("referer") ??
    request.headers.get("referrer") ??
    null;
  const rawUa = request.headers.get("user-agent") ?? null;
  // Trim UA to 512 chars so we don't blow up the column on crazy long strings
  const userAgent = rawUa ? rawUa.slice(0, 512) : null;

  // Run both writes together — if the log fails the counter won't drift
  await prisma.$transaction([
    prisma.clickLog.create({
      data: {
        affiliateLinkId: link.id,
        toolId: tool.id,
        referrer,
        userAgent,
        ipHash,
        country,
        source: source ?? null,
      },
    }),
    prisma.affiliateLink.update({
      where: { id: link.id },
      data: { clicks: { increment: 1 } },
    }),
  ]);
}

// ─── Legacy helper (kept for backwards compat) ───────────────────────────────

/**
 * @deprecated Use logAffiliateClick() from /go/[slug]/route.ts instead.
 * This increments the counter only — no granular log row is created.
 */
export async function recordAffiliateClick(linkId: string): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  await prisma.affiliateLink.update({
    where: { id: linkId },
    data: { clicks: { increment: 1 } },
  });
}
