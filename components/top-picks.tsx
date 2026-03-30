import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { StarRating } from "@/components/star-rating";
import { AffiliateCta } from "@/components/affiliate-cta";

interface TopPicksProps {
  /**
   * Limit results to a specific category. Pass the category DB id.
   * When omitted, pulls the highest-commission tools site-wide.
   */
  categoryId?: string;
  /**
   * "sidebar" — compact vertical list (tool page / compare page sidebar)
   * "section" — full-width horizontal cards (category page / homepage)
   */
  variant?: "sidebar" | "section";
  title?: string;
  /** Source tag passed to affiliate click tracking */
  source?: string;
}

/**
 * Displays the top affiliate picks sorted by commission then by rating.
 *
 * Commission priority: tools whose affiliate link has a `commission` string
 * set (e.g. "30% recurring") are shown first — set this on your highest-value
 * deals in Prisma Studio or via the generate scripts. Within each group the
 * tools are ordered by avgRating descending.
 *
 * This is a React Server Component — no client JS needed.
 */
export async function TopPicks({
  categoryId,
  variant = "section",
  title,
  source = "top-picks",
}: TopPicksProps) {
  // Fetch tools that have at least one active affiliate link.
  // We pull up to 6 and sort commission-bearing ones to the front in JS
  // (Prisma can't ORDER BY across a relation without raw SQL).
  const candidates = await prisma.tool.findMany({
    where: {
      publishedAt: { not: null },
      affiliateLinks: { some: { isActive: true } },
      ...(categoryId ? { categoryId } : {}),
    },
    orderBy: { avgRating: "desc" },
    take: 6,
    include: {
      category: true,
      affiliateLinks: {
        where: { isActive: true, isPrimary: true },
        take: 1,
      },
    },
  });

  if (candidates.length === 0) return null;

  // Sort: tools with a commission string come first
  const sorted = [
    ...candidates.filter((t) => t.affiliateLinks[0]?.commission),
    ...candidates.filter((t) => !t.affiliateLinks[0]?.commission),
  ].slice(0, variant === "sidebar" ? 3 : 3);

  const heading = title ?? (categoryId ? "Top Picks in This Category" : "Editor's Top Picks");

  if (variant === "sidebar") {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="mb-1 font-semibold">{heading}</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Highest-rated tools with affiliate deals
        </p>
        <ul className="space-y-4">
          {sorted.map((tool, i) => {
            const link = tool.affiliateLinks[0];
            return (
              <li key={tool.id} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {tool.logo && (
                      <Image
                        src={tool.logo}
                        alt={tool.name}
                        width={16}
                        height={16}
                        className="rounded"
                      />
                    )}
                    <Link
                      href={`/tools/${tool.slug}`}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {tool.name}
                    </Link>
                  </div>
                  <StarRating rating={tool.avgRating} size="sm" showNumber className="mt-0.5" />
                  {link?.commission && (
                    <span className="mt-0.5 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      {link.commission}
                    </span>
                  )}
                  {link && (
                    <div className="mt-2">
                      <AffiliateCta
                        link={link}
                        toolSlug={tool.slug}
                        size="sm"
                        source={`${source}-sidebar`}
                      />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          We may earn a commission at no extra cost to you.
        </p>
      </div>
    );
  }

  // Section variant — horizontal cards
  return (
    <section className="rounded-2xl border bg-gradient-to-r from-amber-50/60 to-background p-6">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-lg">⭐</span>
        <h2 className="text-lg font-bold">{heading}</h2>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        Top-rated tools with verified affiliate partnerships
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {sorted.map((tool, i) => {
          const link = tool.affiliateLinks[0];
          return (
            <div
              key={tool.id}
              className="relative flex flex-col rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              {i === 0 && (
                <span className="absolute -top-2.5 left-4 rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-semibold text-white">
                  #1 Pick
                </span>
              )}
              <div className="mb-3 flex items-center gap-2.5">
                {tool.logo ? (
                  <Image
                    src={tool.logo}
                    alt={tool.name}
                    width={36}
                    height={36}
                    className="rounded-lg border"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-muted text-base font-bold text-muted-foreground">
                    {tool.name[0]}
                  </div>
                )}
                <div className="min-w-0">
                  <Link
                    href={`/tools/${tool.slug}`}
                    className="block truncate text-sm font-semibold hover:underline"
                  >
                    {tool.name}
                  </Link>
                  <StarRating rating={tool.avgRating} size="sm" showNumber />
                </div>
              </div>

              {tool.tagline && (
                <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
                  {tool.tagline}
                </p>
              )}

              {link?.commission && (
                <span className="mb-3 inline-flex w-fit items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                  {link.commission} commission
                </span>
              )}

              {link ? (
                <div className="mt-auto">
                  <AffiliateCta
                    link={link}
                    toolSlug={tool.slug}
                    size="sm"
                    source={`${source}-section`}
                    className="w-full justify-center"
                  />
                </div>
              ) : (
                <Link
                  href={`/tools/${tool.slug}`}
                  className="mt-auto inline-flex h-8 w-full items-center justify-center rounded-md border bg-background text-xs font-medium hover:bg-accent transition-colors"
                >
                  Read review →
                </Link>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        We earn a commission on purchases made through our links at no extra cost to you.
      </p>
    </section>
  );
}
