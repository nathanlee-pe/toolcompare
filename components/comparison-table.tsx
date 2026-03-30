import type { Tool } from "@prisma/client";
import Link from "next/link";
import { StarRating } from "@/components/star-rating";
import { formatPrice } from "@/lib/utils";

interface AffiliateLink {
  id: string;
  label: string;
  url: string;
  trackedUrl: string | null;
  isPrimary: boolean;
}

interface ComparisonTableProps {
  toolA: Tool;
  toolB: Tool;
  /** Primary affiliate link for Tool A — renders a CTA row at the bottom of the table */
  toolALink?: AffiliateLink | null;
  /** Primary affiliate link for Tool B — renders a CTA row at the bottom of the table */
  toolBLink?: AffiliateLink | null;
}

const CORE_FEATURES = [
  { key: "api", label: "API Access" },
  { key: "sso", label: "SSO / SAML" },
  { key: "mobileApp", label: "Mobile App" },
  { key: "audit", label: "Audit Logs" },
  { key: "customDomain", label: "Custom Domain" },
  { key: "webhooks", label: "Webhooks" },
  { key: "exportData", label: "Data Export" },
  { key: "2fa", label: "Two-Factor Auth" },
];

function FeatureCell({ value }: { value: unknown }) {
  if (value === true) return <span className="text-green-500 text-lg">✓</span>;
  if (value === false) return <span className="text-red-400 text-lg">✗</span>;
  if (value === null || value === undefined) return <span className="text-muted-foreground">—</span>;
  return <span className="text-sm">{String(value)}</span>;
}

export function ComparisonTable({ toolA, toolB, toolALink, toolBLink }: ComparisonTableProps) {
  const featuresA = (toolA.features as Record<string, unknown>) ?? {};
  const featuresB = (toolB.features as Record<string, unknown>) ?? {};

  const rows = [
    {
      label: "Overall Rating",
      a: <StarRating rating={toolA.avgRating} size="sm" showNumber />,
      b: <StarRating rating={toolB.avgRating} size="sm" showNumber />,
    },
    {
      label: "Starting Price",
      a: formatPrice(toolA.startingPrice),
      b: formatPrice(toolB.startingPrice),
    },
    {
      label: "Free Plan",
      a: <FeatureCell value={toolA.hasFreeplan} />,
      b: <FeatureCell value={toolB.hasFreeplan} />,
    },
    {
      label: "Free Trial",
      a: <FeatureCell value={toolA.hasFreeTrial} />,
      b: <FeatureCell value={toolB.hasFreeTrial} />,
    },
    {
      label: "Pricing Model",
      a: toolA.pricingModel.replace("_", " ").toLowerCase(),
      b: toolB.pricingModel.replace("_", " ").toLowerCase(),
    },
    ...CORE_FEATURES.map(({ key, label }) => ({
      label,
      a: <FeatureCell value={featuresA[key]} />,
      b: <FeatureCell value={featuresB[key]} />,
    })),
  ];

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="w-40 p-4 text-left font-medium text-muted-foreground">Feature</th>
            <th className="p-4 text-center font-semibold">{toolA.name}</th>
            <th className="p-4 text-center font-semibold">{toolB.name}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}
            >
              <td className="p-4 text-muted-foreground">{row.label}</td>
              <td className="p-4 text-center">
                {typeof row.a === "string" ? row.a : row.a}
              </td>
              <td className="p-4 text-center">
                {typeof row.b === "string" ? row.b : row.b}
              </td>
            </tr>
          ))}
        </tbody>

        {/* CTA row — only rendered when affiliate links are available */}
        {(toolALink || toolBLink) && (
          <tfoot>
            <tr className="border-t bg-muted/30">
              <td className="p-4 text-xs font-medium text-muted-foreground">
                Get started
              </td>
              <td className="p-3 text-center">
                {toolALink ? (
                  <Link
                    href={`/go/${toolA.slug}`}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    {toolALink.label || `Try ${toolA.name}`}
                  </Link>
                ) : (
                  <Link
                    href={`/tools/${toolA.slug}`}
                    className="inline-flex h-8 items-center justify-center rounded-md border bg-background px-4 text-xs font-medium hover:bg-accent transition-colors"
                  >
                    Read review
                  </Link>
                )}
              </td>
              <td className="p-3 text-center">
                {toolBLink ? (
                  <Link
                    href={`/go/${toolB.slug}`}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    {toolBLink.label || `Try ${toolB.name}`}
                  </Link>
                ) : (
                  <Link
                    href={`/tools/${toolB.slug}`}
                    className="inline-flex h-8 items-center justify-center rounded-md border bg-background px-4 text-xs font-medium hover:bg-accent transition-colors"
                  >
                    Read review
                  </Link>
                )}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
