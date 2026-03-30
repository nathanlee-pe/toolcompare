/**
 * app/admin/clicks/page.tsx — Affiliate click analytics dashboard
 *
 * ⚠️  PROTECT THIS ROUTE IN PRODUCTION.
 * Add authentication middleware (NextAuth, Clerk, simple token check, etc.)
 * before deploying. This page exposes raw click data.
 *
 * No-JS, fully server-rendered with Prisma aggregate queries.
 * Revalidates every 5 minutes (ISR).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Click Analytics | Admin",
  robots: { index: false, follow: false }, // never index admin pages
};

export const revalidate = 300; // 5-minute ISR

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ClickAnalyticsPage() {
  const now = new Date();
  const today = daysAgo(0);
  const week = daysAgo(7);
  const month = daysAgo(30);

  // ── Aggregate queries (run in parallel) ──
  const [
    totalClicks,
    todayClicks,
    weekClicks,
    monthClicks,
    topTools,
    topSources,
    topLinks,
    dailyTrend,
    recentClicks,
    countryBreakdown,
  ] = await Promise.all([
    // Total all-time clicks
    prisma.clickLog.count(),

    // Today
    prisma.clickLog.count({ where: { createdAt: { gte: today } } }),

    // Last 7 days
    prisma.clickLog.count({ where: { createdAt: { gte: week } } }),

    // Last 30 days
    prisma.clickLog.count({ where: { createdAt: { gte: month } } }),

    // Top tools by click count (last 30 days)
    prisma.clickLog.groupBy({
      by: ["toolId"],
      where: { createdAt: { gte: month } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),

    // Top sources (last 30 days)
    prisma.clickLog.groupBy({
      by: ["source"],
      where: { createdAt: { gte: month } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),

    // Top individual affiliate links (last 30 days)
    prisma.clickLog.groupBy({
      by: ["affiliateLinkId"],
      where: { createdAt: { gte: month } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),

    // Daily click trend — last 14 days
    // Prisma groupBy doesn't support date truncation, so we pull raw rows
    // for the window and aggregate in JS (manageable for 14 days of data)
    prisma.clickLog.findMany({
      where: { createdAt: { gte: daysAgo(14) } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),

    // Recent individual click logs
    prisma.clickLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        source: true,
        referrer: true,
        country: true,
        tool: { select: { name: true, slug: true } },
        affiliateLink: { select: { label: true, program: true } },
      },
    }),

    // Country breakdown (last 30 days)
    prisma.clickLog.groupBy({
      by: ["country"],
      where: {
        createdAt: { gte: month },
        country: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
  ]);

  // ── Resolve tool names for topTools ──
  const toolIds = topTools.map((t) => t.toolId);
  const toolsById = await prisma.tool
    .findMany({
      where: { id: { in: toolIds } },
      select: { id: true, name: true, slug: true },
    })
    .then((rows) => Object.fromEntries(rows.map((r) => [r.id, r])));

  // ── Resolve link labels for topLinks ──
  const linkIds = topLinks.map((l) => l.affiliateLinkId);
  const linksById = await prisma.affiliateLink
    .findMany({
      where: { id: { in: linkIds } },
      select: {
        id: true,
        label: true,
        program: true,
        tool: { select: { name: true, slug: true } },
      },
    })
    .then((rows) => Object.fromEntries(rows.map((r) => [r.id, r])));

  // ── Build daily trend map ──
  const trendMap: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = daysAgo(i);
    trendMap[d.toISOString().slice(0, 10)] = 0;
  }
  for (const row of dailyTrend) {
    const key = row.createdAt.toISOString().slice(0, 10);
    if (key in trendMap) trendMap[key]++;
  }
  const trendRows = Object.entries(trendMap);
  const trendMax = Math.max(...Object.values(trendMap), 1);

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <header className="border-b bg-background px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Click Analytics</h1>
            <p className="text-xs text-muted-foreground">
              Last updated {now.toLocaleTimeString()} ·{" "}
              <Link href="/" className="text-primary hover:underline">
                ← Back to site
              </Link>
            </p>
          </div>
          <div className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
            ⚠️ Protect this page in production
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        {/* ── Summary stats ── */}
        <section>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "All-time clicks",
                value: totalClicks.toLocaleString(),
                sub: "since launch",
              },
              {
                label: "Last 30 days",
                value: monthClicks.toLocaleString(),
                sub: `${weekClicks} this week`,
              },
              {
                label: "Last 7 days",
                value: weekClicks.toLocaleString(),
                sub: `${todayClicks} today`,
              },
              {
                label: "Today",
                value: todayClicks.toLocaleString(),
                sub: now.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                }),
              },
            ].map(({ label, value, sub }) => (
              <div
                key={label}
                className="rounded-xl border bg-card p-5 shadow-sm"
              >
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-3xl font-bold tracking-tight">
                  {value}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Daily trend (last 14 days) ── */}
        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="mb-4 font-semibold">
            Daily Clicks — Last 14 Days
          </h2>
          <div className="flex items-end gap-1.5" style={{ height: 80 }}>
            {trendRows.map(([date, count]) => {
              const height = Math.max((count / trendMax) * 80, count > 0 ? 4 : 1);
              const isToday =
                date === new Date().toISOString().slice(0, 10);
              return (
                <div
                  key={date}
                  className="group relative flex flex-1 flex-col items-center"
                  title={`${date}: ${count} click${count !== 1 ? "s" : ""}`}
                >
                  <div
                    className={`w-full rounded-t ${
                      isToday ? "bg-primary" : "bg-primary/40 group-hover:bg-primary/70"
                    } transition-colors`}
                    style={{ height }}
                  />
                  {/* Tooltip on hover */}
                  <div className="pointer-events-none absolute -top-7 hidden rounded bg-foreground px-2 py-0.5 text-xs text-background group-hover:block">
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
          {/* x-axis labels */}
          <div className="mt-1 flex gap-1.5">
            {trendRows.map(([date], i) => (
              <div key={date} className="flex-1 text-center">
                {(i === 0 || i === 6 || i === 13) && (
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Top tools + Top sources (side by side) ── */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top tools */}
          <section className="rounded-xl border bg-card shadow-sm">
            <div className="border-b px-5 py-4">
              <h2 className="font-semibold">Top Tools by Clicks (30 days)</h2>
            </div>
            <div className="divide-y">
              {topTools.length === 0 && (
                <p className="px-5 py-4 text-sm text-muted-foreground">
                  No clicks yet.
                </p>
              )}
              {topTools.map((row, i) => {
                const tool = toolsById[row.toolId];
                const count = row._count.id;
                return (
                  <div
                    key={row.toolId}
                    className="flex items-center gap-4 px-5 py-3"
                  >
                    <span className="w-5 shrink-0 text-sm font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={tool ? `/tools/${tool.slug}` : "#"}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {tool?.name ?? row.toolId}
                      </Link>
                      {/* Mini bar */}
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{
                            width: pct(count, topTools[0]._count.id),
                          }}
                        />
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">
                      {count.toLocaleString()}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {pct(count, monthClicks)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Top sources */}
          <section className="rounded-xl border bg-card shadow-sm">
            <div className="border-b px-5 py-4">
              <h2 className="font-semibold">
                Top Sources / Placements (30 days)
              </h2>
            </div>
            <div className="divide-y">
              {topSources.length === 0 && (
                <p className="px-5 py-4 text-sm text-muted-foreground">
                  No source data yet.
                </p>
              )}
              {topSources.map((row, i) => {
                const count = row._count.id;
                return (
                  <div
                    key={row.source ?? "none"}
                    className="flex items-center gap-4 px-5 py-3"
                  >
                    <span className="w-5 shrink-0 text-sm font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">
                        {row.source ?? (
                          <span className="italic text-muted-foreground">
                            (direct / unknown)
                          </span>
                        )}
                      </p>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{
                            width: pct(
                              count,
                              topSources[0]._count.id
                            ),
                          }}
                        />
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">
                      {count.toLocaleString()}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {pct(count, monthClicks)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* ── Top affiliate links + Country breakdown ── */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top links */}
          <section className="rounded-xl border bg-card shadow-sm">
            <div className="border-b px-5 py-4">
              <h2 className="font-semibold">
                Top Affiliate Links (30 days)
              </h2>
            </div>
            <div className="divide-y">
              {topLinks.length === 0 && (
                <p className="px-5 py-4 text-sm text-muted-foreground">
                  No data yet.
                </p>
              )}
              {topLinks.map((row, i) => {
                const link = linksById[row.affiliateLinkId];
                const count = row._count.id;
                return (
                  <div
                    key={row.affiliateLinkId}
                    className="flex items-center gap-4 px-5 py-3"
                  >
                    <span className="w-5 shrink-0 text-sm font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">
                        {link
                          ? `${link.tool.name} — ${link.label}`
                          : row.affiliateLinkId}
                      </p>
                      {link?.program && (
                        <p className="text-xs text-muted-foreground">
                          {link.program}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-semibold">
                      {count.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Country breakdown */}
          <section className="rounded-xl border bg-card shadow-sm">
            <div className="border-b px-5 py-4">
              <h2 className="font-semibold">
                Top Countries (30 days)
              </h2>
            </div>
            <div className="divide-y">
              {countryBreakdown.length === 0 && (
                <p className="px-5 py-4 text-sm text-muted-foreground">
                  No geo data yet. Requires Vercel or Cloudflare.
                </p>
              )}
              {countryBreakdown.map((row, i) => {
                const count = row._count.id;
                return (
                  <div
                    key={row.country ?? "unknown"}
                    className="flex items-center gap-4 px-5 py-3"
                  >
                    <span className="w-5 shrink-0 text-sm font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {row.country ?? "Unknown"}
                      </p>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-blue-400/70"
                          style={{
                            width: pct(
                              count,
                              countryBreakdown[0]._count.id
                            ),
                          }}
                        />
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">
                      {count.toLocaleString()}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {pct(count, monthClicks)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* ── Recent click log ── */}
        <section className="rounded-xl border bg-card shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Recent Clicks (last 50)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {[
                    "Time",
                    "Tool",
                    "Link",
                    "Source",
                    "Country",
                    "Referrer",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentClicks.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-muted-foreground"
                    >
                      No clicks recorded yet. Visit{" "}
                      <code className="rounded bg-muted px-1">/go/[tool-slug]</code>{" "}
                      to test.
                    </td>
                  </tr>
                )}
                {recentClicks.map((click, i) => (
                  <tr
                    key={click.id}
                    className={`border-b last:border-0 ${
                      i % 2 === 1 ? "bg-muted/10" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                      {click.createdAt.toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/tools/${click.tool.slug}`}
                        className="font-medium hover:underline"
                      >
                        {click.tool.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {click.affiliateLink.label}
                      {click.affiliateLink.program && (
                        <span className="ml-1 text-muted-foreground/60">
                          ({click.affiliateLink.program})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {click.source ? (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                          {click.source}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {click.country ?? "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-2.5 text-xs text-muted-foreground">
                      {click.referrer ? (
                        <span title={click.referrer}>
                          {click.referrer.replace(/^https?:\/\//, "")}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── SQL reference ── */}
        <section className="rounded-xl border bg-muted/30 p-5">
          <h2 className="mb-3 font-semibold">Useful Queries</h2>
          <div className="space-y-3">
            {[
              {
                label: "Best-converting tools this month",
                sql: `SELECT t.name, COUNT(*) AS clicks
FROM "ClickLog" cl JOIN "Tool" t ON cl."toolId" = t.id
WHERE cl."createdAt" > NOW() - INTERVAL '30 days'
GROUP BY t.name ORDER BY clicks DESC LIMIT 20;`,
              },
              {
                label: "Clicks per source (which placement converts best)",
                sql: `SELECT source, COUNT(*) AS clicks,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS pct
FROM "ClickLog"
WHERE "createdAt" > NOW() - INTERVAL '30 days'
GROUP BY source ORDER BY clicks DESC;`,
              },
              {
                label: "Daily click trend",
                sql: `SELECT DATE("createdAt") AS day, COUNT(*) AS clicks
FROM "ClickLog"
WHERE "createdAt" > NOW() - INTERVAL '14 days'
GROUP BY day ORDER BY day;`,
              },
            ].map(({ label, sql }) => (
              <details key={label} className="rounded-lg border bg-card">
                <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium hover:bg-accent/30 transition-colors">
                  {label}
                </summary>
                <pre className="overflow-x-auto border-t bg-muted/40 p-4 text-xs leading-relaxed">
                  {sql}
                </pre>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
