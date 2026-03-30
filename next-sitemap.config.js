/**
 * next-sitemap.config.js
 *
 * This project uses Next.js App Router's native sitemap generation:
 *   app/sitemap.ts  → /sitemap.xml (index) + /sitemap/0-3.xml
 *   app/robots.ts   → /robots.txt
 *
 * next-sitemap is kept as a dev dependency in case you need its advanced
 * features (per-page lastmod from filesystem, alternate language support),
 * but it is NOT run as a postbuild step so it won't overwrite the native output.
 *
 * To re-enable, add to package.json scripts:
 *   "postbuild": "next-sitemap"
 * and set generateRobotsTxt: true below only if you remove app/robots.ts.
 */

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://yourdomain.com",
  generateRobotsTxt: false, // app/robots.ts handles this
  changefreq: "weekly",
  priority: 0.7,
  sitemapSize: 5000,
  exclude: ["/api/*", "/admin/*", "/go/*"],
};
