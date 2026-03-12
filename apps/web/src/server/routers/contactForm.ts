import { z } from "zod";
import { router, publicProcedure } from "../trpc";

export const contactFormRouter = router({
  submit: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        practiceArea: z.string().optional(),
        message: z.string().min(1),
        referrer: z.string().optional(),
        pageUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const submission = await ctx.db.contactFormSubmission.create({
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone || null,
          practiceArea: input.practiceArea || null,
          message: input.message,
          referrer: input.referrer || null,
          pageUrl: input.pageUrl || null,
        },
      });

      const lead = await ctx.db.lead.create({
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone || null,
          source: "CONTACT_FORM",
          status: "NEW",
          priority: "MEDIUM",
          practiceArea: input.practiceArea || null,
          description: input.message,
          contactFormId: submission.id,
          referrer: input.referrer || null,
        },
      });

      await ctx.db.contactFormSubmission.update({
        where: { id: submission.id },
        data: { leadId: lead.id },
      });

      await ctx.db.leadActivity.create({
        data: {
          leadId: lead.id,
          type: "FORM_SUBMITTED",
          description: "Lead created from contact form submission",
        },
      });

      return { success: true, message: "Thank you! We'll be in touch shortly." };
    }),

  getSettings: publicProcedure.query(async ({ ctx }) => {
    const settings = await ctx.db.chatWidgetSettings.findUnique({
      where: { id: "default" },
    });
    return {
      practiceAreas: settings?.practiceAreas
        ? JSON.parse(settings.practiceAreas)
        : ["Family Law", "Criminal Defense", "Personal Injury", "Estate Planning", "Business Law", "Real Estate", "Immigration", "Other"],
    };
  }),
});
