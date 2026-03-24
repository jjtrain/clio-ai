import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { buildDigestForUser, renderDigestHtml } from "@/lib/digest-engine";
import { sendDigestEmail } from "@/lib/email";

export const digestRouter = router({
  getPreferences: publicProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.userId || "demo-user";
    let pref = await ctx.db.digestPreference.findUnique({ where: { userId } });
    if (!pref) {
      pref = await ctx.db.digestPreference.create({
        data: { userId, enabled: true, sendHour: 7, timezone: "America/New_York" },
      });
    }
    return {
      ...pref,
      sections: typeof pref.sections === "string" ? JSON.parse(pref.sections as string) : pref.sections,
    };
  }),

  updatePreferences: publicProcedure
    .input(z.object({
      enabled: z.boolean().optional(),
      sendHour: z.number().min(0).max(23).optional(),
      timezone: z.string().optional(),
      sections: z.record(z.boolean()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.userId || "demo-user";
      return ctx.db.digestPreference.upsert({
        where: { userId },
        create: {
          userId,
          enabled: input.enabled ?? true,
          sendHour: input.sendHour ?? 7,
          timezone: input.timezone ?? "America/New_York",
          sections: input.sections ? (input.sections as any) : undefined,
        },
        update: {
          ...(input.enabled !== undefined && { enabled: input.enabled }),
          ...(input.sendHour !== undefined && { sendHour: input.sendHour }),
          ...(input.timezone !== undefined && { timezone: input.timezone }),
          ...(input.sections !== undefined && { sections: input.sections as any }),
        },
      });
    }),

  sendTestDigest: publicProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session?.userId || "demo-user";
    const payload = await buildDigestForUser(userId);
    const html = renderDigestHtml(payload);

    const result = await sendDigestEmail({
      to: payload.userEmail,
      subject: `[Test] Your Daily Digest — ${payload.date}`,
      html,
      fromEmail: "digest@managal.com",
    });

    await ctx.db.digestLog.create({
      data: {
        userId,
        status: result.success ? "sent" : "failed",
        previewHtml: result.previewHtml || html,
        error: result.error,
      },
    });

    return { success: result.success, previewHtml: result.previewHtml || html, sections: payload.sections.length };
  }),

  getDigestHistory: publicProcedure
    .input(z.object({ limit: z.number().default(10) }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.userId || "demo-user";
      return ctx.db.digestLog.findMany({
        where: { userId },
        orderBy: { sentAt: "desc" },
        take: input?.limit || 10,
        select: { id: true, sentAt: true, status: true, error: true, createdAt: true },
      });
    }),

  getDigestPreview: publicProcedure
    .input(z.object({ logId: z.string() }))
    .query(async ({ ctx, input }) => {
      const log = await ctx.db.digestLog.findUniqueOrThrow({ where: { id: input.logId } });
      return { html: log.previewHtml };
    }),
});
