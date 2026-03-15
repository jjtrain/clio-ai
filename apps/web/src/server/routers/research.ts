import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import {
  conductLegalResearch,
  analyzeCase,
  compareAuthority,
  generateMemo,
  suggestSearchQueries,
} from "@/lib/ai-research";

export const researchRouter = router({
  // ── Sessions ──────────────────────────────────────────
  listSessions: publicProcedure
    .input(
      z.object({
        matterId: z.string().optional(),
        status: z.enum(["ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.status) where.status = input.status;

      return ctx.db.researchSession.findMany({
        where,
        include: {
          matter: { select: { id: true, name: true, matterNumber: true, practiceArea: true } },
          _count: { select: { messages: true, notes: true, sources: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
    }),

  getSession: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.researchSession.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          matter: {
            select: {
              id: true, name: true, matterNumber: true, practiceArea: true,
              description: true,
              client: { select: { name: true } },
              relatedParties: { select: { name: true, role: true } },
            },
          },
          messages: { orderBy: { createdAt: "asc" } },
          notes: { orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }] },
          sources: { orderBy: { createdAt: "desc" } },
        },
      });
    }),

  createSession: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        matterId: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.researchSession.create({
        data: {
          title: input.title,
          matterId: input.matterId || null,
          description: input.description,
        },
      });

      // Add system message
      await ctx.db.researchMessage.create({
        data: {
          sessionId: session.id,
          role: "SYSTEM",
          content: "Research session started. Ask me any legal question and I'll provide analysis, case citations, and strategic guidance.",
        },
      });

      return session;
    }),

  updateSession: publicProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(["ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.researchSession.update({ where: { id }, data });
    }),

  deleteSession: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.researchSession.delete({ where: { id: input.id } });
    }),

  // ── Chat ──────────────────────────────────────────────
  sendMessage: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        content: z.string().min(1),
        analysisType: z.enum(["research", "case_analysis", "comparison", "memo", "search_queries"]).default("research"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Save user message
      await ctx.db.researchMessage.create({
        data: {
          sessionId: input.sessionId,
          role: "USER",
          content: input.content,
        },
      });

      // Get session with matter context
      const session = await ctx.db.researchSession.findUniqueOrThrow({
        where: { id: input.sessionId },
        include: {
          matter: {
            select: {
              name: true, description: true, practiceArea: true,
              relatedParties: { select: { name: true, role: true } },
            },
          },
          notes: true,
          sources: true,
        },
      });

      // Get settings
      const settings = await ctx.db.researchSettings.findUnique({ where: { id: "default" } });
      const model = settings?.defaultModel;
      const jurisdiction = settings?.defaultJurisdiction || "Federal";

      const matterContext = session.matter
        ? {
            name: session.matter.name,
            description: session.matter.description || undefined,
            practiceArea: session.matter.practiceArea || undefined,
            parties: session.matter.relatedParties.map((p) => `${p.name} (${p.role})`),
          }
        : undefined;

      let aiContent = "";
      let metadata: any = {};

      switch (input.analysisType) {
        case "research": {
          const result = await conductLegalResearch({
            query: input.content,
            jurisdiction,
            matterContext,
            model,
          });
          aiContent = result.analysis + (result.strategy ? `\n<h3>Strategic Recommendations</h3>\n${result.strategy}` : "");
          metadata = { type: "research", cases: result.suggestedCases, statutes: result.suggestedStatutes };

          // Auto-create source records for cases
          for (const c of result.suggestedCases) {
            await ctx.db.researchSource.create({
              data: {
                sessionId: input.sessionId,
                title: c.name,
                citation: c.citation,
                sourceType: "CASE_LAW",
                summary: c.summary,
              },
            });
          }
          // Auto-create source records for statutes
          for (const s of result.suggestedStatutes) {
            await ctx.db.researchSource.create({
              data: {
                sessionId: input.sessionId,
                title: s.title,
                citation: s.citation,
                sourceType: "STATUTE",
                summary: s.relevance,
              },
            });
          }
          break;
        }
        case "case_analysis": {
          const result = await analyzeCase({
            caseText: input.content,
            question: "Analyze this case and its key holdings.",
            model,
          });
          aiContent = result.analysis
            + `\n<h3>Key Holdings</h3><ul>${result.keyHoldings.map((h) => `<li>${h}</li>`).join("")}</ul>`
            + `\n<h3>Applicability</h3>\n${result.applicability}`;
          metadata = { type: "case_analysis", keyHoldings: result.keyHoldings };
          break;
        }
        case "comparison": {
          const sourcesForComparison = session.sources
            .filter((s) => s.content || s.summary)
            .map((s) => ({ title: s.title, content: s.content || s.summary || "" }));
          if (sourcesForComparison.length === 0) {
            aiContent = "<p>No sources with content found in this session to compare. Please add source content first.</p>";
            metadata = { type: "comparison", error: true };
          } else {
            const result = await compareAuthority({
              sources: sourcesForComparison,
              issue: input.content,
              model,
            });
            aiContent = `<h3>Comparison</h3>${result.comparison}<h3>Strengths</h3>${result.strengths}<h3>Weaknesses</h3>${result.weaknesses}<h3>Recommendation</h3>${result.recommendation}`;
            metadata = { type: "comparison" };
          }
          break;
        }
        case "memo": {
          const result = await generateMemo({
            matterContext: session.matter
              ? { name: session.matter.name, description: session.matter.description, practiceArea: session.matter.practiceArea }
              : null,
            researchNotes: session.notes.map((n) => `${n.title}: ${n.content}`),
            question: input.content,
            model,
          });
          aiContent = result.memo;
          metadata = { type: "memo" };
          break;
        }
        case "search_queries": {
          const result = await suggestSearchQueries({
            issue: input.content,
            jurisdiction,
            model,
          });
          aiContent = `<h3>Suggested Search Queries</h3><table style="width:100%;border-collapse:collapse;"><thead><tr><th style="text-align:left;border-bottom:1px solid #ddd;padding:8px;">Query</th><th style="text-align:left;border-bottom:1px solid #ddd;padding:8px;">Database</th><th style="text-align:left;border-bottom:1px solid #ddd;padding:8px;">Why</th></tr></thead><tbody>${result.map((q) => `<tr><td style="border-bottom:1px solid #eee;padding:8px;"><code>${q.query}</code></td><td style="border-bottom:1px solid #eee;padding:8px;">${q.database}</td><td style="border-bottom:1px solid #eee;padding:8px;">${q.explanation}</td></tr>`).join("")}</tbody></table>`;
          metadata = { type: "search_queries", queries: result };
          break;
        }
      }

      // Save AI message
      const aiMessage = await ctx.db.researchMessage.create({
        data: {
          sessionId: input.sessionId,
          role: "AI",
          content: aiContent,
          metadata: JSON.stringify(metadata),
        },
      });

      // Touch session updatedAt
      await ctx.db.researchSession.update({
        where: { id: input.sessionId },
        data: { updatedAt: new Date() },
      });

      return aiMessage;
    }),

  // ── Notes ─────────────────────────────────────────────
  listNotes: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.researchNote.findMany({
        where: { sessionId: input.sessionId },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      });
    }),

  createNote: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        title: z.string().min(1),
        content: z.string(),
        tags: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.researchNote.create({
        data: {
          sessionId: input.sessionId,
          title: input.title,
          content: input.content,
          tags: input.tags,
        },
      });
    }),

  updateNote: publicProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        content: z.string().optional(),
        tags: z.string().optional(),
        isPinned: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.researchNote.update({ where: { id }, data });
    }),

  deleteNote: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.researchNote.delete({ where: { id: input.id } });
    }),

  // ── Sources ───────────────────────────────────────────
  listSources: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        sourceType: z.enum(["CASE_LAW", "STATUTE", "REGULATION", "SECONDARY", "WEB", "MANUAL"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = { sessionId: input.sessionId };
      if (input.sourceType) where.sourceType = input.sourceType;
      return ctx.db.researchSource.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
    }),

  addSource: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        title: z.string().min(1),
        citation: z.string().optional(),
        url: z.string().optional(),
        sourceType: z.enum(["CASE_LAW", "STATUTE", "REGULATION", "SECONDARY", "WEB", "MANUAL"]),
        summary: z.string().optional(),
        content: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.researchSource.create({ data: input });
    }),

  updateSource: publicProcedure
    .input(
      z.object({
        id: z.string(),
        relevanceScore: z.number().min(1).max(5).optional(),
        summary: z.string().optional(),
        content: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.researchSource.update({ where: { id }, data });
    }),

  deleteSource: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.researchSource.delete({ where: { id: input.id } });
    }),

  // ── Generate Memo ─────────────────────────────────────
  generateMemo: publicProcedure
    .input(z.object({ sessionId: z.string(), question: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.researchSession.findUniqueOrThrow({
        where: { id: input.sessionId },
        include: {
          matter: { select: { name: true, description: true, practiceArea: true, client: { select: { name: true } } } },
          notes: true,
        },
      });
      const settings = await ctx.db.researchSettings.findUnique({ where: { id: "default" } });

      const result = await generateMemo({
        matterContext: session.matter
          ? { name: session.matter.name, description: session.matter.description, practiceArea: session.matter.practiceArea, clientName: session.matter.client.name }
          : null,
        researchNotes: session.notes.map((n) => `${n.title}: ${n.content}`),
        question: input.question,
        model: settings?.defaultModel,
      });

      const msg = await ctx.db.researchMessage.create({
        data: {
          sessionId: input.sessionId,
          role: "AI",
          content: result.memo,
          metadata: JSON.stringify({ type: "memo" }),
        },
      });

      return msg;
    }),

  // ── Settings ──────────────────────────────────────────
  getSettings: publicProcedure.query(async ({ ctx }) => {
    let settings = await ctx.db.researchSettings.findUnique({ where: { id: "default" } });
    if (!settings) {
      settings = await ctx.db.researchSettings.create({ data: { id: "default" } });
    }
    return settings;
  }),

  updateSettings: publicProcedure
    .input(
      z.object({
        vlexApiKey: z.string().optional(),
        vlexEnabled: z.boolean().optional(),
        defaultJurisdiction: z.string().optional(),
        defaultModel: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.researchSettings.upsert({
        where: { id: "default" },
        create: { id: "default", ...input },
        update: input,
      });
    }),
});
