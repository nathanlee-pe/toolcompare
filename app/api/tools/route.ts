import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/tools — simple JSON endpoint for client-side filtering / external consumers
export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category");
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 20), 100);
  const page = Math.max(Number(req.nextUrl.searchParams.get("page") ?? 1), 1);

  const [tools, total] = await Promise.all([
    prisma.tool.findMany({
      where: {
        publishedAt: { not: null },
        ...(category && { category: { slug: category } }),
      },
      select: {
        slug: true,
        name: true,
        tagline: true,
        logo: true,
        avgRating: true,
        reviewCount: true,
        pricingModel: true,
        startingPrice: true,
        hasFreeplan: true,
        category: { select: { name: true, slug: true } },
      },
      orderBy: { avgRating: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.tool.count({
      where: {
        publishedAt: { not: null },
        ...(category && { category: { slug: category } }),
      },
    }),
  ]);

  return NextResponse.json({
    tools,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  });
}
