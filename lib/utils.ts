import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatPrice(price: number | null, cycle = "mo"): string {
  if (price === null) return "Contact sales";
  if (price === 0) return "Free";
  return `$${price}/${cycle}`;
}

export function comparisonSlug(slugA: string, slugB: string): string {
  // Always order alphabetically so /a-vs-b and /b-vs-a resolve to the same page
  const [first, second] = [slugA, slugB].sort();
  return `${first}-vs-${second}`;
}
