import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";
import * as signEngine from "@/lib/mobile-sign-engine";

export const mobileSignRouter = router({
  // ── Requests 1-11 ──

  create: publicProcedure
    .input(
      z.object({
        title: z.string(),
        documentContent: z.string(),
        signers: z.array(z.any()),
        matterId: z.string().optional(),
        firmId: z.string(),
        userId: z.string(),
        customMessage: z.string().optional(),
        legalDisclaimer: z.string().optional(),
        requireInitials: z.boolean().optional(),
        requireDateField: z.boolean().optional(),
        brandColor: z.string().optional(),
        firmLogo: z.string().optional(),
        firmName: z.string().optional(),
        signingOrder: z.string().optional(),
        saveCompletedToMatter: z.boolean().optional(),
        autoRemindEnabled: z.boolean().optional(),
        autoRemindDays: z.number().optional(),
        expirationDays: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return signEngine.createSigningRequest(input);
    }),

  createFromTemplate: publicProcedure
    .input(
      z.object({
        templateId: z.string(),
        fieldValues: z.record(z.string()),
        signers: z.array(z.any()),
        matterId: z.string().optional(),
        firmId: z.string(),
        userId: z.string(),
        title: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return signEngine.generateFromTemplate(input.templateId, input);
    }),

  send: publicProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ input }) => {
      return signEngine.sendSigningRequest(input.requestId);
    }),

  createAndSend: publicProcedure
    .input(
      z.object({
        title: z.string(),
        documentContent: z.string(),
        signers: z.array(z.any()),
        matterId: z.string().optional(),
        firmId: z.string(),
        userId: z.string(),
        customMessage: z.string().optional(),
        legalDisclaimer: z.string().optional(),
        requireInitials: z.boolean().optional(),
        requireDateField: z.boolean().optional(),
        brandColor: z.string().optional(),
        firmLogo: z.string().optional(),
        firmName: z.string().optional(),
        signingOrder: z.string().optional(),
        saveCompletedToMatter: z.boolean().optional(),
        autoRemindEnabled: z.boolean().optional(),
        autoRemindDays: z.number().optional(),
        expirationDays: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const request = await signEngine.createSigningRequest(input);
      const sendResult = await signEngine.sendSigningRequest(request.id);
      return { ...request, ...sendResult };
    }),

  list: publicProcedure
    .input(
      z.object({
        firmId: z.string().optional(),
        status: z.string().optional(),
        matterId: z.string().optional(),
        userId: z.string().optional(),
        skip: z.number().optional(),
        take: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      return db.mobileSignatureRequest.findMany({
        where: {
          ...(input.status && { status: input.status as any }),
          ...(input.matterId && { matterId: input.matterId }),
        } as any,
        orderBy: { createdAt: "desc" },
        skip: input.skip,
        take: input.take ?? 50,
      });
    }),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.mobileSignatureRequest.findUniqueOrThrow({
        where: { id: input.id },
      });
    }),

  cancel: publicProcedure
    .input(z.object({ requestId: z.string(), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      return signEngine.cancelRequest(input.requestId, input.reason);
    }),

  resend: publicProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ input }) => {
      return signEngine.sendSigningRequest(input.requestId);
    }),

  remind: publicProcedure
    .input(
      z.object({ requestId: z.string(), signerId: z.string().optional() })
    )
    .mutation(async ({ input }) => {
      return signEngine.sendReminder(input.requestId, input.signerId);
    }),

  extend: publicProcedure
    .input(z.object({ requestId: z.string(), additionalDays: z.number() }))
    .mutation(async ({ input }) => {
      const request = await db.mobileSignatureRequest.findUniqueOrThrow({
        where: { id: input.requestId },
      });
      const currentExpiry = request.tokenExpiresAt ?? new Date();
      const newExpiry = new Date(
        currentExpiry.getTime() + input.additionalDays * 24 * 60 * 60 * 1000
      );
      return db.mobileSignatureRequest.update({
        where: { id: input.requestId },
        data: { tokenExpiresAt: newExpiry },
      });
    }),

  duplicate: publicProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ input }) => {
      const original = await db.mobileSignatureRequest.findUniqueOrThrow({
        where: { id: input.requestId },
      });
      const signers = JSON.parse((original.signers as string) || "[]").map(
        (s: any) => ({ ...s, status: "pending", signedAt: null, signatureData: null })
      );
      return signEngine.createSigningRequest({
        title: original.title, documentContent: original.documentContent, signers,
        matterId: original.matterId ?? undefined, customMessage: original.customMessage ?? undefined,
        requireInitials: original.requireInitials, requireDateField: original.requireDateField,
        signingOrder: original.signingOrder as any, firmName: original.firmName,
      } as any);
    }),

  // ── Public (no auth) 12-14 ──

  getPublicSigningPage: publicProcedure
    .input(z.object({ signingToken: z.string() }))
    .query(async ({ input }) => {
      return signEngine.getSigningPage(input.signingToken);
    }),

  submitPublicSignature: publicProcedure
    .input(
      z.object({
        signingToken: z.string(),
        signerId: z.string(),
        signatureData: z.string(),
        ipAddress: z.string().optional(),
        userAgent: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return signEngine.submitSignature(input.signingToken, input);
    }),

  declinePublic: publicProcedure
    .input(z.object({ signingToken: z.string(), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      return signEngine.declineSigningRequest(input.signingToken, input.reason);
    }),

  // ── Templates 15-21 ──

  templates: router({
    list: publicProcedure
      .input(
        z.object({
          category: z.string().optional(),
          isActive: z.boolean().optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        return db.signatureTemplate.findMany({
          where: {
            
            ...(input?.category && { category: input.category }),
            isActive: input?.isActive ?? true,
          },
          orderBy: { createdAt: "desc" },
        });
      }),

    get: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        return db.signatureTemplate.findUniqueOrThrow({
          where: { id: input.id },
        });
      }),

    create: publicProcedure
      .input(
        z.object({
          name: z.string(),
          description: z.string().optional(),
          content: z.string(),
          variables: z.array(z.string()),
          signerRoles: z.array(z.any()),
          category: z.string().optional(),
          firmId: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        return db.signatureTemplate.create({ data: input as any });
      }),

    update: publicProcedure
      .input(
        z.object({
          id: z.string(),
          name: z.string().optional(),
          description: z.string().optional(),
          content: z.string().optional(),
          variables: z.array(z.string()).optional(),
          signerRoles: z.array(z.any()).optional(),
          category: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.signatureTemplate.update({ where: { id }, data: data as any });
      }),

    delete: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        return db.signatureTemplate.update({
          where: { id: input.id },
          data: { isActive: false },
        });
      }),

    preview: publicProcedure
      .input(
        z.object({
          id: z.string(),
          sampleValues: z.record(z.string()).optional(),
        })
      )
      .query(async ({ input }) => {
        const template = await db.signatureTemplate.findUniqueOrThrow({
          where: { id: input.id },
        });
        let html = template.content as string;
        const values = input.sampleValues ?? {};
        for (const [key, value] of Object.entries(values)) {
          html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
        }
        return { html };
      }),

    seed: publicProcedure
      .input(z.object({ firmId: z.string().optional() }).optional())
      .mutation(async ({ input }) => {
        const existing = await db.signatureTemplate.count({
          where: {  },
        });
        if (existing > 0) return { seeded: false, message: "Templates already exist" };

        const templates = [
          {
            name: "Retainer Agreement",
            description: "Standard legal retainer agreement for new clients",
            category: "engagement",
            variables: JSON.stringify(["clientName", "clientAddress", "hourlyRate", "retainerAmount", "scopeOfWork", "firmName", "attorneyName", "effectiveDate"]),
            signerRoles: JSON.stringify([{ role: "Client", order: 1 }, { role: "Attorney", order: 2 }]),
            content: `<html><body style="font-family:Georgia,serif;max-width:800px;margin:0 auto;padding:40px;line-height:1.6">
<h1 style="text-align:center;border-bottom:2px solid #333;padding-bottom:10px">RETAINER AGREEMENT</h1>
<p style="text-align:center;color:#666">Attorney-Client Fee Agreement</p>
<p>This Retainer Agreement ("Agreement") is entered into as of <strong>{{effectiveDate}}</strong> by and between:</p>
<p><strong>Attorney/Firm:</strong> {{firmName}}, represented by {{attorneyName}}</p>
<p><strong>Client:</strong> {{clientName}}, residing at {{clientAddress}}</p>
<h2>1. Scope of Representation</h2>
<p>The Firm agrees to provide legal services to the Client in connection with: {{scopeOfWork}}</p>
<h2>2. Fees and Billing</h2>
<p>The Client agrees to pay the Firm at an hourly rate of <strong>\${{hourlyRate}}</strong> per hour for attorney time. An initial retainer deposit of <strong>\${{retainerAmount}}</strong> is due upon execution of this Agreement. This retainer will be deposited into the Firm's client trust account and applied against fees and costs as they are incurred.</p>
<h2>3. Costs and Expenses</h2>
<p>In addition to attorney fees, the Client shall be responsible for all costs and expenses incurred in connection with the representation, including but not limited to filing fees, court costs, deposition costs, expert witness fees, travel expenses, and copying charges.</p>
<h2>4. Billing Statements</h2>
<p>The Firm shall provide monthly billing statements detailing services rendered, time spent, and costs incurred. Payment is due within thirty (30) days of the statement date.</p>
<h2>5. Termination</h2>
<p>Either party may terminate this Agreement at any time upon written notice. Upon termination, the Client shall pay for all services rendered and costs incurred through the date of termination.</p>
<h2>6. Acknowledgment</h2>
<p>By signing below, the parties acknowledge that they have read, understood, and agree to the terms of this Agreement.</p>
<div style="margin-top:60px;display:flex;justify-content:space-between">
<div><p>________________________________</p><p>{{clientName}}, Client</p><p>Date: _______________</p></div>
<div><p>________________________________</p><p>{{attorneyName}}, Attorney</p><p>Date: _______________</p></div>
</div></body></html>`,
            
            isActive: true,
            usageCount: 0,
          },
          {
            name: "Settlement Agreement",
            description: "Standard settlement agreement between parties",
            category: "settlement",
            variables: JSON.stringify(["clientName", "opposingParty", "settlementAmount", "caseNumber", "effectiveDate", "firmName"]),
            signerRoles: JSON.stringify([{ role: "Client", order: 1 }, { role: "Opposing Party", order: 2 }]),
            content: `<html><body style="font-family:Georgia,serif;max-width:800px;margin:0 auto;padding:40px;line-height:1.6">
<h1 style="text-align:center">SETTLEMENT AGREEMENT AND RELEASE</h1>
<p>Case No: {{caseNumber}}</p>
<p>This Settlement Agreement is entered into as of {{effectiveDate}} by {{clientName}} ("First Party") and {{opposingParty}} ("Second Party").</p>
<h2>Terms</h2>
<p>Second Party agrees to pay First Party the sum of <strong>\${{settlementAmount}}</strong> in full and final settlement of all claims arising from the above-referenced matter.</p>
<p>Upon receipt of payment, First Party releases and forever discharges Second Party from any and all claims, demands, and causes of action.</p>
<p>Prepared by {{firmName}}.</p>
<div style="margin-top:60px"><p>________________________________</p><p>{{clientName}}</p></div>
<div style="margin-top:40px"><p>________________________________</p><p>{{opposingParty}}</p></div></body></html>`,
            
            isActive: true,
            usageCount: 0,
          },
          {
            name: "Consent to Representation",
            description: "Conflict waiver and consent to dual representation",
            category: "engagement",
            variables: JSON.stringify(["clientName", "otherParty", "matterDescription", "firmName", "attorneyName"]),
            signerRoles: JSON.stringify([{ role: "Client", order: 1 }]),
            content: `<html><body style="font-family:Georgia,serif;max-width:800px;margin:0 auto;padding:40px;line-height:1.6">
<h1 style="text-align:center">CONSENT TO REPRESENTATION</h1>
<p>I, <strong>{{clientName}}</strong>, have been informed that {{firmName}} currently represents or has previously represented {{otherParty}} in other matters.</p>
<p>I understand the potential conflict of interest in connection with: {{matterDescription}}.</p>
<p>After full disclosure by {{attorneyName}}, I hereby consent to the firm's representation and waive any conflict of interest.</p>
<div style="margin-top:60px"><p>________________________________</p><p>{{clientName}}</p><p>Date: _______________</p></div></body></html>`,
            
            isActive: true,
            usageCount: 0,
          },
          {
            name: "Authorization to Release Records",
            description: "Client authorization for record release to third parties",
            category: "authorization",
            variables: JSON.stringify(["clientName", "recipientName", "recordsDescription", "firmName"]),
            signerRoles: JSON.stringify([{ role: "Client", order: 1 }]),
            content: `<html><body style="font-family:Georgia,serif;max-width:800px;margin:0 auto;padding:40px;line-height:1.6">
<h1 style="text-align:center">AUTHORIZATION TO RELEASE RECORDS</h1>
<p>I, <strong>{{clientName}}</strong>, hereby authorize {{firmName}} to release the following records to <strong>{{recipientName}}</strong>:</p>
<p>{{recordsDescription}}</p>
<p>This authorization is valid for 90 days from the date of signature.</p>
<div style="margin-top:60px"><p>________________________________</p><p>{{clientName}}</p><p>Date: _______________</p></div></body></html>`,
            
            isActive: true,
            usageCount: 0,
          },
          {
            name: "Notice of Withdrawal",
            description: "Attorney notice of withdrawal from representation",
            category: "disengagement",
            variables: JSON.stringify(["clientName", "matterDescription", "withdrawalDate", "firmName", "attorneyName"]),
            signerRoles: JSON.stringify([{ role: "Client", order: 1 }, { role: "Attorney", order: 2 }]),
            content: `<html><body style="font-family:Georgia,serif;max-width:800px;margin:0 auto;padding:40px;line-height:1.6">
<h1 style="text-align:center">NOTICE OF WITHDRAWAL</h1>
<p>Dear {{clientName}},</p>
<p>This letter is to inform you that {{firmName}}, through {{attorneyName}}, will be withdrawing from representation in the matter of: {{matterDescription}}.</p>
<p>The effective date of withdrawal shall be <strong>{{withdrawalDate}}</strong>. We recommend that you retain new counsel promptly.</p>
<p>All client files will be made available upon request.</p>
<div style="margin-top:60px"><p>________________________________</p><p>{{attorneyName}}, Attorney</p></div>
<div style="margin-top:40px"><p>Acknowledged:</p><p>________________________________</p><p>{{clientName}}, Client</p></div></body></html>`,
            
            isActive: true,
            usageCount: 0,
          },
          {
            name: "Fee Modification Agreement",
            description: "Agreement to modify existing fee arrangement",
            category: "engagement",
            variables: JSON.stringify(["clientName", "currentRate", "newRate", "effectiveDate", "firmName", "attorneyName"]),
            signerRoles: JSON.stringify([{ role: "Client", order: 1 }, { role: "Attorney", order: 2 }]),
            content: `<html><body style="font-family:Georgia,serif;max-width:800px;margin:0 auto;padding:40px;line-height:1.6">
<h1 style="text-align:center">FEE MODIFICATION AGREEMENT</h1>
<p>This agreement modifies the existing fee arrangement between {{firmName}} (represented by {{attorneyName}}) and {{clientName}}.</p>
<p>Effective <strong>{{effectiveDate}}</strong>, the hourly rate shall change from \${{currentRate}} to <strong>\${{newRate}}</strong> per hour.</p>
<p>All other terms of the original retainer agreement remain in full force and effect.</p>
<div style="margin-top:60px;display:flex;justify-content:space-between">
<div><p>________________________________</p><p>{{clientName}}, Client</p></div>
<div><p>________________________________</p><p>{{attorneyName}}, Attorney</p></div>
</div></body></html>`,
            
            isActive: true,
            usageCount: 0,
          },
        ];

        for (const t of templates) {
          await db.signatureTemplate.create({ data: t as any });
        }

        return { seeded: true, count: templates.length };
      }),
  }),

  // ── Analytics 22-24 ──

  stats: publicProcedure
    .input(z.object({}).optional())
    .query(async ({ input }) => {
      const statuses = ["MSS_DRAFT", "MSS_SENT", "MSS_VIEWED", "MSS_PARTIALLY_SIGNED", "MSS_COMPLETED", "MSS_DECLINED", "MSS_CANCELLED", "MSS_EXPIRED"];
      const counts: Record<string, number> = {};
      for (const status of statuses) {
        counts[status] = await db.mobileSignatureRequest.count({
          where: {  status: status as any },
        });
      }
      const completed = await db.mobileSignatureRequest.findMany({
        where: {  status: "MSS_COMPLETED" as any, completedAt: { not: null } },
        select: { createdAt: true, completedAt: true },
      });
      const avgCompletionMs = completed.length
        ? completed.reduce((sum, r) => sum + (r.completedAt!.getTime() - r.createdAt.getTime()), 0) / completed.length
        : 0;
      return { counts, avgCompletionHours: Math.round(avgCompletionMs / 3600000) };
    }),

  getAuditTrail: publicProcedure
    .input(z.object({ requestId: z.string() }))
    .query(async ({ input }) => {
      const request = await db.mobileSignatureRequest.findUniqueOrThrow({
        where: { id: input.requestId },
      });
      return JSON.parse((request.auditTrail as string) || "[]");
    }),

  getAuditCertificate: publicProcedure
    .input(z.object({ requestId: z.string() }))
    .query(async ({ input }) => {
      return signEngine.generateAuditCertificate(input.requestId);
    }),

  // ── Settings 25-26 ──

  settings: router({
    get: publicProcedure
      .input(z.object({}).optional())
      .query(async ({ input }) => {
        const existing = await db.mobileSignSettings.findFirst({
          where: {  },
        });
        if (existing) return existing;
        return db.mobileSignSettings.create({
          data: {
            
            defaultExpirationDays: 7,
            defaultReminderEnabled: true,
            defaultReminderDays: 3,
            brandColor: "#1a73e8",
            defaultLegalDisclaimer: "By signing this document, you agree to the terms contained herein.",
          } as any,
        });
      }),

    update: publicProcedure
      .input(
        z.object({
          firmId: z.string(),
          defaultExpirationDays: z.number().optional(),
          defaultReminderEnabled: z.boolean().optional(),
          defaultReminderDays: z.number().optional(),
          brandColor: z.string().optional(),
          firmLogo: z.string().optional(),
          firmName: z.string().optional(),
          defaultLegalDisclaimer: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { firmId, ...data } = input;
        return db.mobileSignSettings.upsert({
          where: { firmId } as any,
          update: data,
          create: { firmId, ...data } as any,
        });
      }),
  }),
});
