import type { Tool, Category, AffiliateLink, PricingTier, Review, Comparison, Tag } from "@prisma/client";

export type ToolWithCategory = Tool & { category: Category };

export type ToolWithRelations = Tool & {
  category: Category;
  affiliateLinks: AffiliateLink[];
  pricingTiers: PricingTier[];
  reviews: Review[];
  tags: Array<{ tag: Tag }>;
};

export type ComparisonWithTools = Comparison & {
  toolA: Tool;
  toolB: Tool;
};

export type CategoryWithCount = Category & {
  _count: { tools: number };
};
