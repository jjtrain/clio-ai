import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import {
  parseQuery,
  executeSearch,
  summarizeResults,
  generateQuerySuggestions,
  buildSearchIndex,
  expandQueryTerms,
  type FullSearchResponse,
} from "@/lib/search-engine";

const DEFAULT_USER_ID = "demo-user";
const DEFAULT_FIRM_ID = "demo-firm";

export const searchRouter = router({
  // ==========================================
  // CORE SEARCH
  // ==========================================

  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(100).optional().default(20),
        targetTypes: z.array(z.string()).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const startTime = Date.now();
      const parsed = await parseQuery(input.query);

      // Override targets if specified
      if (input.targetTypes && input.targetTypes.length > 0) {
        parsed.primaryTarget = input.targetTypes[0] as any;
        parsed.secondaryTargets = input.targetTypes.slice(1) as any[];
      }

      const searchResults = await executeSearch(parsed, DEFAULT_USER_ID, DEFAULT_FIRM_ID, input.limit);
      const summary = await summarizeResults(input.query, searchResults.results, parsed);
      const suggestions = generateQuerySuggestions(input.query, searchResults.results);

      // Record the query
      try {
        await ctx.db.searchQuery.create({
          data: {
            queryText: input.query,
            parsedIntent: parsed as any,
            resultCount: searchResults.totalCount,
            executionTime: searchResults.executionTimeMs,
            userId: DEFAULT_USER_ID,
            firmId: DEFAULT_FIRM_ID,
          },
        });
      } catch {
        // Non-critical
      }

      return {
        summary,
        results: searchResults.results,
        totalCount: searchResults.totalCount,
        byType: searchResults.byType,
        suggestions,
        parsedIntent: parsed,
        executionTimeMs: Date.now() - startTime,
      } satisfies FullSearchResponse;
    }),

  quickSearch: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(10).optional().default(8),
      })
    )
    .query(async ({ ctx, input }) => {
      // Lightweight search: skip AI parse, do direct text matching on SearchIndex
      const keywords = input.query.split(/\s+/).filter((w) => w.length > 1);
      const expanded = await expandQueryTerms(keywords, DEFAULT_FIRM_ID);

      if (expanded.length === 0) return { results: [] };

      const results = await ctx.db.searchIndex.findMany({
        where: {
          firmId: DEFAULT_FIRM_ID,
          OR: expanded.flatMap((kw) => [
            { title: { contains: kw, mode: "insensitive" as const } },
            { subtitle: { contains: kw, mode: "insensitive" as const } },
          ]),
        },
        take: input.limit,
        orderBy: { updatedAt: "desc" },
      });

      return {
        results: results.map((r) => ({
          id: r.entityId,
          entityType: r.entityType,
          title: r.title,
          subtitle: r.subtitle,
        })),
      };
    }),

  searchByType: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        entityType: z.string(),
        limit: z.number().min(1).max(50).optional().default(20),
      })
    )
    .query(async ({ input }) => {
      const parsed = await parseQuery(input.query);
      parsed.primaryTarget = input.entityType as any;
      parsed.secondaryTargets = [];

      const searchResults = await executeSearch(parsed, DEFAULT_USER_ID, DEFAULT_FIRM_ID, input.limit);
      return searchResults;
    }),

  // ==========================================
  // SUGGESTIONS & AUTOCOMPLETE
  // ==========================================

  getSuggestions: publicProcedure
    .input(z.object({ partialQuery: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const suggestions: Array<{ type: string; text: string; subtitle?: string }> = [];

      // Recent queries matching prefix
      const recentQueries = await ctx.db.searchQuery.findMany({
        where: {
          userId: DEFAULT_USER_ID,
          queryText: { startsWith: input.partialQuery, mode: "insensitive" },
        },
        orderBy: { createdAt: "desc" },
        take: 3,
        distinct: ["queryText"],
      });
      for (const q of recentQueries) {
        suggestions.push({ type: "recent", text: q.queryText });
      }

      // Saved searches matching prefix
      const saved = await ctx.db.savedSearch.findMany({
        where: {
          userId: DEFAULT_USER_ID,
          name: { contains: input.partialQuery, mode: "insensitive" },
        },
        take: 3,
      });
      for (const s of saved) {
        suggestions.push({ type: "saved", text: s.queryText, subtitle: s.name });
      }

      // Entity name matches from index
      const entities = await ctx.db.searchIndex.findMany({
        where: {
          firmId: DEFAULT_FIRM_ID,
          title: { contains: input.partialQuery, mode: "insensitive" },
        },
        take: 5,
        orderBy: { updatedAt: "desc" },
      });
      for (const e of entities) {
        suggestions.push({ type: e.entityType, text: e.title, subtitle: e.subtitle || undefined });
      }

      // Common templates
      const templates = [
        "show me all matters where...",
        "find the document...",
        "list upcoming deadlines for...",
        "overdue deadlines",
        "active matters in discovery",
        "unbilled time entries",
      ];
      const matchingTemplates = templates.filter((t) =>
        t.toLowerCase().includes(input.partialQuery.toLowerCase())
      );
      for (const t of matchingTemplates.slice(0, 2)) {
        suggestions.push({ type: "template", text: t });
      }

      return { suggestions: suggestions.slice(0, 10) };
    }),

  getPopularQueries: publicProcedure.query(async ({ ctx }) => {
    const queries = await ctx.db.searchQuery.groupBy({
      by: ["queryText"],
      _count: { queryText: true },
      orderBy: { _count: { queryText: "desc" } },
      take: 10,
    });
    return queries.map((q) => ({ query: q.queryText, count: q._count.queryText }));
  }),

  // ==========================================
  // SAVED SEARCHES
  // ==========================================

  saveSearch: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        queryText: z.string().min(1),
        alertEnabled: z.boolean().optional().default(false),
        alertFrequency: z.enum(["daily", "weekly", "monthly"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.savedSearch.create({
        data: {
          name: input.name,
          queryText: input.queryText,
          alertEnabled: input.alertEnabled,
          alertFrequency: input.alertFrequency,
          userId: DEFAULT_USER_ID,
          firmId: DEFAULT_FIRM_ID,
        },
      });
    }),

  getSavedSearches: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.savedSearch.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
    });
  }),

  runSavedSearch: publicProcedure
    .input(z.object({ savedSearchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const saved = await ctx.db.savedSearch.findUnique({ where: { id: input.savedSearchId } });
      if (!saved) throw new Error("Saved search not found");

      const parsed = await parseQuery(saved.queryText);
      const results = await executeSearch(parsed, DEFAULT_USER_ID, DEFAULT_FIRM_ID, 20);
      const summary = await summarizeResults(saved.queryText, results.results, parsed);

      await ctx.db.savedSearch.update({
        where: { id: input.savedSearchId },
        data: { lastRunAt: new Date(), lastResultCount: results.totalCount },
      });

      return { summary, ...results, parsedIntent: parsed };
    }),

  updateSavedSearch: publicProcedure
    .input(
      z.object({
        savedSearchId: z.string(),
        name: z.string().optional(),
        alertEnabled: z.boolean().optional(),
        alertFrequency: z.enum(["daily", "weekly", "monthly"]).nullable().optional(),
        isPinned: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { savedSearchId, ...data } = input;
      return ctx.db.savedSearch.update({
        where: { id: savedSearchId },
        data,
      });
    }),

  deleteSavedSearch: publicProcedure
    .input(z.object({ savedSearchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.savedSearch.delete({ where: { id: input.savedSearchId } });
    }),

  // ==========================================
  // FEEDBACK & LEARNING
  // ==========================================

  recordClick: publicProcedure
    .input(
      z.object({
        queryId: z.string(),
        resultId: z.string(),
        resultType: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.searchClick.create({ data: input });
    }),

  recordFeedback: publicProcedure
    .input(
      z.object({
        queryId: z.string(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.searchQuery.update({
        where: { id: input.queryId },
        data: { rating: input.rating, ratingComment: input.comment },
      });
    }),

  // ==========================================
  // INDEX MANAGEMENT
  // ==========================================

  rebuildIndex: publicProcedure.mutation(async () => {
    const count = await buildSearchIndex(DEFAULT_FIRM_ID);
    return { indexedCount: count, rebuiltAt: new Date() };
  }),

  getIndexStats: publicProcedure.query(async ({ ctx }) => {
    const total = await ctx.db.searchIndex.count({ where: { firmId: DEFAULT_FIRM_ID } });
    const byType = await ctx.db.searchIndex.groupBy({
      by: ["entityType"],
      _count: { entityType: true },
      where: { firmId: DEFAULT_FIRM_ID },
    });

    return {
      total,
      byType: byType.reduce<Record<string, number>>((acc, t) => {
        acc[t.entityType] = t._count.entityType;
        return acc;
      }, {}),
    };
  }),

  // ==========================================
  // SYNONYMS
  // ==========================================

  getSynonyms: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.searchSynonym.findMany({
      where: { OR: [{ firmId: DEFAULT_FIRM_ID }, { firmId: null }] },
      orderBy: { term: "asc" },
    });
  }),

  addSynonym: publicProcedure
    .input(
      z.object({
        term: z.string().min(1),
        canonicalTerm: z.string().min(1),
        category: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.searchSynonym.create({
        data: {
          term: input.term.toLowerCase(),
          canonicalTerm: input.canonicalTerm,
          category: input.category,
          firmId: DEFAULT_FIRM_ID,
        },
      });
    }),

  deleteSynonym: publicProcedure
    .input(z.object({ synonymId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.searchSynonym.delete({ where: { id: input.synonymId } });
    }),
});
