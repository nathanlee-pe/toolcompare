/**
 * components/affiliate-cta.tsx
 *
 * Affiliate call-to-action button. When toolSlug is provided every click is
 * routed through /go/[slug] so it gets logged to the ClickLog table. Without
 * toolSlug it falls back to the direct affiliate URL (no server-side logging).
 */

import type { AffiliateLink } from "@prisma/client";
import { cn } from "@/lib/utils";
import { getAffiliateUrl, getGoUrl } from "@/lib/affiliate";

interface AffiliateCtaProps {
  link: Pick<AffiliateLink, "id" | "label" | "url" | "trackedUrl" | "commission">;
  /** Tool slug — when provided the CTA routes through /go/[slug] for logging */
  toolSlug?: string;
  size?: "sm" | "default" | "lg";
  className?: string;
  /** Placement identifier logged as the "source" column in ClickLog */
  source?: string;
}

export function AffiliateCta({
  link,
  toolSlug,
  size = "default",
  className,
  source,
}: AffiliateCtaProps) {
  // If we have the tool slug, route through the tracking endpoint.
  // Otherwise fall back to the direct URL (e.g. when toolSlug is unavailable).
  const href = toolSlug
    ? getGoUrl(toolSlug, source)
    : getAffiliateUrl(link, source);

  // /go/* is an internal Next.js route — no need for noopener/sponsored on it.
  // The route handler itself performs the external redirect.
  const isInternal = href.startsWith("/go/");

  const sizeClass = {
    sm: "h-8 px-3 text-xs",
    default: "h-9 px-4 text-sm",
    lg: "h-11 px-8 text-base",
  }[size];

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <a
        href={href}
        target="_blank"
        rel={
          isInternal
            ? "noopener noreferrer"
            : "nofollow noopener noreferrer sponsored"
        }
        className={cn(
          "inline-flex items-center justify-center rounded-md bg-primary font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors",
          sizeClass
        )}
      >
        {link.label}
      </a>
      {link.commission && (
        <p className="text-center text-xs text-muted-foreground">
          {link.commission}
        </p>
      )}
    </div>
  );
}
