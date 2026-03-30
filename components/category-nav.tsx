import Link from "next/link";
import type { Category } from "@prisma/client";

type CategoryWithCount = Category & { _count?: { tools: number } };

interface CategoryNavProps {
  categories: CategoryWithCount[];
}

export function CategoryNav({ categories }: CategoryNavProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {categories.map((cat) => (
        <Link
          key={cat.id}
          href={`/category/${cat.slug}`}
          className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm hover:shadow-md hover:border-primary/50 transition-all group"
        >
          {cat.icon && (
            <span className="text-2xl" role="img" aria-label={cat.name}>
              {cat.icon}
            </span>
          )}
          <div className="min-w-0">
            <p className="font-medium truncate group-hover:text-primary transition-colors">
              {cat.name}
            </p>
            {cat._count && (
              <p className="text-xs text-muted-foreground">
                {cat._count.tools} tools
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
