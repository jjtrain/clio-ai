import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { attorneyShareTestConnection, attorneyShareSearchAttorneys, attorneyShareSendReferral, attorneyShareAcceptReferral, attorneyShareDeclineReferral } from "@/lib/integrations/attorney-share";
import { appearMeTestConnection, appearMePostRequest, appearMeGetRequest, appearMeGetEstimate, appearMeCancelRequest, appearMeSubmitRating } from "@/lib/integrations/appearme";

function maskKey(k: string | null) { return k ? "****" + k.slice(-4) : null; }

export const referralsRouter = router({
  // ─── Settings ──────────────────────────────────────────────────
  "settings.list": publicProcedure.query(async ({ ctx }) => {
    const all = await ctx.db.referralIntegration.findMany({ orderBy: { provider: "asc" } });
    return all.map((i) => ({ ...i, apiKey: maskKey(i.apiKey), apiSecret: maskKey(i.apiSecret) }));
  }),
  "settings.update": publicProcedure
    .input(z.object({ provider: z.string(), displayName: z.string().optional(), apiKey: z.string().optional().nullable(), baseUrl: z.string().optional().nullable(), accountId: z.string().optional().nullable(), firmProfileId: z.string().optional().nullable(), isEnabled: z.boolean().optional(), autoNotifyOnReferral: z.boolean().optional(), defaultReferralFee: z.number().optional().nullable(), practiceAreas: z.string().optional().nullable(), jurisdictions: z.string().optional().nullable(), settings: z.string().optional().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const { provider, ...data } = input;
      const clean: any = { ...data };
      if (clean.apiKey?.startsWith("****")) delete clean.apiKey;
      return ctx.db.referralIntegration.upsert({ where: { provider }, create: { provider, displayName: input.displayName || provider, ...clean }, update: clean });
    }),
  "settings.test": publicProcedure
    .input(z.object({ provider: z.string() }))
    .mutation(async ({ input }) => input.provider === "ATTORNEY_SHARE" ? attorneyShareTestConnection() : input.provider === "APPEARME" ? appearMeTestConnection() : { success: false, error: "Unknown" }),

  // ─── Referrals ─────────────────────────────────────────────────
  "referrals.list": publicProcedure
    .input(z.object({ direction: z.string().optional(), status: z.string().optional(), caseType: z.string().optional(), search: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.direction) where.direction = input.direction;
      if (input?.status) where.status = input.status;
      if (input?.caseType) where.caseType = input.caseType;
      if (input?.search) where.OR = [{ clientName: { contains: input.search, mode: "insensitive" } }, { referringAttorneyName: { contains: input.search, mode: "insensitive" } }, { receivingAttorneyName: { contains: input.search, mode: "insensitive" } }];
      return ctx.db.referral.findMany({ where, include: { activities: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { createdAt: "desc" }, take: input?.limit || 50 });
    }),
  "referrals.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.referral.findUniqueOrThrow({ where: { id: input.id }, include: { activities: { orderBy: { createdAt: "asc" } } } })),
  "referrals.createOutbound": publicProcedure
    .input(z.object({ clientName: z.string(), clientEmail: z.string().optional(), clientPhone: z.string().optional(), caseType: z.string().optional(), caseDescription: z.string().optional(), jurisdiction: z.string().optional(), urgency: z.string().default("NORMAL"), referralFeeType: z.string().optional(), referralFeePercentage: z.number().optional(), receivingAttorneyEmail: z.string().optional(), receivingAttorneyName: z.string().optional(), receivingFirmName: z.string().optional(), matterId: z.string().optional(), estimatedCaseValue: z.number().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const referral = await ctx.db.referral.create({
        data: { ...input, direction: "OUTBOUND", status: "SENT", sentAt: new Date(), lastActivityAt: new Date() },
      });
      // Try Attorney Share
      if (input.receivingAttorneyEmail) {
        const result = await attorneyShareSendReferral({ recipientEmail: input.receivingAttorneyEmail, clientName: input.clientName, caseType: input.caseType || "", caseDescription: input.caseDescription || "", jurisdiction: input.jurisdiction || "", urgency: input.urgency, referralFeeType: input.referralFeeType || "TBD", referralFeePercentage: input.referralFeePercentage });
        if (result.success) {
          await ctx.db.referral.update({ where: { id: referral.id }, data: { provider: "ATTORNEY_SHARE", externalReferralId: (result as any).data?.referralId } });
        }
      }
      await ctx.db.referralActivity.create({ data: { referralId: referral.id, activityType: "SENT", description: `Referral sent to ${input.receivingAttorneyName || input.receivingAttorneyEmail || "attorney"}` } });
      return referral;
    }),
  "referrals.processInbound": publicProcedure
    .input(z.object({ referringAttorneyName: z.string().optional(), referringAttorneyEmail: z.string().optional(), referringFirmName: z.string().optional(), clientName: z.string(), clientEmail: z.string().optional(), clientPhone: z.string().optional(), caseType: z.string().optional(), caseDescription: z.string().optional(), jurisdiction: z.string().optional(), urgency: z.string().default("NORMAL"), estimatedCaseValue: z.number().optional(), referralFeeType: z.string().optional(), referralFeePercentage: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const referral = await ctx.db.referral.create({
        data: { ...input, direction: "INBOUND", status: "RECEIVED", receivedAt: new Date(), lastActivityAt: new Date() },
      });
      // Auto-create lead
      const lead = await ctx.db.lead.create({
        data: { name: input.clientName, email: input.clientEmail, phone: input.clientPhone, source: "REFERRAL", status: "NEW", priority: "HIGH" },
      });
      await ctx.db.referral.update({ where: { id: referral.id }, data: { leadId: lead.id } });
      await ctx.db.referralActivity.create({ data: { referralId: referral.id, activityType: "RECEIVED", description: `Referral received from ${input.referringAttorneyName || input.referringFirmName || "attorney"}. Lead created.` } });
      return referral;
    }),
  "referrals.accept": publicProcedure
    .input(z.object({ referralId: z.string(), message: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const ref = await ctx.db.referral.findUniqueOrThrow({ where: { id: input.referralId } });
      if (ref.externalReferralId && ref.provider === "ATTORNEY_SHARE") await attorneyShareAcceptReferral(ref.externalReferralId, input.message);
      await ctx.db.referralActivity.create({ data: { referralId: input.referralId, activityType: "ACCEPTED", description: "Referral accepted" } });
      return ctx.db.referral.update({ where: { id: input.referralId }, data: { status: "ACCEPTED", acceptedAt: new Date(), lastActivityAt: new Date() } });
    }),
  "referrals.decline": publicProcedure
    .input(z.object({ referralId: z.string(), reason: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ref = await ctx.db.referral.findUniqueOrThrow({ where: { id: input.referralId } });
      if (ref.externalReferralId && ref.provider === "ATTORNEY_SHARE") await attorneyShareDeclineReferral(ref.externalReferralId, input.reason);
      await ctx.db.referralActivity.create({ data: { referralId: input.referralId, activityType: "DECLINED", description: `Declined: ${input.reason}` } });
      return ctx.db.referral.update({ where: { id: input.referralId }, data: { status: "DECLINED", declineReason: input.reason, lastActivityAt: new Date() } });
    }),
  "referrals.updateStatus": publicProcedure
    .input(z.object({ referralId: z.string(), status: z.string(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.referralActivity.create({ data: { referralId: input.referralId, activityType: "STATUS_UPDATE", description: `Status changed to ${input.status}${input.notes ? `: ${input.notes}` : ""}` } });
      return ctx.db.referral.update({ where: { id: input.referralId }, data: { status: input.status, lastActivityAt: new Date() } });
    }),
  "referrals.addNote": publicProcedure
    .input(z.object({ referralId: z.string(), note: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.referralActivity.create({ data: { referralId: input.referralId, activityType: "NOTE_ADDED", description: input.note } });
      return ctx.db.referral.update({ where: { id: input.referralId }, data: { lastActivityAt: new Date() } });
    }),
  "referrals.recordPayment": publicProcedure
    .input(z.object({ referralId: z.string(), amount: z.number(), paymentDate: z.string().optional(), method: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const ref = await ctx.db.referral.findUniqueOrThrow({ where: { id: input.referralId } });
      const newPaid = Number(ref.feePaidAmount || 0) + input.amount;
      await ctx.db.referralActivity.create({ data: { referralId: input.referralId, activityType: "FEE_PAID", description: `Fee payment of $${input.amount.toFixed(2)} recorded via ${input.method || "unspecified"}` } });
      return ctx.db.referral.update({ where: { id: input.referralId }, data: { feePaidAmount: newPaid, feePaidDate: input.paymentDate ? new Date(input.paymentDate) : new Date(), lastActivityAt: new Date() } });
    }),

  // ─── Attorney Search ───────────────────────────────────────────
  "attorneys.search": publicProcedure
    .input(z.object({ practiceArea: z.string(), jurisdiction: z.string(), query: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const externalResult = await attorneyShareSearchAttorneys(input);
      const localContacts = await ctx.db.referralContact.findMany({ where: { isActive: true, practiceAreas: { contains: input.practiceArea, mode: "insensitive" } }, take: 20 });
      return { external: externalResult, local: localContacts };
    }),

  // ─── Appearances ───────────────────────────────────────────────
  "appearances.list": publicProcedure
    .input(z.object({ matterId: z.string().optional(), status: z.string().optional(), requestType: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.status) where.status = input.status;
      if (input?.requestType) where.requestType = input.requestType;
      return ctx.db.appearanceRequest.findMany({ where, orderBy: { eventDate: "desc" }, take: input?.limit || 50 });
    }),
  "appearances.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.appearanceRequest.findUniqueOrThrow({ where: { id: input.id } })),
  "appearances.create": publicProcedure
    .input(z.object({ matterId: z.string(), requestType: z.string().default("COURT_APPEARANCE"), courtName: z.string().optional(), courtAddress: z.string().optional(), caseNumber: z.string().optional(), judgeName: z.string().optional(), eventDate: z.string(), eventTime: z.string().optional(), estimatedDuration: z.number().optional(), practiceArea: z.string(), jurisdiction: z.string(), caseDescription: z.string(), specialInstructions: z.string().optional(), urgency: z.string().default("STANDARD"), budget: z.number().optional(), rateType: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const appearMeResult = await appearMePostRequest({ requestType: input.requestType, practiceArea: input.practiceArea, jurisdiction: input.jurisdiction, courtName: input.courtName, eventDate: input.eventDate, eventTime: input.eventTime, estimatedDuration: input.estimatedDuration, caseDescription: input.caseDescription, urgency: input.urgency, budget: input.budget, rateType: input.rateType });

      const req = await ctx.db.appearanceRequest.create({
        data: {
          provider: "APPEARME", matterId: input.matterId, requestType: input.requestType,
          courtName: input.courtName, courtAddress: input.courtAddress, caseNumber: input.caseNumber, judgeName: input.judgeName,
          eventDate: new Date(input.eventDate), eventTime: input.eventTime, estimatedDuration: input.estimatedDuration,
          practiceArea: input.practiceArea, jurisdiction: input.jurisdiction, caseDescription: input.caseDescription,
          specialInstructions: input.specialInstructions, urgency: input.urgency, budget: input.budget, rateType: input.rateType,
          externalRequestId: appearMeResult.success ? (appearMeResult as any).data?.requestId : undefined,
          status: appearMeResult.success ? "POSTED" : "DRAFT",
        },
      });

      // Create calendar event
      await ctx.db.calendarEvent.create({
        data: { title: `${input.requestType}: ${input.courtName || "TBD"}`, startTime: new Date(input.eventDate), endTime: new Date(new Date(input.eventDate).getTime() + (input.estimatedDuration || 2) * 60 * 60 * 1000), location: input.courtAddress, description: `AppearMe request for ${input.practiceArea}` },
      });

      return req;
    }),
  "appearances.cancel": publicProcedure
    .input(z.object({ id: z.string(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const req = await ctx.db.appearanceRequest.findUniqueOrThrow({ where: { id: input.id } });
      if (req.externalRequestId) await appearMeCancelRequest(req.externalRequestId, input.reason);
      return ctx.db.appearanceRequest.update({ where: { id: input.id }, data: { status: "CANCELLED", notes: input.reason } });
    }),
  "appearances.submitRating": publicProcedure
    .input(z.object({ id: z.string(), rating: z.number().min(1).max(5), comment: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const req = await ctx.db.appearanceRequest.findUniqueOrThrow({ where: { id: input.id } });
      if (req.externalRequestId) await appearMeSubmitRating(req.externalRequestId, input.rating, input.comment);
      return ctx.db.appearanceRequest.update({ where: { id: input.id }, data: { rating: input.rating, ratingComment: input.comment } });
    }),
  "appearances.getEstimate": publicProcedure
    .input(z.object({ requestType: z.string(), jurisdiction: z.string(), duration: z.number(), urgency: z.string() }))
    .mutation(async ({ input }) => appearMeGetEstimate(input)),

  // ─── Contacts ──────────────────────────────────────────────────
  "contacts.list": publicProcedure
    .input(z.object({ relationship: z.string().optional(), search: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = { isActive: true };
      if (input?.relationship) where.relationship = input.relationship;
      if (input?.search) where.OR = [{ name: { contains: input.search, mode: "insensitive" } }, { firmName: { contains: input.search, mode: "insensitive" } }];
      return ctx.db.referralContact.findMany({ where, orderBy: { name: "asc" }, take: input?.limit || 50 });
    }),
  "contacts.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.referralContact.findUniqueOrThrow({ where: { id: input.id } })),
  "contacts.create": publicProcedure
    .input(z.object({ name: z.string(), email: z.string().optional(), phone: z.string().optional(), firmName: z.string().optional(), barNumber: z.string().optional(), jurisdiction: z.string().optional(), practiceAreas: z.string().optional(), relationship: z.string().default("REFERRAL_PARTNER"), source: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.referralContact.create({ data: input })),
  "contacts.update": publicProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), email: z.string().optional(), phone: z.string().optional(), firmName: z.string().optional(), relationship: z.string().optional(), notes: z.string().optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => { const { id, ...data } = input; return ctx.db.referralContact.update({ where: { id }, data }); }),

  // ─── Reports ───────────────────────────────────────────────────
  "reports.overview": publicProcedure.query(async ({ ctx }) => {
    const referrals = await ctx.db.referral.findMany();
    const inbound = referrals.filter((r) => r.direction === "INBOUND");
    const outbound = referrals.filter((r) => r.direction === "OUTBOUND");
    const feesEarned = inbound.filter((r) => r.feePaidAmount).reduce((s, r) => s + Number(r.feePaidAmount), 0);
    const feesOwed = outbound.filter((r) => r.estimatedFeeAmount && !r.feePaidAmount).reduce((s, r) => s + Number(r.estimatedFeeAmount || 0), 0);
    const appearances = await ctx.db.appearanceRequest.findMany();
    const appearanceCost = appearances.reduce((s, a) => s + Number(a.totalCost || 0), 0);
    return { totalInbound: inbound.length, totalOutbound: outbound.length, feesEarned, feesOwed, totalAppearances: appearances.length, appearanceCost, pendingReview: inbound.filter((r) => r.status === "RECEIVED").length };
  }),

  // ─── Dashboard Stats ───────────────────────────────────────────
  getDashboardStats: publicProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthReferrals = await ctx.db.referral.findMany({ where: { createdAt: { gte: monthStart } } });
    const inboundMonth = monthReferrals.filter((r) => r.direction === "INBOUND").length;
    const outboundMonth = monthReferrals.filter((r) => r.direction === "OUTBOUND").length;
    const pendingReview = await ctx.db.referral.count({ where: { direction: "INBOUND", status: "RECEIVED" } });
    const activeAppearances = await ctx.db.appearanceRequest.count({ where: { status: { notIn: ["COMPLETED", "CANCELLED"] } } });

    const allReferrals = await ctx.db.referral.findMany();
    const feesEarned = allReferrals.filter((r) => r.direction === "INBOUND" && r.feePaidAmount).reduce((s, r) => s + Number(r.feePaidAmount), 0);
    const feesOwed = allReferrals.filter((r) => r.direction === "OUTBOUND" && r.estimatedFeeAmount && Number(r.feePaidAmount || 0) < Number(r.estimatedFeeAmount)).reduce((s, r) => s + Number(r.estimatedFeeAmount || 0) - Number(r.feePaidAmount || 0), 0);

    return { inboundMonth, outboundMonth, pendingReview, activeAppearances, feesEarned, feesOwed };
  }),
});
