import Link from "next/link";
import Image from "next/image";
import type { Tool, Category, AffiliateLink } from "@prisma/client";
import { StarRating } from "@/components/star-rating";
import { AffiliateCta } from "@/components/affiliate-cta";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";

type ToolWithRelations = Tool & {
  category: Category;
  affiliateLinks: AffiliateLink[];
};

interface ToolCardProps {
  tool: ToolWithRelations;
  rank?: number;
  variant?: "card" | "horizontal";
}

export function ToolCard({ tool, rank, variant = "card" }: ToolCardProps) {
  const primaryLink = tool.affiliateLinks[0];

  if (variant === "horizontal") {
    return (
      <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
        {tool.logo && (
          <Image
            src={tool.logo}
            alt={`${tool.name} logo`}
            width={48}
            height={48}
            className="rounded-lg border"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link href={`/tools/${tool.slug}`} className="font-semibold hover:underline truncate">
              {tool.name}
            </Link>
            {rank === 1 && <Badge variant="default">Top Pick</Badge>}
          </div>
          {tool.tagline && (
            <p className="text-sm text-muted-foreground truncate">{tool.tagline}</p>
          )}
          <div className="mt-1 flex items-center gap-3">
            <StarRating rating={tool.avgRating} size="sm" />
            <span className="text-xs text-muted-foreground">
              {tool.avgRating.toFixed(1)} ({tool.reviewCount})
            </span>
            <span className="text-xs text-muted-foreground">
              {formatPrice(tool.startingPrice)}
            </span>
          </div>
        </div>
        {primaryLink && (
          <AffiliateCta link={primaryLink} toolSlug={tool.slug} size="sm" source="tool-card-horizontal" />
        )}
      </div>
    );
  }

  return (
    <div className="group flex flex-col rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="p-5 flex-1 space-y-3">
        <div className="flex items-start gap-3">
          {tool.logo ? (
            <Image
              src={tool.logo}
              alt={`${tool.name} logo`}
              width={48}
              height={48}
              className="rounded-lg border shrink-0"
            />
          ) : (
            <div className="h-12 w-12 rounded-lg border bg-muted shrink-0 flex items-center justify-center text-lg font-bold text-muted-foreground">
              {tool.name[0]}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {rank === 1 && <Badge variant="default" className="text-xs">Top Pick</Badge>}
            </div>
            <Link
              href={`/tools/${tool.slug}`}
              className="block font-semibold hover:underline leading-tight"
            >
              {tool.name}
            </Link>
            <Badge variant="secondary" className="mt-1 text-xs">
              {tool.category.name}
            </Badge>
          </div>
        </div>

        {tool.tagline && (
          <p className="text-sm text-muted-foreground line-clamp-2">{tool.tagline}</p>
        )}

        <div className="flex items-center gap-2">
          <StarRating rating={tool.avgRating} size="sm" />
          <span className="text-xs text-muted-foreground">
            {tool.avgRating.toFixed(1)} · {tool.reviewCount} reviews
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {tool.hasFreeplan ? "Free plan available" : formatPrice(tool.startingPrice)}
          </span>
          {tool.hasFreeplan && (
            <span className="text-xs text-green-600 font-medium">Free tier</span>
          )}
        </div>
      </div>

      <div className="border-t p-4 flex gap-2">
        <Link
          href={`/tools/${tool.slug}`}
          className="flex-1 inline-flex items-center justify-center rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent transition-colors"
        >
          Read Review
        </Link>
        {primaryLink && (
          <AffiliateCta link={primaryLink} toolSlug={tool.slug} size="sm" source="tool-card-grid" className="flex-1" />
        )}
      </div>
    </div>
  );
}
