import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { CampaignStatus, CampaignType } from "@prisma/client";
import { sendCampaignEmail } from "@/lib/email";

// ─── Helpers ──────────────────────────────────────────────────────

async function buildAudienceList(
  db: any,
  audienceType: string,
  audienceFilter?: string | null
): Promise<{ email: string; name: string; sourceType: string; sourceId: string }[]> {
  switch (audienceType) {
    case "ALL_CLIENTS": {
      const clients = await db.client.findMany({
        where: { status: "ACTIVE", email: { not: null } },
        select: { id: true, name: true, email: true },
      });
      return clients
        .filter((c: any) => c.email)
        .map((c: any) => ({ email: c.email!, name: c.name, sourceType: "CLIENT", sourceId: c.id }));
    }
    case "ALL_LEADS": {
      const leads = await db.lead.findMany({
        where: { email: { not: null }, status: { not: "ARCHIVED" } },
        select: { id: true, name: true, email: true },
      });
      return leads
        .filter((l: any) => l.email)
        .map((l: any) => ({ email: l.email!, name: l.name, sourceType: "LEAD", sourceId: l.id }));
    }
    case "INTAKE_SUBMISSIONS": {
      const subs = await db.intakeFormSubmission.findMany({
        where: { submitterEmail: { not: null } },
        select: { id: true, submitterName: true, submitterEmail: true },
      });
      return subs
        .filter((s: any) => s.submitterEmail)
        .map((s: any) => ({
          email: s.submitterEmail!,
          name: s.submitterName || "there",
          sourceType: "INTAKE",
          sourceId: s.id,
        }));
    }
    case "CUSTOM": {
      if (!audienceFilter) return [];
      const filters = JSON.parse(audienceFilter);
      const results: { email: string; name: string; sourceType: string; sourceId: string }[] = [];

      if (filters.leadStatus || filters.leadSource || filters.practiceArea) {
        const where: any = { email: { not: null } };
        if (filters.leadStatus) where.status = { in: filters.leadStatus };
        if (filters.leadSource) where.source = { in: filters.leadSource };
        if (filters.practiceArea) where.practiceArea = filters.practiceArea;
        const leads = await db.lead.findMany({ where, select: { id: true, name: true, email: true } });
        for (const l of leads) {
          if (l.email) results.push({ email: l.email, name: l.name, sourceType: "LEAD", sourceId: l.id });
        }
      }

      if (filters.clientStatus) {
        const clients = await db.client.findMany({
          where: { status: filters.clientStatus, email: { not: null } },
          select: { id: true, name: true, email: true },
        });
        for (const c of clients) {
          if (c.email) results.push({ email: c.email, name: c.name, sourceType: "CLIENT", sourceId: c.id });
        }
      }

      // Deduplicate by email
      const seen = new Set<string>();
      return results.filter((r) => {
        if (seen.has(r.email)) return false;
        seen.add(r.email);
        return true;
      });
    }
    default:
      return [];
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Router ───────────────────────────────────────────────────────

export const campaignsRouter = router({
  // ── Templates ─────────────────────────────────────────────────

  listTemplates: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.emailTemplate.findMany({ orderBy: { updatedAt: "desc" } });
  }),

  getTemplate: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const tpl = await ctx.db.emailTemplate.findUnique({ where: { id: input.id } });
      if (!tpl) throw new Error("Template not found");
      return tpl;
    }),

  createTemplate: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        subject: z.string().min(1),
        htmlContent: z.string().min(1),
        category: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.emailTemplate.create({ data: input });
    }),

  updateTemplate: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        subject: z.string().optional(),
        htmlContent: z.string().optional(),
        category: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.emailTemplate.update({ where: { id }, data });
    }),

  deleteTemplate: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.emailTemplate.delete({ where: { id: input.id } });
    }),

  // ── Campaigns ─────────────────────────────────────────────────

  list: publicProcedure
    .input(
      z.object({
        status: z.nativeEnum(CampaignStatus).optional(),
        campaignType: z.nativeEnum(CampaignType).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.status) where.status = input.status;
      if (input?.campaignType) where.campaignType = input.campaignType;
      return ctx.db.emailCampaign.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { recipients: true } } },
      });
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const campaign = await ctx.db.emailCampaign.findUnique({
        where: { id: input.id },
        include: {
          template: { select: { name: true } },
          _count: { select: { recipients: true } },
        },
      });
      if (!campaign) throw new Error("Campaign not found");
      return campaign;
    }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        subject: z.string().min(1),
        htmlContent: z.string().min(1),
        campaignType: z.nativeEnum(CampaignType).default("BLAST"),
        audienceType: z.string().default("ALL_CLIENTS"),
        audienceFilter: z.string().optional(),
        templateId: z.string().optional(),
        scheduledAt: z.string().optional(),
        triggerEvent: z.string().optional(),
        triggerCondition: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.emailCampaign.create({
        data: {
          name: input.name,
          subject: input.subject,
          htmlContent: input.htmlContent,
          campaignType: input.campaignType,
          audienceType: input.audienceType,
          audienceFilter: input.audienceFilter || null,
          templateId: input.templateId || null,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
          triggerEvent: input.triggerEvent || null,
          triggerCondition: input.triggerCondition || null,
        },
      });
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        subject: z.string().optional(),
        htmlContent: z.string().optional(),
        audienceType: z.string().optional(),
        audienceFilter: z.string().optional(),
        scheduledAt: z.string().nullable().optional(),
        triggerEvent: z.string().optional(),
        triggerCondition: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.db.emailCampaign.findUnique({ where: { id: input.id } });
      if (!campaign) throw new Error("Campaign not found");
      if (campaign.status !== "DRAFT") throw new Error("Can only edit draft campaigns");
      const { id, scheduledAt, ...data } = input;
      return ctx.db.emailCampaign.update({
        where: { id },
        data: {
          ...data,
          ...(scheduledAt !== undefined
            ? { scheduledAt: scheduledAt ? new Date(scheduledAt) : null }
            : {}),
        },
      });
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.db.emailCampaign.findUnique({ where: { id: input.id } });
      if (!campaign) throw new Error("Campaign not found");
      if (campaign.status !== "DRAFT") throw new Error("Can only delete draft campaigns");
      return ctx.db.emailCampaign.delete({ where: { id: input.id } });
    }),

  buildAudience: publicProcedure
    .input(
      z.object({
        audienceType: z.string(),
        audienceFilter: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const list = await buildAudienceList(ctx.db, input.audienceType, input.audienceFilter);
      return {
        count: list.length,
        preview: list.slice(0, 10),
      };
    }),

  send: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.db.emailCampaign.findUnique({ where: { id: input.id } });
      if (!campaign) throw new Error("Campaign not found");
      if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED")
        throw new Error("Campaign cannot be sent");

      // Build audience
      const audience = await buildAudienceList(ctx.db, campaign.audienceType, campaign.audienceFilter);
      if (audience.length === 0) throw new Error("No recipients found for this audience");

      // Create recipient records
      await ctx.db.campaignRecipient.createMany({
        data: audience.map((r) => ({
          campaignId: campaign.id,
          email: r.email,
          name: r.name,
          sourceType: r.sourceType,
          sourceId: r.sourceId,
        })),
      });

      // Update campaign to SENDING
      await ctx.db.emailCampaign.update({
        where: { id: campaign.id },
        data: { status: "SENDING", recipientCount: audience.length },
      });

      // Get firm settings for from email and firm name
      const settings = await ctx.db.settings.findUnique({ where: { id: "default" } });
      const firmName = settings?.firmName || "Our Law Firm";
      const fromEmail = settings?.email || "noreply@example.com";

      // Send in batches of 10
      let totalSent = 0;
      let totalFailed = 0;
      const recipients = await ctx.db.campaignRecipient.findMany({
        where: { campaignId: campaign.id },
      });

      for (let i = 0; i < recipients.length; i += 10) {
        const batch = recipients.slice(i, i + 10);
        const results = await Promise.allSettled(
          batch.map(async (r: any) => {
            const result = await sendCampaignEmail({
              to: r.email,
              name: r.name || "there",
              subject: campaign.subject,
              htmlContent: campaign.htmlContent,
              fromEmail,
              firmName,
            });
            await ctx.db.campaignRecipient.update({
              where: { id: r.id },
              data: {
                status: result.success ? "SENT" : "FAILED",
                sentAt: result.success ? new Date() : null,
                errorMessage: result.error || null,
              },
            });
            return result.success;
          })
        );

        for (const r of results) {
          if (r.status === "fulfilled" && r.value) totalSent++;
          else totalFailed++;
        }

        if (i + 10 < recipients.length) await sleep(200);
      }

      // Finalize
      return ctx.db.emailCampaign.update({
        where: { id: campaign.id },
        data: {
          status: "SENT",
          totalSent,
          totalFailed,
          totalDelivered: totalSent,
          sentAt: new Date(),
          completedAt: new Date(),
        },
      });
    }),

  cancel: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const campaign = await ctx.db.emailCampaign.findUnique({ where: { id: input.id } });
      if (!campaign) throw new Error("Campaign not found");
      if (campaign.status !== "SCHEDULED" && campaign.status !== "DRAFT")
        throw new Error("Can only cancel draft or scheduled campaigns");
      return ctx.db.emailCampaign.update({
        where: { id: input.id },
        data: { status: "CANCELLED" },
      });
    }),

  getRecipients: publicProcedure
    .input(
      z.object({
        campaignId: z.string(),
        status: z.enum(["PENDING", "SENT", "DELIVERED", "FAILED", "BOUNCED"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = { campaignId: input.campaignId };
      if (input.status) where.status = input.status;
      const [recipients, total] = await Promise.all([
        ctx.db.campaignRecipient.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.db.campaignRecipient.count({ where }),
      ]);
      return { recipients, total };
    }),

  getCampaignStats: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const stats = await ctx.db.campaignRecipient.groupBy({
        by: ["status"],
        where: { campaignId: input.id },
        _count: true,
      });
      return Object.fromEntries(stats.map((s) => [s.status, s._count]));
    }),

  // ── Triggers ──────────────────────────────────────────────────

  listTriggers: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.emailCampaign.findMany({
      where: { campaignType: "TRIGGERED" },
      orderBy: { createdAt: "desc" },
    });
  }),

  checkTrigger: publicProcedure
    .input(
      z.object({
        event: z.string(),
        conditionData: z.record(z.string(), z.any()),
        recipientEmail: z.string(),
        recipientName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find active triggered campaigns matching the event
      const triggers = await ctx.db.emailCampaign.findMany({
        where: {
          campaignType: "TRIGGERED",
          triggerEvent: input.event,
          status: "SENT", // SENT means active for triggers
        },
      });

      const settings = await ctx.db.settings.findUnique({ where: { id: "default" } });
      const firmName = settings?.firmName || "Our Law Firm";
      const fromEmail = settings?.email || "noreply@example.com";

      for (const trigger of triggers) {
        // Check condition match
        if (trigger.triggerCondition) {
          const cond = JSON.parse(trigger.triggerCondition);
          let matches = true;
          for (const [key, value] of Object.entries(cond)) {
            if (input.conditionData[key] !== value) {
              matches = false;
              break;
            }
          }
          if (!matches) continue;
        }

        // Send the email
        const result = await sendCampaignEmail({
          to: input.recipientEmail,
          name: input.recipientName || "there",
          subject: trigger.subject,
          htmlContent: trigger.htmlContent,
          fromEmail,
          firmName,
        });

        // Record the recipient
        await ctx.db.campaignRecipient.create({
          data: {
            campaignId: trigger.id,
            email: input.recipientEmail,
            name: input.recipientName,
            sourceType: "TRIGGER",
            sourceId: null,
            status: result.success ? "SENT" : "FAILED",
            sentAt: result.success ? new Date() : null,
            errorMessage: result.error || null,
          },
        });

        // Update stats
        await ctx.db.emailCampaign.update({
          where: { id: trigger.id },
          data: {
            totalSent: { increment: result.success ? 1 : 0 },
            totalFailed: { increment: result.success ? 0 : 1 },
            recipientCount: { increment: 1 },
          },
        });
      }
    }),
});
