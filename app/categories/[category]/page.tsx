/**
 * app/categories/[category]/page.tsx
 *
 * Permanent redirect to the canonical /category/[slug] route.
 * Keeps any existing inbound links working while consolidating URL structure.
 */

import { permanentRedirect } from "next/navigation";

interface PageProps {
  params: Promise<{ category: string }>;
}

export default async function LegacyCategoryRedirect({ params }: PageProps) {
  const { category } = await params;
  permanentRedirect(`/category/${category}`);
}
