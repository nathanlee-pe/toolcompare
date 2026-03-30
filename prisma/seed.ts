import { PrismaClient, PricingModel, BillingCycle } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Categories ──────────────────────────────────────────────────────────────
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: "crm" },
      create: {
        name: "CRM",
        slug: "crm",
        description: "Customer relationship management software",
        icon: "🤝",
        metaTitle: "Best CRM Software",
        metaDescription: "Compare the best CRM tools for sales teams of all sizes.",
      },
      update: {},
    }),
    prisma.category.upsert({
      where: { slug: "project-management" },
      create: {
        name: "Project Management",
        slug: "project-management",
        description: "Tools for planning, tracking, and shipping projects",
        icon: "📋",
      },
      update: {},
    }),
    prisma.category.upsert({
      where: { slug: "email-marketing" },
      create: {
        name: "Email Marketing",
        slug: "email-marketing",
        description: "Email automation and campaign management platforms",
        icon: "📧",
      },
      update: {},
    }),
    prisma.category.upsert({
      where: { slug: "analytics" },
      create: {
        name: "Analytics",
        slug: "analytics",
        description: "Web and product analytics tools",
        icon: "📊",
      },
      update: {},
    }),
  ]);

  const [crm, pm, email, analytics] = categories;

  // ── Tags ────────────────────────────────────────────────────────────────────
  const tags = await Promise.all(
    ["small-business", "enterprise", "open-source", "ai-powered", "no-code"].map((name) =>
      prisma.tag.upsert({
        where: { slug: name },
        create: { name: name.replace(/-/g, " "), slug: name },
        update: {},
      })
    )
  );

  // ── Tools ───────────────────────────────────────────────────────────────────
  const notion = await prisma.tool.upsert({
    where: { slug: "notion" },
    create: {
      name: "Notion",
      slug: "notion",
      tagline: "The all-in-one workspace for your notes, docs, and projects",
      description:
        "<p>Notion is a flexible all-in-one workspace that combines notes, wikis, databases, and project management in a single tool. It's popular with startups, remote teams, and individuals who want to centralize their work.</p>",
      logo: "https://www.notion.so/images/logo-ios.png",
      website: "https://notion.so",
      foundedYear: 2016,
      pricingModel: PricingModel.FREEMIUM,
      startingPrice: 10,
      hasFreeplan: true,
      hasFreeTrial: false,
      avgRating: 4.5,
      reviewCount: 1240,
      pros: [
        "Extremely flexible and customizable",
        "Great for both personal and team use",
        "Generous free tier",
        "Strong template ecosystem",
      ],
      cons: [
        "Can be slow on large databases",
        "Offline mode is limited",
        "Steep learning curve for advanced features",
      ],
      features: {
        api: true,
        sso: true,
        mobileApp: true,
        audit: true,
        customDomain: false,
        webhooks: true,
        exportData: true,
        "2fa": true,
      },
      categoryId: pm.id,
      publishedAt: new Date(),
      metaTitle: "Notion Review (2026) — Is it Worth It?",
      metaDescription:
        "Our in-depth Notion review covers pricing, features, pros and cons. Find out if Notion is the right workspace tool for your team.",
    },
    update: {},
  });

  const confluence = await prisma.tool.upsert({
    where: { slug: "confluence" },
    create: {
      name: "Confluence",
      slug: "confluence",
      tagline: "The enterprise wiki and knowledge base from Atlassian",
      description:
        "<p>Confluence is Atlassian's enterprise wiki and documentation platform. It integrates deeply with Jira and is widely used in software development and enterprise environments.</p>",
      website: "https://www.atlassian.com/software/confluence",
      foundedYear: 2004,
      pricingModel: PricingModel.FREEMIUM,
      startingPrice: 5.75,
      hasFreeplan: true,
      hasFreeTrial: true,
      avgRating: 4.1,
      reviewCount: 890,
      pros: [
        "Deep Jira integration",
        "Robust permissions and admin controls",
        "Excellent for large engineering teams",
        "Free tier for up to 10 users",
      ],
      cons: [
        "UI feels dated compared to newer tools",
        "Can be expensive at scale",
        "Search quality is inconsistent",
      ],
      features: {
        api: true,
        sso: true,
        mobileApp: true,
        audit: true,
        customDomain: false,
        webhooks: true,
        exportData: true,
        "2fa": true,
      },
      categoryId: pm.id,
      publishedAt: new Date(),
    },
    update: {},
  });

  // ── Pricing Tiers ───────────────────────────────────────────────────────────
  await prisma.pricingTier.createMany({
    data: [
      {
        toolId: notion.id,
        name: "Free",
        price: 0,
        billingCycle: BillingCycle.MONTHLY,
        isFree: true,
        features: ["Unlimited pages & blocks", "Share with 5 guests", "7-day version history"],
      },
      {
        toolId: notion.id,
        name: "Plus",
        price: 10,
        billingCycle: BillingCycle.MONTHLY,
        isPopular: true,
        features: [
          "Unlimited file uploads",
          "30-day version history",
          "Unlimited guests",
          "Custom domains",
        ],
      },
      {
        toolId: notion.id,
        name: "Business",
        price: 18,
        billingCycle: BillingCycle.MONTHLY,
        features: [
          "Everything in Plus",
          "SAML SSO",
          "90-day version history",
          "Bulk PDF export",
        ],
      },
    ],
    skipDuplicates: true,
  });

  // ── Affiliate Links ─────────────────────────────────────────────────────────
  await prisma.affiliateLink.createMany({
    data: [
      {
        toolId: notion.id,
        label: "Try Notion Free",
        url: "https://notion.so",
        trackedUrl: "https://notion.so/?ref=your-affiliate-id",
        program: "direct",
        commission: null,
        isPrimary: true,
        isActive: true,
      },
      {
        toolId: confluence.id,
        label: "Start Free Trial",
        url: "https://www.atlassian.com/software/confluence/try",
        program: "direct",
        isPrimary: true,
        isActive: true,
      },
    ],
    skipDuplicates: true,
  });

  // ── Comparison ──────────────────────────────────────────────────────────────
  await prisma.comparison.upsert({
    where: { slug: "confluence-vs-notion" },
    create: {
      slug: "confluence-vs-notion",
      toolAId: confluence.id,
      toolBId: notion.id,
      winnerToolId: notion.id,
      verdict:
        "For most teams outside enterprise environments, Notion offers better flexibility and value. Confluence excels when deep Jira integration is required.",
      metaTitle: "Notion vs Confluence (2026) — Which is Better?",
      metaDescription:
        "Notion vs Confluence head-to-head: pricing, features, ease of use compared. See which wiki tool wins.",
      publishedAt: new Date(),
    },
    update: {},
  });

  // ── Tags on tools ────────────────────────────────────────────────────────────
  const [smallBiz, enterprise] = tags;
  await prisma.toolTag.createMany({
    data: [
      { toolId: notion.id, tagId: smallBiz.id },
      { toolId: confluence.id, tagId: enterprise.id },
    ],
    skipDuplicates: true,
  });

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
