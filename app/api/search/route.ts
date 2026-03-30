import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const tools = await prisma.tool.findMany({
    where: {
      publishedAt: { not: null },
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { tagline: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      slug: true,
      name: true,
      tagline: true,
      logo: true,
      category: { select: { name: true } },
    },
    take: 8,
  });

  return NextResponse.json({ results: tools });
}
