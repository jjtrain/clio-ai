import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "@/lib/db";

const FEDERAL_EXEMPTION = 13_610_000; // 2024

async function recomputeGrossEstate(profileId: string) {
  const assets = await db.estateAsset.findMany({ where: { profileId }, select: { estimatedValue: true } });
  const total = assets.reduce((s, a) => s + Number(a.estimatedValue), 0);
  await db.estatePlanningProfile.update({ where: { id: profileId }, data: { estimatedGrossEstate: total } });
  return total;
}

async function postSystemMsg(matterId: string, body: string) {
  try {
    let thread = await db.matterThread.findUnique({ where: { matterId } });
    if (!thread) thread = await db.matterThread.create({ data: { matterId } });
    await db.matterMessage.create({ data: { threadId: thread.id, matterId, authorId: "system", body, isSystemMessage: true, systemEventType: "ESTATE_PLANNING" } });
    await db.matterThread.update({ where: { id: thread.id }, data: { lastMessageAt: new Date(), lastMessagePreview: body.slice(0, 140), messageCount: { increment: 1 } } });
  } catch {}
}

export const estatePlanningRouter = router({
  getOrCreateProfile: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      let profile = await ctx.db.estatePlanningProfile.findUnique({
        where: { matterId: input.matterId },
        include: { assets: { orderBy: [{ assetCategory: "asc" }, { sortOrder: "asc" }] }, beneficiaries: { orderBy: { createdAt: "asc" } }, allocations: true, documents: { orderBy: { createdAt: "desc" } } },
      });

      if (!profile) {
        const matter = await ctx.db.matter.findUnique({ where: { id: input.matterId }, include: { client: true } });
        profile = await ctx.db.estatePlanningProfile.create({
          data: { matterId: input.matterId, clientFullName: matter?.client?.name || "" },
          include: { assets: true, beneficiaries: true, allocations: true, documents: true },
        });
      }

      // Compute summary
      const assets = profile.assets;
      const grossEstate = assets.reduce((s, a) => s + Number(a.estimatedValue), 0);
      const totalLiabilities = assets.reduce((s, a) => s + Number(a.mortgageBalance || 0) + Number(a.liabilityAmount || 0), 0);
      const byCategory: Record<string, { count: number; totalValue: number }> = {};
      for (const a of assets) {
        if (!byCategory[a.assetCategory]) byCategory[a.assetCategory] = { count: 0, totalValue: 0 };
        byCategory[a.assetCategory].count++;
        byCategory[a.assetCategory].totalValue += Number(a.estimatedValue);
      }
      const allocatedAssetIds = new Set(profile.allocations.map((a) => a.assetId));
      const unallocatedAssets = assets.filter((a) => !allocatedAssetIds.has(a.id));

      return {
        ...profile,
        summary: {
          totalAssets: assets.length,
          grossEstateValue: grossEstate,
          totalLiabilities,
          netEstateValue: grossEstate - totalLiabilities,
          assetsByCategory: byCategory,
          federalEstateTaxExposure: grossEstate > FEDERAL_EXEMPTION,
          unallocatedAssets: unallocatedAssets.length,
        },
      };
    }),

  updateProfile: publicProcedure
    .input(z.object({ id: z.string(), data: z.record(z.any()) }))
    .mutation(async ({ ctx, input }) => {
      const clean = { ...input.data };
      if (clean.clientDOB) clean.clientDOB = new Date(clean.clientDOB);
      if (clean.spouseDOB) clean.spouseDOB = new Date(clean.spouseDOB);
      return ctx.db.estatePlanningProfile.update({ where: { id: input.id }, data: clean });
    }),

  addAsset: publicProcedure
    .input(z.object({
      profileId: z.string(), matterId: z.string(), assetCategory: z.string(), description: z.string(),
      assetSubtype: z.string().optional(), institutionName: z.string().optional(), accountNumberLast4: z.string().optional(),
      titleHolder: z.string().optional(), titleHolderDetail: z.string().optional(),
      estimatedValue: z.number().min(0), valuationDate: z.string().optional(), valuationMethod: z.string().optional(),
      hasDesignatedBeneficiary: z.boolean().optional(), primaryBeneficiary: z.string().optional(), contingentBeneficiary: z.string().optional(),
      isRetirement: z.boolean().optional(), mortgageBalance: z.number().optional(), liabilityAmount: z.number().optional(),
      liabilityDescription: z.string().optional(), propertyAddress: z.string().optional(), propertyState: z.string().optional(),
      annualIncome: z.number().optional(), notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const isRetirement = input.isRetirement || ["RETIREMENT_ACCOUNT"].includes(input.assetCategory);
      const asset = await ctx.db.estateAsset.create({
        data: { ...input, valuationDate: input.valuationDate ? new Date(input.valuationDate) : null, isRetirement },
      });
      await recomputeGrossEstate(input.profileId);
      return asset;
    }),

  updateAsset: publicProcedure
    .input(z.object({ id: z.string(), data: z.record(z.any()) }))
    .mutation(async ({ ctx, input }) => {
      const clean = { ...input.data };
      if (clean.valuationDate) clean.valuationDate = new Date(clean.valuationDate);
      const asset = await ctx.db.estateAsset.update({ where: { id: input.id }, data: clean });
      await recomputeGrossEstate(asset.profileId);
      return asset;
    }),

  deleteAsset: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const allocs = await ctx.db.estateAllocation.findMany({ where: { assetId: input.id }, include: { beneficiary: true } });
      if (allocs.length > 0) throw new Error(`Cannot delete: asset is allocated to ${allocs.map((a) => a.beneficiary.name).join(", ")}. Remove allocations first.`);
      const asset = await ctx.db.estateAsset.delete({ where: { id: input.id } });
      await recomputeGrossEstate(asset.profileId);
      return asset;
    }),

  reorderAssets: publicProcedure
    .input(z.object({ updates: z.array(z.object({ id: z.string(), sortOrder: z.number() })) }))
    .mutation(async ({ ctx, input }) => {
      await Promise.all(input.updates.map((u) => ctx.db.estateAsset.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } })));
      return { success: true };
    }),

  addBeneficiary: publicProcedure
    .input(z.object({ profileId: z.string(), name: z.string(), relationship: z.string(), relationshipDetail: z.string().optional(), dob: z.string().optional(), isMinor: z.boolean().optional(), hasSpecialNeeds: z.boolean().optional(), sharePercentage: z.number().optional(), shareDescription: z.string().optional(), isTrustee: z.boolean().optional(), isExecutor: z.boolean().optional(), isPOAAgent: z.boolean().optional(), isHealthcareProxy: z.boolean().optional(), address: z.string().optional(), email: z.string().optional(), phone: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.estateBeneficiary.create({ data: { ...input, dob: input.dob ? new Date(input.dob) : null } })),

  updateBeneficiary: publicProcedure
    .input(z.object({ id: z.string(), data: z.record(z.any()) }))
    .mutation(async ({ ctx, input }) => { const clean = { ...input.data }; if (clean.dob) clean.dob = new Date(clean.dob); return ctx.db.estateBeneficiary.update({ where: { id: input.id }, data: clean }); }),

  removeBeneficiary: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const allocs = await ctx.db.estateAllocation.count({ where: { beneficiaryId: input.id } });
      if (allocs > 0) throw new Error(`Cannot remove: ${allocs} allocation(s) reference this beneficiary.`);
      return ctx.db.estateBeneficiary.delete({ where: { id: input.id } });
    }),

  addAllocation: publicProcedure
    .input(z.object({ assetId: z.string(), beneficiaryId: z.string(), profileId: z.string(), dispositionType: z.string(), percentage: z.number().optional(), amount: z.number().optional(), conditions: z.string().optional(), trustName: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (input.percentage) {
        const existing = await ctx.db.estateAllocation.findMany({ where: { assetId: input.assetId }, select: { percentage: true } });
        const total = existing.reduce((s, a) => s + Number(a.percentage || 0), 0) + input.percentage;
        if (total > 100) throw new Error(`Total allocation for this asset would be ${total}% (max 100%).`);
      }
      return ctx.db.estateAllocation.create({ data: input });
    }),

  updateAllocation: publicProcedure
    .input(z.object({ id: z.string(), data: z.record(z.any()) }))
    .mutation(async ({ ctx, input }) => ctx.db.estateAllocation.update({ where: { id: input.id }, data: input.data })),

  removeAllocation: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.estateAllocation.delete({ where: { id: input.id } })),

  detectGaps: publicProcedure
    .input(z.object({ profileId: z.string(), matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      const profile = await ctx.db.estatePlanningProfile.findUniqueOrThrow({
        where: { id: input.profileId },
        include: { assets: true, beneficiaries: true, allocations: true },
      });
      const gaps: Array<{ severity: string; category: string; description: string; recommendation: string }> = [];

      if (!profile.healthcareProxyName) gaps.push({ severity: "HIGH", category: "Fiduciary", description: "No healthcare proxy named", recommendation: "Designate a healthcare agent to make medical decisions if you're incapacitated" });
      if (!profile.poaAgentName) gaps.push({ severity: "HIGH", category: "Fiduciary", description: "No power of attorney agent named", recommendation: "Designate a POA agent for financial and legal matters" });

      const retirementNobenef = profile.assets.filter((a) => a.isRetirement && !a.hasDesignatedBeneficiary);
      for (const a of retirementNobenef) gaps.push({ severity: "HIGH", category: "Beneficiary", description: `Retirement account "${a.description}" has no beneficiary designation`, recommendation: "Contact the custodian to name a primary and contingent beneficiary" });

      const minorDirect = profile.beneficiaries.filter((b) => b.isMinor);
      for (const b of minorDirect) {
        const hasAlloc = profile.allocations.some((a) => a.beneficiaryId === b.id);
        if (hasAlloc && !profile.planType.includes("TRUST")) {
          gaps.push({ severity: "HIGH", category: "Minor", description: `Minor child "${b.name}" is a direct beneficiary with no trust provision`, recommendation: "Consider a trust for minor beneficiaries to manage assets until they reach a specified age" });
        }
      }

      const realEstateNoTitle = profile.assets.filter((a) => a.assetCategory === "REAL_ESTATE" && a.titleHolder === "CLIENT");
      for (const a of realEstateNoTitle) gaps.push({ severity: "MEDIUM", category: "Title", description: `Real estate "${a.description}" titled in individual name`, recommendation: "Consider transferring to a revocable trust or adding transfer-on-death deed" });

      const grossEstate = profile.assets.reduce((s, a) => s + Number(a.estimatedValue), 0);
      if (grossEstate > FEDERAL_EXEMPTION * 0.8) gaps.push({ severity: "MEDIUM", category: "Tax", description: "Gross estate within 20% of federal exemption", recommendation: "Review estate tax reduction strategies (gifting, irrevocable trusts, charitable planning)" });

      if (profile.planType.includes("TRUST") && !profile.assets.some((a) => a.titleHolder === "TRUST")) {
        gaps.push({ severity: "HIGH", category: "Funding", description: "Trust plan selected but no assets titled in trust", recommendation: "Fund the trust by retitling assets — an unfunded trust provides no probate avoidance" });
      }

      const allocatedIds = new Set(profile.allocations.map((a) => a.assetId));
      const unallocated = profile.assets.filter((a) => !allocatedIds.has(a.id));
      if (unallocated.length > 0) gaps.push({ severity: "MEDIUM", category: "Allocation", description: `${unallocated.length} asset(s) have no beneficiary allocation`, recommendation: "Review and assign disposition for all assets" });

      const businessAssets = profile.assets.filter((a) => a.assetCategory === "BUSINESS_INTEREST");
      for (const a of businessAssets) {
        const hasAlloc = profile.allocations.some((al) => al.assetId === a.id);
        if (!hasAlloc) gaps.push({ severity: "MEDIUM", category: "Business", description: `Business interest "${a.description}" has no succession plan`, recommendation: "Create a buy-sell agreement or succession plan for business interests" });
      }

      // Auto-create tasks for HIGH gaps
      for (const gap of gaps.filter((g) => g.severity === "HIGH")) {
        const title = `Review: ${gap.description}`;
        const existing = await ctx.db.task.findFirst({ where: { matterId: input.matterId, title } });
        if (!existing) {
          await ctx.db.task.create({ data: { matterId: input.matterId, title, description: gap.recommendation, dueDate: new Date(Date.now() + 30 * 86400000), priority: "LOW", status: "NOT_STARTED" } });
        }
      }

      return gaps;
    }),

  generateSummaryMemo: publicProcedure
    .input(z.object({ profileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const profile = await ctx.db.estatePlanningProfile.findUniqueOrThrow({
        where: { id: input.profileId },
        include: { assets: { orderBy: [{ assetCategory: "asc" }, { sortOrder: "asc" }] }, beneficiaries: true, allocations: { include: { asset: true, beneficiary: true } } },
      });

      const grossEstate = profile.assets.reduce((s, a) => s + Number(a.estimatedValue), 0);
      const memo = {
        client: { name: profile.clientFullName, dob: profile.clientDOB, domicile: profile.domicileState, maritalStatus: profile.maritalStatus, spouse: profile.spouseName },
        planType: profile.planType,
        primaryGoals: profile.primaryGoals,
        fiduciaries: { executor: profile.beneficiaries.find((b) => b.isExecutor)?.name, trustee: profile.successorTrusteeName, poaAgent: profile.poaAgentName, healthcareProxy: profile.healthcareProxyName },
        assetsByCategory: {} as Record<string, any[]>,
        grossEstate, netEstate: grossEstate - profile.assets.reduce((s, a) => s + Number(a.mortgageBalance || 0) + Number(a.liabilityAmount || 0), 0),
        beneficiaries: profile.beneficiaries,
        allocations: profile.allocations,
        dependents: profile.dependents,
        generatedAt: new Date().toISOString(),
      };

      for (const a of profile.assets) {
        if (!memo.assetsByCategory[a.assetCategory]) memo.assetsByCategory[a.assetCategory] = [];
        memo.assetsByCategory[a.assetCategory].push(a);
      }

      const doc = await ctx.db.estateDocument.create({
        data: { profileId: input.profileId, matterId: profile.matterId, documentType: "SUMMARY_MEMO", title: `Estate Planning Summary — ${profile.clientFullName}`, status: "DRAFT", generatedData: memo as any },
      });

      await postSystemMsg(profile.matterId, `Estate planning summary memo generated — ${profile.assets.length} assets, gross estate $${Math.round(grossEstate).toLocaleString()}`);

      return { document: doc, memo };
    }),

  assembleDocument: publicProcedure
    .input(z.object({ profileId: z.string(), documentType: z.string(), templateId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const profile = await ctx.db.estatePlanningProfile.findUniqueOrThrow({
        where: { id: input.profileId },
        include: { assets: true, beneficiaries: true, allocations: { include: { asset: true, beneficiary: true } } },
      });
      const data = { profile, assets: profile.assets, beneficiaries: profile.beneficiaries, allocations: profile.allocations, generatedAt: new Date().toISOString() };
      return ctx.db.estateDocument.create({
        data: { profileId: input.profileId, matterId: profile.matterId, documentType: input.documentType, title: `${input.documentType.replace(/_/g, " ")} — ${profile.clientFullName}`, status: "DRAFT", templateId: input.templateId, generatedData: data as any },
      });
    }),
});
