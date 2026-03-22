import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";
import * as aiRouter from "@/lib/ai-router";

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const COURT_TYPE = ["CT_STATE_SUPREME", "CT_STATE_FAMILY", "CT_STATE_CIVIL", "CT_STATE_CRIMINAL", "CT_STATE_SURROGATE", "CT_STATE_APPELLATE", "CT_FEDERAL_DISTRICT", "CT_FEDERAL_CIRCUIT", "CT_FEDERAL_BANKRUPTCY", "CT_FEDERAL_MAGISTRATE", "CT_SMALL_CLAIMS", "CT_TOWN_VILLAGE", "CT_HOUSING", "CT_TAX", "CT_WORKERS_COMP", "CT_OTHER"] as const;
const EFILING_SYSTEM = ["EFS_NYSCEF", "EFS_ECF_PACER", "EFS_FILE_AND_SERVE", "EFS_ODYSSEY", "EFS_TYLER", "EFS_NONE", "EFS_OTHER"] as const;
const FILING_RULE_CATEGORY = ["FRC_DOCUMENT_FORMAT", "FRC_FILING_PROCEDURE", "FRC_SERVICE_REQUIREMENT", "FRC_SCHEDULING", "FRC_MOTION_PRACTICE", "FRC_DISCOVERY", "FRC_TRIAL", "FRC_APPEARANCE", "FRC_PAYMENT", "FRC_EFILING", "FRC_JUDGE_SPECIFIC", "FRC_LOCAL_RULE", "FRC_COURTESY_COPY", "FRC_ENDORSEMENT", "FRC_OTHER"] as const;
const RULE_SEVERITY = ["RS_REQUIRED", "RS_RECOMMENDED", "RS_INFORMATIONAL", "RS_WARNING"] as const;
const REMINDER_TIMING = ["RT_AT_FILING", "RT_BEFORE_FILING", "RT_AT_MATTER_CREATION", "RT_AT_COURT_ASSIGNMENT", "RT_ALWAYS_VISIBLE"] as const;
const REMINDER_STATUS = ["RMS_PENDING", "RMS_ACKNOWLEDGED", "RMS_COMPLETED", "RMS_DISMISSED", "RMS_OVERRIDDEN"] as const;

export const courtRulesRouter = router({
  // ─── Courts (1-8) ────────────────────────────────────────────────

  "courts.list": publicProcedure
    .input(z.object({
      courtType: z.string().optional(),
      state: z.string().optional(),
      county: z.string().optional(),
      jurisdiction: z.string().optional(),
      isActive: z.boolean().optional(),
      limit: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.courtType) where.courtType = input.courtType;
      if (input?.state) where.state = input.state;
      if (input?.county) where.county = input.county;
      if (input?.jurisdiction) where.jurisdiction = input.jurisdiction;
      if (input?.isActive !== undefined) where.isActive = input.isActive;
      return ctx.db.court.findMany({
        where, include: { _count: { select: { courtFilingRules: true, judgeProfiles: true, courtAssignments: true } } },
        orderBy: { name: "asc" }, take: input?.limit || 50,
      });
    }),

  "courts.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.court.findUnique({ where: { id: input.id }, include: { courtFilingRules: true, judgeProfiles: true } });
    }),

  "courts.create": publicProcedure
    .input(z.object({
      name: z.string().min(1), shortName: z.string().optional(), courtType: z.string(),
      jurisdiction: z.string(), jurisdictionId: z.string().optional(), county: z.string().optional(),
      state: z.string(), address: z.string().optional(), city: z.string().optional(), zip: z.string().optional(),
      phone: z.string().optional(), fax: z.string().optional(), website: z.string().optional(),
      efilingSystem: z.string().optional(), efilingUrl: z.string().optional(),
      efilingMandatory: z.boolean().optional(), efilingExemptions: z.string().optional(),
      clerkName: z.string().optional(), clerkPhone: z.string().optional(), clerkEmail: z.string().optional(),
      clerkHours: z.string().optional(), filingHours: z.string().optional(), filingFees: z.string().optional(),
      paymentMethods: z.string().optional(), specialInstructions: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.court.create({ data: { ...input, slug: slug(input.name), courtType: input.courtType as any, efilingSystem: input.efilingSystem as any } });
    }),

  "courts.update": publicProcedure
    .input(z.object({
      id: z.string(), name: z.string().optional(), shortName: z.string().optional(),
      courtType: z.string().optional(), jurisdiction: z.string().optional(),
      county: z.string().optional(), state: z.string().optional(), address: z.string().optional(),
      city: z.string().optional(), zip: z.string().optional(), phone: z.string().optional(),
      fax: z.string().optional(), website: z.string().optional(), efilingSystem: z.string().optional(),
      efilingUrl: z.string().optional(), efilingMandatory: z.boolean().optional(),
      efilingExemptions: z.string().optional(), clerkName: z.string().optional(), clerkPhone: z.string().optional(),
      clerkEmail: z.string().optional(), clerkHours: z.string().optional(), filingHours: z.string().optional(),
      filingFees: z.string().optional(), paymentMethods: z.string().optional(),
      specialInstructions: z.string().optional(), isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      if (data.name) (data as any).slug = slug(data.name);
      if (data.courtType) (data as any).courtType = data.courtType as any;
      if (data.efilingSystem) (data as any).efilingSystem = data.efilingSystem as any;
      return ctx.db.court.update({ where: { id }, data: data as any });
    }),

  "courts.delete": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.court.update({ where: { id: input.id }, data: { isActive: false } });
    }),

  "courts.search": publicProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.court.findMany({
        where: { name: { contains: input.query, mode: "insensitive" as any }, isActive: true },
        take: 20, orderBy: { name: "asc" },
      });
    }),

  "courts.getByCountyState": publicProcedure
    .input(z.object({ county: z.string(), state: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.court.findMany({
        where: { county: input.county, state: input.state, isActive: true },
        include: { _count: { select: { courtFilingRules: true, judgeProfiles: true } } },
      });
    }),

  "courts.seed": publicProcedure.mutation(async ({ ctx }) => {
    const existing = await ctx.db.court.count();
    if (existing > 0) return { seeded: false, message: "Courts already exist", count: existing };

    const courts = [
      {
        name: "Supreme Court, Nassau County",
        shortName: "Nassau Supreme",
        slug: "supreme-court-nassau-county",
        courtType: "CT_STATE_SUPREME" as any,
        jurisdiction: "New York State",
        county: "Nassau",
        state: "NY",
        address: "100 Supreme Court Drive",
        city: "Mineola",
        zip: "11501",
        phone: "(516) 493-3400",
        fax: "(516) 493-3499",
        website: "https://www.nycourts.gov/courts/10jd/nassau/",
        efilingSystem: "EFS_NYSCEF" as any,
        efilingUrl: "https://iapps.courts.state.ny.us/nyscef",
        efilingMandatory: true,
        efilingExemptions: "Self-represented litigants may be exempt from mandatory e-filing",
        clerkName: "Nassau County Clerk",
        clerkPhone: "(516) 493-3400",
        clerkHours: "Monday-Friday, 9:00 AM - 5:00 PM",
        filingHours: "E-filing available 24/7; in-person 9:00 AM - 5:00 PM",
        filingFees: JSON.stringify({ rji: 95, index_number: 210, motion: 45, cross_motion: 45, jury_demand: 65 }),
        paymentMethods: "Credit card, check, money order",
        specialInstructions: "All documents must include index number and caption. RJI required upon filing first motion or within 45 days of filing.",
        rules: {
          create: [
            {
              category: "FRC_EFILING" as any,
              title: "Mandatory NYSCEF E-Filing",
              description: "All documents in Supreme Court, Nassau County must be filed through the New York State Courts Electronic Filing system (NYSCEF). Paper filings are not accepted unless an exemption is granted. Self-represented litigants may file in person at the clerk's office.",
              statute: "22 NYCRR § 202.5-b",
              severity: "RS_REQUIRED" as any,
              filingTypes: JSON.stringify(["all"]),
              reminderTiming: "RT_AT_COURT_ASSIGNMENT" as any,
              checklist: JSON.stringify(["Verify NYSCEF account is active", "Confirm case is registered in NYSCEF", "Upload documents in PDF format", "Verify all parties have NYSCEF accounts or are marked for paper service", "Confirm filing confirmation email received"]),
              commonMistakes: JSON.stringify(["Filing paper documents when e-filing is mandatory", "Not registering case in NYSCEF before filing", "Uploading documents in non-PDF format", "Forgetting to serve non-e-filing parties separately"]),
              tips: JSON.stringify(["Set up NYSCEF account well before first filing", "Save filing confirmation emails for records", "Use PDF/A format for best compatibility"]),
              penaltyForNonCompliance: "Filing may be rejected; documents not considered filed until properly submitted through NYSCEF",
              displayOrder: 1,
            },
            {
              category: "FRC_DOCUMENT_FORMAT" as any,
              title: "Document Formatting Requirements",
              description: "All documents filed with Nassau Supreme Court must be on letter-size paper (8.5 x 11 inches), with minimum 1-inch margins, double-spaced, in 12-point font. Exhibits must be separately tabbed and indexed. A table of contents is required for submissions exceeding 25 pages.",
              statute: "22 NYCRR § 202.5(a)",
              severity: "RS_REQUIRED" as any,
              filingTypes: JSON.stringify(["all"]),
              reminderTiming: "RT_AT_FILING" as any,
              checklist: JSON.stringify(["Confirm letter-size paper (8.5 x 11)", "Verify 1-inch margins on all sides", "Confirm double-spacing", "Verify 12-point font", "Tab and index exhibits separately", "Include table of contents if over 25 pages", "Include index number and caption on all documents"]),
              commonMistakes: JSON.stringify(["Using legal-size paper instead of letter-size", "Single-spacing documents", "Not tabbing exhibits", "Missing index number on pages", "Font smaller than 12-point"]),
              tips: JSON.stringify(["Use document templates with pre-set formatting", "Run a formatting check before filing", "Number all pages consecutively"]),
              penaltyForNonCompliance: "Documents may be rejected by clerk; court may strike non-conforming papers",
              displayOrder: 2,
            },
            {
              category: "FRC_MOTION_PRACTICE" as any,
              title: "Motion Practice Requirements",
              description: "All motions in Nassau Supreme Court must be made returnable on the designated motion day for the assigned part. Motions require proper notice of motion or order to show cause, supporting affidavit/affirmation, memorandum of law, and proposed order. Cross-motions must be served at least 7 days before the return date with answering papers due 2 days before.",
              statute: "22 NYCRR § 202.8",
              severity: "RS_REQUIRED" as any,
              filingTypes: JSON.stringify(["motion", "cross_motion", "order_to_show_cause"]),
              reminderTiming: "RT_AT_FILING" as any,
              checklist: JSON.stringify(["Determine correct return date for assigned part", "Prepare notice of motion with return date", "Draft supporting affidavit/affirmation", "Prepare memorandum of law", "Draft proposed order", "File and serve all papers timely", "For cross-motions: serve at least 7 days before return date", "Confirm proof of service filed"]),
              commonMistakes: JSON.stringify(["Wrong return date for assigned part", "Missing memorandum of law", "Late service of cross-motion", "Not including proposed order", "Failing to file proof of service"]),
              tips: JSON.stringify(["Check part rules for specific motion day", "Calendar return dates immediately upon filing", "File sur-reply only with court permission"]),
              penaltyForNonCompliance: "Motion may be denied without prejudice or adjourned; late papers may not be considered",
              displayOrder: 3,
            },
            {
              category: "FRC_COURTESY_COPY" as any,
              title: "Courtesy Copy and Working Copy Requirements",
              description: "Many judges in Nassau Supreme Court require courtesy copies (working copies) of all motion papers delivered to chambers. Working copies must be clearly marked 'WORKING COPY' and include the e-filed confirmation notice. Check individual judge's part rules for specific requirements.",
              statute: "22 NYCRR § 202.5-b(d)(4)",
              severity: "RS_RECOMMENDED" as any,
              filingTypes: JSON.stringify(["motion", "cross_motion", "order_to_show_cause", "opposition"]),
              reminderTiming: "RT_AT_FILING" as any,
              checklist: JSON.stringify(["Check assigned judge's part rules for courtesy copy requirements", "Print and bind working copies", "Mark cover page 'WORKING COPY'", "Attach NYSCEF filing confirmation to front of working copy", "Deliver to correct chambers/part", "Confirm delivery deadline per part rules"]),
              commonMistakes: JSON.stringify(["Not checking if judge requires working copies", "Missing NYSCEF confirmation notice on working copy", "Delivering to wrong chambers", "Missing delivery deadline"]),
              tips: JSON.stringify(["Keep a reference sheet of which judges require courtesy copies", "Deliver courtesy copies the same day as e-filing when possible"]),
              penaltyForNonCompliance: "Motion may not be reviewed or may be delayed; judge may not consider papers without working copies",
              displayOrder: 4,
            },
            {
              category: "FRC_FILING_PROCEDURE" as any,
              title: "Request for Judicial Intervention (RJI) Requirements",
              description: "An RJI must be filed when judicial involvement is first sought, including with the first motion, request for a preliminary conference, or application for any court relief. The RJI assigns the case to a specific judge. Filing fee is $95. Must be filed within 45 days of service of the complaint if no prior motion is made.",
              statute: "22 NYCRR § 202.6",
              severity: "RS_REQUIRED" as any,
              filingTypes: JSON.stringify(["rji", "motion", "preliminary_conference_request"]),
              reminderTiming: "RT_AT_MATTER_CREATION" as any,
              checklist: JSON.stringify(["Determine if RJI has already been filed in case", "Complete RJI form with accurate case information", "Include $95 filing fee", "File through NYSCEF", "Note assigned judge and part number", "Calendar any preliminary conference date"]),
              commonMistakes: JSON.stringify(["Filing motion without RJI", "Missing the 45-day window for RJI filing", "Incomplete or inaccurate RJI form", "Not noting assigned judge for future filings"]),
              tips: JSON.stringify(["File RJI as early as possible to get case assigned", "Keep record of RJI number for all future filings"]),
              penaltyForNonCompliance: "Motion will not be accepted without RJI; case may be subject to administrative dismissal for failure to file RJI timely",
              displayOrder: 5,
            },
            {
              category: "FRC_SERVICE_REQUIREMENT" as any,
              title: "Service of Papers Requirements",
              description: "Service of interlocutory papers in Nassau Supreme Court follows CPLR requirements. E-filed documents are served through NYSCEF on consenting parties. Non-consenting parties must be served by conventional means. Proof of service must be filed within one day of service.",
              statute: "CPLR § 2103; 22 NYCRR § 202.5-b(f)",
              severity: "RS_REQUIRED" as any,
              filingTypes: JSON.stringify(["all"]),
              reminderTiming: "RT_AT_FILING" as any,
              checklist: JSON.stringify(["Identify all parties and their NYSCEF consent status", "E-serve consenting parties through NYSCEF", "Serve non-consenting parties by conventional means (mail, hand delivery, overnight)", "Prepare and file proof/affidavit of service", "File proof of service within one day of service"]),
              commonMistakes: JSON.stringify(["Not serving non-NYSCEF parties separately", "Late filing of proof of service", "Serving by email without consent", "Not verifying all parties' addresses"]),
              tips: JSON.stringify(["Maintain a service list with NYSCEF status for each party", "Use NYSCEF service confirmation as proof for consenting parties"]),
              penaltyForNonCompliance: "Papers may not be considered; motion may be denied for improper service",
              displayOrder: 6,
            },
          ],
        },
      },
      {
        name: "Supreme Court, Queens County",
        shortName: "Queens Supreme",
        slug: "supreme-court-queens-county",
        courtType: "CT_STATE_SUPREME" as any,
        jurisdiction: "New York State",
        county: "Queens",
        state: "NY",
        address: "88-11 Sutphin Boulevard",
        city: "Jamaica",
        zip: "11435",
        phone: "(718) 298-1000",
        website: "https://www.nycourts.gov/courts/11jd/supreme/",
        efilingSystem: "EFS_NYSCEF" as any,
        efilingUrl: "https://iapps.courts.state.ny.us/nyscef",
        efilingMandatory: true,
        clerkHours: "Monday-Friday, 9:00 AM - 5:00 PM",
        filingHours: "E-filing available 24/7; in-person 9:00 AM - 5:00 PM",
        filingFees: JSON.stringify({ rji: 95, index_number: 210, motion: 45, cross_motion: 45, jury_demand: 65 }),
        paymentMethods: "Credit card, check, money order",
        specialInstructions: "Preliminary conference will be automatically scheduled within 45 days of RJI filing. All parties must appear with settlement authority.",
        rules: {
          create: [
            {
              category: "FRC_MOTION_PRACTICE" as any,
              title: "Queens Supreme Motion Practice",
              description: "Motions in Queens Supreme Court must be made returnable on the motion calendar of the assigned justice. All motion papers must be filed through NYSCEF. Working copies must be delivered to the assigned justice's chambers within the time frame specified in the part rules. Sur-reply papers are not permitted without prior court approval.",
              statute: "22 NYCRR § 202.8; Queens County Supreme Court Rules",
              severity: "RS_REQUIRED" as any,
              filingTypes: JSON.stringify(["motion", "cross_motion", "order_to_show_cause"]),
              reminderTiming: "RT_AT_FILING" as any,
              checklist: JSON.stringify(["Verify correct return date for assigned part", "File all motion papers through NYSCEF", "Prepare and deliver working copies per part rules", "Serve opposition papers timely", "File proof of service"]),
              commonMistakes: JSON.stringify(["Missing part-specific motion day", "Late delivery of working copies", "Submitting sur-reply without permission"]),
              tips: JSON.stringify(["Consult individual part rules before filing", "Calendar all motion deadlines immediately"]),
              penaltyForNonCompliance: "Motion may be adjourned or denied without prejudice",
              displayOrder: 1,
            },
            {
              category: "FRC_SCHEDULING" as any,
              title: "Preliminary Conference Requirements",
              description: "A preliminary conference is automatically scheduled within 45 days of filing the RJI in Queens Supreme Court. All parties must appear with authority to discuss settlement, discovery schedule, and case management. Failure to appear may result in default or dismissal.",
              statute: "22 NYCRR § 202.12",
              severity: "RS_REQUIRED" as any,
              filingTypes: JSON.stringify(["preliminary_conference_request", "rji"]),
              reminderTiming: "RT_AT_COURT_ASSIGNMENT" as any,
              checklist: JSON.stringify(["Calendar preliminary conference date immediately", "Prepare discovery proposals", "Review case for settlement discussions", "Ensure client or authorized representative will attend", "Bring proposed discovery schedule"]),
              commonMistakes: JSON.stringify(["Failing to appear at preliminary conference", "Not preparing discovery proposals", "Appearing without settlement authority"]),
              tips: JSON.stringify(["Propose realistic discovery timeline", "Bring draft preliminary conference order"]),
              penaltyForNonCompliance: "Default judgment or dismissal for failure to appear; sanctions possible",
              displayOrder: 2,
            },
            {
              category: "FRC_EFILING" as any,
              title: "Queens NYSCEF E-Filing Protocol",
              description: "All filings in Queens Supreme Court must be submitted through NYSCEF. Documents must be in PDF format and properly captioned with the index number. Proposed orders and judgments must be submitted as separate documents. Stipulations of adjournment must be e-filed, not just submitted to the part.",
              statute: "22 NYCRR § 202.5-b",
              severity: "RS_REQUIRED" as any,
              filingTypes: JSON.stringify(["all"]),
              reminderTiming: "RT_AT_COURT_ASSIGNMENT" as any,
              checklist: JSON.stringify(["Confirm NYSCEF registration for all parties", "Upload documents in PDF format", "Include index number on all documents", "Submit proposed orders as separate documents", "E-file stipulations of adjournment"]),
              commonMistakes: JSON.stringify(["Submitting adjournment stipulations only to chambers", "Combining proposed order with motion papers", "Missing index number on filed documents"]),
              tips: JSON.stringify(["Verify filing confirmation after each submission", "Maintain separate PDFs for each document type"]),
              penaltyForNonCompliance: "Filings may be rejected; adjournment requests may not be processed",
              displayOrder: 3,
            },
          ],
        },
      },
      {
        name: "Family Court, Queens County",
        shortName: "Queens Family",
        slug: "family-court-queens-county",
        courtType: "CT_STATE_FAMILY" as any,
        jurisdiction: "New York State",
        county: "Queens",
        state: "NY",
        address: "151-20 Jamaica Avenue",
        city: "Jamaica",
        zip: "11432",
        phone: "(718) 298-0197",
        website: "https://www.nycourts.gov/courts/nyc/family/",
        efilingSystem: "EFS_NYSCEF" as any,
        efilingUrl: "https://iapps.courts.state.ny.us/nyscef",
        efilingMandatory: false,
        efilingExemptions: "E-filing is voluntary in Family Court; paper filing accepted",
        clerkHours: "Monday-Friday, 9:00 AM - 5:00 PM",
        filingHours: "In-person filing: 9:00 AM - 4:00 PM",
        filingFees: JSON.stringify({ petition: 0, motion: 0, note: "No filing fees in Family Court" }),
        paymentMethods: "N/A - No filing fees",
        specialInstructions: "Family Court has no filing fees. Interpreters available upon request. Orders of protection may be filed at any time. Initial appearances scheduled within days of petition filing.",
        rules: {
          create: [
            {
              category: "FRC_FILING_PROCEDURE" as any,
              title: "Family Court Petition Filing",
              description: "Petitions in Queens Family Court must include all required forms per the specific proceeding type (custody, support, family offense, etc.). Petitions must be verified by the petitioner. The clerk will set an initial return date upon filing. Respondent must be served with the petition and notice of the court date.",
              statute: "Family Court Act §§ 154, 165",
              severity: "RS_REQUIRED" as any,
              filingTypes: JSON.stringify(["petition", "custody_petition", "support_petition", "family_offense_petition"]),
              reminderTiming: "RT_AT_FILING" as any,
              checklist: JSON.stringify(["Complete correct petition form for proceeding type", "Verify petition by petitioner", "Include all required supporting documents", "Obtain return date from clerk", "Arrange for service on respondent", "File proof of service before return date"]),
              commonMistakes: JSON.stringify(["Using wrong petition form", "Filing unverified petition", "Failing to arrange timely service", "Missing supporting documentation"]),
              tips: JSON.stringify(["Visit court help center for form assistance", "File petition early in the day to get same-day return date"]),
              penaltyForNonCompliance: "Petition may be rejected; case delayed until properly filed",
              displayOrder: 1,
            },
            {
              category: "FRC_APPEARANCE" as any,
              title: "Mandatory Appearance Requirements",
              description: "All parties must personally appear on scheduled court dates in Queens Family Court unless excused by the court. Attorneys must have authorization to proceed in the client's absence only in limited circumstances. Failure to appear may result in default, warrant, or dismissal.",
              statute: "Family Court Act § 153",
              severity: "RS_REQUIRED" as any,
              filingTypes: JSON.stringify(["all"]),
              reminderTiming: "RT_ALWAYS_VISIBLE" as any,
              checklist: JSON.stringify(["Confirm court date and time with client", "Arrive at least 30 minutes early for security screening", "Bring all relevant documents and orders", "Have client photo ID available", "Notify court clerk upon arrival"]),
              commonMistakes: JSON.stringify(["Client failing to appear without notice", "Arriving late due to security lines", "Not notifying court of scheduling conflicts in advance"]),
              tips: JSON.stringify(["Send client reminders 48 hours and 24 hours before court date", "Know the judge's policy on adjournments"]),
              penaltyForNonCompliance: "Default judgment, arrest warrant, or case dismissal",
              displayOrder: 2,
            },
            {
              category: "FRC_SERVICE_REQUIREMENT" as any,
              title: "Service of Process in Family Court",
              description: "Service of Family Court petitions must be made personally upon the respondent unless the court authorizes alternative service. Service must be completed within the time specified by the court (typically before the return date). If personal service cannot be made, application for alternative service (posting, publication) must be filed.",
              statute: "Family Court Act § 154; CPLR Article 3",
              severity: "RS_REQUIRED" as any,
              filingTypes: JSON.stringify(["petition", "summons", "order_to_show_cause"]),
              reminderTiming: "RT_AT_FILING" as any,
              checklist: JSON.stringify(["Arrange for personal service by process server (age 18+)", "Complete service before return date", "File affidavit of service with court", "If unable to serve: prepare application for alternative service", "For orders of protection: ensure immediate service if required"]),
              commonMistakes: JSON.stringify(["Having party serve papers personally (not permitted)", "Late service missing return date", "Incomplete affidavit of service", "Not attempting service at multiple addresses"]),
              tips: JSON.stringify(["Hire professional process server for difficult service situations", "Document all service attempts in detail"]),
              penaltyForNonCompliance: "Case adjourned; may be dismissed for failure to prosecute if service not completed",
              displayOrder: 3,
            },
            {
              category: "FRC_DOCUMENT_FORMAT" as any,
              title: "Family Court Document Standards",
              description: "Documents filed in Queens Family Court must be legible, on standard letter-size paper, and include the docket number and caption. Orders to show cause must include the specific relief sought and supporting facts. All financial disclosure forms must use the court-approved forms and be fully completed.",
              statute: "22 NYCRR § 205.7",
              severity: "RS_RECOMMENDED" as any,
              filingTypes: JSON.stringify(["all"]),
              reminderTiming: "RT_AT_FILING" as any,
              checklist: JSON.stringify(["Use standard letter-size paper", "Include docket number on all pages", "Use court-approved forms where required", "Complete all sections of financial disclosure", "Attach required exhibits with labels"]),
              commonMistakes: JSON.stringify(["Incomplete financial disclosure forms", "Missing docket number", "Using outdated court forms", "Handwritten documents that are difficult to read"]),
              tips: JSON.stringify(["Download latest forms from court website", "Type all documents when possible"]),
              penaltyForNonCompliance: "Documents may be returned for correction; financial disclosures rejected if incomplete",
              displayOrder: 4,
            },
          ],
        },
      },
      {
        name: "United States District Court, Eastern District of New York",
        shortName: "EDNY",
        slug: "us-district-court-edny",
        courtType: "CT_FEDERAL_DISTRICT" as any,
        jurisdiction: "Federal",
        county: "Kings",
        state: "NY",
        address: "225 Cadman Plaza East",
        city: "Brooklyn",
        zip: "11201",
        phone: "(718) 613-2600",
        fax: "(718) 613-2699",
        website: "https://www.nyed.uscourts.gov",
        efilingSystem: "EFS_ECF_PACER" as any,
        efilingUrl: "https://ecf.nyed.uscourts.gov",
        efilingMandatory: true,
        efilingExemptions: "Pro se litigants may be exempt from mandatory ECF filing with court approval",
        clerkName: "Clerk of Court, EDNY",
        clerkPhone: "(718) 613-2600",
        clerkHours: "Monday-Friday, 8:30 AM - 5:00 PM",
        filingHours: "ECF available 24/7; in-person 8:30 AM - 4:30 PM",
        filingFees: JSON.stringify({ civil_filing: 402, motion_fee: 0, appeal_fee: 505, habeas: 5, removal: 402 }),
        paymentMethods: "Pay.gov, credit card, check, money order",
        specialInstructions: "EDNY has two courthouses: Brooklyn and Central Islip. Filing location depends on county of residence or where claim arose. All attorneys must be admitted to EDNY bar or appear pro hac vice.",
        rules: {
          create: [
            {
              category: "FRC_EFILING" as any,
              title: "CM/ECF Electronic Filing Requirements",
              description: "All documents in EDNY must be filed electronically through the CM/ECF system. Attorneys must register for an ECF account and complete training before filing. Documents must be in PDF format, text-searchable, and not exceed 35MB per document. Exhibits must be filed as separate attachments.",
              statute: "EDNY Local Civil Rule 5.2",
              severity: "RS_REQUIRED" as any,
              filingTypes: JSON.stringify(["all"]),
              reminderTiming: "RT_AT_COURT_ASSIGNMENT" as any,
              checklist: JSON.stringify(["Register for CM/ECF account", "Complete ECF training", "Convert documents to text-searchable PDF", "Verify file size under 35MB", "File exhibits as separate attachments", "Verify case number and judge assignment", "Confirm NEF (Notice of Electronic Filing) received"]),
              commonMistakes: JSON.stringify(["Filing non-searchable PDFs", "Exceeding 35MB file size limit", "Combining exhibits into single PDF", "Not registering for ECF before first filing deadline", "Filing in wrong case or division"]),
              tips: JSON.stringify(["Use Adobe Acrobat to ensure text-searchable PDFs", "Split large documents into parts if needed", "Save NEF emails as filing confirmation"]),
              penaltyForNonCompliance: "Filing rejected; may miss filing deadline resulting in default or sanctions",
              displayOrder: 1,
            },
            {
              category: "FRC_DOCUMENT_FORMAT" as any,
              title: "EDNY Document Formatting Standards",
              description: "Documents filed in EDNY must conform to federal formatting requirements: 8.5 x 11 inch paper, double-spaced, 12-point font (Times New Roman or equivalent), 1-inch margins. Memoranda of law in support of or in opposition to motions are limited to 25 pages unless prior permission is obtained. Reply memoranda limited to 10 pages.",
              statute: "EDNY Local Civil Rule 7.1",
              severity: "RS_REQUIRED" as any,
              filingTypes: JSON.stringify(["all"]),
              reminderTiming: "RT_AT_FILING" as any,
              checklist: JSON.stringify(["Use 8.5 x 11 inch paper format", "Double-space text", "Use 12-point Times New Roman or equivalent", "Maintain 1-inch margins", "Keep memoranda under 25 pages", "Keep reply memoranda under 10 pages", "Number all pages", "Include case caption and docket number"]),
              commonMistakes: JSON.stringify(["Exceeding page limits without permission", "Wrong font or font size", "Single-spacing", "Missing docket number on pages"]),
              tips: JSON.stringify(["Request leave to exceed page limits well in advance", "Use court-approved templates"]),
              penaltyForNonCompliance: "Court may strike non-conforming documents; may need to refile",
              displayOrder: 2,
            },
            {
              category: "FRC_MOTION_PRACTICE" as any,
              title: "EDNY Motion Practice and Pre-Motion Conference",
              description: "Before filing any dispositive motion in EDNY, parties must request a pre-motion conference with the court. Letter briefs (not exceeding 3 pages) must be submitted outlining the anticipated motion. Non-dispositive motions (discovery disputes, etc.) are typically resolved through letter briefing. All motions require a notice of motion, memorandum of law, and supporting declarations.",
              statute: "EDNY Local Civil Rule 7.1; Individual Judge Rules",
              severity: "RS_REQUIRED" as any,
              filingTypes: JSON.stringify(["motion", "summary_judgment", "motion_to_dismiss"]),
              reminderTiming: "RT_BEFORE_FILING" as any,
              reminderDaysBefore: 14,
              checklist: JSON.stringify(["Submit pre-motion conference letter (3 pages max) for dispositive motions", "Wait for court's scheduling order before filing motion", "Prepare notice of motion", "Draft memorandum of law (25 pages max)", "Prepare supporting declarations with exhibits", "Serve and file motion papers per scheduling order", "Prepare Local Rule 56.1 statement for summary judgment motions"]),
              commonMistakes: JSON.stringify(["Filing dispositive motion without pre-motion conference", "Exceeding 3-page limit for pre-motion letter", "Missing Rule 56.1 statement on summary judgment", "Not checking individual judge rules for variations"]),
              tips: JSON.stringify(["Review individual judge's rules before any motion practice", "Include all grounds in pre-motion letter to avoid waiver"]),
              penaltyForNonCompliance: "Motion may be stricken or denied without prejudice; sanctions possible",
              displayOrder: 3,
            },
            {
              category: "FRC_DISCOVERY" as any,
              title: "EDNY Discovery Requirements and Rule 26 Obligations",
              description: "Parties in EDNY must conduct a Rule 26(f) conference and submit a discovery plan within 14 days. Initial disclosures under Rule 26(a)(1) are due within 14 days after the Rule 26(f) conference. Discovery disputes should first be addressed through meet-and-confer, then by letter to the court (not formal motion). Interrogatories limited to 25.",
              statute: "FRCP Rules 26, 33, 34; EDNY Local Civil Rule 26.2",
              severity: "RS_REQUIRED" as any,
              filingTypes: JSON.stringify(["discovery", "interrogatories", "document_request", "deposition_notice"]),
              reminderTiming: "RT_AT_COURT_ASSIGNMENT" as any,
              checklist: JSON.stringify(["Schedule Rule 26(f) conference with opposing counsel", "Prepare and exchange initial disclosures within 14 days of 26(f) conference", "Submit discovery plan to court within 14 days of 26(f) conference", "Limit interrogatories to 25 (including subparts)", "Meet and confer before raising discovery disputes with court", "Submit discovery dispute letters (3 pages max) if meet-and-confer fails"]),
              commonMistakes: JSON.stringify(["Missing initial disclosure deadline", "Exceeding 25 interrogatory limit", "Filing discovery motion without meet-and-confer", "Not exchanging Rule 26(a)(1) disclosures"]),
              tips: JSON.stringify(["Calendar Rule 26(f) conference immediately after initial case management conference", "Document all meet-and-confer efforts"]),
              penaltyForNonCompliance: "Discovery sanctions under Rule 37; preclusion of evidence; adverse inference",
              displayOrder: 4,
            },
            {
              category: "FRC_SERVICE_REQUIREMENT" as any,
              title: "EDNY Service of Process Requirements",
              description: "Service of the summons and complaint must be completed within 90 days of filing under FRCP Rule 4(m). Service may be made personally, by leaving copies at dwelling, by delivering to authorized agent, or by waiver under Rule 4(d). Waiver of service extends response time to 60 days. Proof of service must be filed with the court.",
              statute: "FRCP Rule 4; EDNY Local Civil Rule 5.2",
              severity: "RS_REQUIRED" as any,
              filingTypes: JSON.stringify(["complaint", "summons", "third_party_complaint"]),
              reminderTiming: "RT_AT_MATTER_CREATION" as any,
              checklist: JSON.stringify(["Send waiver of service request (saves costs, extends response time)", "If no waiver: arrange personal service within 90 days", "File proof of service / return of waiver with court", "Calendar response deadline (21 days personal service, 60 days waiver)", "For international service: allow additional time per Hague Convention"]),
              commonMistakes: JSON.stringify(["Missing 90-day service deadline", "Not sending waiver request to save costs", "Improper service method", "Failing to file proof of service"]),
              tips: JSON.stringify(["Always try waiver of service first - it's cheaper and gives defendant more time", "Use professional process server for difficult service"]),
              penaltyForNonCompliance: "Case dismissed without prejudice for failure to serve within 90 days",
              displayOrder: 5,
            },
            {
              category: "FRC_COURTESY_COPY" as any,
              title: "EDNY Courtesy Copy and Chamber Copy Requirements",
              description: "Many EDNY judges require courtesy copies of all motion papers and memoranda of law delivered to chambers. Courtesy copies must be marked 'COURTESY COPY' and include the ECF header with filing date. Requirements vary by judge - always check individual judge's rules.",
              statute: "Individual Judge Rules; EDNY Local Rule 5.2(e)",
              severity: "RS_RECOMMENDED" as any,
              filingTypes: JSON.stringify(["motion", "opposition", "reply", "memorandum_of_law"]),
              reminderTiming: "RT_AT_FILING" as any,
              checklist: JSON.stringify(["Check individual judge's rules for courtesy copy requirements", "Print documents with ECF header showing filing date", "Mark 'COURTESY COPY' on cover", "Deliver to correct chambers within required timeframe", "Include all exhibits and supporting documents"]),
              commonMistakes: JSON.stringify(["Not checking judge-specific requirements", "Missing ECF header on courtesy copies", "Delivering to wrong chambers", "Sending courtesy copies when judge does not want them"]),
              tips: JSON.stringify(["Call chambers to confirm courtesy copy policy if unclear", "Some judges accept emailed courtesy copies"]),
              penaltyForNonCompliance: "Papers may not be reviewed timely; motion may be delayed",
              displayOrder: 6,
            },
            {
              category: "FRC_LOCAL_RULE" as any,
              title: "EDNY Local Rule 56.1 Statement Requirements",
              description: "Any motion for summary judgment in EDNY must include a separate, short, and concise statement of material facts as to which the moving party contends there is no genuine issue. Each fact must be set forth in a separately numbered paragraph with citation to admissible evidence. The opposing party must respond to each numbered paragraph and may add additional facts.",
              statute: "EDNY Local Civil Rule 56.1",
              severity: "RS_REQUIRED" as any,
              filingTypes: JSON.stringify(["summary_judgment"]),
              reminderTiming: "RT_BEFORE_FILING" as any,
              reminderDaysBefore: 7,
              checklist: JSON.stringify(["Prepare Rule 56.1 statement with numbered paragraphs", "Cite admissible evidence for each fact", "Include only material facts (not arguments)", "Organize facts logically by issue", "If opposing: respond to each paragraph with admit/deny", "If opposing: add counter-statement of additional facts", "Attach all cited evidence as exhibits"]),
              commonMistakes: JSON.stringify(["Including legal arguments in 56.1 statement", "Failing to cite evidence for each fact", "Not responding to each numbered paragraph when opposing", "Citing inadmissible evidence"]),
              tips: JSON.stringify(["Draft 56.1 statement before memorandum of law", "Use 56.1 statement as outline for memorandum"]),
              penaltyForNonCompliance: "Uncontested facts deemed admitted; motion may be denied for failure to comply",
              displayOrder: 7,
            },
          ],
        },
      },
      {
        name: "United States District Court, Southern District of New York",
        shortName: "SDNY",
        slug: "us-district-court-sdny",
        courtType: "CT_FEDERAL_DISTRICT" as any,
        jurisdiction: "Federal",
        county: "New York",
        state: "NY",
        address: "500 Pearl Street",
        city: "New York",
        zip: "10007",
        phone: "(212) 805-0136",
        website: "https://www.nysd.uscourts.gov",
        efilingSystem: "EFS_ECF_PACER" as any,
        efilingUrl: "https://ecf.nysd.uscourts.gov",
        efilingMandatory: true,
        efilingExemptions: "Pro se litigants in civil cases may be exempt; pro se prisoners file on paper",
        clerkName: "Clerk of Court, SDNY",
        clerkPhone: "(212) 805-0136",
        clerkHours: "Monday-Friday, 8:30 AM - 5:00 PM",
        filingHours: "ECF available 24/7; in-person 8:30 AM - 4:30 PM",
        filingFees: JSON.stringify({ civil_filing: 402, motion_fee: 0, appeal_fee: 505, habeas: 5, removal: 402 }),
        paymentMethods: "Pay.gov, credit card, check, money order",
        specialInstructions: "SDNY has courthouses in Manhattan (500 Pearl St) and White Plains (300 Quarropas St). Case assignment depends on county. Individual judge practices vary significantly - always review Individual Practices before filing.",
        rules: {
          create: [
            {
              category: "FRC_EFILING" as any,
              title: "SDNY ECF Electronic Filing Requirements",
              description: "All documents in SDNY must be filed electronically through CM/ECF. Attorneys must be admitted to the SDNY bar and registered for ECF. Documents must be PDF format, text-searchable. Proposed orders must be submitted in both PDF and Word format. Filing is considered complete upon receipt of the NEF.",
              statute: "SDNY Local Civil Rule 5.2; ECF Rules and Instructions",
              severity: "RS_REQUIRED" as any,
              filingTypes: JSON.stringify(["all"]),
              reminderTiming: "RT_AT_COURT_ASSIGNMENT" as any,
              checklist: JSON.stringify(["Verify SDNY bar admission", "Register for ECF account", "File documents as text-searchable PDFs", "Submit proposed orders in PDF and Word format", "Verify NEF received after filing", "Confirm correct case number and judge"]),
              commonMistakes: JSON.stringify(["Not being admitted to SDNY bar", "Filing non-searchable PDFs", "Submitting proposed orders only in PDF without Word version", "Filing in wrong case or division"]),
              tips: JSON.stringify(["Apply for SDNY bar admission well before first filing", "Keep copies of all NEFs"]),
              penaltyForNonCompliance: "Filing rejected; potential missed deadlines",
              displayOrder: 1,
            },
            {
              category: "FRC_MOTION_PRACTICE" as any,
              title: "SDNY Motion Practice and Individual Practices",
              description: "Motion practice in SDNY is heavily governed by individual judge's practices. Before filing any motion, attorneys must review the assigned judge's Individual Practices posted on the court website. Most judges require pre-motion conference letters for dispositive motions. Memoranda of law limited to 25 pages; reply memoranda to 10 pages. Local Rule 56.1 statements required for summary judgment.",
              statute: "SDNY Local Civil Rule 6.1, 7.1; Individual Practices",
              severity: "RS_REQUIRED" as any,
              filingTypes: JSON.stringify(["motion", "summary_judgment", "motion_to_dismiss"]),
              reminderTiming: "RT_BEFORE_FILING" as any,
              reminderDaysBefore: 14,
              checklist: JSON.stringify(["Download and review assigned judge's Individual Practices", "Submit pre-motion conference letter if required by judge", "Comply with page limits (25 pages memo, 10 pages reply)", "Prepare Rule 56.1 statement for summary judgment", "Include all required components: notice of motion, memo of law, declarations", "Serve and file per scheduling order deadlines"]),
              commonMistakes: JSON.stringify(["Not reviewing Individual Practices before filing", "Filing dispositive motion without required pre-motion conference", "Exceeding page limits", "Wrong format for particular judge"]),
              tips: JSON.stringify(["Individual Practices are available at https://www.nysd.uscourts.gov/judges", "When in doubt, call chambers"]),
              penaltyForNonCompliance: "Motion stricken; sanctions; case management complications",
              displayOrder: 2,
            },
            {
              category: "FRC_DISCOVERY" as any,
              title: "SDNY Discovery Obligations and Dispute Resolution",
              description: "SDNY follows FRCP discovery rules with local modifications. Initial disclosures due within 14 days of Rule 26(f) conference. Discovery disputes must be raised by letter to the court (not exceeding 3 pages) after good-faith meet-and-confer. Interrogatories limited to 25. Depositions limited to 10 per side (7 hours each).",
              statute: "FRCP Rules 26-37; SDNY Local Civil Rule 26.2, 33.3",
              severity: "RS_REQUIRED" as any,
              filingTypes: JSON.stringify(["discovery", "interrogatories", "document_request", "deposition_notice"]),
              reminderTiming: "RT_AT_COURT_ASSIGNMENT" as any,
              checklist: JSON.stringify(["Conduct Rule 26(f) conference", "Exchange initial disclosures within 14 days", "Submit proposed case management plan", "Limit interrogatories to 25", "Limit depositions to 10 per side, 7 hours each", "Meet and confer before any discovery dispute letter", "Keep discovery dispute letters under 3 pages"]),
              commonMistakes: JSON.stringify(["Filing discovery motions instead of letters", "Exceeding interrogatory or deposition limits without stipulation", "Inadequate meet-and-confer before raising disputes"]),
              tips: JSON.stringify(["Agree on ESI protocol early in the case", "Use joint discovery dispute letters when possible"]),
              penaltyForNonCompliance: "Discovery sanctions; evidence preclusion; adverse inference instructions",
              displayOrder: 3,
            },
            {
              category: "FRC_LOCAL_RULE" as any,
              title: "SDNY Local Rule 56.1 Statement for Summary Judgment",
              description: "Motions for summary judgment in SDNY must include a separate Rule 56.1 statement setting forth material facts as to which there is no genuine dispute. Each fact must be in a numbered paragraph citing specific evidence. The opposing party must respond to each paragraph. Uncontroverted facts in the 56.1 statement are deemed admitted.",
              statute: "SDNY Local Civil Rule 56.1",
              severity: "RS_REQUIRED" as any,
              filingTypes: JSON.stringify(["summary_judgment"]),
              reminderTiming: "RT_BEFORE_FILING" as any,
              reminderDaysBefore: 7,
              checklist: JSON.stringify(["Draft Rule 56.1 statement with numbered paragraphs", "Cite specific admissible evidence for each fact", "Include only undisputed material facts", "If opposing: respond to each numbered paragraph", "If opposing: include counter-statement of additional material facts", "Ensure all cited evidence is in the record"]),
              commonMistakes: JSON.stringify(["Argumentative statements instead of facts", "Failing to cite specific evidence", "Not responding to each paragraph point-by-point", "Citing evidence not in the record"]),
              tips: JSON.stringify(["Start drafting 56.1 statement early in summary judgment preparation", "Cross-reference 56.1 statement with memorandum of law"]),
              penaltyForNonCompliance: "Facts deemed admitted if unopposed; motion may be denied for non-compliance",
              displayOrder: 4,
            },
          ],
        },
      },
    ];

    const created = [];
    for (const courtData of courts) {
      const c = await ctx.db.court.create({ data: courtData as any });
      created.push(c);
    }

    return { seeded: true, message: `Created ${created.length} courts with rules`, courts: created.map((c: any) => ({ id: c.id, name: c.name, slug: c.slug })) };
  }),

  // ─── Filing Rules (9-19) ─────────────────────────────────────────

  "rules.list": publicProcedure
    .input(z.object({
      courtId: z.string(),
      category: z.string().optional(),
      severity: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = { courtId: input.courtId };
      if (input.category) where.category = input.category;
      if (input.severity) where.severity = input.severity;
      if (input.isActive !== undefined) where.isActive = input.isActive;
      return ctx.db.courtFilingRule.findMany({ where, orderBy: [{ severity: "asc" }, { displayOrder: "asc" }] });
    }),

  "rules.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.courtFilingRule.findUnique({ where: { id: input.id } });
    }),

  "rules.create": publicProcedure
    .input(z.object({
      courtId: z.string(), category: z.string(), title: z.string().min(1),
      description: z.string(), statute: z.string().optional(), statuteUrl: z.string().optional(),
      severity: z.string(), practiceAreas: z.string().optional(),
      filingTypes: z.string().optional(), reminderTiming: z.string().optional(),
      reminderDaysBefore: z.number().optional(), checklist: z.string().optional(),
      commonMistakes: z.string().optional(), tips: z.string().optional(),
      penaltyForNonCompliance: z.string().optional(), exceptions: z.string().optional(),
      effectiveDate: z.string().optional(), expirationDate: z.string().optional(),
      displayOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const data: any = { ...input };
      if (input.effectiveDate) data.effectiveDate = new Date(input.effectiveDate);
      if (input.expirationDate) data.expirationDate = new Date(input.expirationDate);
      return ctx.db.courtFilingRule.create({ data });
    }),

  "rules.update": publicProcedure
    .input(z.object({
      id: z.string(), category: z.string().optional(), title: z.string().optional(),
      description: z.string().optional(), statute: z.string().optional(), statuteUrl: z.string().optional(),
      severity: z.string().optional(), practiceAreas: z.string().optional(),
      filingTypes: z.string().optional(), reminderTiming: z.string().optional(),
      reminderDaysBefore: z.number().optional(), checklist: z.string().optional(),
      commonMistakes: z.string().optional(), tips: z.string().optional(),
      penaltyForNonCompliance: z.string().optional(), exceptions: z.string().optional(),
      displayOrder: z.number().optional(), isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.courtFilingRule.update({ where: { id }, data: data as any });
    }),

  "rules.delete": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.courtFilingRule.update({ where: { id: input.id }, data: { isActive: false } });
    }),

  "rules.getForFiling": publicProcedure
    .input(z.object({ courtId: z.string(), filingType: z.string() }))
    .query(async ({ ctx, input }) => {
      const rules = await ctx.db.courtFilingRule.findMany({
        where: { courtId: input.courtId, isActive: true },
        orderBy: [{ severity: "asc" }, { displayOrder: "asc" }],
      });
      return rules.filter((r: any) => {
        if (!r.filingTypes) return false;
        const types = JSON.parse(r.filingTypes);
        return types.includes("all") || types.includes(input.filingType);
      });
    }),

  "rules.getReminders": publicProcedure
    .input(z.object({ matterId: z.string(), status: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { matterId: input.matterId };
      if (input.status) where.status = input.status;
      else where.status = "RMS_PENDING" as any;
      return ctx.db.courtRuleReminder.findMany({ where, orderBy: { severity: "asc" } });
    }),

  "rules.getRequired": publicProcedure
    .input(z.object({ courtId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.courtFilingRule.findMany({
        where: { courtId: input.courtId, severity: "RS_REQUIRED" as any, isActive: true },
        orderBy: { displayOrder: "asc" },
      });
    }),

  "rules.verify": publicProcedure
    .input(z.object({ id: z.string(), verifiedBy: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.courtFilingRule.update({
        where: { id: input.id },
        data: { lastVerified: new Date(), verifiedBy: input.verifiedBy },
      });
    }),

  "rules.bulkImport": publicProcedure
    .input(z.object({
      courtId: z.string(),
      rules: z.array(z.object({
        category: z.string(), title: z.string(), description: z.string(),
        severity: z.string(), statute: z.string().optional(),
        filingTypes: z.string().optional(), checklist: z.string().optional(),
        commonMistakes: z.string().optional(), tips: z.string().optional(),
        penaltyForNonCompliance: z.string().optional(), displayOrder: z.number().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const data = input.rules.map((r, i) => ({ ...r, courtId: input.courtId, displayOrder: r.displayOrder ?? i + 1 }));
      return ctx.db.courtFilingRule.createMany({ data: data as any });
    }),

  "rules.export": publicProcedure
    .input(z.object({ courtId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rules = await ctx.db.courtFilingRule.findMany({ where: { courtId: input.courtId, isActive: true }, orderBy: { displayOrder: "asc" } });
      return { courtId: input.courtId, exportedAt: new Date().toISOString(), count: rules.length, rules };
    }),

  // ─── Judges (20-30) ──────────────────────────────────────────────

  "judges.list": publicProcedure
    .input(z.object({
      courtId: z.string().optional(), isActive: z.boolean().optional(), limit: z.number().default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.courtId) where.courtId = input.courtId;
      if (input?.isActive !== undefined) where.isActive = input.isActive;
      return ctx.db.judgeProfile.findMany({ where, orderBy: { name: "asc" }, take: input?.limit || 50 });
    }),

  "judges.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.judgeProfile.findUnique({ where: { id: input.id }, include: { specificRules: true } });
    }),

  "judges.create": publicProcedure
    .input(z.object({
      courtId: z.string(), name: z.string().min(1), title: z.string().optional(),
      part: z.string().optional(), courtroom: z.string().optional(), floor: z.string().optional(),
      phone: z.string().optional(), clerkName: z.string().optional(), clerkPhone: z.string().optional(),
      clerkEmail: z.string().optional(), practiceAreas: z.string().optional(),
      schedulingPreferences: z.string().optional(), rulingTendencies: z.string().optional(),
      petPeeves: z.string().optional(), preferences: z.string().optional(),
      motionPractice: z.string().optional(), discoveryPractice: z.string().optional(),
      trialPractice: z.string().optional(), individualRules: z.string().optional(),
      individualRulesUrl: z.string().optional(), appointedDate: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const data: any = { ...input };
      if (input.appointedDate) data.appointedDate = new Date(input.appointedDate);
      return ctx.db.judgeProfile.create({ data });
    }),

  "judges.update": publicProcedure
    .input(z.object({
      id: z.string(), name: z.string().optional(), title: z.string().optional(),
      part: z.string().optional(), courtroom: z.string().optional(), floor: z.string().optional(),
      phone: z.string().optional(), clerkName: z.string().optional(), clerkPhone: z.string().optional(),
      clerkEmail: z.string().optional(), practiceAreas: z.string().optional(),
      schedulingPreferences: z.string().optional(), rulingTendencies: z.string().optional(),
      petPeeves: z.string().optional(), preferences: z.string().optional(),
      motionPractice: z.string().optional(), discoveryPractice: z.string().optional(),
      trialPractice: z.string().optional(), individualRules: z.string().optional(),
      individualRulesUrl: z.string().optional(), isActive: z.boolean().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.judgeProfile.update({ where: { id }, data });
    }),

  "judges.delete": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.judgeProfile.update({ where: { id: input.id }, data: { isActive: false } });
    }),

  "judges.getRules": publicProcedure
    .input(z.object({ judgeId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.judgeSpecificRule.findMany({ where: { judgeId: input.judgeId }, orderBy: { displayOrder: "asc" } });
    }),

  "judges.addRule": publicProcedure
    .input(z.object({
      judgeId: z.string(), courtId: z.string(), category: z.string(),
      title: z.string().min(1), description: z.string(), severity: z.string(),
      practiceAreas: z.string().optional(), displayOrder: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.judgeSpecificRule.create({ data: input as any });
    }),

  "judges.updateRule": publicProcedure
    .input(z.object({
      id: z.string(), category: z.string().optional(),
      title: z.string().optional(), description: z.string().optional(),
      severity: z.string().optional(), practiceAreas: z.string().optional(),
      displayOrder: z.number().optional(), isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.judgeSpecificRule.update({ where: { id }, data: data as any });
    }),

  "judges.deleteRule": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.judgeSpecificRule.delete({ where: { id: input.id } });
    }),

  "judges.search": publicProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.judgeProfile.findMany({
        where: { name: { contains: input.query, mode: "insensitive" as any }, isActive: true },
        take: 20, orderBy: { name: "asc" },
      });
    }),

  "judges.getAnalytics": publicProcedure
    .input(z.object({ judgeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const judge = await ctx.db.judgeProfile.findUnique({ where: { id: input.judgeId }, include: { specificRules: true, assignments: true } });
      return { judge, totalAssignments: judge?.assignments?.length || 0, totalRules: judge?.specificRules?.length || 0 };
    }),

  // ─── Assignment (31-35) ──────────────────────────────────────────

  "assignment.get": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.matterCourtAssignment.findUnique({
        where: { matterId: input.matterId },
        include: { court: true, judge: true },
      });
    }),

  "assignment.assign": publicProcedure
    .input(z.object({
      matterId: z.string(), courtId: z.string(), judgeId: z.string().optional(),
      indexNumber: z.string().optional(), part: z.string().optional(),
      assignedDate: z.string().optional(), rjiFiledDate: z.string().optional(),
      rjiNumber: z.string().optional(), filingDate: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const data: any = { ...input };
      if (input.assignedDate) data.assignedDate = new Date(input.assignedDate);
      if (input.rjiFiledDate) data.rjiFiledDate = new Date(input.rjiFiledDate);
      if (input.filingDate) data.filingDate = new Date(input.filingDate);

      const assignment = await ctx.db.matterCourtAssignment.create({ data, include: { court: true, judge: true } });

      // Load court rules triggered at creation or assignment
      const courtRules = await ctx.db.courtFilingRule.findMany({
        where: {
          courtId: input.courtId,
          isActive: true,
          reminderTiming: { in: ["RT_AT_MATTER_CREATION" as any, "RT_AT_COURT_ASSIGNMENT" as any] },
        },
      });

      const reminders = [];
      for (const rule of courtRules) {
        const reminder = await ctx.db.courtRuleReminder.create({
          data: {
            matterId: input.matterId, courtRuleId: rule.id, title: rule.title,
            description: rule.description, severity: rule.severity, category: rule.category,
            checklist: rule.checklist, status: "RMS_PENDING" as any,
          },
        });
        reminders.push(reminder);
      }

      return { assignment, reminders };
    }),

  "assignment.update": publicProcedure
    .input(z.object({
      matterId: z.string(), courtId: z.string().optional(), judgeId: z.string().optional(),
      indexNumber: z.string().optional(), part: z.string().optional(),
      assignedDate: z.string().optional(), rjiFiledDate: z.string().optional(),
      rjiNumber: z.string().optional(), filingDate: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { matterId, ...rest } = input;
      const data: any = { ...rest };
      if (rest.assignedDate) data.assignedDate = new Date(rest.assignedDate);
      if (rest.rjiFiledDate) data.rjiFiledDate = new Date(rest.rjiFiledDate);
      if (rest.filingDate) data.filingDate = new Date(rest.filingDate);
      return ctx.db.matterCourtAssignment.update({ where: { matterId }, data });
    }),

  "assignment.remove": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.courtRuleReminder.deleteMany({ where: { matterId: input.matterId } });
      return ctx.db.matterCourtAssignment.delete({ where: { matterId: input.matterId } });
    }),

  "assignment.acknowledgeRules": publicProcedure
    .input(z.object({ matterId: z.string(), acknowledgedBy: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.matterCourtAssignment.update({
        where: { matterId: input.matterId },
        data: { rulesAcknowledged: true, rulesAcknowledgedAt: new Date(), rulesAcknowledgedBy: input.acknowledgedBy },
      });
    }),

  // ─── Reminders (36-45) ───────────────────────────────────────────

  "reminders.list": publicProcedure
    .input(z.object({
      matterId: z.string(), status: z.string().optional(),
      severity: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = { matterId: input.matterId };
      if (input.status) where.status = input.status;
      if (input.severity) where.severity = input.severity;
      return ctx.db.courtRuleReminder.findMany({ where, orderBy: [{ severity: "asc" }, { createdAt: "desc" }] });
    }),

  "reminders.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.courtRuleReminder.findUnique({ where: { id: input.id }, include: { courtRule: true } });
    }),

  "reminders.acknowledge": publicProcedure
    .input(z.object({ id: z.string(), acknowledgedBy: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.courtRuleReminder.update({
        where: { id: input.id },
        data: { status: "RMS_ACKNOWLEDGED" as any, acknowledgedAt: new Date(), acknowledgedBy: input.acknowledgedBy },
      });
    }),

  "reminders.complete": publicProcedure
    .input(z.object({ id: z.string(), completedBy: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.courtRuleReminder.update({
        where: { id: input.id },
        data: { status: "RMS_COMPLETED" as any, completedAt: new Date(), completedBy: input.completedBy },
      });
    }),

  "reminders.completeChecklistItem": publicProcedure
    .input(z.object({ id: z.string(), itemIndex: z.number(), completed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const reminder = await ctx.db.courtRuleReminder.findUnique({ where: { id: input.id } });
      if (!reminder || !reminder.checklist) throw new Error("Reminder or checklist not found");
      const checklist = JSON.parse(reminder.checklist);
      if (typeof checklist[input.itemIndex] === "string") {
        checklist[input.itemIndex] = { text: checklist[input.itemIndex], completed: input.completed };
      } else {
        checklist[input.itemIndex].completed = input.completed;
      }
      return ctx.db.courtRuleReminder.update({ where: { id: input.id }, data: { checklist: JSON.stringify(checklist) } });
    }),

  "reminders.dismiss": publicProcedure
    .input(z.object({ id: z.string(), dismissedReason: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.courtRuleReminder.update({
        where: { id: input.id },
        data: { status: "RMS_DISMISSED" as any, dismissedReason: input.dismissedReason },
      });
    }),

  "reminders.override": publicProcedure
    .input(z.object({ id: z.string(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.courtRuleReminder.update({
        where: { id: input.id },
        data: { status: "RMS_OVERRIDDEN" as any, dismissedReason: input.reason },
      });
    }),

  "reminders.generateForFiling": publicProcedure
    .input(z.object({ matterId: z.string(), courtId: z.string(), filingType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const rules = await ctx.db.courtFilingRule.findMany({
        where: { courtId: input.courtId, isActive: true },
      });
      const matching = rules.filter((r: any) => {
        if (!r.filingTypes) return false;
        const types = JSON.parse(r.filingTypes);
        return types.includes("all") || types.includes(input.filingType);
      });
      const reminders = [];
      for (const rule of matching) {
        const reminder = await ctx.db.courtRuleReminder.create({
          data: {
            matterId: input.matterId, courtRuleId: rule.id, title: rule.title,
            description: rule.description, severity: rule.severity, category: rule.category,
            checklist: rule.checklist, status: "RMS_PENDING" as any,
          },
        });
        reminders.push(reminder);
      }
      return { generated: reminders.length, reminders };
    }),

  "reminders.getActiveCount": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.courtRuleReminder.count({ where: { matterId: input.matterId, status: "RMS_PENDING" as any } });
    }),

  "reminders.getUrgent": publicProcedure.query(async ({ ctx }) => {
    return ctx.db.courtRuleReminder.findMany({
      where: { status: "RMS_PENDING" as any, severity: "RS_REQUIRED" as any },
      orderBy: { createdAt: "asc" }, take: 100,
    });
  }),

  // ─── AI (46-50) ──────────────────────────────────────────────────

  "ai.suggestCourt": publicProcedure
    .input(z.object({ jurisdiction: z.string().optional(), state: z.string(), county: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { state: input.state, isActive: true };
      if (input.jurisdiction) where.jurisdiction = input.jurisdiction;
      if (input.county) where.county = input.county;
      return ctx.db.court.findMany({ where, include: { _count: { select: { courtFilingRules: true } } }, orderBy: { name: "asc" } });
    }),

  "ai.summarizeRules": publicProcedure
    .input(z.object({ courtId: z.string() }))
    .query(async ({ ctx, input }) => {
      const court = await ctx.db.court.findUnique({ where: { id: input.courtId }, include: { courtFilingRules: { where: { isActive: true } } } });
      if (!court) throw new Error("Court not found");
      const rulesText = court.courtFilingRules.map((r: any) => `[${r.severity}] ${r.title}: ${r.description}`).join("\n\n");
      const result = await aiRouter.complete({
        feature: "court-rules-summary",
        systemPrompt: "You are a legal assistant. Summarize the following court filing rules in plain English for an attorney. Be concise but thorough.",
        userPrompt: `Summarize the filing rules for ${court.name}:\n\n${rulesText}`,
      });
      return { court: court.name, summary: result.content, ruleCount: court.courtFilingRules.length };
    }),

  "ai.compareCourtRules": publicProcedure
    .input(z.object({ courtIdA: z.string(), courtIdB: z.string() }))
    .query(async ({ ctx, input }) => {
      const [courtA, courtB] = await Promise.all([
        ctx.db.court.findUnique({ where: { id: input.courtIdA }, include: { courtFilingRules: { where: { isActive: true } } } }),
        ctx.db.court.findUnique({ where: { id: input.courtIdB }, include: { courtFilingRules: { where: { isActive: true } } } }),
      ]);
      if (!courtA || !courtB) throw new Error("One or both courts not found");
      const formatRules = (court: any) => court.courtFilingRules.map((r: any) => ({ category: r.category, title: r.title, severity: r.severity, description: r.description }));
      return { courtA: { id: courtA.id, name: courtA.name, rules: formatRules(courtA) }, courtB: { id: courtB.id, name: courtB.name, rules: formatRules(courtB) } };
    }),

  "ai.analyzeJudge": publicProcedure
    .input(z.object({ judgeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const judge = await ctx.db.judgeProfile.findUnique({ where: { id: input.judgeId }, include: { specificRules: true, court: true } });
      if (!judge) throw new Error("Judge not found");
      const judgeInfo = `Judge: ${judge.name}\nCourt: ${(judge as any).court?.name}\nPart: ${judge.part || "N/A"}\nPreferences: ${judge.preferences || "N/A"}\nPet Peeves: ${judge.petPeeves || "N/A"}\nMotion Practice: ${judge.motionPractice || "N/A"}\nRules: ${judge.specificRules.map((r: any) => r.title + ": " + r.description).join("\n")}`;
      const result = await aiRouter.complete({
        feature: "judge-analysis",
        systemPrompt: "You are a legal assistant. Analyze this judge's profile and provide practical advice for attorneys appearing before them. Be specific and actionable.",
        userPrompt: `Analyze this judge's profile and rules:\n\n${judgeInfo}`,
      });
      return { judge: judge.name, court: (judge as any).court?.name, analysis: result.content };
    }),

  "ai.generateFilingChecklist": publicProcedure
    .input(z.object({ courtId: z.string(), judgeId: z.string().optional(), filingType: z.string() }))
    .query(async ({ ctx, input }) => {
      const courtRules = await ctx.db.courtFilingRule.findMany({ where: { courtId: input.courtId, isActive: true } });
      const matching = courtRules.filter((r: any) => {
        if (!r.filingTypes) return false;
        const types = JSON.parse(r.filingTypes);
        return types.includes("all") || types.includes(input.filingType);
      });
      let judgeRules: any[] = [];
      if (input.judgeId) {
        judgeRules = await ctx.db.judgeSpecificRule.findMany({ where: { judgeId: input.judgeId, isActive: true } });
      }
      const checklist = matching.map((r: any, i: number) => ({
        order: i + 1, source: "court", title: r.title, severity: r.severity, category: r.category,
        items: r.checklist ? JSON.parse(r.checklist) : [], tips: r.tips ? JSON.parse(r.tips) : [],
        commonMistakes: r.commonMistakes ? JSON.parse(r.commonMistakes) : [],
        penalty: r.penaltyForNonCompliance,
      }));
      const judgeItems = judgeRules.map((r: any, i: number) => ({
        order: matching.length + i + 1, source: "judge", title: r.title, severity: r.severity, category: r.category,
        items: [], tips: [], commonMistakes: [], penalty: null,
      }));
      return { filingType: input.filingType, courtId: input.courtId, judgeId: input.judgeId, checklist: [...checklist, ...judgeItems] };
    }),

  // ─── Reports (51-54) ─────────────────────────────────────────────

  "reports.courtUsage": publicProcedure.query(async ({ ctx }) => {
    const courts = await ctx.db.court.findMany({ where: { isActive: true }, include: { _count: { select: { courtAssignments: true } } }, orderBy: { name: "asc" } });
    return courts.map((c: any) => ({ id: c.id, name: c.name, assignmentCount: c._count.courtAssignments }));
  }),

  "reports.ruleCompliance": publicProcedure
    .input(z.object({ matterId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      const [pending, acknowledged, completed, dismissed, overridden] = await Promise.all([
        ctx.db.courtRuleReminder.count({ where: { ...where, status: "RMS_PENDING" as any } }),
        ctx.db.courtRuleReminder.count({ where: { ...where, status: "RMS_ACKNOWLEDGED" as any } }),
        ctx.db.courtRuleReminder.count({ where: { ...where, status: "RMS_COMPLETED" as any } }),
        ctx.db.courtRuleReminder.count({ where: { ...where, status: "RMS_DISMISSED" as any } }),
        ctx.db.courtRuleReminder.count({ where: { ...where, status: "RMS_OVERRIDDEN" as any } }),
      ]);
      const total = pending + acknowledged + completed + dismissed + overridden;
      return { total, pending, acknowledged, completed, dismissed, overridden, complianceRate: total > 0 ? Math.round((completed / total) * 100) : 0 };
    }),

  "reports.judgeAnalytics": publicProcedure.query(async ({ ctx }) => {
    const judges = await ctx.db.judgeProfile.findMany({ where: { isActive: true }, include: { _count: { select: { assignments: true, specificRules: true } } }, orderBy: { name: "asc" } });
    return judges.map((j: any) => ({ id: j.id, name: j.name, courtId: j.courtId, assignmentCount: j._count.courtAssignments, ruleCount: j._count.specificRules }));
  }),

  "reports.reminderEffectiveness": publicProcedure.query(async ({ ctx }) => {
    const [pending, acknowledged, completed, dismissed, overridden] = await Promise.all([
      ctx.db.courtRuleReminder.count({ where: { status: "RMS_PENDING" as any } }),
      ctx.db.courtRuleReminder.count({ where: { status: "RMS_ACKNOWLEDGED" as any } }),
      ctx.db.courtRuleReminder.count({ where: { status: "RMS_COMPLETED" as any } }),
      ctx.db.courtRuleReminder.count({ where: { status: "RMS_DISMISSED" as any } }),
      ctx.db.courtRuleReminder.count({ where: { status: "RMS_OVERRIDDEN" as any } }),
    ]);
    const total = pending + acknowledged + completed + dismissed + overridden;
    return {
      total, pending, acknowledged, completed, dismissed, overridden,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      acknowledgeRate: total > 0 ? Math.round(((acknowledged + completed) / total) * 100) : 0,
      dismissRate: total > 0 ? Math.round(((dismissed + overridden) / total) * 100) : 0,
    };
  }),
});
