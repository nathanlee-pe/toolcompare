import Link from "next/link";

export function SiteFooter() {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? "SaaS Reviews";

  return (
    <footer className="border-t bg-muted/30 py-10">
      <div className="container mx-auto px-4">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="font-semibold">{siteName}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Honest, independent reviews of the best SaaS tools for your business.
            </p>
          </div>

          <div>
            <p className="text-sm font-medium">Explore</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li><Link href="/tools" className="hover:underline">All Tools</Link></li>
              <li><Link href="/categories" className="hover:underline">Categories</Link></li>
              <li><Link href="/compare" className="hover:underline">Compare</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-medium">Legal</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li><Link href="/privacy" className="hover:underline">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:underline">Terms of Use</Link></li>
              <li>
                <Link href="/affiliate-disclosure" className="hover:underline">
                  Affiliate Disclosure
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-6 text-center text-xs text-muted-foreground">
          <p>
            © {new Date().getFullYear()} {siteName}. Some links may be affiliate links.{" "}
            <Link href="/affiliate-disclosure" className="hover:underline">Learn more</Link>.
          </p>
        </div>
      </div>
    </footer>
  );
}
