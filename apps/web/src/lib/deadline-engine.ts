import { db } from "@/lib/db";
import * as aiRouter from "@/lib/ai-router";

// ---------------------------------------------------------------------------
// 1. Court Holidays Data (hardcoded for speed + DB fallback)
// ---------------------------------------------------------------------------

export const HOLIDAYS: Array<{ name: string; date: string; jurisdiction: string }> = [
  { name: "New Year's Day", date: "2026-01-01", jurisdiction: "all" },
  { name: "MLK Day", date: "2026-01-19", jurisdiction: "all" },
  { name: "Lincoln's Birthday", date: "2026-02-12", jurisdiction: "ny_state" },
  { name: "Presidents' Day", date: "2026-02-16", jurisdiction: "all" },
  { name: "Memorial Day", date: "2026-05-25", jurisdiction: "all" },
  { name: "Juneteenth", date: "2026-06-19", jurisdiction: "all" },
  { name: "Independence Day", date: "2026-07-04", jurisdiction: "all" },
  { name: "Labor Day", date: "2026-09-07", jurisdiction: "all" },
  { name: "Columbus Day", date: "2026-10-12", jurisdiction: "all" },
  { name: "Election Day", date: "2026-11-03", jurisdiction: "ny_state" },
  { name: "Veterans Day", date: "2026-11-11", jurisdiction: "all" },
  { name: "Thanksgiving", date: "2026-11-26", jurisdiction: "all" },
  { name: "Day After Thanksgiving", date: "2026-11-27", jurisdiction: "all" },
  { name: "Christmas", date: "2026-12-25", jurisdiction: "all" },
  // 2027
  { name: "New Year's Day", date: "2027-01-01", jurisdiction: "all" },
  { name: "MLK Day", date: "2027-01-18", jurisdiction: "all" },
  { name: "Lincoln's Birthday", date: "2027-02-12", jurisdiction: "ny_state" },
  { name: "Presidents' Day", date: "2027-02-15", jurisdiction: "all" },
  { name: "Memorial Day", date: "2027-05-31", jurisdiction: "all" },
  { name: "Juneteenth", date: "2027-06-19", jurisdiction: "all" },
  { name: "Independence Day", date: "2027-07-04", jurisdiction: "all" },
  { name: "Labor Day", date: "2027-09-06", jurisdiction: "all" },
  { name: "Columbus Day", date: "2027-10-11", jurisdiction: "all" },
  { name: "Election Day", date: "2027-11-02", jurisdiction: "ny_state" },
  { name: "Veterans Day", date: "2027-11-11", jurisdiction: "all" },
  { name: "Thanksgiving", date: "2027-11-25", jurisdiction: "all" },
  { name: "Day After Thanksgiving", date: "2027-11-26", jurisdiction: "all" },
  { name: "Christmas", date: "2027-12-25", jurisdiction: "all" },
];

// ---------------------------------------------------------------------------
// 2. Core Functions
// ---------------------------------------------------------------------------

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isCourtHoliday(
  date: Date,
  jurisdiction: string,
): { isHoliday: boolean; holidayName?: string } {
  const dateStr = date.toISOString().split("T")[0];
  const isNY =
    jurisdiction.startsWith("ny_");
  const isFederal =
    jurisdiction.includes("federal") ||
    jurisdiction.includes("edny") ||
    jurisdiction.includes("sdny");

  for (const h of HOLIDAYS) {
    if (h.date === dateStr) {
      if (h.jurisdiction === "all")
        return { isHoliday: true, holidayName: h.name };
      if (h.jurisdiction === "ny_state" && isNY)
        return { isHoliday: true, holidayName: h.name };
      if (h.jurisdiction === "federal" && isFederal)
        return { isHoliday: true, holidayName: h.name };
    }
  }
  return { isHoliday: false };
}

export function getNextBusinessDay(date: Date, jurisdiction: string): Date {
  const d = new Date(date);
  while (true) {
    if (!isWeekend(d) && !isCourtHoliday(d, jurisdiction).isHoliday) return d;
    d.setDate(d.getDate() + 1);
  }
}

export function addBusinessDays(
  startDate: Date,
  days: number,
  jurisdiction: string,
): Date {
  const d = new Date(startDate);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d) && !isCourtHoliday(d, jurisdiction).isHoliday) added++;
  }
  return d;
}

export function calculateDeadlineDate(
  triggerDate: Date,
  days: number,
  isBusinessDays: boolean,
  jurisdiction: string,
) {
  const trigger = new Date(triggerDate);
  let originalDate: Date;

  if (isBusinessDays) {
    originalDate = addBusinessDays(trigger, days, jurisdiction);
  } else {
    originalDate = new Date(trigger);
    originalDate.setDate(originalDate.getDate() + days);
  }

  const orig = new Date(originalDate);
  let adjustedForWeekend = false;
  let adjustedForHoliday = false;
  let holidayName: string | undefined;

  if (isWeekend(originalDate)) {
    adjustedForWeekend = true;
    originalDate = getNextBusinessDay(originalDate, jurisdiction);
  }
  const holidayCheck = isCourtHoliday(originalDate, jurisdiction);
  if (holidayCheck.isHoliday) {
    adjustedForHoliday = true;
    holidayName = holidayCheck.holidayName;
    originalDate.setDate(originalDate.getDate() + 1);
    originalDate = getNextBusinessDay(originalDate, jurisdiction);
  }

  return {
    deadlineDate: originalDate,
    originalDate: orig,
    adjustedForWeekend,
    adjustedForHoliday,
    holidayName,
  };
}

export function getServiceMethodAdjustment(
  serviceMethod: string,
  jurisdiction: string,
): number {
  const isNY = jurisdiction.startsWith("ny_");
  const isFederal =
    jurisdiction.includes("federal") ||
    jurisdiction.includes("edny") ||
    jurisdiction.includes("sdny");
  const isCA = jurisdiction.startsWith("ca_");

  if (isNY) {
    switch (serviceMethod) {
      case "personal":
        return 0;
      case "first_class_mail":
      case "mail":
        return 5;
      case "nail_and_mail":
        return 11;
      case "substituted":
        return 11;
      case "publication":
        return 30;
      default:
        return 0;
    }
  }
  if (isFederal) {
    switch (serviceMethod) {
      case "personal":
        return 0;
      case "mail":
      case "first_class_mail":
        return 3;
      case "email_consent":
        return 0;
      case "waiver":
        return 0; // but answer time is 60 days not 21
      default:
        return 0;
    }
  }
  if (isCA) {
    switch (serviceMethod) {
      case "personal":
        return 0;
      case "mail":
      case "first_class_mail":
        return 5;
      case "substituted":
        return 10;
      default:
        return 0;
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// 3. Default Deadline Rules
// ---------------------------------------------------------------------------

interface DeadlineRule {
  triggerEvent: string;
  practiceArea: string;
  jurisdiction: string;
  deadlineName: string;
  description: string;
  ruleReference: string;
  category: string;
  calendarDays: number | null;
  businessDays: number | null;
  mailAdditionalDays: number;
  priority: string;
  sortOrder: number;
  dependsOnRule: string | null;
  subServiceAdditionalDays?: number;
  nailMailAdditionalDays?: number;
}

export function getDefaultRules(): DeadlineRule[] {
  return [
    // NY Supreme -- Complaint Served
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_supreme",
      deadlineName: "Answer/Responsive Pleading Due",
      description: "Defendant must file answer or responsive pleading",
      ruleReference: "CPLR 3012(a)",
      category: "responsive_pleading",
      calendarDays: 20,
      businessDays: null,
      mailAdditionalDays: 10,
      priority: "critical",
      sortOrder: 1,
      dependsOnRule: null,
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_supreme",
      deadlineName: "Demand for Bill of Particulars",
      description: "Demand for verified bill of particulars",
      ruleReference: "CPLR 3041",
      category: "discovery",
      calendarDays: 30,
      businessDays: null,
      mailAdditionalDays: 5,
      priority: "high",
      sortOrder: 2,
      dependsOnRule: "Answer/Responsive Pleading Due",
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_supreme",
      deadlineName: "Preliminary Conference Request",
      description:
        "Request for preliminary conference (RJI must be filed)",
      ruleReference: "22 NYCRR 202.12",
      category: "administrative",
      calendarDays: 45,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "normal",
      sortOrder: 3,
      dependsOnRule: null,
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_supreme",
      deadlineName: "Discovery Demand Deadline",
      description:
        "Combined discovery demands (interrogatories, document demands, depositions)",
      ruleReference: "CPLR 3120",
      category: "discovery",
      calendarDays: 120,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 4,
      dependsOnRule: null,
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_supreme",
      deadlineName: "Note of Issue Filing Deadline",
      description:
        "File note of issue to place case on trial calendar",
      ruleReference: "22 NYCRR 202.21",
      category: "trial_prep",
      calendarDays: 365,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 5,
      dependsOnRule: null,
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_supreme",
      deadlineName: "Expert Disclosure Deadline",
      description: "Expert disclosure per preliminary conference order, typically 60 days before trial",
      ruleReference: "22 NYCRR 202.17",
      category: "trial_prep",
      calendarDays: 305,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 6,
      dependsOnRule: null,
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_supreme",
      deadlineName: "Summary Judgment Motion Deadline",
      description: "Last day to file motion for summary judgment",
      ruleReference: "CPLR 3212(a)",
      category: "motion",
      calendarDays: 425,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "critical",
      sortOrder: 7,
      dependsOnRule: "Note of Issue Filing Deadline",
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_supreme",
      deadlineName: "Trial Ready",
      description: "Case must be trial ready per court scheduling order",
      ruleReference: "22 NYCRR 202.21",
      category: "trial_prep",
      calendarDays: 540,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 8,
      dependsOnRule: null,
    },

    // NY Supreme -- Motion Filed
    {
      triggerEvent: "motion_filed",
      practiceArea: "general",
      jurisdiction: "ny_supreme",
      deadlineName: "Opposition Papers Due",
      description:
        "Opposition papers due 7 days before return date",
      ruleReference: "CPLR 2214(b)",
      category: "motion",
      calendarDays: -7,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "critical",
      sortOrder: 1,
      dependsOnRule: null,
    },
    {
      triggerEvent: "motion_filed",
      practiceArea: "general",
      jurisdiction: "ny_supreme",
      deadlineName: "Reply Papers Due",
      description:
        "Reply papers due on return date or per court rules",
      ruleReference: "CPLR 2214(b)",
      category: "motion",
      calendarDays: 0,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 2,
      dependsOnRule: null,
    },
    {
      triggerEvent: "motion_filed",
      practiceArea: "general",
      jurisdiction: "ny_supreme",
      deadlineName: "Decision Expected",
      description:
        "Court must decide within 60 days of submission",
      ruleReference: "22 NYCRR 202.48",
      category: "administrative",
      calendarDays: 60,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "normal",
      sortOrder: 3,
      dependsOnRule: null,
    },

    // NY Supreme -- Note of Issue Filed
    {
      triggerEvent: "note_of_issue_filed",
      practiceArea: "general",
      jurisdiction: "ny_supreme",
      deadlineName: "Summary Judgment Deadline",
      description:
        "Motion for summary judgment must be filed within 60 days",
      ruleReference: "CPLR 3212(a)",
      category: "motion",
      calendarDays: 60,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "critical",
      sortOrder: 1,
      dependsOnRule: null,
    },
    {
      triggerEvent: "note_of_issue_filed",
      practiceArea: "general",
      jurisdiction: "ny_supreme",
      deadlineName: "Strike Note of Issue Motion",
      description: "Motion to vacate note of issue",
      ruleReference: "22 NYCRR 202.21(e)",
      category: "motion",
      calendarDays: 20,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 2,
      dependsOnRule: null,
    },
    {
      triggerEvent: "note_of_issue_filed",
      practiceArea: "general",
      jurisdiction: "ny_supreme",
      deadlineName: "Pre-Trial Conference",
      description: "Pre-trial conference per court scheduling",
      ruleReference: "22 NYCRR 202.26",
      category: "trial_prep",
      calendarDays: 90,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "normal",
      sortOrder: 3,
      dependsOnRule: null,
    },
    {
      triggerEvent: "note_of_issue_filed",
      practiceArea: "general",
      jurisdiction: "ny_supreme",
      deadlineName: "Trial Date",
      description: "Trial date per court scheduling",
      ruleReference: "22 NYCRR 202.21",
      category: "trial_prep",
      calendarDays: 180,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "critical",
      sortOrder: 4,
      dependsOnRule: null,
    },

    // NY Supreme -- Discovery Commenced
    {
      triggerEvent: "discovery_commenced",
      practiceArea: "general",
      jurisdiction: "ny_supreme",
      deadlineName: "Document Demand Response",
      description: "Response to document demands",
      ruleReference: "CPLR 3122",
      category: "discovery",
      calendarDays: 20,
      businessDays: null,
      mailAdditionalDays: 5,
      priority: "high",
      sortOrder: 1,
      dependsOnRule: null,
    },
    {
      triggerEvent: "discovery_commenced",
      practiceArea: "general",
      jurisdiction: "ny_supreme",
      deadlineName: "Interrogatory Responses",
      description: "Answers to interrogatories due",
      ruleReference: "CPLR 3133",
      category: "discovery",
      calendarDays: 20,
      businessDays: null,
      mailAdditionalDays: 5,
      priority: "high",
      sortOrder: 2,
      dependsOnRule: null,
    },
    {
      triggerEvent: "discovery_commenced",
      practiceArea: "general",
      jurisdiction: "ny_supreme",
      deadlineName: "Deposition Scheduling",
      description: "Depositions must be scheduled per preliminary conference order",
      ruleReference: "CPLR 3107",
      category: "discovery",
      calendarDays: 60,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "normal",
      sortOrder: 3,
      dependsOnRule: null,
    },
    {
      triggerEvent: "discovery_commenced",
      practiceArea: "general",
      jurisdiction: "ny_supreme",
      deadlineName: "Expert Disclosure Deadline",
      description: "Expert disclosure deadline per court order",
      ruleReference: "22 NYCRR 202.17",
      category: "discovery",
      calendarDays: 120,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 4,
      dependsOnRule: null,
    },
    {
      triggerEvent: "discovery_commenced",
      practiceArea: "general",
      jurisdiction: "ny_supreme",
      deadlineName: "Discovery Cutoff",
      description: "All discovery must be completed per preliminary conference order",
      ruleReference: "22 NYCRR 202.12",
      category: "discovery",
      calendarDays: 180,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "critical",
      sortOrder: 5,
      dependsOnRule: null,
    },

    // Federal EDNY -- Complaint Served
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_federal_edny",
      deadlineName: "Answer Due",
      description: "Answer or responsive pleading due",
      ruleReference: "FRCP 12(a)(1)",
      category: "responsive_pleading",
      calendarDays: 21,
      businessDays: null,
      mailAdditionalDays: 3,
      priority: "critical",
      sortOrder: 1,
      dependsOnRule: null,
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_federal_edny",
      deadlineName: "Rule 26(f) Conference",
      description:
        "Parties must confer at least 21 days before scheduling conference",
      ruleReference: "FRCP 26(f)",
      category: "discovery",
      calendarDays: 60,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 2,
      dependsOnRule: null,
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_federal_edny",
      deadlineName: "Initial Disclosures",
      description:
        "Initial disclosures due 14 days after Rule 26(f) conference",
      ruleReference: "FRCP 26(a)(1)",
      category: "discovery",
      calendarDays: 74,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 3,
      dependsOnRule: "Rule 26(f) Conference",
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_federal_edny",
      deadlineName: "Fact Discovery Cutoff",
      description: "Fact discovery closes per scheduling order",
      ruleReference: "FRCP 16(b)",
      category: "discovery",
      calendarDays: 270,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 4,
      dependsOnRule: null,
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_federal_edny",
      deadlineName: "Expert Reports Due",
      description:
        "Expert witness reports due per scheduling order",
      ruleReference: "FRCP 26(a)(2)",
      category: "discovery",
      calendarDays: 300,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 5,
      dependsOnRule: null,
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_federal_edny",
      deadlineName: "Rebuttal Expert Reports",
      description:
        "Rebuttal expert reports due 30 days after initial reports",
      ruleReference: "FRCP 26(a)(2)(D)",
      category: "discovery",
      calendarDays: 330,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 6,
      dependsOnRule: "Expert Reports Due",
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_federal_edny",
      deadlineName: "Discovery Plan Due",
      description: "Discovery plan due per scheduling conference",
      ruleReference: "FRCP 26(f)",
      category: "discovery",
      calendarDays: 90,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "normal",
      sortOrder: 6,
      dependsOnRule: "Rule 26(f) Conference",
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_federal_edny",
      deadlineName: "Discovery Cutoff",
      description: "All discovery must be completed per scheduling order",
      ruleReference: "FRCP 16(b)",
      category: "discovery",
      calendarDays: 300,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "critical",
      sortOrder: 7,
      dependsOnRule: null,
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_federal_edny",
      deadlineName: "Dispositive Motion Deadline",
      description: "Last day for dispositive motions",
      ruleReference: "Per scheduling order",
      category: "motion",
      calendarDays: 360,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "critical",
      sortOrder: 8,
      dependsOnRule: null,
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_federal_edny",
      deadlineName: "Pre-Trial Order Due",
      description: "Joint pre-trial order due per court order",
      ruleReference: "FRCP 16(e)",
      category: "trial_prep",
      calendarDays: 390,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 9,
      dependsOnRule: null,
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_federal_edny",
      deadlineName: "Joint Pre-Trial Conference",
      description: "Joint pre-trial conference per scheduling order",
      ruleReference: "FRCP 16",
      category: "trial_prep",
      calendarDays: 400,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 10,
      dependsOnRule: null,
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_federal_edny",
      deadlineName: "Trial Date",
      description: "Trial date per scheduling order",
      ruleReference: "FRCP 16",
      category: "trial_prep",
      calendarDays: 450,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "critical",
      sortOrder: 11,
      dependsOnRule: null,
    },

    // Federal SDNY -- Complaint Served
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_federal_sdny",
      deadlineName: "Answer Due",
      description: "Answer or responsive pleading due",
      ruleReference: "FRCP 12(a)(1)",
      category: "responsive_pleading",
      calendarDays: 21,
      businessDays: null,
      mailAdditionalDays: 3,
      priority: "critical",
      sortOrder: 1,
      dependsOnRule: null,
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_federal_sdny",
      deadlineName: "Rule 26(f) Conference",
      description: "Parties must confer",
      ruleReference: "FRCP 26(f)",
      category: "discovery",
      calendarDays: 60,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 2,
      dependsOnRule: null,
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_federal_sdny",
      deadlineName: "Initial Disclosures",
      description:
        "Initial disclosures due 14 days after 26(f) conference",
      ruleReference: "FRCP 26(a)(1)",
      category: "discovery",
      calendarDays: 74,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 3,
      dependsOnRule: "Rule 26(f) Conference",
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_federal_sdny",
      deadlineName: "Fact Discovery Cutoff",
      description: "Fact discovery closes",
      ruleReference: "FRCP 16(b)",
      category: "discovery",
      calendarDays: 270,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 4,
      dependsOnRule: null,
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_federal_sdny",
      deadlineName: "Expert Reports Due",
      description: "Expert reports due",
      ruleReference: "FRCP 26(a)(2)",
      category: "discovery",
      calendarDays: 300,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 5,
      dependsOnRule: null,
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_federal_sdny",
      deadlineName: "Rebuttal Expert Reports",
      description: "Rebuttal expert reports due 30 days after initial reports",
      ruleReference: "FRCP 26(a)(2)(D)",
      category: "discovery",
      calendarDays: 330,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 6,
      dependsOnRule: "Expert Reports Due",
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_federal_sdny",
      deadlineName: "Discovery Cutoff",
      description: "All discovery must be completed",
      ruleReference: "FRCP 16(b)",
      category: "discovery",
      calendarDays: 300,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "critical",
      sortOrder: 7,
      dependsOnRule: null,
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_federal_sdny",
      deadlineName: "Dispositive Motion Deadline",
      description: "Last day for dispositive motions",
      ruleReference: "Per scheduling order",
      category: "motion",
      calendarDays: 360,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "critical",
      sortOrder: 8,
      dependsOnRule: null,
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_federal_sdny",
      deadlineName: "Pre-Trial Order Due",
      description: "Joint pre-trial order due per court order",
      ruleReference: "FRCP 16(e)",
      category: "trial_prep",
      calendarDays: 390,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 9,
      dependsOnRule: null,
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "general",
      jurisdiction: "ny_federal_sdny",
      deadlineName: "Trial Date",
      description: "Trial date per scheduling order",
      ruleReference: "FRCP 16",
      category: "trial_prep",
      calendarDays: 450,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "critical",
      sortOrder: 10,
      dependsOnRule: null,
    },

    // Federal EDNY -- Motion Filed
    {
      triggerEvent: "motion_filed",
      practiceArea: "general",
      jurisdiction: "ny_federal_edny",
      deadlineName: "Opposition Due",
      description: "Opposition papers due",
      ruleReference: "Local Rule 6.1",
      category: "motion",
      calendarDays: 14,
      businessDays: null,
      mailAdditionalDays: 3,
      priority: "critical",
      sortOrder: 1,
      dependsOnRule: null,
    },
    {
      triggerEvent: "motion_filed",
      practiceArea: "general",
      jurisdiction: "ny_federal_edny",
      deadlineName: "Reply Due",
      description:
        "Reply papers due 7 days after opposition",
      ruleReference: "Local Rule 6.1",
      category: "motion",
      calendarDays: 21,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 2,
      dependsOnRule: "Opposition Due",
    },

    // Federal SDNY -- Motion Filed
    {
      triggerEvent: "motion_filed",
      practiceArea: "general",
      jurisdiction: "ny_federal_sdny",
      deadlineName: "Opposition Due",
      description: "Opposition papers due",
      ruleReference: "Local Rule 6.1",
      category: "motion",
      calendarDays: 14,
      businessDays: null,
      mailAdditionalDays: 3,
      priority: "critical",
      sortOrder: 1,
      dependsOnRule: null,
    },
    {
      triggerEvent: "motion_filed",
      practiceArea: "general",
      jurisdiction: "ny_federal_sdny",
      deadlineName: "Reply Due",
      description: "Reply papers due",
      ruleReference: "Local Rule 6.1",
      category: "motion",
      calendarDays: 21,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 2,
      dependsOnRule: "Opposition Due",
    },

    // Federal EDNY -- Motion Filed: Decision Expected
    {
      triggerEvent: "motion_filed",
      practiceArea: "general",
      jurisdiction: "ny_federal_edny",
      deadlineName: "Decision Expected",
      description: "No fixed deadline for federal court decisions",
      ruleReference: "Per court practice",
      category: "administrative",
      calendarDays: 90,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "low",
      sortOrder: 3,
      dependsOnRule: null,
    },
    {
      triggerEvent: "motion_filed",
      practiceArea: "general",
      jurisdiction: "ny_federal_sdny",
      deadlineName: "Decision Expected",
      description: "No fixed deadline for federal court decisions",
      ruleReference: "Per court practice",
      category: "administrative",
      calendarDays: 90,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "low",
      sortOrder: 3,
      dependsOnRule: null,
    },

    // NY PI additions
    {
      triggerEvent: "complaint_served",
      practiceArea: "personal_injury",
      jurisdiction: "ny_supreme",
      deadlineName: "90-Day Demand for Complaint",
      description:
        "If defendant: demand plaintiff serve complaint within 90 days",
      ruleReference: "CPLR 3012(b)",
      category: "responsive_pleading",
      calendarDays: 90,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 10,
      dependsOnRule: null,
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "personal_injury",
      jurisdiction: "ny_supreme",
      deadlineName: "IME Scheduling",
      description: "Independent medical examination scheduling after bill of particulars served",
      ruleReference: "CPLR 3121",
      category: "discovery",
      calendarDays: 60,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "normal",
      sortOrder: 11,
      dependsOnRule: "Demand for Bill of Particulars",
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "personal_injury",
      jurisdiction: "ny_supreme",
      deadlineName: "No-Fault / Insurance Disclosure",
      description: "No-fault and insurance disclosure per case requirements",
      ruleReference: "CPLR 3101",
      category: "discovery",
      calendarDays: 45,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "normal",
      sortOrder: 12,
      dependsOnRule: null,
    },
    {
      triggerEvent: "complaint_served",
      practiceArea: "personal_injury",
      jurisdiction: "ny_supreme",
      deadlineName: "Mediation Deadline",
      description: "Mediation deadline per court part rules",
      ruleReference: "22 NYCRR 202.12",
      category: "administrative",
      calendarDays: 270,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "normal",
      sortOrder: 13,
      dependsOnRule: null,
    },

    // NY Family Court
    {
      triggerEvent: "petition_filed",
      practiceArea: "family_law",
      jurisdiction: "ny_family",
      deadlineName: "Return Date",
      description: "Court appearance on return date",
      ruleReference: "FCA",
      category: "administrative",
      calendarDays: 21,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "critical",
      sortOrder: 1,
      dependsOnRule: null,
    },
    {
      triggerEvent: "petition_filed",
      practiceArea: "family_law",
      jurisdiction: "ny_family",
      deadlineName: "Answer Due",
      description:
        "Answer to petition due on or before return date",
      ruleReference: "FCA",
      category: "responsive_pleading",
      calendarDays: 20,
      businessDays: null,
      mailAdditionalDays: 5,
      priority: "critical",
      sortOrder: 2,
      dependsOnRule: null,
    },
    {
      triggerEvent: "petition_filed",
      practiceArea: "family_law",
      jurisdiction: "ny_family",
      deadlineName: "Discovery (Limited)",
      description: "Limited discovery per court order",
      ruleReference: "FCA 165",
      category: "discovery",
      calendarDays: 45,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "normal",
      sortOrder: 3,
      dependsOnRule: null,
    },
    {
      triggerEvent: "petition_filed",
      practiceArea: "family_law",
      jurisdiction: "ny_family",
      deadlineName: "Hearing / Trial Date",
      description: "Hearing or trial date per court scheduling",
      ruleReference: "FCA",
      category: "trial_prep",
      calendarDays: 90,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 4,
      dependsOnRule: null,
    },
    {
      triggerEvent: "petition_filed",
      practiceArea: "family_law",
      jurisdiction: "ny_family",
      deadlineName: "Order to Show Cause",
      description: "Order to show cause as scheduled by court",
      ruleReference: "FCA",
      category: "motion",
      calendarDays: 14,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "critical",
      sortOrder: 5,
      dependsOnRule: null,
    },

    // NY Surrogate
    {
      triggerEvent: "probate_filed",
      practiceArea: "estate_planning",
      jurisdiction: "ny_surrogate",
      deadlineName: "Citation Return Date",
      description: "Return date on citation",
      ruleReference: "SCPA",
      category: "administrative",
      calendarDays: 28,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "critical",
      sortOrder: 1,
      dependsOnRule: null,
    },
    {
      triggerEvent: "probate_filed",
      practiceArea: "estate_planning",
      jurisdiction: "ny_surrogate",
      deadlineName: "Objections Due",
      description: "Deadline for filing objections to probate",
      ruleReference: "SCPA",
      category: "responsive_pleading",
      calendarDays: 28,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "critical",
      sortOrder: 2,
      dependsOnRule: null,
    },
    {
      triggerEvent: "probate_filed",
      practiceArea: "estate_planning",
      jurisdiction: "ny_surrogate",
      deadlineName: "SCPA 1404 Examination",
      description:
        "Notice for examination of attesting witnesses",
      ruleReference: "SCPA 1404",
      category: "discovery",
      calendarDays: 10,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 3,
      dependsOnRule: null,
    },
    {
      triggerEvent: "probate_filed",
      practiceArea: "estate_planning",
      jurisdiction: "ny_surrogate",
      deadlineName: "Accounting Deadline",
      description: "Accounting deadline per court order",
      ruleReference: "SCPA 2208",
      category: "filing",
      calendarDays: 180,
      businessDays: null,
      mailAdditionalDays: 0,
      priority: "high",
      sortOrder: 4,
      dependsOnRule: null,
    },
  ];
}

// ---------------------------------------------------------------------------
// 4. Chain Calculation
// ---------------------------------------------------------------------------

export interface ChainDeadline {
  name: string;
  description: string;
  ruleReference: string;
  category: string;
  baseCalcDays: number;
  adjustmentDays: number;
  totalDays: number;
  deadlineDate: Date;
  originalDate: Date;
  adjustedForWeekend: boolean;
  adjustedForHoliday: boolean;
  holidayName?: string;
  isBusinessDays: boolean;
  priority: string;
  sortOrder: number;
  dependsOnRule: string | null;
  reminderDays: number[];
}

export function calculateFullChain(
  triggerEvent: string,
  triggerDate: Date,
  practiceArea: string,
  jurisdiction: string,
  serviceMethod?: string,
): ChainDeadline[] {
  const allRules = getDefaultRules();
  // Filter rules: match triggerEvent + jurisdiction, and practiceArea matches or is "general"
  let rules = allRules.filter(
    (r) =>
      r.triggerEvent === triggerEvent &&
      r.jurisdiction === jurisdiction &&
      (r.practiceArea === practiceArea || r.practiceArea === "general"),
  );

  // If no exact jurisdiction match, try general
  if (rules.length === 0) {
    rules = allRules.filter(
      (r) =>
        r.triggerEvent === triggerEvent &&
        r.practiceArea === "general" &&
        r.jurisdiction === jurisdiction,
    );
  }

  const serviceAdj = serviceMethod
    ? getServiceMethodAdjustment(serviceMethod, jurisdiction)
    : 0;

  const results: ChainDeadline[] = [];

  for (const rule of rules) {
    const baseDays = rule.calendarDays ?? rule.businessDays ?? 0;
    const isBusinessDays =
      rule.businessDays !== null &&
      rule.businessDays !== undefined &&
      rule.calendarDays === null;
    let adjDays = 0;

    // Add service method days based on type
    if (serviceMethod === "first_class_mail" || serviceMethod === "mail") {
      adjDays = rule.mailAdditionalDays;
    } else if (serviceMethod === "substituted") {
      adjDays =
        rule.subServiceAdditionalDays || rule.mailAdditionalDays;
    } else if (serviceMethod === "nail_and_mail") {
      adjDays =
        rule.nailMailAdditionalDays || rule.mailAdditionalDays;
    } else {
      adjDays =
        serviceAdj > 0 && rule.category === "responsive_pleading"
          ? serviceAdj
          : 0;
    }

    const totalDays = baseDays + adjDays;
    const calc = calculateDeadlineDate(
      triggerDate,
      Math.abs(totalDays),
      isBusinessDays,
      jurisdiction,
    );

    const reminderDays =
      rule.priority === "critical"
        ? [30, 14, 7, 3, 1]
        : rule.priority === "high"
          ? [14, 7, 3, 1]
          : [7, 3, 1];

    results.push({
      name: rule.deadlineName,
      description: rule.description,
      ruleReference: rule.ruleReference,
      category: rule.category,
      baseCalcDays: baseDays,
      adjustmentDays: adjDays,
      totalDays,
      deadlineDate: calc.deadlineDate,
      originalDate: calc.originalDate,
      adjustedForWeekend: calc.adjustedForWeekend,
      adjustedForHoliday: calc.adjustedForHoliday,
      holidayName: calc.holidayName,
      isBusinessDays,
      priority: rule.priority,
      sortOrder: rule.sortOrder,
      dependsOnRule: rule.dependsOnRule,
      reminderDays,
    });
  }

  // Sort by deadline date
  results.sort((a, b) => a.deadlineDate.getTime() - b.deadlineDate.getTime());
  return results;
}

// ---------------------------------------------------------------------------
// 5. AI Natural Language Parser
// ---------------------------------------------------------------------------

export async function parseTriggerEvent(input: string): Promise<{
  triggerEvent: string;
  triggerDate: string;
  serviceMethod?: string;
  practiceArea?: string;
  jurisdiction?: string;
  additionalContext?: string;
}> {
  const result = await aiRouter.complete({
    feature: "deadline_calculator",
    systemPrompt: `You are a legal deadline parser. Extract the trigger event, date, service method, practice area, and jurisdiction from an attorney's description. Today's date is ${new Date().toISOString().split("T")[0]}.

Return JSON only with these fields:
- triggerEvent: one of "complaint_served", "motion_filed", "note_of_issue_filed", "discovery_commenced", "trial_date_set", "appeal_filed", "petition_filed", "probate_filed", "custom"
- triggerDate: ISO date string (YYYY-MM-DD)
- serviceMethod: one of "personal", "substituted", "nail_and_mail", "first_class_mail", "publication", "email_consent", "waiver" or null
- practiceArea: one of "personal_injury", "family_law", "immigration", "corporate", "litigation", "criminal", "real_estate", "estate_planning", "general" or null
- jurisdiction: one of "ny_supreme", "ny_federal_edny", "ny_federal_sdny", "ny_family", "ny_surrogate", "ca_superior", "federal_general" or null
- additionalContext: any other relevant details`,
    userPrompt: input,
  });

  try {
    return JSON.parse(result.content);
  } catch {
    return {
      triggerEvent: "custom",
      triggerDate: new Date().toISOString().split("T")[0],
      additionalContext: input,
    };
  }
}

// ---------------------------------------------------------------------------
// 6. Chain Management Functions
// ---------------------------------------------------------------------------

export async function createDeadlineChain(params: {
  matterId?: string;
  name: string;
  triggerEvent: string;
  triggerDate: Date;
  triggerDescription?: string;
  practiceArea: string;
  jurisdiction: string;
  serviceMethod?: string;
  courtId?: string;
  userId: string;
  firmId: string;
}) {
  const chain = await (db as any).deadlineChain.create({
    data: {
      matterId: params.matterId,
      name: params.name,
      triggerEvent: params.triggerEvent,
      triggerDate: params.triggerDate,
      triggerDescription: params.triggerDescription,
      practiceArea: params.practiceArea,
      jurisdiction: params.jurisdiction,
      serviceMethod: params.serviceMethod,
      courtId: params.courtId,
      userId: params.userId,
      firmId: params.firmId,
    },
  });

  const deadlines = calculateFullChain(
    params.triggerEvent,
    params.triggerDate,
    params.practiceArea,
    params.jurisdiction,
    params.serviceMethod,
  );

  const created = [];
  for (const dl of deadlines) {
    const d = await (db as any).calculatedDeadline.create({
      data: {
        chainId: chain.id,
        name: dl.name,
        description: dl.description,
        ruleReference: dl.ruleReference,
        category: dl.category,
        baseCalcDays: dl.baseCalcDays,
        adjustmentDays: dl.adjustmentDays,
        totalDays: dl.totalDays,
        deadlineDate: dl.deadlineDate,
        originalDate: dl.originalDate,
        adjustedForWeekend: dl.adjustedForWeekend,
        adjustedForHoliday: dl.adjustedForHoliday,
        holidayName: dl.holidayName,
        isBusinessDays: dl.isBusinessDays,
        priority: dl.priority,
        sortOrder: dl.sortOrder,
        reminderDays: JSON.stringify(dl.reminderDays),
        matterId: params.matterId,
        userId: params.userId,
        firmId: params.firmId,
      },
    });
    created.push(d);
  }

  return { chain, deadlines: created };
}

export async function recalculateChain(chainId: string) {
  const chain = await (db as any).deadlineChain.findUnique({
    where: { id: chainId },
  });
  if (!chain) throw new Error("Chain not found");

  // Delete existing deadlines
  await (db as any).calculatedDeadline.deleteMany({ where: { chainId } });

  const deadlines = calculateFullChain(
    chain.triggerEvent,
    chain.triggerDate,
    chain.practiceArea,
    chain.jurisdiction,
    chain.serviceMethod,
  );

  const created = [];
  for (const dl of deadlines) {
    const d = await (db as any).calculatedDeadline.create({
      data: {
        chainId,
        name: dl.name,
        description: dl.description,
        ruleReference: dl.ruleReference,
        category: dl.category,
        baseCalcDays: dl.baseCalcDays,
        adjustmentDays: dl.adjustmentDays,
        totalDays: dl.totalDays,
        deadlineDate: dl.deadlineDate,
        originalDate: dl.originalDate,
        adjustedForWeekend: dl.adjustedForWeekend,
        adjustedForHoliday: dl.adjustedForHoliday,
        holidayName: dl.holidayName,
        isBusinessDays: dl.isBusinessDays,
        priority: dl.priority,
        sortOrder: dl.sortOrder,
        reminderDays: JSON.stringify(dl.reminderDays),
        matterId: chain.matterId,
        userId: chain.userId,
        firmId: chain.firmId,
      },
    });
    created.push(d);
  }

  return { chain, deadlines: created };
}

export async function markDeadlineCompleted(deadlineId: string) {
  return (db as any).calculatedDeadline.update({
    where: { id: deadlineId },
    data: { status: "completed", completedAt: new Date() },
  });
}

export async function extendDeadline(
  deadlineId: string,
  newDate: Date,
  reason: string,
) {
  return (db as any).calculatedDeadline.update({
    where: { id: deadlineId },
    data: {
      status: "extended",
      extendedTo: newDate,
      extensionReason: reason,
      deadlineDate: newDate,
    },
  });
}

export async function applyStay(
  chainId: string,
  stayStart: Date,
  stayEnd: Date,
  reason?: string,
) {
  await (db as any).deadlineChain.update({
    where: { id: chainId },
    data: {
      status: "stayed",
      stayStartDate: stayStart,
      stayEndDate: stayEnd,
      ...(reason ? { notes: `Stay reason: ${reason}` } : {}),
    },
  });

  // Recalculate pending deadlines by adding stay duration
  const stayDays = Math.ceil(
    (stayEnd.getTime() - stayStart.getTime()) / 86400000,
  );
  const deadlines = await (db as any).calculatedDeadline.findMany({
    where: {
      chainId,
      status: "pending",
      deadlineDate: { gte: stayStart },
    },
  });

  for (const dl of deadlines) {
    const newDate = new Date(dl.deadlineDate.getTime() + stayDays * 86400000);
    await (db as any).calculatedDeadline.update({
      where: { id: dl.id },
      data: { deadlineDate: newDate },
    });
  }
}

export async function syncToCalendar(chainId: string) {
  try {
    const deadlines = await (db as any).calculatedDeadline.findMany({
      where: { chainId, status: "pending" },
    });
    const chain = await (db as any).deadlineChain.findUnique({
      where: { id: chainId },
    });
    if (!chain) return;

    for (const dl of deadlines) {
      const existing = await db.calendarEvent.findFirst({
        where: {
          sourceType: "deadline_calculator",
          sourceId: dl.id,
        } as any,
      });

      const eventType =
        dl.category === "responsive_pleading"
          ? "court_filing"
          : dl.category === "motion"
            ? "court_hearing"
            : "matter_deadline";

      if (!existing) {
        const evt = await db.calendarEvent.create({
          data: {
            title: `${dl.name} — ${chain.name}`,
            startTime: dl.deadlineDate,
            endTime: dl.deadlineDate,
            eventType,
            sourceType: "deadline_calculator",
            sourceId: dl.id,
            matterId: chain.matterId,
            userId: chain.userId,
            firmId: chain.firmId,
          } as any,
        });
        await (db as any).calculatedDeadline.update({
          where: { id: dl.id },
          data: { calendarEventId: (evt as any).id },
        });
      }
    }
  } catch {
    /* calendar sync is optional */
  }
}

export async function exportTimeline(
  chainId: string,
  format: "pdf" | "csv",
): Promise<{ content: string; filename: string; mimeType: string }> {
  let chain: any;
  let deadlines: any[];

  if (chainId === "sample-chain-1") {
    const sample = getSampleChain();
    chain = sample.chain;
    deadlines = sample.deadlines;
  } else {
    chain = await (db as any).deadlineChain.findUnique({
      where: { id: chainId },
    });
    if (!chain) throw new Error("Chain not found");
    deadlines = await (db as any).calculatedDeadline.findMany({
      where: { chainId },
      orderBy: { deadlineDate: "asc" },
    });
  }

  if (format === "csv") {
    const headers = [
      "Deadline Name",
      "Date",
      "Original Date",
      "Days from Trigger",
      "Category",
      "Priority",
      "Status",
      "Rule Reference",
      "Description",
      "Adjusted for Weekend",
      "Adjusted for Holiday",
      "Holiday Name",
      "Business Days",
    ];

    const rows = deadlines.map((d: any) => [
      d.name,
      new Date(d.deadlineDate).toISOString().split("T")[0],
      new Date(d.originalDate).toISOString().split("T")[0],
      d.totalDays,
      d.category,
      d.priority,
      d.status,
      d.ruleReference || "",
      (d.description || "").replace(/"/g, '""'),
      d.adjustedForWeekend ? "Yes" : "No",
      d.adjustedForHoliday ? "Yes" : "No",
      d.holidayName || "",
      d.isBusinessDays ? "Yes" : "No",
    ]);

    const csvContent =
      headers.join(",") +
      "\n" +
      rows.map((r: any[]) => r.map((c: any) => `"${c}"`).join(",")).join("\n");

    return {
      content: csvContent,
      filename: `${chain.name.replace(/[^a-zA-Z0-9]/g, "_")}_timeline.csv`,
      mimeType: "text/csv",
    };
  }

  // PDF: generate HTML-based printable content
  const deadlineRows = deadlines
    .map(
      (d: any) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${new Date(d.deadlineDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600;">${d.name}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${d.ruleReference || ""}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${d.category}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${d.priority}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${d.status}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${d.description || ""}</td>
        </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html><head><title>${chain.name} - Deadline Timeline</title>
<style>body{font-family:system-ui,sans-serif;padding:40px;color:#1e293b;}
table{width:100%;border-collapse:collapse;margin-top:20px;}
th{text-align:left;padding:8px;border-bottom:2px solid #1e293b;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;}
td{font-size:13px;}</style></head>
<body>
<h1 style="margin-bottom:4px;">${chain.name}</h1>
<p style="color:#64748b;">Trigger: ${chain.triggerEvent} | Date: ${new Date(chain.triggerDate).toLocaleDateString()} | Jurisdiction: ${chain.jurisdiction}</p>
<table>
<thead><tr><th>Date</th><th>Deadline</th><th>Rule</th><th>Category</th><th>Priority</th><th>Status</th><th>Description</th></tr></thead>
<tbody>${deadlineRows}</tbody>
</table>
<p style="margin-top:30px;color:#94a3b8;font-size:11px;">Generated by Managal Smart Deadline Calculator on ${new Date().toLocaleDateString()}</p>
</body></html>`;

  return {
    content: html,
    filename: `${chain.name.replace(/[^a-zA-Z0-9]/g, "_")}_timeline.html`,
    mimeType: format === "pdf" ? "text/html" : "text/html",
  };
}

export function getSampleChain() {
  const triggerDate = new Date(2026, 2, 1); // March 1, 2026
  const deadlines = calculateFullChain(
    "complaint_served",
    triggerDate,
    "personal_injury",
    "ny_supreme",
    "personal",
  );
  return {
    chain: {
      id: "sample-chain-1",
      name: "Smith v. Jones — Post-Service Deadlines",
      triggerEvent: "complaint_served",
      triggerDate,
      triggerDescription:
        "Complaint served on defendant via personal service",
      practiceArea: "personal_injury",
      jurisdiction: "ny_supreme",
      serviceMethod: "personal",
      status: "active",
      matterId: null,
    },
    deadlines: deadlines.map((d, i) => ({
      id: `sample-dl-${i}`,
      chainId: "sample-chain-1",
      ...d,
      status: d.deadlineDate < new Date() ? "completed" : "pending",
      completedAt: d.deadlineDate < new Date() ? d.deadlineDate : null,
    })),
  };
}
