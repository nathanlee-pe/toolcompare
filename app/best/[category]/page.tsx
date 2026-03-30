import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ToolCard } from "@/components/tool-card";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yourdomain.com";

export const revalidate = 3600;

// "best" pages are high-intent SEO pages:  /best/crm, /best/project-management
// They mirror category pages but target "best X software" queries specifically.

interface PageProps {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  const categories = await prisma.category.findMany({ select: { slug: true } });
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await prisma.category.findUnique({ where: { slug } });
  if (!category) return {};

  const year = new Date().getFullYear();
  return {
    title: `Best ${category.name} Software in ${year} — Expert Picks`,
    description: `We tested the best ${category.name} tools of ${year}. See our top picks, pricing, and side-by-side comparisons.`,
    alternates: { canonical: `${siteUrl}/best/${slug}` },
    openGraph: {
      type: "article",
      url: `${siteUrl}/best/${slug}`,
      title: `Best ${category.name} Software in ${year} — Expert Picks`,
      description: `We tested the best ${category.name} tools of ${year}. See our top picks, pricing, and side-by-side comparisons.`,
    },
  };
}

export default async function BestPage({ params }: PageProps) {
  const { category: slug } = await params;

  const category = await prisma.category.findUnique({ where: { slug } });
  if (!category) notFound();

  const tools = await prisma.tool.findMany({
    where: {
      categoryId: category.id,
      publishedAt: { not: null },
    },
    orderBy: { avgRating: "desc" },
    take: 10,
    include: {
      category: true,
      affiliateLinks: { where: { isPrimary: true, isActive: true }, take: 1 },
    },
  });

  const year = new Date().getFullYear();

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <nav className="mb-4 text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">Home</Link>
        {" / "}
        <Link href="/categories" className="hover:underline">Categories</Link>
        {" / "}
        <span>Best {category.name}</span>
      </nav>

      <h1 className="mb-3 text-3xl font-bold">
        Best {category.name} Software in {year}
      </h1>
      <p className="mb-8 text-muted-foreground">
        We tested and rated the top {category.name.toLowerCase()} tools available today.
        Here are our expert picks ranked by overall score.
      </p>

      <div className="space-y-6">
        {tools.map((tool, i) => (
          <div key={tool.id} className="flex gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
              {i + 1}
            </div>
            <div className="flex-1">
              <ToolCard tool={tool} rank={i + 1} variant="horizontal" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Methodology</p>
        <p className="mt-1">
          Our rankings are based on verified user reviews, hands-on testing, pricing value, feature
          depth, and support quality. We update this list regularly as tools evolve.
        </p>
      </div>
    </div>
  );
}
