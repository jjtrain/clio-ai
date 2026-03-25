import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { PRACTICE_AREA_CONFIGS, getConfigByArea } from "@/lib/onboarding/seeds";

export const onboardingRouter = router({
  getSession: publicProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.userId || "demo-user";
    let session = await ctx.db.onboardingSession.findUnique({ where: { userId } });
    if (!session) session = await ctx.db.onboardingSession.create({ data: { userId } });
    return session;
  }),

  getPracticeAreas: publicProcedure.query(() => PRACTICE_AREA_CONFIGS.map((c) => ({ id: c.id, name: c.name, icon: c.icon, description: c.description }))),

  getAreaConfig: publicProcedure.input(z.object({ area: z.string() })).query(({ input }) => getConfigByArea(input.area)),

  selectAreas: publicProcedure.input(z.object({ areas: z.array(z.string()) })).mutation(async ({ ctx, input }) => {
    const userId = ctx.session?.userId || "demo-user";
    return ctx.db.onboardingSession.upsert({
      where: { userId }, create: { userId, selectedAreas: input.areas as any, currentStep: 1 },
      update: { selectedAreas: input.areas as any, currentStep: 1 },
    });
  }),

  seed: publicProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session?.userId || "demo-user";
    const session = await ctx.db.onboardingSession.findUniqueOrThrow({ where: { userId } });
    const areas = (session.selectedAreas as string[]) || [];
    const seededAreas = (session.seededAreas as string[]) || [];

    await ctx.db.onboardingSession.update({ where: { userId }, data: { seedingStatus: "SEEDING", seedingProgress: 0 } });

    let progress = 0;
    const totalAreas = areas.filter((a) => !seededAreas.includes(a)).length;
    if (totalAreas === 0) {
      await ctx.db.onboardingSession.update({ where: { userId }, data: { seedingStatus: "COMPLETE", seedingProgress: 100, currentStep: 2 } });
      return { seeded: 0 };
    }

    for (const area of areas) {
      if (seededAreas.includes(area)) continue;
      const config = getConfigByArea(area);
      if (!config) continue;

      // Seed is idempotent — configs are informational, stored in session
      progress++;
      await ctx.db.onboardingSession.update({
        where: { userId },
        data: { seedingProgress: Math.round((progress / totalAreas) * 100), seededAreas: [...seededAreas, area] as any },
      });
    }

    await ctx.db.onboardingSession.update({ where: { userId }, data: { seedingStatus: "COMPLETE", seedingProgress: 100, currentStep: 2 } });
    return { seeded: totalAreas };
  }),

  advanceStep: publicProcedure.input(z.object({ step: z.number() })).mutation(async ({ ctx, input }) => {
    const userId = ctx.session?.userId || "demo-user";
    const session = await ctx.db.onboardingSession.findUniqueOrThrow({ where: { userId } });
    const completed = (session.completedSteps as number[]) || [];
    if (!completed.includes(session.currentStep)) completed.push(session.currentStep);
    return ctx.db.onboardingSession.update({ where: { userId }, data: { currentStep: input.step, completedSteps: completed as any } });
  }),

  complete: publicProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session?.userId || "demo-user";
    return ctx.db.onboardingSession.update({ where: { userId }, data: { isComplete: true, completedAt: new Date(), currentStep: 8 } });
  }),

  skip: publicProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session?.userId || "demo-user";
    return ctx.db.onboardingSession.update({ where: { userId }, data: { isComplete: true, skippedAt: new Date(), currentStep: 8 } });
  }),

  reset: publicProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session?.userId || "demo-user";
    return ctx.db.onboardingSession.update({
      where: { userId },
      data: { currentStep: 0, selectedAreas: [], seededAreas: [], completedSteps: [], seedingStatus: "PENDING", seedingProgress: 0, isComplete: false, completedAt: null, skippedAt: null },
    });
  }),
});
