import type { PricingTier, AffiliateLink } from "@prisma/client";
import { AffiliateCta } from "@/components/affiliate-cta";
import { cn, formatPrice } from "@/lib/utils";

interface PricingTableProps {
  tiers: PricingTier[];
  affiliateLinks?: AffiliateLink[];
  toolSlug?: string;
}

export function PricingTable({ tiers, affiliateLinks = [], toolSlug }: PricingTableProps) {
  const primaryLink = affiliateLinks.find((l) => l.isPrimary) ?? affiliateLinks[0];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tiers.map((tier) => (
        <div
          key={tier.id}
          className={cn(
            "relative flex flex-col rounded-xl border p-5",
            tier.isPopular
              ? "border-primary shadow-lg"
              : "bg-card shadow-sm"
          )}
        >
          {tier.isPopular && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                Most Popular
              </span>
            </div>
          )}

          <div className="mb-4">
            <p className="text-sm font-medium text-muted-foreground">{tier.name}</p>
            <p className="mt-1 text-3xl font-bold">
              {tier.isFree
                ? "Free"
                : tier.price == null
                  ? "Custom"
                  : `$${tier.price}`}
            </p>
            {!tier.isFree && tier.price != null && (
              <p className="text-xs text-muted-foreground">
                /{tier.billingCycle.toLowerCase()}
              </p>
            )}
          </div>

          <ul className="mb-6 flex-1 space-y-2">
            {tier.features.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 text-green-500">✓</span>
                {f}
              </li>
            ))}
          </ul>

          {primaryLink && (
            <AffiliateCta link={primaryLink} toolSlug={toolSlug} source="pricing-table" />
          )}
        </div>
      ))}
    </div>
  );
}
