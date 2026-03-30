import Link from "next/link";

const nav = [
  { href: "/tools", label: "All Tools" },
  { href: "/categories", label: "Categories" },
  { href: "/compare", label: "Compare" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="font-bold text-lg">
          {process.env.NEXT_PUBLIC_SITE_NAME ?? "SaaS Reviews"}
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Search placeholder — wire up to /api/search */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            href="/tools"
            className="inline-flex h-9 items-center rounded-md border px-3 text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            Search tools...
            <kbd className="ml-2 hidden rounded bg-muted px-1.5 py-0.5 text-xs sm:inline-block">
              ⌘K
            </kbd>
          </Link>
        </div>
      </div>
    </header>
  );
}
