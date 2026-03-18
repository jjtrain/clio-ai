import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import * as tracers from "@/lib/integrations/tracers";
import * as sonar from "@/lib/integrations/sonar";
import * as mediascope from "@/lib/integrations/mediascope";
import * as engine from "@/lib/investigations-engine";
import { db } from "@/lib/db";

// ─── Helpers ────────────────────────────────────────────────────

function tracersProcedure(
  searchType: string,
  fn: (input: any) => Promise<any>,
) {
  return publicProcedure
    .input(z.object({ matterId: z.string().optional() }).passthrough())
    .mutation(async ({ input }) => {
      return engine.runSearch({
        searchType: searchType,
        subject: (input as any).firstName ? `${(input as any).firstName} ${(input as any).lastName}` : (input as any).businessName || (input as any).phone || (input as any).email || "Unknown",
        matterId: input.matterId,
        inputs: input,
      });
    });
}

// ─── Router ─────────────────────────────────────────────────────

export const investigationsRouter = router({
  // ── Settings (4) ────────────────────────────────────────────

  settings: router({
    list: publicProcedure.query(async () => {
      return db.investigationsIntegration.findMany();
    }),

    get: publicProcedure
      .input(z.object({ provider: z.enum(["TRACERS", "SONAR", "MEDIASCOPE"]) }))
      .query(async ({ input }) => {
        return db.investigationsIntegration.findUnique({ where: { provider: input.provider } });
      }),

    update: publicProcedure
      .input(z.object({
        provider: z.enum(["TRACERS", "SONAR", "MEDIASCOPE"]),
        isEnabled: z.boolean().optional(),
        displayName: z.string().optional(),
        apiKey: z.string().optional(),
        apiSecret: z.string().optional(),
        baseUrl: z.string().optional(),
        accountId: z.string().optional(),
        userId: z.string().optional(),
        webhookUrl: z.string().optional(),
        webhookSecret: z.string().optional(),
        autoSearchOnNewMatter: z.boolean().optional(),
        autoSearchOnConflictCheck: z.boolean().optional(),
        defaultSearchDepth: z.string().optional(),
        settings: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { provider, ...data } = input;
        return db.investigationsIntegration.upsert({
          where: { provider },
          update: data,
          create: { provider, displayName: provider, ...data },
        });
      }),

    test: publicProcedure
      .input(z.object({ provider: z.enum(["TRACERS", "SONAR", "MEDIASCOPE"]) }))
      .mutation(async ({ input }) => {
        if (input.provider === "TRACERS") return tracers.testConnection();
        if (input.provider === "SONAR") return sonar.testConnection();
        return mediascope.testConnection();
      }),
  }),

  // ── Searches (8) ───────────────────────────────────────────

  searches: router({
    list: publicProcedure
      .input(z.object({
        provider: z.enum(["TRACERS", "SONAR", "MEDIASCOPE"]).optional(),
        searchType: z.string().optional(),
        status: z.string().optional(),
        matterId: z.string().optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const f = input ?? {};
        return db.investigationSearch.findMany({
          where: {
            ...(f.provider && { provider: f.provider }),
            ...(f.searchType && { searchType: f.searchType as any }),
            ...(f.status && { status: f.status as any }),
            ...(f.matterId && { matterId: f.matterId }),
            ...(f.search && { searchSubject: { contains: f.search } }),
          },
          include: { matter: true },
          orderBy: { createdAt: "desc" },
        });
      }),

    get: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        return db.investigationSearch.findUniqueOrThrow({
          where: { id: input.id },
          include: { matter: true, personRecords: true, visualAssetMatches: true },
        });
      }),

    run: publicProcedure
      .input(z.object({
        searchType: z.string(),
        matterId: z.string().optional(),
        inputs: z.any(),
      }))
      .mutation(async ({ input }) => {
        return engine.runSearch(input as any);
      }),

    runComprehensive: publicProcedure
      .input(z.object({
        firstName: z.string(),
        lastName: z.string(),
        state: z.string().optional(),
        dob: z.string().optional(),
        matterId: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return engine.runComprehensivePersonSearch({ subject: `${input.firstName} ${input.lastName}`, inputs: input, matterId: input.matterId });
      }),

    getSummary: publicProcedure
      .input(z.object({ searchId: z.string() }))
      .query(async ({ input }) => {
        const search = await db.investigationSearch.findUniqueOrThrow({ where: { id: input.searchId } });
        if (!search.resultSummary) {
          return engine.generateSearchSummary(input.searchId);
        }
        return search.resultSummary;
      }),

    saveToMatter: publicProcedure
      .input(z.object({ searchId: z.string(), matterId: z.string() }))
      .mutation(async ({ input }) => {
        return db.investigationSearch.update({
          where: { id: input.searchId },
          data: { isSavedToMatter: true, matterId: input.matterId },
        });
      }),

    getHistory: publicProcedure.query(async () => {
      return db.investigationSearch.findMany({ orderBy: { createdAt: "desc" } });
    }),

    getCredits: publicProcedure.query(async () => {
      return tracers.getCreditsBalance();
    }),
  }),

  // ── Person Records (6) ────────────────────────────────────

  persons: router({
    list: publicProcedure
      .input(z.object({
        matterId: z.string().optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const f = input ?? {};
        return db.personRecord.findMany({
          where: {
            ...(f.matterId && { matterId: f.matterId }),
            ...(f.search && { fullName: { contains: f.search } }),
          },
          include: { search: true, matter: true },
        });
      }),

    get: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        return db.personRecord.findUniqueOrThrow({ where: { id: input.id } });
      }),

    getDossier: publicProcedure
      .input(z.object({ personRecordId: z.string() }))
      .query(async ({ input }) => {
        return engine.getSubjectDossier(input.personRecordId);
      }),

    crossReference: publicProcedure
      .input(z.object({ personRecordId: z.string(), matterId: z.string() }))
      .mutation(async ({ input }) => {
        return engine.crossReferenceWithMatter(input.personRecordId, input.matterId);
      }),

    enrichClient: publicProcedure
      .input(z.object({ clientId: z.string() }))
      .mutation(async ({ input }) => {
        return engine.enrichClientProfile(input.clientId);
      }),

    enrichOpposingParty: publicProcedure
      .input(z.object({ matterId: z.string(), partyName: z.string() }))
      .mutation(async ({ input }) => {
        return engine.enrichOpposingParty(input.matterId, input.partyName);
      }),
  }),

  // ── Tracers (19) ──────────────────────────────────────────

  tracers: router({
    personSearch: tracersProcedure("PERSON_LOCATE", tracers.personSearch),

    skipTrace: tracersProcedure("SKIP_TRACE", tracers.skipTrace),

    assetSearch: tracersProcedure("ASSET_SEARCH", tracers.assetSearch),

    backgroundCheck: tracersProcedure("BACKGROUND_CHECK", tracers.backgroundCheck),

    criminalRecords: tracersProcedure("CRIMINAL_RECORDS", tracers.criminalSearch),

    courtRecords: tracersProcedure("COURT_RECORDS", tracers.courtRecords),

    bankruptcy: tracersProcedure("BANKRUPTCY", tracers.bankruptcySearch),

    liensJudgments: tracersProcedure("LIENS_JUDGMENTS", tracers.liensJudgments),

    propertyRecords: tracersProcedure("PROPERTY_RECORDS", tracers.propertySearch),

    vehicleRecords: tracersProcedure("VEHICLE_RECORDS", tracers.vehicleSearch),

    businessSearch: tracersProcedure("BUSINESS_SEARCH", tracers.businessSearch),

    uccFilings: tracersProcedure("UCC_FILINGS", tracers.uccSearch),

    phoneLookup: tracersProcedure("PHONE_LOOKUP", tracers.phoneLookup as any),

    emailLookup: tracersProcedure("EMAIL_LOOKUP", tracers.emailLookup as any),

    addressHistory: tracersProcedure("ADDRESS_HISTORY", tracers.addressHistory),

    deathRecords: tracersProcedure("DEATH_RECORDS", tracers.deathSearch),

    professionalLicense: tracersProcedure("PROFESSIONAL_LICENSE", tracers.professionalLicense),

    comprehensive: tracersProcedure("COMPREHENSIVE", tracers.comprehensiveSearch),
  }),

  // ── Sonar (9) ─────────────────────────────────────────────

  sonar: router({
    identify: publicProcedure
      .input(z.object({ name: z.string(), phone: z.string().optional(), email: z.string().optional(), jurisdiction: z.string().optional(), matterId: z.string().optional() }))
      .mutation(async ({ input }) => sonar.identifyProspect(input)),

    searchIncidents: publicProcedure
      .input(z.object({ type: z.string().optional(), jurisdiction: z.string().optional(), keywords: z.string().optional() }))
      .query(async ({ input }) => sonar.searchIncidents(input)),

    getIncident: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => sonar.getIncidentDetail(input.id)),

    searchByPhone: publicProcedure
      .input(z.object({ phone: z.string() }))
      .mutation(async ({ input }) => sonar.searchByPhone(input)),

    searchByAddress: publicProcedure
      .input(z.object({ address: z.string(), city: z.string().optional(), state: z.string().optional(), radius: z.number().optional() }))
      .mutation(async ({ input }) => sonar.searchByAddress(input)),

    getPersonReport: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => sonar.getPersonReport(input.id)),

    getLeadScore: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => sonar.getLeadScore(input.id)),

    convertToLead: publicProcedure
      .input(z.object({ personId: z.string(), name: z.string(), email: z.string().optional(), phone: z.string().optional(), notes: z.string().optional() }))
      .mutation(async ({ input }) => {
        await sonar.convertToLead(input.personId);
        const lead = await db.lead.create({ data: { name: input.name, email: input.email, phone: input.phone, source: "OTHER", notes: input.notes || "Converted from Sonar" } });
        return lead;
      }),

    marketInsights: publicProcedure
      .input(z.object({ jurisdiction: z.string().optional(), practiceArea: z.string().optional() }).optional())
      .query(async () => sonar.getMarketInsights()),
  }),

  // ── Mediascope (13) ───────────────────────────────────────

  mediascope: router({
    searchByImage: publicProcedure
      .input(z.object({ imageUrl: z.string(), matterId: z.string().optional() }))
      .mutation(async ({ input }) => mediascope.searchByImage(input)),

    searchLogo: publicProcedure
      .input(z.object({ logoUrl: z.string().optional(), brandName: z.string().optional(), matterId: z.string().optional() }))
      .mutation(async ({ input }) => mediascope.searchLogo(input)),

    searchTrademark: publicProcedure
      .input(z.object({ wordMark: z.string().optional(), registrationNumber: z.string().optional(), matterId: z.string().optional() }))
      .mutation(async ({ input }) => mediascope.searchTrademark(input)),

    searchProduct: publicProcedure
      .input(z.object({ productName: z.string().optional(), category: z.string().optional(), matterId: z.string().optional() }))
      .mutation(async ({ input }) => mediascope.searchProduct(input)),

    startMonitoring: publicProcedure
      .input(z.object({ assetType: z.string(), assetUrl: z.string().optional(), brandName: z.string().optional(), frequency: z.string().default("daily"), matterId: z.string().optional() }))
      .mutation(async ({ input }) => mediascope.startMonitoring(input)),

    stopMonitoring: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => mediascope.stopMonitoring(input.id)),

    reviewMatch: publicProcedure
      .input(z.object({ matchId: z.string(), status: z.enum(["REVIEWED", "CONFIRMED_INFRINGEMENT", "FALSE_POSITIVE", "TAKEDOWN_REQUESTED", "TAKEDOWN_COMPLETED", "MONITORING"]), reviewNotes: z.string().optional(), reviewedBy: z.string().optional() }))
      .mutation(async ({ input }) => db.visualAssetMatch.update({ where: { id: input.matchId }, data: { status: input.status, reviewNotes: input.reviewNotes, reviewedBy: input.reviewedBy, reviewedAt: new Date() } })),

    getInfringementReport: publicProcedure
      .input(z.object({ matterId: z.string() }))
      .query(async ({ input }) => engine.generateVisualAssetReport(input.matterId)),

    estimateDamages: publicProcedure
      .input(z.object({ matterId: z.string() }))
      .mutation(async ({ input }) => engine.estimateInfringementDamages(input.matterId)),

    generateTakedown: publicProcedure
      .input(z.object({ matchId: z.string() }))
      .mutation(async ({ input }) => mediascope.generateTakedownNotice(input.matchId)),

    getTakedownTemplates: publicProcedure.query(async () => mediascope.getTakedownTemplates()),

    marketplaceAnalytics: publicProcedure.query(async () => mediascope.getMarketplaceAnalytics()),
  }),

  // ── Visual Matches (5) ───────────────────────────────────

  matches: router({
    list: publicProcedure
      .input(z.object({
        searchId: z.string().optional(),
        matterId: z.string().optional(),
        status: z.enum(["NEW", "REVIEWED", "CONFIRMED_INFRINGEMENT", "FALSE_POSITIVE", "TAKEDOWN_REQUESTED", "TAKEDOWN_COMPLETED", "MONITORING"]).optional(),
        matchType: z.string().optional(),
        platform: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const f = input ?? {};
        return db.visualAssetMatch.findMany({
          where: {
            ...(f.searchId && { searchId: f.searchId }),
            ...(f.matterId && { matterId: f.matterId }),
            ...(f.status && { status: f.status }),
            ...(f.matchType && { matchType: f.matchType as any }),
            ...(f.platform && { platform: f.platform }),
          },
          include: { search: true, matter: true },
          orderBy: { createdAt: "desc" },
        });
      }),

    get: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        return db.visualAssetMatch.findUniqueOrThrow({
          where: { id: input.id },
          include: { search: true, matter: true },
        });
      }),

    review: publicProcedure
      .input(z.object({
        id: z.string(),
        status: z.enum(["REVIEWED", "CONFIRMED_INFRINGEMENT", "FALSE_POSITIVE", "TAKEDOWN_REQUESTED", "TAKEDOWN_COMPLETED", "MONITORING"]),
        reviewNotes: z.string().optional(),
        reviewedBy: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.visualAssetMatch.update({
          where: { id: input.id },
          data: {
            status: input.status,
            reviewNotes: input.reviewNotes,
            reviewedBy: input.reviewedBy,
            reviewedAt: new Date(),
          },
        });
      }),

    bulkReview: publicProcedure
      .input(z.object({
        ids: z.array(z.string()),
        status: z.enum(["REVIEWED", "CONFIRMED_INFRINGEMENT", "FALSE_POSITIVE", "TAKEDOWN_REQUESTED", "TAKEDOWN_COMPLETED", "MONITORING"]),
        reviewedBy: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.visualAssetMatch.updateMany({
          where: { id: { in: input.ids } },
          data: {
            status: input.status,
            reviewedBy: input.reviewedBy,
            reviewedAt: new Date(),
          },
        });
      }),

    generateTakedownPackage: publicProcedure
      .input(z.object({ matchIds: z.array(z.string()) }))
      .mutation(async ({ input }) => {
        return engine.generateTakedownPackage(input.matchIds);
      }),
  }),

  // ── Monitoring (7) ────────────────────────────────────────

  monitoring: router({
    subscriptions: router({
      list: publicProcedure
        .input(z.object({
          matterId: z.string().optional(),
          clientId: z.string().optional(),
          isActive: z.boolean().optional(),
          monitoringType: z.string().optional(),
        }).optional())
        .query(async ({ input }) => {
          const f = input ?? {};
          return db.monitoringSubscription.findMany({
            where: {
              ...(f.matterId && { matterId: f.matterId }),
              ...(f.clientId && { clientId: f.clientId }),
              ...(f.isActive !== undefined && { isActive: f.isActive }),
              ...(f.monitoringType && { monitoringType: f.monitoringType }),
            },
            orderBy: { createdAt: "desc" },
          });
        }),

      create: publicProcedure
        .input(z.object({
          type: z.enum(["person", "visual_asset"]),
          subject: z.string(),
          subjectDetails: z.any().optional(),
          matterId: z.string().optional(),
          clientId: z.string().optional(),
          frequency: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
          if (input.type === "person") {
            return engine.monitorPerson({ subject: input.subject, subjectDetails: input.subjectDetails || {}, matterId: input.matterId, clientId: input.clientId, frequency: input.frequency });
          }
          return engine.monitorVisualAsset({ assetName: input.subject, assetDetails: input.subjectDetails || {}, matterId: input.matterId, frequency: input.frequency });
        }),

      stop: publicProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
          return db.monitoringSubscription.update({
            where: { id: input.id },
            data: { isActive: false },
          });
        }),
    }),

    alerts: router({
      list: publicProcedure
        .input(z.object({
          matterId: z.string().optional(),
          monitoringType: z.string().optional(),
          severity: z.enum(["INFO", "WARNING", "CRITICAL"]).optional(),
          isRead: z.boolean().optional(),
          isDismissed: z.boolean().optional(),
        }).optional())
        .query(async ({ input }) => {
          const f = input ?? {};
          return db.monitoringAlert.findMany({
            where: {
              ...(f.matterId && { matterId: f.matterId }),
              ...(f.monitoringType && { monitoringType: f.monitoringType as any }),
              ...(f.severity && { severity: f.severity }),
              ...(f.isRead !== undefined && { isRead: f.isRead }),
              ...(f.isDismissed !== undefined && { isDismissed: f.isDismissed }),
            },
            orderBy: { createdAt: "desc" },
          });
        }),

      get: publicProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input }) => {
          return db.monitoringAlert.findUniqueOrThrow({ where: { id: input.id } });
        }),

      acknowledge: publicProcedure
        .input(z.object({ id: z.string(), actionTaken: z.string().optional() }))
        .mutation(async ({ input }) => {
          return db.monitoringAlert.update({
            where: { id: input.id },
            data: { isRead: true, actionTaken: input.actionTaken },
          });
        }),

      dismiss: publicProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
          return db.monitoringAlert.update({
            where: { id: input.id },
            data: { isDismissed: true },
          });
        }),
    }),
  }),

  // ── Reports (7) ───────────────────────────────────────────

  reports: router({
    overview: publicProcedure
      .input(z.object({ from: z.string().optional(), to: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const dateRange = input?.from && input?.to ? { from: new Date(input.from), to: new Date(input.to) } : undefined;
        return engine.getInvestigationStats(dateRange);
      }),

    personDossier: publicProcedure
      .input(z.object({ personRecordId: z.string() }))
      .query(async ({ input }) => {
        return engine.getSubjectDossier(input.personRecordId);
      }),

    infringement: publicProcedure
      .input(z.object({ matterId: z.string() }))
      .query(async ({ input }) => {
        return engine.generateVisualAssetReport(input.matterId);
      }),

    damages: publicProcedure
      .input(z.object({ matterId: z.string() }))
      .query(async ({ input }) => {
        return engine.estimateInfringementDamages(input.matterId);
      }),

    searchHistory: publicProcedure
      .input(z.object({
        matterId: z.string().optional(),
        provider: z.enum(["TRACERS", "SONAR", "MEDIASCOPE"]).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const f = input ?? {};
        const searches = await db.investigationSearch.findMany({
          where: {
            ...(f.matterId && { matterId: f.matterId }),
            ...(f.provider && { provider: f.provider }),
            ...(f.from || f.to ? {
              createdAt: {
                ...(f.from && { gte: new Date(f.from) }),
                ...(f.to && { lte: new Date(f.to) }),
              },
            } : {}),
          },
          orderBy: { createdAt: "desc" },
        });
        const byProvider = { TRACERS: 0, SONAR: 0, MEDIASCOPE: 0 };
        const byType: Record<string, number> = {};
        const byStatus: Record<string, number> = {};
        for (const s of searches) {
          byProvider[s.provider]++;
          byType[s.searchType] = (byType[s.searchType] || 0) + 1;
          byStatus[s.status] = (byStatus[s.status] || 0) + 1;
        }
        return { total: searches.length, byProvider, byType, byStatus, searches };
      }),

    monitoringSummary: publicProcedure
      .input(z.object({ matterId: z.string().optional() }).optional())
      .query(async ({ input }) => {
        const f = input ?? {};
        const [subscriptions, alerts] = await Promise.all([
          db.monitoringSubscription.findMany({
            where: { ...(f.matterId && { matterId: f.matterId }) },
          }),
          db.monitoringAlert.findMany({
            where: { ...(f.matterId && { matterId: f.matterId }) },
            orderBy: { createdAt: "desc" },
          }),
        ]);
        return {
          activeSubscriptions: subscriptions.filter((s) => s.isActive).length,
          totalSubscriptions: subscriptions.length,
          totalAlerts: alerts.length,
          unreadAlerts: alerts.filter((a) => !a.isRead).length,
          criticalAlerts: alerts.filter((a) => a.severity === "CRITICAL" && !a.isDismissed).length,
          subscriptions,
          alerts,
        };
      }),

    export: publicProcedure
      .input(z.object({
        type: z.enum(["searches", "persons", "matches", "alerts"]),
        matterId: z.string().optional(),
        format: z.enum(["json", "csv"]).optional(),
      }))
      .query(async ({ input }) => {
        return { message: `Export ${input.type} report in ${input.format || "json"} format`, status: "pending" };
      }),
  }),
});
