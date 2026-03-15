import { z } from "zod";
import { router, publicProcedure } from "../trpc";

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function getDefaultPages(firmName: string) {
  return [
    {
      slug: "home",
      title: "Home",
      pageType: "HOME" as const,
      sortOrder: 0,
      content: JSON.stringify([
        {
          type: "hero",
          data: {
            headline: firmName || "Your Law Firm",
            subheadline: "Experienced Legal Representation You Can Trust",
            ctaText: "Schedule Consultation",
            ctaLink: "/book",
          },
        },
        {
          type: "practiceAreaGrid",
          data: {
            areas: [
              { name: "Family Law", description: "Divorce, custody, and family matters handled with care." },
              { name: "Criminal Defense", description: "Aggressive defense for misdemeanor and felony charges." },
              { name: "Personal Injury", description: "Fighting for fair compensation when you're hurt." },
              { name: "Business Law", description: "Entity formation, contracts, and corporate counsel." },
              { name: "Estate Planning", description: "Wills, trusts, and protecting your legacy." },
              { name: "Real Estate", description: "Residential and commercial property transactions." },
            ],
          },
        },
        { type: "testimonialCarousel", data: {} },
        {
          type: "callToAction",
          data: {
            text: "Ready to discuss your case? Get a free consultation today.",
            buttonText: "Contact Us",
            buttonLink: "/contact",
          },
        },
      ]),
    },
    {
      slug: "about",
      title: "About",
      pageType: "ABOUT" as const,
      sortOrder: 1,
      content: JSON.stringify([
        {
          type: "text",
          data: {
            content:
              "<h2>About Our Firm</h2><p>With decades of combined experience, our attorneys are dedicated to providing exceptional legal services to individuals and businesses. We believe in building lasting relationships with our clients based on trust, communication, and results.</p>",
          },
        },
        {
          type: "attorneyProfile",
          data: {
            name: "Attorney Name",
            title: "Founding Partner",
            bio: "With over 20 years of experience in the legal field, our founding partner brings a wealth of knowledge and dedication to every case.",
            education: "J.D., Harvard Law School",
            barAdmissions: "State Bar",
          },
        },
      ]),
    },
    {
      slug: "practice-areas",
      title: "Practice Areas",
      pageType: "PRACTICE_AREAS" as const,
      sortOrder: 2,
      content: JSON.stringify([
        {
          type: "text",
          data: { content: "<h2>Our Practice Areas</h2><p>We provide comprehensive legal services across a wide range of practice areas.</p>" },
        },
        {
          type: "practiceAreaGrid",
          data: {
            areas: [
              { name: "Family Law", description: "Divorce, child custody, support modifications, and adoption. We handle sensitive family matters with compassion and expertise." },
              { name: "Criminal Defense", description: "DUI/DWI, drug charges, theft, assault, and white-collar crimes. Protecting your rights and freedom." },
              { name: "Personal Injury", description: "Auto accidents, slip and fall, medical malpractice, and wrongful death. We fight for maximum compensation." },
              { name: "Business Law", description: "Entity formation, contract drafting, mergers and acquisitions, and business litigation." },
              { name: "Estate Planning", description: "Wills, trusts, powers of attorney, and probate administration. Protecting your family's future." },
              { name: "Real Estate", description: "Buying, selling, leasing, zoning issues, and title disputes for residential and commercial properties." },
            ],
          },
        },
      ]),
    },
    {
      slug: "contact",
      title: "Contact",
      pageType: "CONTACT" as const,
      sortOrder: 3,
      content: JSON.stringify([
        {
          type: "text",
          data: { content: "<h2>Get in Touch</h2><p>We're here to help. Reach out to schedule a consultation or ask a question.</p>" },
        },
        { type: "contactForm", data: {} },
      ]),
    },
    {
      slug: "testimonials",
      title: "Testimonials",
      pageType: "TESTIMONIALS" as const,
      sortOrder: 4,
      content: JSON.stringify([{ type: "testimonialCarousel", data: {} }]),
    },
    {
      slug: "blog",
      title: "Blog",
      pageType: "BLOG" as const,
      sortOrder: 5,
      content: JSON.stringify([{ type: "blogLatest", data: { count: 6 } }]),
    },
  ];
}

export const websiteRouter = router({
  // ── Settings ──────────────────────────────────────────────────

  getSettings: publicProcedure.query(async ({ ctx }) => {
    let settings = await ctx.db.websiteSettings.findUnique({ where: { id: "default" } });

    if (!settings) {
      const firmSettings = await ctx.db.settings.findUnique({ where: { id: "default" } });
      settings = await ctx.db.websiteSettings.create({
        data: {
          id: "default",
          siteSlug: slugify(firmSettings?.firmName || "my-firm"),
          firmName: firmSettings?.firmName || null,
          phone: firmSettings?.phone || null,
          email: firmSettings?.email || null,
          address: firmSettings?.address || null,
          city: firmSettings?.city || null,
          state: firmSettings?.state || null,
          zip: firmSettings?.zip || null,
        },
      });
    }

    // Init default pages if none exist
    const pageCount = await ctx.db.websitePage.count();
    if (pageCount === 0) {
      const defaults = getDefaultPages(settings.firmName || "Our Law Firm");
      for (const page of defaults) {
        await ctx.db.websitePage.create({ data: page });
      }
    }

    return settings;
  }),

  updateSettings: publicProcedure
    .input(
      z.object({
        siteSlug: z.string().optional(),
        firmName: z.string().optional(),
        tagline: z.string().optional(),
        logoUrl: z.string().optional(),
        primaryColor: z.string().optional(),
        secondaryColor: z.string().optional(),
        fontFamily: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zip: z.string().optional(),
        linkedinUrl: z.string().optional(),
        facebookUrl: z.string().optional(),
        twitterUrl: z.string().optional(),
        googleReviewsUrl: z.string().optional(),
        metaTitle: z.string().optional(),
        metaDescription: z.string().optional(),
        footerText: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.websiteSettings.update({ where: { id: "default" }, data: input });
    }),

  publish: publicProcedure.mutation(async ({ ctx }) => {
    return ctx.db.websiteSettings.update({ where: { id: "default" }, data: { isPublished: true } });
  }),

  unpublish: publicProcedure.mutation(async ({ ctx }) => {
    return ctx.db.websiteSettings.update({ where: { id: "default" }, data: { isPublished: false } });
  }),

  // ── Pages ─────────────────────────────────────────────────────

  listPages: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.websitePage.findMany({ orderBy: { sortOrder: "asc" } });
  }),

  getPage: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const page = await ctx.db.websitePage.findUnique({ where: { id: input.id } });
      if (!page) throw new Error("Page not found");
      return page;
    }),

  getPageBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.websitePage.findFirst({ where: { slug: input.slug } });
    }),

  createPage: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        slug: z.string().min(1),
        content: z.string().default("[]"),
        metaTitle: z.string().optional(),
        metaDescription: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const maxOrder = await ctx.db.websitePage.aggregate({ _max: { sortOrder: true } });
      return ctx.db.websitePage.create({
        data: {
          title: input.title,
          slug: slugify(input.slug),
          pageType: "CUSTOM",
          content: input.content,
          sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
          metaTitle: input.metaTitle,
          metaDescription: input.metaDescription,
        },
      });
    }),

  updatePage: publicProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        content: z.string().optional(),
        isPublished: z.boolean().optional(),
        sortOrder: z.number().optional(),
        metaTitle: z.string().optional(),
        metaDescription: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.websitePage.update({ where: { id }, data });
    }),

  deletePage: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const page = await ctx.db.websitePage.findUnique({ where: { id: input.id } });
      if (!page) throw new Error("Page not found");
      if (page.pageType !== "CUSTOM") throw new Error("Cannot delete default pages");
      return ctx.db.websitePage.delete({ where: { id: input.id } });
    }),

  reorderPages: publicProcedure
    .input(z.array(z.object({ id: z.string(), sortOrder: z.number() })))
    .mutation(async ({ ctx, input }) => {
      for (const item of input) {
        await ctx.db.websitePage.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        });
      }
    }),

  // ── Testimonials ──────────────────────────────────────────────

  listTestimonials: publicProcedure
    .input(z.object({ publishedOnly: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.publishedOnly) where.isPublished = true;
      return ctx.db.websiteTestimonial.findMany({ where, orderBy: { sortOrder: "asc" } });
    }),

  createTestimonial: publicProcedure
    .input(
      z.object({
        clientName: z.string().min(1),
        content: z.string().min(1),
        rating: z.number().min(1).max(5).optional(),
        practiceArea: z.string().optional(),
        isPublished: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.websiteTestimonial.create({ data: input });
    }),

  updateTestimonial: publicProcedure
    .input(
      z.object({
        id: z.string(),
        clientName: z.string().optional(),
        content: z.string().optional(),
        rating: z.number().min(1).max(5).optional(),
        practiceArea: z.string().optional(),
        isPublished: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.websiteTestimonial.update({ where: { id }, data });
    }),

  deleteTestimonial: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.websiteTestimonial.delete({ where: { id: input.id } });
    }),

  // ── Blog ──────────────────────────────────────────────────────

  listPosts: publicProcedure
    .input(
      z.object({
        publishedOnly: z.boolean().optional(),
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.publishedOnly) where.isPublished = true;
      const [posts, total] = await Promise.all([
        ctx.db.websiteBlogPost.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: input?.limit ?? 20,
          skip: input?.offset ?? 0,
        }),
        ctx.db.websiteBlogPost.count({ where }),
      ]);
      return { posts, total };
    }),

  getPost: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const post = await ctx.db.websiteBlogPost.findUnique({ where: { id: input.id } });
      if (!post) throw new Error("Post not found");
      return post;
    }),

  getPostBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.websiteBlogPost.findUnique({ where: { slug: input.slug } });
    }),

  createPost: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        slug: z.string().optional(),
        content: z.string().min(1),
        excerpt: z.string().optional(),
        author: z.string().optional(),
        coverImageUrl: z.string().optional(),
        tags: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let slug = input.slug || slugify(input.title);
      const existing = await ctx.db.websiteBlogPost.findUnique({ where: { slug } });
      if (existing) slug = `${slug}-${Date.now().toString(36)}`;
      return ctx.db.websiteBlogPost.create({
        data: { ...input, slug },
      });
    }),

  updatePost: publicProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        content: z.string().optional(),
        excerpt: z.string().optional(),
        author: z.string().optional(),
        coverImageUrl: z.string().optional(),
        tags: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.websiteBlogPost.update({ where: { id }, data });
    }),

  deletePost: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.websiteBlogPost.delete({ where: { id: input.id } });
    }),

  publishPost: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.websiteBlogPost.update({
        where: { id: input.id },
        data: { isPublished: true, publishedAt: new Date() },
      });
    }),

  unpublishPost: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.websiteBlogPost.update({
        where: { id: input.id },
        data: { isPublished: false },
      });
    }),

  // ── Public ────────────────────────────────────────────────────

  getPublicSite: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const settings = await ctx.db.websiteSettings.findUnique({ where: { siteSlug: input.slug } });
      if (!settings || !settings.isPublished) return null;

      const [pages, testimonials] = await Promise.all([
        ctx.db.websitePage.findMany({
          where: { isPublished: true },
          orderBy: { sortOrder: "asc" },
        }),
        ctx.db.websiteTestimonial.findMany({
          where: { isPublished: true },
          orderBy: { sortOrder: "asc" },
        }),
      ]);

      return { settings, pages, testimonials };
    }),

  getPublicBlogPost: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.websiteBlogPost.findFirst({
        where: { slug: input.slug, isPublished: true },
      });
    }),

  getPublicBlogList: publicProcedure
    .input(z.object({ limit: z.number().default(6) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.websiteBlogPost.findMany({
        where: { isPublished: true },
        orderBy: { publishedAt: "desc" },
        take: input.limit,
      });
    }),
});
