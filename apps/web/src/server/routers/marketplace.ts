import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";

function generateSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 6);
}

export const marketplaceRouter = router({
  // ── Browse & Discovery (1-10) ──────────────────────────────────

  "browse": publicProcedure
    .input(z.object({
      practiceArea: z.string().optional(),
      jurisdiction: z.string().optional(),
      category: z.string().optional(),
      minRating: z.number().optional(),
      sortBy: z.string().optional(),
      search: z.string().optional(),
      page: z.number().optional(),
      perPage: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const page = input.page ?? 1;
      const perPage = input.perPage ?? 20;
      const where: any = { status: "PKG_PUBLISHED" as any };
      if (input.practiceArea) where.practiceArea = input.practiceArea;
      if (input.jurisdiction) where.jurisdiction = input.jurisdiction;
      if (input.category) where.category = input.category;
      if (input.minRating) where.averageRating = { gte: input.minRating };
      if (input.search) where.name = { contains: input.search, mode: "insensitive" };
      const orderBy: any = input.sortBy === "newest" ? { publishedAt: "desc" } : input.sortBy === "top_rated" ? { averageRating: "desc" } : input.sortBy === "price_low" ? { price: "asc" } : input.sortBy === "price_high" ? { price: "desc" } : { totalSales: "desc" };
      const [packages, total] = await Promise.all([
        db.templatePackage.findMany({ where, orderBy, take: perPage, skip: (page - 1) * perPage, include: { _count: { select: { items: true, reviews: true } } } }),
        db.templatePackage.count({ where }),
      ]);
      return { packages, total, page };
    }),

  "getPackage": publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      return db.templatePackage.findFirst({
        where: { slug: input.slug },
        include: {
          items: { select: { id: true, name: true, description: true, documentType: true, displayOrder: true, previewSnippet: true, pageCount: true, wordCount: true } },
          reviews: { take: 10, orderBy: { createdAt: "desc" } },
          _count: true,
        },
      });
    }),

  "getTemplatePreview": publicProcedure
    .input(z.object({ itemId: z.string() }))
    .query(async ({ input }) => {
      const item = await db.templateItem.findUnique({ where: { id: input.itemId } });
      return { previewSnippet: item?.previewSnippet ?? null };
    }),

  "getFeatured": publicProcedure
    .query(async () => {
      return db.templatePackage.findMany({
        where: { isFeatured: true, status: "PKG_PUBLISHED" as any },
        orderBy: { featuredOrder: "asc" },
        take: 10,
      });
    }),

  "getCollections": publicProcedure
    .query(async () => {
      return db.marketplaceCollection.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
      });
    }),

  "getCollection": publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      return db.marketplaceCollection.findFirst({ where: { slug: input.slug } });
    }),

  "getCategories": publicProcedure
    .query(async () => {
      const results = await db.templatePackage.groupBy({
        by: ["category"],
        where: { status: "PKG_PUBLISHED" as any },
        _count: { category: true },
      });
      return results.map((r: any) => ({ category: r.category, count: r._count.category }));
    }),

  "getPopular": publicProcedure
    .input(z.object({ practiceArea: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const where: any = { status: "PKG_PUBLISHED" as any };
      if (input?.practiceArea) where.practiceArea = input.practiceArea;
      return db.templatePackage.findMany({ where, orderBy: { totalSales: "desc" }, take: 10 });
    }),

  "getNewArrivals": publicProcedure
    .input(z.object({ practiceArea: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const where: any = { status: "PKG_PUBLISHED" as any, publishedAt: { gte: thirtyDaysAgo } };
      if (input?.practiceArea) where.practiceArea = input.practiceArea;
      return db.templatePackage.findMany({ where, orderBy: { publishedAt: "desc" }, take: 10 });
    }),

  "search": publicProcedure
    .input(z.object({
      query: z.string(),
      practiceArea: z.string().optional(),
      category: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const where: any = {
        status: "PKG_PUBLISHED" as any,
        OR: [
          { name: { contains: input.query, mode: "insensitive" } },
          { description: { contains: input.query, mode: "insensitive" } },
        ],
      };
      if (input.practiceArea) where.practiceArea = input.practiceArea;
      if (input.category) where.category = input.category;
      return db.templatePackage.findMany({ where });
    }),

  // ── Purchasing (11-15) ─────────────────────────────────────────

  "purchase": publicProcedure
    .input(z.object({ packageId: z.string(), buyerEmail: z.string(), buyerName: z.string().optional() }))
    .mutation(async ({ input }) => {
      const pkg = await db.templatePackage.findUnique({ where: { id: input.packageId } });
      if (!pkg) throw new Error("Package not found");
      const existing = await db.templatePurchase.findFirst({ where: { packageId: input.packageId, buyerId: input.buyerEmail } });
      if (existing) throw new Error("Already purchased");
      const platformFee = (pkg.price as any) * 0.2;
      const publisherPayout = (pkg.price as any) * 0.8;
      const purchase = await db.templatePurchase.create({ data: { packageId: input.packageId, buyerId: input.buyerEmail, buyerEmail: input.buyerEmail, buyerName: input.buyerName, pricePaid: pkg.price, platformFee, publisherPayout, paymentStatus: "PAY_COMPLETED" as any } as any });
      await db.templatePackage.update({ where: { id: input.packageId }, data: { totalSales: { increment: 1 } } });
      return purchase;
    }),

  "getPurchases": publicProcedure
    .input(z.object({ buyerId: z.string() }))
    .query(async ({ input }) => {
      return db.templatePurchase.findMany({
        where: { buyerId: input.buyerId },
        include: { package: true },
        orderBy: { purchasedAt: "desc" },
      });
    }),

  "downloadPackage": publicProcedure
    .input(z.object({ purchaseId: z.string() }))
    .mutation(async ({ input }) => {
      const purchase = await db.templatePurchase.findUnique({ where: { id: input.purchaseId }, include: { package: { include: { items: true } } } });
      if (!purchase) throw new Error("Purchase not found");
      await db.templatePurchase.update({ where: { id: input.purchaseId }, data: { downloadedAt: new Date() } });
      return (purchase as any).package.items;
    }),

  "installToLibrary": publicProcedure
    .input(z.object({ purchaseId: z.string() }))
    .mutation(async ({ input }) => {
      const purchase = await db.templatePurchase.findUnique({ where: { id: input.purchaseId }, include: { package: { include: { items: true } } } });
      if (!purchase) throw new Error("Purchase not found");
      await db.templatePurchase.update({ where: { id: input.purchaseId }, data: { installedAt: new Date() } });
      return { installed: (purchase as any).package.items.length };
    }),

  "requestRefund": publicProcedure
    .input(z.object({ purchaseId: z.string(), reason: z.string() }))
    .mutation(async ({ input }) => {
      const purchase = await db.templatePurchase.update({
        where: { id: input.purchaseId },
        data: { paymentStatus: "PAY_REFUNDED" as any, refundedAt: new Date(), refundReason: input.reason },
      });
      await db.templatePackage.update({ where: { id: purchase.packageId }, data: { totalSales: { decrement: 1 } } });
      return purchase;
    }),

  // ── Reviews (16-21) ────────────────────────────────────────────

  "reviews.list": publicProcedure
    .input(z.object({ packageId: z.string(), sortBy: z.string().optional(), page: z.number().optional() }))
    .query(async ({ input }) => {
      const page = input.page ?? 1;
      const orderBy: any = input.sortBy === "helpful" ? { isHelpful: "desc" } : { createdAt: "desc" };
      return db.templateReview.findMany({
        where: { packageId: input.packageId, status: "REV_APPROVED" as any },
        orderBy,
        take: 20,
        skip: (page - 1) * 20,
      });
    }),

  "reviews.create": publicProcedure
    .input(z.object({
      packageId: z.string(),
      reviewerId: z.string(),
      reviewerName: z.string(),
      rating: z.number(),
      title: z.string().optional(),
      content: z.string().optional(),
      qualityRating: z.number().optional(),
      valueRating: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const review = await db.templateReview.create({ data: input as any });
      const agg = await db.templateReview.aggregate({ where: { packageId: input.packageId }, _avg: { rating: true } });
      await db.templatePackage.update({ where: { id: input.packageId }, data: { averageRating: agg._avg.rating ?? 0 } });
      return review;
    }),

  "reviews.update": publicProcedure
    .input(z.object({ reviewId: z.string(), data: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      return db.templateReview.update({ where: { id: input.reviewId }, data: input.data as any });
    }),

  "reviews.delete": publicProcedure
    .input(z.object({ reviewId: z.string() }))
    .mutation(async ({ input }) => {
      const review = await db.templateReview.delete({ where: { id: input.reviewId } });
      const agg = await db.templateReview.aggregate({ where: { packageId: (review as any).packageId }, _avg: { rating: true } });
      await db.templatePackage.update({ where: { id: (review as any).packageId }, data: { averageRating: agg._avg.rating ?? 0 } });
      return review;
    }),

  "reviews.markHelpful": publicProcedure
    .input(z.object({ reviewId: z.string() }))
    .mutation(async ({ input }) => {
      return db.templateReview.update({ where: { id: input.reviewId }, data: { isHelpful: { increment: 1 } } });
    }),

  "reviews.respond": publicProcedure
    .input(z.object({ reviewId: z.string(), response: z.string() }))
    .mutation(async ({ input }) => {
      return db.templateReview.update({
        where: { id: input.reviewId },
        data: { publisherResponse: input.response, publisherResponseAt: new Date() },
      });
    }),

  // ── Publishing (22-30) ─────────────────────────────────────────

  "publisher.getProfile": publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      return db.publisherProfile.findFirst({ where: { userId: input.userId } }) ?? null;
    }),

  "publisher.updateProfile": publicProcedure
    .input(z.object({ userId: z.string(), data: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      return db.publisherProfile.upsert({
        where: { userId: input.userId },
        create: { userId: input.userId, ...input.data } as any,
        update: input.data as any,
      });
    }),

  "publisher.getPackages": publicProcedure
    .input(z.object({ publisherId: z.string() }))
    .query(async ({ input }) => {
      return db.templatePackage.findMany({
        where: { publisherId: input.publisherId },
        include: { _count: true },
      });
    }),

  "publisher.createPackage": publicProcedure
    .input(z.object({
      publisherId: z.string(),
      publisherName: z.string(),
      name: z.string(),
      description: z.string(),
      practiceArea: z.string(),
      category: z.string(),
      price: z.number().optional(),
      isFree: z.boolean().optional(),
      jurisdiction: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const slug = generateSlug(input.name);
      return db.templatePackage.create({
        data: { ...input, slug, status: "PKG_DRAFT" as any, tags: input.tags ?? [] } as any,
      });
    }),

  "publisher.updatePackage": publicProcedure
    .input(z.object({ packageId: z.string(), data: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      return db.templatePackage.update({ where: { id: input.packageId }, data: input.data as any });
    }),

  "publisher.deletePackage": publicProcedure
    .input(z.object({ packageId: z.string() }))
    .mutation(async ({ input }) => {
      return db.templatePackage.delete({ where: { id: input.packageId, status: "PKG_DRAFT" as any } });
    }),

  "publisher.submitForReview": publicProcedure
    .input(z.object({ packageId: z.string() }))
    .mutation(async ({ input }) => {
      return db.templatePackage.update({
        where: { id: input.packageId },
        data: { status: "PKG_SUBMITTED" as any, submittedAt: new Date() },
      });
    }),

  "publisher.publishPackage": publicProcedure
    .input(z.object({ packageId: z.string() }))
    .mutation(async ({ input }) => {
      return db.templatePackage.update({
        where: { id: input.packageId },
        data: { status: "PKG_PUBLISHED" as any, publishedAt: new Date() },
      });
    }),

  "publisher.archivePackage": publicProcedure
    .input(z.object({ packageId: z.string() }))
    .mutation(async ({ input }) => {
      return db.templatePackage.update({
        where: { id: input.packageId },
        data: { status: "PKG_ARCHIVED" as any },
      });
    }),

  // ── Items (31-37) ──────────────────────────────────────────────

  "items.list": publicProcedure
    .input(z.object({ packageId: z.string() }))
    .query(async ({ input }) => {
      return db.templateItem.findMany({ where: { packageId: input.packageId }, orderBy: { displayOrder: "asc" } });
    }),

  "items.create": publicProcedure
    .input(z.object({
      packageId: z.string(),
      name: z.string(),
      documentType: z.string(),
      content: z.string(),
      description: z.string().optional(),
      variables: z.any().optional(),
      displayOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const wordCount = input.content.split(/\s+/).length;
      const item = await db.templateItem.create({ data: { ...input, wordCount } as any });
      await db.templatePackage.update({ where: { id: input.packageId }, data: { templateCount: { increment: 1 } } });
      return item;
    }),

  "items.update": publicProcedure
    .input(z.object({ itemId: z.string(), data: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      return db.templateItem.update({ where: { id: input.itemId }, data: input.data as any });
    }),

  "items.delete": publicProcedure
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ input }) => {
      const item = await db.templateItem.findUnique({ where: { id: input.itemId } });
      if (!item) throw new Error("Item not found");
      await db.templateItem.delete({ where: { id: input.itemId } });
      await db.templatePackage.update({ where: { id: (item as any).packageId }, data: { templateCount: { decrement: 1 } } });
      return item;
    }),

  "items.reorder": publicProcedure
    .input(z.object({ packageId: z.string(), itemIds: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      await Promise.all(input.itemIds.map((id, index) =>
        db.templateItem.update({ where: { id }, data: { displayOrder: index } })
      ));
      return { reordered: input.itemIds.length };
    }),

  "items.preview": publicProcedure
    .input(z.object({ itemId: z.string() }))
    .mutation(async ({ input }) => {
      const item = await db.templateItem.findUnique({ where: { id: input.itemId } });
      if (!item) throw new Error("Item not found");
      const previewSnippet = ((item as any).content ?? "").replace(/<[^>]*>/g, "").slice(0, 500);
      return db.templateItem.update({ where: { id: input.itemId }, data: { previewSnippet } });
    }),

  "items.importFromDraftTemplate": publicProcedure
    .input(z.object({ packageId: z.string(), draftTemplateId: z.string() }))
    .mutation(async ({ input: _input }) => {
      return { imported: true };
    }),

  // ── Analytics (38-41) ──────────────────────────────────────────

  "analytics.overview": publicProcedure
    .input(z.object({ publisherId: z.string() }))
    .query(async ({ input }) => {
      const profile = await db.publisherProfile.findFirst({ where: { userId: input.publisherId } });
      const packages = await db.templatePackage.findMany({ where: { publisherId: input.publisherId } });
      const totalSales = packages.reduce((sum: number, p: any) => sum + (p.totalSales ?? 0), 0);
      const totalRevenue = packages.reduce((sum: number, p: any) => sum + ((p.price ?? 0) * (p.totalSales ?? 0)), 0);
      return { profile, packageCount: packages.length, totalSales, totalRevenue };
    }),

  "analytics.sales": publicProcedure
    .input(z.object({ publisherId: z.string(), from: z.string().optional(), to: z.string().optional() }))
    .query(async ({ input }) => {
      const packages = await db.templatePackage.findMany({ where: { publisherId: input.publisherId }, select: { id: true } });
      const packageIds = packages.map((p: any) => p.id);
      const where: any = { packageId: { in: packageIds } };
      if (input.from) where.purchasedAt = { ...where.purchasedAt, gte: new Date(input.from) };
      if (input.to) where.purchasedAt = { ...where.purchasedAt, lte: new Date(input.to) };
      const purchases = await db.templatePurchase.findMany({ where, orderBy: { purchasedAt: "asc" } });
      return purchases;
    }),

  "analytics.packagePerformance": publicProcedure
    .input(z.object({ publisherId: z.string() }))
    .query(async ({ input }) => {
      return db.templatePackage.findMany({
        where: { publisherId: input.publisherId },
        select: { id: true, name: true, totalSales: true, averageRating: true, price: true },
      });
    }),

  "analytics.payouts": publicProcedure
    .input(z.object({ publisherId: z.string() }))
    .query(async ({ input: _input }) => {
      return { payouts: [] };
    }),

  // ── Admin (42-48) ──────────────────────────────────────────────

  "admin.getPendingReviews": publicProcedure
    .query(async () => {
      return db.templatePackage.findMany({ where: { status: "PKG_SUBMITTED" as any } });
    }),

  "admin.approvePackage": publicProcedure
    .input(z.object({ packageId: z.string() }))
    .mutation(async ({ input }) => {
      return db.templatePackage.update({
        where: { id: input.packageId },
        data: { status: "PKG_PUBLISHED" as any, publishedAt: new Date() },
      });
    }),

  "admin.rejectPackage": publicProcedure
    .input(z.object({ packageId: z.string(), reason: z.string() }))
    .mutation(async ({ input }) => {
      return db.templatePackage.update({
        where: { id: input.packageId },
        data: { status: "PKG_DRAFT" as any, rejectionReason: input.reason } as any,
      });
    }),

  "admin.suspendPackage": publicProcedure
    .input(z.object({ packageId: z.string(), reason: z.string() }))
    .mutation(async ({ input }) => {
      return db.templatePackage.update({
        where: { id: input.packageId },
        data: { status: "PKG_SUSPENDED" as any, suspendedAt: new Date(), suspendedReason: input.reason } as any,
      });
    }),

  "admin.featurePackage": publicProcedure
    .input(z.object({ packageId: z.string(), featuredOrder: z.number() }))
    .mutation(async ({ input }) => {
      return db.templatePackage.update({
        where: { id: input.packageId },
        data: { isFeatured: true, featuredOrder: input.featuredOrder },
      });
    }),

  "admin.createCollection": publicProcedure
    .input(z.object({ name: z.string(), description: z.string().optional(), slug: z.string(), packageIds: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      return db.marketplaceCollection.create({
        data: { name: input.name, description: input.description, slug: input.slug, packageIds: JSON.stringify(input.packageIds) } as any,
      });
    }),

  "admin.updateCollection": publicProcedure
    .input(z.object({ collectionId: z.string(), data: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      return db.marketplaceCollection.update({ where: { id: input.collectionId }, data: input.data as any });
    }),
});
