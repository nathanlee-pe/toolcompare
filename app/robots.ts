/**
 * app/robots.ts — robots.txt generation
 *
 * Rules applied (in order of specificity):
 *
 *   1. Googlebot / Bingbot — full access, explicit allow for clarity
 *   2. Common Crawl (CCBot) — disallowed; used for AI training datasets
 *   3. OpenAI scrapers — GPTBot (training) disallowed; ChatGPT-User (citations) allowed
 *   4. Anthropic / Claude — disallowed (opt-out of training data collection)
 *   5. All other bots — allow public content, disallow private paths
 *
 * Paths always disallowed:
 *   /api/       — server-only endpoints, no crawlable content
 *   /admin/     — analytics dashboard (noindex via metadata, also blocked here)
 *   /go/        — affiliate redirect handler; should NEVER be indexed
 *   /_next/     — Next.js internals
 *
 * To allow AI assistants to index for citation purposes, promote the
 * ChatGPT-User rule to "Allow: /" and keep GPTBot disallowed (they are
 * different — ChatGPT-User retrieves pages at query time, GPTBot trains models).
 */

import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yourdomain.com";

// Paths that should never be crawled by any bot
const PRIVATE_PATHS = ["/api/", "/admin/", "/go/", "/_next/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // ── 1. Verified search-engine crawlers (full access) ──────────────────
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: "Googlebot-Image",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: "Bingbot",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: "DuckDuckBot",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: "Slurp", // Yahoo
        allow: "/",
        disallow: PRIVATE_PATHS,
      },

      // ── 2. AI training scrapers (disallow) ────────────────────────────────
      // These bots collect training data; the content here is editorial and
      // affiliate-supported, so we opt out of contributing to training corpora.
      {
        userAgent: "CCBot", // Common Crawl — feeds many LLM training sets
        disallow: "/",
      },
      {
        userAgent: "GPTBot", // OpenAI model training
        disallow: "/",
      },
      {
        userAgent: "Google-Extended", // Google Bard / Gemini training
        disallow: "/",
      },
      {
        userAgent: "anthropic-ai", // Anthropic training crawl
        disallow: "/",
      },
      {
        userAgent: "Claude-Web", // Alternate Anthropic identifier
        disallow: "/",
      },
      {
        userAgent: "cohere-ai",
        disallow: "/",
      },
      {
        userAgent: "PerplexityBot", // Perplexity training
        disallow: "/",
      },
      {
        userAgent: "Bytespider", // TikTok / ByteDance training
        disallow: "/",
      },
      {
        userAgent: "Amazonbot", // Amazon Alexa training
        disallow: "/",
      },

      // ── 3. AI assistants that cite sources (allow public content) ─────────
      // Unlike training bots above, these retrieve pages at query time to cite
      // them — this can drive referral traffic.
      {
        userAgent: "ChatGPT-User", // ChatGPT browsing plugin
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: "PerplexityBot-User", // Perplexity at query time
        allow: "/",
        disallow: PRIVATE_PATHS,
      },

      // ── 4. All other bots (default policy) ───────────────────────────────
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
        // crawlDelay is not part of Next.js MetadataRoute.Robots but can be
        // added via a custom route handler if needed (most bots respect it).
      },
    ],

    // Canonical sitemap index — references /sitemap/0.xml … /sitemap/3.xml
    sitemap: `${siteUrl}/sitemap.xml`,

    // Non-standard: some crawlers read this host declaration
    host: siteUrl,
  };
}
