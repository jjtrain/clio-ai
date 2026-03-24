import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { translateText, translateBatch, translateAndCacheContent, warmTranslationCache, detectClientLanguage, translateMessage } from "@/lib/translation-engine";

const DEFAULT_FIRM_ID = "demo-firm";

export const translationRouter = router({
  // ==========================================
  // TRANSLATION OPERATIONS
  // ==========================================

  translateContent: publicProcedure
    .input(z.object({ text: z.string(), targetLanguage: z.string(), context: z.string().optional(), practiceArea: z.string().optional() }))
    .mutation(async ({ input }) => {
      return translateText(input);
    }),

  translateBatch: publicProcedure
    .input(z.object({ items: z.array(z.object({ id: z.string(), text: z.string() })), targetLanguage: z.string(), practiceArea: z.string().optional() }))
    .mutation(async ({ input }) => {
      return translateBatch(input.items, input.targetLanguage, input.practiceArea);
    }),

  translateMatterContent: publicProcedure
    .input(z.object({ matterId: z.string(), targetLanguages: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      let total = 0;
      for (const lang of input.targetLanguages) {
        total += await warmTranslationCache(input.matterId, lang, DEFAULT_FIRM_ID);
      }
      return { translated: total };
    }),

  translateMessage: publicProcedure
    .input(z.object({ text: z.string(), fromLanguage: z.string(), toLanguage: z.string(), practiceArea: z.string().optional() }))
    .mutation(async ({ input }) => {
      return translateMessage(input);
    }),

  // ==========================================
  // CONTENT TRANSLATION MANAGEMENT
  // ==========================================

  getTranslationsForContent: publicProcedure
    .input(z.object({ sourceType: z.string(), sourceId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.contentTranslation.findMany({
        where: { sourceType: input.sourceType, sourceId: input.sourceId },
        orderBy: { languageCode: "asc" },
      });
    }),

  updateTranslation: publicProcedure
    .input(z.object({ translationId: z.string(), translatedText: z.string(), isVerified: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.contentTranslation.update({
        where: { id: input.translationId },
        data: {
          translatedText: input.translatedText,
          isVerified: input.isVerified,
          verifiedAt: input.isVerified ? new Date() : undefined,
          needsReview: false,
        },
      });
    }),

  verifyTranslation: publicProcedure
    .input(z.object({ translationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.contentTranslation.update({
        where: { id: input.translationId },
        data: { isVerified: true, verifiedAt: new Date(), needsReview: false },
      });
    }),

  getTranslationQueue: publicProcedure
    .input(z.object({ languageCode: z.string().optional(), needsReview: z.boolean().optional(), limit: z.number().optional().default(30) }))
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID };
      if (input.languageCode) where.languageCode = input.languageCode;
      if (input.needsReview) where.needsReview = true;
      return ctx.db.contentTranslation.findMany({ where, orderBy: { createdAt: "desc" }, take: input.limit });
    }),

  // ==========================================
  // UI TRANSLATIONS
  // ==========================================

  getUITranslations: publicProcedure
    .input(z.object({ languageCode: z.string() }))
    .query(async ({ ctx, input }) => {
      const translations = await ctx.db.uITranslation.findMany({
        where: { languageCode: input.languageCode },
      });
      // Return as key-value map
      return translations.reduce<Record<string, string>>((acc, t) => {
        acc[t.translationKey] = t.translatedText;
        return acc;
      }, {});
    }),

  updateUITranslation: publicProcedure
    .input(z.object({ translationKey: z.string(), languageCode: z.string(), translatedText: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.uITranslation.upsert({
        where: { translationKey_languageCode: { translationKey: input.translationKey, languageCode: input.languageCode } },
        create: { ...input },
        update: { translatedText: input.translatedText },
      });
    }),

  getMissingUITranslations: publicProcedure
    .input(z.object({ languageCode: z.string() }))
    .query(async ({ ctx, input }) => {
      // Get all English keys
      const allKeys = await ctx.db.uITranslation.findMany({
        where: { languageCode: "en" },
        select: { translationKey: true },
      });

      const translated = await ctx.db.uITranslation.findMany({
        where: { languageCode: input.languageCode },
        select: { translationKey: true },
      });

      const translatedKeys = new Set(translated.map((t) => t.translationKey));
      return allKeys.filter((k) => !translatedKeys.has(k.translationKey)).map((k) => k.translationKey);
    }),

  // ==========================================
  // GLOSSARY
  // ==========================================

  getGlossary: publicProcedure
    .input(z.object({ languageCode: z.string(), practiceArea: z.string().optional(), category: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { languageCode: input.languageCode };
      if (input.practiceArea) where.practiceArea = input.practiceArea;
      if (input.category) where.category = input.category;
      return ctx.db.translationGlossary.findMany({ where, orderBy: { englishTerm: "asc" } });
    }),

  addGlossaryTerm: publicProcedure
    .input(z.object({
      languageCode: z.string(),
      englishTerm: z.string(),
      translatedTerm: z.string(),
      category: z.string(),
      practiceArea: z.string().optional(),
      context: z.string().optional(),
      doNotTranslate: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.translationGlossary.create({ data: { ...input } });
    }),

  updateGlossaryTerm: publicProcedure
    .input(z.object({ termId: z.string(), translatedTerm: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.translationGlossary.update({ where: { id: input.termId }, data: { translatedTerm: input.translatedTerm } });
    }),

  deleteGlossaryTerm: publicProcedure
    .input(z.object({ termId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.translationGlossary.delete({ where: { id: input.termId } });
    }),

  // ==========================================
  // LANGUAGE CONFIGURATION
  // ==========================================

  getLanguages: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.languageConfig.findMany({ orderBy: [{ isActive: "desc" }, { languageName: "asc" }] });
  }),

  updateLanguage: publicProcedure
    .input(z.object({ languageCode: z.string(), isActive: z.boolean().optional(), fontFamily: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { languageCode, ...data } = input;
      return ctx.db.languageConfig.update({ where: { languageCode }, data });
    }),

  addLanguage: publicProcedure
    .input(z.object({ languageCode: z.string(), languageName: z.string(), nativeName: z.string(), isRTL: z.boolean().optional(), fontFamily: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.languageConfig.create({ data: { ...input, isActive: true } });
    }),

  // ==========================================
  // CLIENT PREFERENCES
  // ==========================================

  getClientLanguage: publicProcedure
    .input(z.object({ portalAccountId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.clientLanguagePreference.findUnique({ where: { portalAccountId: input.portalAccountId } });
    }),

  setClientLanguage: publicProcedure
    .input(z.object({ portalAccountId: z.string(), primaryLanguage: z.string(), secondaryLanguage: z.string().optional(), showBilingual: z.boolean().optional(), autoTranslate: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.clientLanguagePreference.upsert({
        where: { portalAccountId: input.portalAccountId },
        create: input,
        update: input,
      });
    }),

  detectLanguage: publicProcedure
    .input(z.object({ browserLanguage: z.string().optional(), ipCountry: z.string().optional() }))
    .query(({ input }) => {
      return detectClientLanguage(input);
    }),

  // ==========================================
  // ANALYTICS
  // ==========================================

  getTranslationStats: publicProcedure.query(async ({ ctx }) => {
    const totalTranslations = await ctx.db.contentTranslation.count({ where: { firmId: DEFAULT_FIRM_ID } });
    const verified = await ctx.db.contentTranslation.count({ where: { firmId: DEFAULT_FIRM_ID, isVerified: true } });
    const needsReview = await ctx.db.contentTranslation.count({ where: { firmId: DEFAULT_FIRM_ID, needsReview: true } });

    const byLanguage = await ctx.db.contentTranslation.groupBy({
      by: ["languageCode"],
      _count: { languageCode: true },
      where: { firmId: DEFAULT_FIRM_ID },
    });

    const languages = await ctx.db.languageConfig.findMany({ where: { isActive: true } });

    return {
      totalTranslations,
      verified,
      needsReview,
      verificationRate: totalTranslations > 0 ? Math.round((verified / totalTranslations) * 100) : 100,
      byLanguage: byLanguage.map((l) => ({ code: l.languageCode, count: l._count.languageCode })),
      activeLanguages: languages.length,
    };
  }),
});
