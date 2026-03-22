import { router } from "../trpc";
import { clientsRouter } from "./clients";
import { mattersRouter } from "./matters";
import { timeEntriesRouter } from "./timeEntries";
import { documentsRouter } from "./documents";
import { calendarRouter } from "./calendar";
import { usersRouter } from "./users";
import { invoicesRouter } from "./invoices";
import { trustRouter } from "./trust";
import { tasksRouter } from "./tasks";
import { schedulerRouter } from "./scheduler";
import { intakeFormsRouter } from "./intakeForms";
import { leadsRouter } from "./leads";
import { chatRouter } from "./chat";
import { contactFormRouter } from "./contactForm";
import { conflictsRouter } from "./conflicts";
import { relatedPartiesRouter } from "./relatedParties";
import { signaturesRouter } from "./signatures";
import { analyticsRouter } from "./analytics";
import { campaignsRouter } from "./campaigns";
import { websiteRouter } from "./website";
import { aiAssistantRouter } from "./aiAssistant";
import { researchRouter } from "./research";
import { documentDraftingRouter } from "./documentDrafting";
import { screeningRouter } from "./screening";
import { efilingRouter } from "./efiling";
import { clientPortalRouter } from "./clientPortal";
import { messagingRouter } from "./messaging";
import { billingRemindersRouter } from "./billingReminders";
import { invoiceTemplatesRouter } from "./invoiceTemplates";
import { reportsRouter } from "./reports";
import { dashboardsRouter } from "./dashboards";
import { marketingRoiRouter } from "./marketingRoi";
import { forecastingRouter } from "./forecasting";
import { riskAlertsRouter } from "./riskAlerts";
import { medicalRecordsRouter } from "./medicalRecords";
import { damagesRouter } from "./damages";
import { paymentsRouter } from "./payments";
import { financingRouter } from "./financing";
import { interestRouter } from "./interest";
import { approvalsRouter } from "./approvals";
import { accountingRouter } from "./accounting";
import { reconciliationRouter } from "./reconciliation";
import { integrationsRouter } from "./integrations";
import { docketingRouter } from "./docketing";
import { legalToolsRouter } from "./legalTools";
import { familyLawRouter } from "./familyLaw";
import { docToolsRouter } from "./docTools";
import { collectionsRouter } from "./collections";
import { communicationsRouter } from "./communications";
import { crmIntakeRouter } from "./crmIntake";
import { marketingRouter } from "./marketing";
import { schedulingExtRouter } from "./scheduling-ext";
import { timeTrackingRouter } from "./timeTracking";
import { processServingRouter } from "./processServing";
import { documentStorageRouter } from "./documentStorage";
import { referralsRouter } from "./referrals";
import { piMedicalRouter } from "./piMedical";
import { finInsightsRouter } from "./finInsights";
import { zoomRouter } from "./zoom";
import { complianceRouter } from "./compliance";
import { investigationsRouter } from "./investigations";
import { visualsRouter } from "./visuals";
import { mailRouter } from "./mail";
import { immigrationRouter } from "./immigration";
import { conveyancingRouter } from "./conveyancing";
import { emailRouter } from "./email";
import { lsaRouter } from "./lsa";
import { hrRouter } from "./hr";
import { aiIntegrationRouter } from "./ai";
import { securityRouter } from "./security";
import { practiceAreaRouter } from "./practiceArea";
import { practiceAreaFieldsRouter } from "./practiceAreaFields";
import { marketplaceRouter } from "./marketplace";
import { departmentsRouter } from "./departments";
import { jurisdictionsRouter } from "./jurisdictions";
import { solRouter } from "./sol";
import { practiceKPIsRouter } from "./practiceKPIs";
import { courtRulesRouter } from "./courtRules";
import { voiceNotesRouter } from "./voiceNotes";
import { courtCompanionRouter } from "./courtCompanion";
import { swipeToBillRouter } from "./swipeToBill";
import { offlineSyncRouter } from "./offlineSync";
import { scannerRouter } from "./scanner";
import { mobileSignRouter } from "./mobileSign";
import { notificationsRouter } from "./notifications";

export const appRouter = router({
  clients: clientsRouter,
  matters: mattersRouter,
  timeEntries: timeEntriesRouter,
  documents: documentsRouter,
  calendar: calendarRouter,
  users: usersRouter,
  invoices: invoicesRouter,
  trust: trustRouter,
  tasks: tasksRouter,
  scheduler: schedulerRouter,
  intakeForms: intakeFormsRouter,
  leads: leadsRouter,
  chat: chatRouter,
  contactForm: contactFormRouter,
  conflicts: conflictsRouter,
  relatedParties: relatedPartiesRouter,
  signatures: signaturesRouter,
  analytics: analyticsRouter,
  campaigns: campaignsRouter,
  website: websiteRouter,
  aiAssistant: aiAssistantRouter,
  research: researchRouter,
  drafting: documentDraftingRouter,
  screening: screeningRouter,
  efiling: efilingRouter,
  clientPortal: clientPortalRouter,
  messaging: messagingRouter,
  billingReminders: billingRemindersRouter,
  invoiceTemplates: invoiceTemplatesRouter,
  reports: reportsRouter,
  dashboards: dashboardsRouter,
  marketingRoi: marketingRoiRouter,
  forecasting: forecastingRouter,
  riskAlerts: riskAlertsRouter,
  medicalRecords: medicalRecordsRouter,
  damages: damagesRouter,
  payments: paymentsRouter,
  financing: financingRouter,
  interest: interestRouter,
  approvals: approvalsRouter,
  accounting: accountingRouter,
  reconciliation: reconciliationRouter,
  integrations: integrationsRouter,
  docketing: docketingRouter,
  legalTools: legalToolsRouter,
  familyLaw: familyLawRouter,
  docTools: docToolsRouter,
  collections: collectionsRouter,
  communications: communicationsRouter,
  crmIntake: crmIntakeRouter,
  marketing: marketingRouter,
  schedulingExt: schedulingExtRouter,
  timeTracking: timeTrackingRouter,
  processServing: processServingRouter,
  documentStorage: documentStorageRouter,
  referrals: referralsRouter,
  piMedical: piMedicalRouter,
  finInsights: finInsightsRouter,
  zoom: zoomRouter,
  compliance: complianceRouter,
  investigations: investigationsRouter,
  visuals: visualsRouter,
  mail: mailRouter,
  immigration: immigrationRouter,
  conveyancing: conveyancingRouter,
  email: emailRouter,
  lsa: lsaRouter,
  hr: hrRouter,
  ai: aiIntegrationRouter,
  security: securityRouter,
  practiceArea: practiceAreaRouter,
  practiceAreaFields: practiceAreaFieldsRouter,
  marketplace: marketplaceRouter,
  departments: departmentsRouter,
  jurisdictions: jurisdictionsRouter,
  sol: solRouter,
  practiceKPIs: practiceKPIsRouter,
  courtRules: courtRulesRouter,
  voiceNotes: voiceNotesRouter,
  courtCompanion: courtCompanionRouter,
  swipeToBill: swipeToBillRouter,
  offlineSync: offlineSyncRouter,
  scanner: scannerRouter,
  mobileSign: mobileSignRouter,
  notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;
