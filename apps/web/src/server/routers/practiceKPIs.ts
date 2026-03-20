import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";
import * as kpiEngine from "@/lib/kpi-engine";

// ── Seed data: all ~120 KPIs across 7 practice areas ──────────────────
const SEED_DASHBOARDS: { practiceArea: string; name: string; description: string; kpis: { name: string; kpiType: string; category: string; widgetType: string; widgetWidth: string; targetDirection: string; benchmark: number | null; displayFormat: string; description: string }[] }[] = [
  {
    practiceArea: "personal_injury", name: "Personal Injury KPIs", description: "Key metrics for PI practice management",
    kpis: [
      { name: "Total Active Cases", kpiType: "KPI_COUNT", category: "Caseload", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 85, displayFormat: "#,##0", description: "Number of currently active PI cases" },
      { name: "New Cases This Month", kpiType: "KPI_COUNT", category: "Caseload", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 15, displayFormat: "#,##0", description: "New PI cases opened this period" },
      { name: "Cases Settled This Month", kpiType: "KPI_COUNT", category: "Caseload", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 10, displayFormat: "#,##0", description: "Number of cases settled this period" },
      { name: "Average Case Age (Days)", kpiType: "KPI_DURATION_DAYS", category: "Caseload", widgetType: "KW_GAUGE", widgetWidth: "WW_QUARTER", targetDirection: "TD_LOWER_IS_BETTER", benchmark: 365, displayFormat: "#,##0 days", description: "Average age of active cases in days" },
      { name: "Settlement Rate", kpiType: "KPI_PERCENTAGE", category: "Outcomes", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 92, displayFormat: "#0.0%", description: "Percentage of cases resolved via settlement" },
      { name: "Average Settlement Amount", kpiType: "KPI_CURRENCY", category: "Financial", widgetType: "KW_STAT_CARD", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 45000, displayFormat: "$#,##0", description: "Average settlement value" },
      { name: "Total Settlements Value", kpiType: "KPI_CURRENCY", category: "Financial", widgetType: "KW_STAT_CARD", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 450000, displayFormat: "$#,##0", description: "Total value of all settlements this period" },
      { name: "Average Fee Per Case", kpiType: "KPI_CURRENCY", category: "Financial", widgetType: "KW_STAT_CARD", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 15000, displayFormat: "$#,##0", description: "Average attorney fee earned per settled case" },
      { name: "Revenue This Month", kpiType: "KPI_CURRENCY", category: "Financial", widgetType: "KW_LINE_CHART", widgetWidth: "WW_HALF", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 150000, displayFormat: "$#,##0", description: "Total revenue for the period" },
      { name: "Demand-to-Settlement Ratio", kpiType: "KPI_RATIO", category: "Outcomes", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 3.5, displayFormat: "#0.0x", description: "Ratio of initial demand to final settlement" },
      { name: "Medical Treatment Completion Rate", kpiType: "KPI_PERCENTAGE", category: "Case Progress", widgetType: "KW_PROGRESS_BAR", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 85, displayFormat: "#0.0%", description: "Pct of cases with completed medical treatment" },
      { name: "Lien Resolution Rate", kpiType: "KPI_PERCENTAGE", category: "Case Progress", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 90, displayFormat: "#0.0%", description: "Percentage of liens resolved before disbursement" },
      { name: "Average Time to Demand", kpiType: "KPI_DURATION_DAYS", category: "Efficiency", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_LOWER_IS_BETTER", benchmark: 180, displayFormat: "#,##0 days", description: "Average days from intake to demand letter" },
      { name: "Average Time to Settlement", kpiType: "KPI_DURATION_DAYS", category: "Efficiency", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_LOWER_IS_BETTER", benchmark: 270, displayFormat: "#,##0 days", description: "Average days from intake to settlement" },
      { name: "Cases in Litigation", kpiType: "KPI_COUNT", category: "Caseload", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_LOWER_IS_BETTER", benchmark: 15, displayFormat: "#,##0", description: "Number of cases that have entered litigation" },
      { name: "Litigation Rate", kpiType: "KPI_PERCENTAGE", category: "Outcomes", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_LOWER_IS_BETTER", benchmark: 12, displayFormat: "#0.0%", description: "Percentage of cases going to litigation" },
      { name: "Client Satisfaction Score", kpiType: "KPI_PERCENTAGE", category: "Client", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 90, displayFormat: "#0.0%", description: "Average client satisfaction rating" },
      { name: "Referral Rate", kpiType: "KPI_PERCENTAGE", category: "Client", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 35, displayFormat: "#0.0%", description: "Percentage of new cases from referrals" },
      { name: "Pre-Litigation Settlement Rate", kpiType: "KPI_PERCENTAGE", category: "Outcomes", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 80, displayFormat: "#0.0%", description: "Pct of cases settled without filing suit" },
      { name: "Pipeline Value", kpiType: "KPI_CURRENCY", category: "Financial", widgetType: "KW_STAT_CARD", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 2000000, displayFormat: "$#,##0", description: "Total estimated value of active case pipeline" },
      { name: "Cost Per Case", kpiType: "KPI_CURRENCY", category: "Financial", widgetType: "KW_BAR_CHART", widgetWidth: "WW_THIRD", targetDirection: "TD_LOWER_IS_BETTER", benchmark: 3500, displayFormat: "$#,##0", description: "Average cost incurred per case" },
      { name: "Case Rejection Rate", kpiType: "KPI_PERCENTAGE", category: "Intake", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_TARGET_EXACT", benchmark: 40, displayFormat: "#0.0%", description: "Percentage of intakes declined" },
    ],
  },
  {
    practiceArea: "family", name: "Family Law KPIs", description: "Key metrics for family law practice",
    kpis: [
      { name: "Total Active Cases", kpiType: "KPI_COUNT", category: "Caseload", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 60, displayFormat: "#,##0", description: "Active family law matters" },
      { name: "New Cases This Month", kpiType: "KPI_COUNT", category: "Caseload", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 12, displayFormat: "#,##0", description: "New family law cases opened" },
      { name: "Cases Closed This Month", kpiType: "KPI_COUNT", category: "Caseload", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 8, displayFormat: "#,##0", description: "Cases resolved this period" },
      { name: "Average Case Duration (Days)", kpiType: "KPI_DURATION_DAYS", category: "Efficiency", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_LOWER_IS_BETTER", benchmark: 180, displayFormat: "#,##0 days", description: "Average time to resolve family matters" },
      { name: "Mediation Success Rate", kpiType: "KPI_PERCENTAGE", category: "Outcomes", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 65, displayFormat: "#0.0%", description: "Pct of cases resolved through mediation" },
      { name: "Contested vs Uncontested Ratio", kpiType: "KPI_RATIO", category: "Caseload", widgetType: "KW_PIE_CHART", widgetWidth: "WW_THIRD", targetDirection: "TD_LOWER_IS_BETTER", benchmark: 1.5, displayFormat: "#0.0:1", description: "Ratio of contested to uncontested divorces" },
      { name: "Revenue This Month", kpiType: "KPI_CURRENCY", category: "Financial", widgetType: "KW_LINE_CHART", widgetWidth: "WW_HALF", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 120000, displayFormat: "$#,##0", description: "Total family law revenue" },
      { name: "Average Fee Per Case", kpiType: "KPI_CURRENCY", category: "Financial", widgetType: "KW_STAT_CARD", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 8500, displayFormat: "$#,##0", description: "Average fee earned per closed case" },
      { name: "Retainer Utilization Rate", kpiType: "KPI_PERCENTAGE", category: "Financial", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 85, displayFormat: "#0.0%", description: "Pct of retainer funds applied to billings" },
      { name: "Billable Hours Per Attorney", kpiType: "KPI_NUMBER", category: "Productivity", widgetType: "KW_BAR_CHART", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 140, displayFormat: "#,##0 hrs", description: "Monthly billable hours per attorney" },
      { name: "Custody Dispute Rate", kpiType: "KPI_PERCENTAGE", category: "Caseload", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_LOWER_IS_BETTER", benchmark: 30, displayFormat: "#0.0%", description: "Pct of cases involving custody disputes" },
      { name: "Support Modification Rate", kpiType: "KPI_PERCENTAGE", category: "Caseload", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_TARGET_EXACT", benchmark: 15, displayFormat: "#0.0%", description: "Pct of cases that are support modifications" },
      { name: "Client Satisfaction Score", kpiType: "KPI_PERCENTAGE", category: "Client", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 88, displayFormat: "#0.0%", description: "Average client satisfaction rating" },
      { name: "Court Appearance Rate", kpiType: "KPI_RATE", category: "Efficiency", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_LOWER_IS_BETTER", benchmark: 75, displayFormat: "#0.0%", description: "Average court appearances per case" },
      { name: "Emergency/Ex-Parte Motions", kpiType: "KPI_COUNT", category: "Caseload", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_LOWER_IS_BETTER", benchmark: 5, displayFormat: "#,##0", description: "Emergency motions filed this period" },
      { name: "Accounts Receivable (Days)", kpiType: "KPI_DURATION_DAYS", category: "Financial", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_LOWER_IS_BETTER", benchmark: 45, displayFormat: "#,##0 days", description: "Average days to collect payment" },
      { name: "Asset Discovery Completion", kpiType: "KPI_PERCENTAGE", category: "Case Progress", widgetType: "KW_PROGRESS_BAR", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 90, displayFormat: "#0.0%", description: "Pct of divorce cases with completed asset discovery" },
      { name: "Referral Rate", kpiType: "KPI_PERCENTAGE", category: "Client", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 30, displayFormat: "#0.0%", description: "Pct of new cases from referrals" },
      { name: "Document Turnaround (Days)", kpiType: "KPI_DURATION_DAYS", category: "Efficiency", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_LOWER_IS_BETTER", benchmark: 5, displayFormat: "#0.0 days", description: "Average days to prepare key documents" },
      { name: "Collaborative Law Cases", kpiType: "KPI_COUNT", category: "Caseload", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 8, displayFormat: "#,##0", description: "Number of collaborative law cases" },
    ],
  },
  {
    practiceArea: "criminal", name: "Criminal Defense KPIs", description: "Key metrics for criminal defense practice",
    kpis: [
      { name: "Total Active Cases", kpiType: "KPI_COUNT", category: "Caseload", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 50, displayFormat: "#,##0", description: "Active criminal defense cases" },
      { name: "New Cases This Month", kpiType: "KPI_COUNT", category: "Caseload", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 10, displayFormat: "#,##0", description: "New cases opened this period" },
      { name: "Cases Resolved This Month", kpiType: "KPI_COUNT", category: "Caseload", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 8, displayFormat: "#,##0", description: "Cases disposed this period" },
      { name: "Acquittal Rate", kpiType: "KPI_PERCENTAGE", category: "Outcomes", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 25, displayFormat: "#0.0%", description: "Pct of trial cases resulting in acquittal" },
      { name: "Dismissal Rate", kpiType: "KPI_PERCENTAGE", category: "Outcomes", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 30, displayFormat: "#0.0%", description: "Pct of cases dismissed" },
      { name: "Plea Bargain Rate", kpiType: "KPI_PERCENTAGE", category: "Outcomes", widgetType: "KW_PIE_CHART", widgetWidth: "WW_THIRD", targetDirection: "TD_TARGET_EXACT", benchmark: 55, displayFormat: "#0.0%", description: "Pct of cases resolved via plea bargain" },
      { name: "Charge Reduction Rate", kpiType: "KPI_PERCENTAGE", category: "Outcomes", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 65, displayFormat: "#0.0%", description: "Pct of cases with reduced charges" },
      { name: "Average Case Duration (Days)", kpiType: "KPI_DURATION_DAYS", category: "Efficiency", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_LOWER_IS_BETTER", benchmark: 120, displayFormat: "#,##0 days", description: "Average time to resolution" },
      { name: "Trial Rate", kpiType: "KPI_PERCENTAGE", category: "Outcomes", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_TARGET_EXACT", benchmark: 8, displayFormat: "#0.0%", description: "Pct of cases going to trial" },
      { name: "Revenue This Month", kpiType: "KPI_CURRENCY", category: "Financial", widgetType: "KW_LINE_CHART", widgetWidth: "WW_HALF", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 100000, displayFormat: "$#,##0", description: "Total criminal defense revenue" },
      { name: "Average Fee Per Case", kpiType: "KPI_CURRENCY", category: "Financial", widgetType: "KW_STAT_CARD", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 7500, displayFormat: "$#,##0", description: "Average fee per resolved case" },
      { name: "Bail Hearing Success Rate", kpiType: "KPI_PERCENTAGE", category: "Outcomes", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 75, displayFormat: "#0.0%", description: "Pct of bail hearings with favorable outcome" },
      { name: "Client Satisfaction Score", kpiType: "KPI_PERCENTAGE", category: "Client", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 85, displayFormat: "#0.0%", description: "Average client satisfaction rating" },
      { name: "Motion Success Rate", kpiType: "KPI_PERCENTAGE", category: "Efficiency", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 55, displayFormat: "#0.0%", description: "Pct of motions granted" },
      { name: "Felony vs Misdemeanor Ratio", kpiType: "KPI_RATIO", category: "Caseload", widgetType: "KW_PIE_CHART", widgetWidth: "WW_THIRD", targetDirection: "TD_TARGET_EXACT", benchmark: 1.2, displayFormat: "#0.0:1", description: "Ratio of felony to misdemeanor cases" },
      { name: "Retained vs Court-Appointed Ratio", kpiType: "KPI_RATIO", category: "Caseload", widgetType: "KW_PIE_CHART", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 2.0, displayFormat: "#0.0:1", description: "Ratio of retained to appointed clients" },
    ],
  },
  {
    practiceArea: "immigration", name: "Immigration KPIs", description: "Key metrics for immigration practice",
    kpis: [
      { name: "Total Active Cases", kpiType: "KPI_COUNT", category: "Caseload", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 75, displayFormat: "#,##0", description: "Active immigration matters" },
      { name: "New Cases This Month", kpiType: "KPI_COUNT", category: "Caseload", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 12, displayFormat: "#,##0", description: "New cases opened this period" },
      { name: "Cases Completed This Month", kpiType: "KPI_COUNT", category: "Caseload", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 8, displayFormat: "#,##0", description: "Petitions/apps approved or resolved" },
      { name: "Overall Approval Rate", kpiType: "KPI_PERCENTAGE", category: "Outcomes", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 88, displayFormat: "#0.0%", description: "Pct of applications approved" },
      { name: "RFE Rate", kpiType: "KPI_PERCENTAGE", category: "Quality", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_LOWER_IS_BETTER", benchmark: 15, displayFormat: "#0.0%", description: "Pct of filings receiving RFE" },
      { name: "RFE Overcome Rate", kpiType: "KPI_PERCENTAGE", category: "Quality", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 85, displayFormat: "#0.0%", description: "Pct of RFEs successfully overcome" },
      { name: "Average Processing Time (Days)", kpiType: "KPI_DURATION_DAYS", category: "Efficiency", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_LOWER_IS_BETTER", benchmark: 180, displayFormat: "#,##0 days", description: "Average USCIS processing time" },
      { name: "Revenue This Month", kpiType: "KPI_CURRENCY", category: "Financial", widgetType: "KW_LINE_CHART", widgetWidth: "WW_HALF", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 90000, displayFormat: "$#,##0", description: "Total immigration revenue" },
      { name: "Average Fee Per Case", kpiType: "KPI_CURRENCY", category: "Financial", widgetType: "KW_STAT_CARD", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 5000, displayFormat: "$#,##0", description: "Average fee per completed case" },
      { name: "Visa Category Breakdown", kpiType: "KPI_COUNT", category: "Caseload", widgetType: "KW_PIE_CHART", widgetWidth: "WW_THIRD", targetDirection: "TD_TARGET_EXACT", benchmark: null, displayFormat: "#,##0", description: "Distribution of cases by visa category" },
      { name: "Deadline Compliance Rate", kpiType: "KPI_PERCENTAGE", category: "Quality", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 99, displayFormat: "#0.0%", description: "Pct of filings submitted before deadline" },
      { name: "Client Satisfaction Score", kpiType: "KPI_PERCENTAGE", category: "Client", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 90, displayFormat: "#0.0%", description: "Average client satisfaction rating" },
      { name: "Premium Processing Usage", kpiType: "KPI_PERCENTAGE", category: "Efficiency", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_TARGET_EXACT", benchmark: 25, displayFormat: "#0.0%", description: "Pct of eligible cases using premium processing" },
      { name: "Denial Rate", kpiType: "KPI_PERCENTAGE", category: "Outcomes", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_LOWER_IS_BETTER", benchmark: 5, displayFormat: "#0.0%", description: "Pct of applications denied" },
      { name: "Appeal Success Rate", kpiType: "KPI_PERCENTAGE", category: "Outcomes", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 60, displayFormat: "#0.0%", description: "Pct of appeals won" },
      { name: "Compliance Audit Score", kpiType: "KPI_PERCENTAGE", category: "Quality", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 95, displayFormat: "#0.0%", description: "I-9 and compliance audit scores" },
    ],
  },
  {
    practiceArea: "corporate", name: "Corporate Law KPIs", description: "Key metrics for corporate/transactional practice",
    kpis: [
      { name: "Total Active Matters", kpiType: "KPI_COUNT", category: "Caseload", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 40, displayFormat: "#,##0", description: "Active corporate matters" },
      { name: "New Engagements This Month", kpiType: "KPI_COUNT", category: "Caseload", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 6, displayFormat: "#,##0", description: "New corporate engagements" },
      { name: "Deals Closed This Month", kpiType: "KPI_COUNT", category: "Caseload", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 4, displayFormat: "#,##0", description: "Transactions completed this period" },
      { name: "Average Deal Value", kpiType: "KPI_CURRENCY", category: "Financial", widgetType: "KW_STAT_CARD", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 500000, displayFormat: "$#,##0", description: "Average value of closed transactions" },
      { name: "Revenue This Month", kpiType: "KPI_CURRENCY", category: "Financial", widgetType: "KW_LINE_CHART", widgetWidth: "WW_HALF", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 200000, displayFormat: "$#,##0", description: "Total corporate practice revenue" },
      { name: "Average Closing Time (Days)", kpiType: "KPI_DURATION_DAYS", category: "Efficiency", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_LOWER_IS_BETTER", benchmark: 45, displayFormat: "#,##0 days", description: "Average days from engagement to closing" },
      { name: "Retainer Utilization Rate", kpiType: "KPI_PERCENTAGE", category: "Financial", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 90, displayFormat: "#0.0%", description: "Pct of retainer funds utilized" },
      { name: "Deal Closure Rate", kpiType: "KPI_PERCENTAGE", category: "Outcomes", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 75, displayFormat: "#0.0%", description: "Pct of engagements resulting in closed deal" },
      { name: "Billable Hours Per Attorney", kpiType: "KPI_NUMBER", category: "Productivity", widgetType: "KW_BAR_CHART", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 160, displayFormat: "#,##0 hrs", description: "Monthly billable hours per attorney" },
      { name: "Client Retention Rate", kpiType: "KPI_PERCENTAGE", category: "Client", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 85, displayFormat: "#0.0%", description: "Pct of corporate clients retained year over year" },
      { name: "Due Diligence Completion Rate", kpiType: "KPI_PERCENTAGE", category: "Quality", widgetType: "KW_PROGRESS_BAR", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 95, displayFormat: "#0.0%", description: "Pct of DD checklists completed on time" },
      { name: "Cross-Sell Rate", kpiType: "KPI_PERCENTAGE", category: "Client", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 20, displayFormat: "#0.0%", description: "Pct of corporate clients using additional services" },
    ],
  },
  {
    practiceArea: "real_estate", name: "Real Estate KPIs", description: "Key metrics for real estate practice",
    kpis: [
      { name: "Total Active Transactions", kpiType: "KPI_COUNT", category: "Caseload", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 30, displayFormat: "#,##0", description: "Active real estate transactions" },
      { name: "Transactions Closed This Month", kpiType: "KPI_COUNT", category: "Caseload", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 8, displayFormat: "#,##0", description: "Closings completed this period" },
      { name: "Average Transaction Value", kpiType: "KPI_CURRENCY", category: "Financial", widgetType: "KW_STAT_CARD", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 450000, displayFormat: "$#,##0", description: "Average value of closed transactions" },
      { name: "Revenue This Month", kpiType: "KPI_CURRENCY", category: "Financial", widgetType: "KW_LINE_CHART", widgetWidth: "WW_HALF", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 80000, displayFormat: "$#,##0", description: "Total real estate practice revenue" },
      { name: "Average Closing Time (Days)", kpiType: "KPI_DURATION_DAYS", category: "Efficiency", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_LOWER_IS_BETTER", benchmark: 45, displayFormat: "#,##0 days", description: "Average days from contract to closing" },
      { name: "Title Issue Rate", kpiType: "KPI_PERCENTAGE", category: "Quality", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_LOWER_IS_BETTER", benchmark: 12, displayFormat: "#0.0%", description: "Pct of transactions with title issues" },
      { name: "Client Satisfaction Score", kpiType: "KPI_PERCENTAGE", category: "Client", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 92, displayFormat: "#0.0%", description: "Average client satisfaction rating" },
      { name: "Commercial vs Residential Ratio", kpiType: "KPI_RATIO", category: "Caseload", widgetType: "KW_PIE_CHART", widgetWidth: "WW_THIRD", targetDirection: "TD_TARGET_EXACT", benchmark: 0.8, displayFormat: "#0.0:1", description: "Ratio of commercial to residential deals" },
      { name: "Average Fee Per Transaction", kpiType: "KPI_CURRENCY", category: "Financial", widgetType: "KW_STAT_CARD", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 3500, displayFormat: "$#,##0", description: "Average fee earned per closing" },
      { name: "Escrow Discrepancy Rate", kpiType: "KPI_PERCENTAGE", category: "Quality", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_LOWER_IS_BETTER", benchmark: 3, displayFormat: "#0.0%", description: "Pct of closings with escrow issues" },
    ],
  },
  {
    practiceArea: "general_litigation", name: "General Litigation KPIs", description: "Key metrics for general litigation practice",
    kpis: [
      { name: "Total Active Cases", kpiType: "KPI_COUNT", category: "Caseload", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 45, displayFormat: "#,##0", description: "Active litigation matters" },
      { name: "New Cases This Month", kpiType: "KPI_COUNT", category: "Caseload", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 8, displayFormat: "#,##0", description: "New litigation cases opened" },
      { name: "Cases Resolved This Month", kpiType: "KPI_COUNT", category: "Caseload", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 6, displayFormat: "#,##0", description: "Cases disposed this period" },
      { name: "Win Rate", kpiType: "KPI_PERCENTAGE", category: "Outcomes", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 65, displayFormat: "#0.0%", description: "Pct of cases with favorable outcome" },
      { name: "Settlement Before Trial Rate", kpiType: "KPI_PERCENTAGE", category: "Outcomes", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 70, displayFormat: "#0.0%", description: "Pct of cases settled pre-trial" },
      { name: "Average Case Duration (Days)", kpiType: "KPI_DURATION_DAYS", category: "Efficiency", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_LOWER_IS_BETTER", benchmark: 240, displayFormat: "#,##0 days", description: "Average time to disposition" },
      { name: "Revenue This Month", kpiType: "KPI_CURRENCY", category: "Financial", widgetType: "KW_LINE_CHART", widgetWidth: "WW_HALF", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 130000, displayFormat: "$#,##0", description: "Total litigation revenue" },
      { name: "Average Fee Per Case", kpiType: "KPI_CURRENCY", category: "Financial", widgetType: "KW_STAT_CARD", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 12000, displayFormat: "$#,##0", description: "Average fee per resolved case" },
      { name: "Motion Success Rate", kpiType: "KPI_PERCENTAGE", category: "Outcomes", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 60, displayFormat: "#0.0%", description: "Pct of motions granted" },
      { name: "Discovery Completion Rate", kpiType: "KPI_PERCENTAGE", category: "Case Progress", widgetType: "KW_PROGRESS_BAR", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 85, displayFormat: "#0.0%", description: "Pct of cases with completed discovery" },
      { name: "Billable Hours Per Attorney", kpiType: "KPI_NUMBER", category: "Productivity", widgetType: "KW_BAR_CHART", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 150, displayFormat: "#,##0 hrs", description: "Monthly billable hours per attorney" },
      { name: "Client Satisfaction Score", kpiType: "KPI_PERCENTAGE", category: "Client", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 87, displayFormat: "#0.0%", description: "Average client satisfaction rating" },
      { name: "Collection Rate", kpiType: "KPI_PERCENTAGE", category: "Financial", widgetType: "KW_GAUGE", widgetWidth: "WW_THIRD", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 92, displayFormat: "#0.0%", description: "Pct of billed fees collected" },
      { name: "Summary Judgment Success Rate", kpiType: "KPI_PERCENTAGE", category: "Outcomes", widgetType: "KW_STAT_CARD", widgetWidth: "WW_QUARTER", targetDirection: "TD_HIGHER_IS_BETTER", benchmark: 40, displayFormat: "#0.0%", description: "Pct of summary judgment motions granted" },
    ],
  },
];

export const practiceKPIsRouter = router({
  // ── Dashboards (1-8) ──────────────────────────────────────────────
  "dashboards.list": publicProcedure.query(async ({ ctx }) => {
    return ctx.db.practiceKPIDashboard.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { kpis: true } } } });
  }),

  "dashboards.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.practiceKPIDashboard.findUniqueOrThrow({ where: { id: input.id }, include: { kpis: { orderBy: { position: "asc" } } } });
    }),

  "dashboards.getForPracticeArea": publicProcedure
    .input(z.object({ practiceArea: z.string(), departmentId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { practiceArea: input.practiceArea, isActive: true };
      if (input.departmentId) where.departmentId = input.departmentId;
      return ctx.db.practiceKPIDashboard.findMany({ where, include: { kpis: { orderBy: { position: "asc" } } } });
    }),

  "dashboards.create": publicProcedure
    .input(z.object({ practiceArea: z.string(), name: z.string(), description: z.string().optional(), departmentId: z.string().optional(), isDefault: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.practiceKPIDashboard.create({ data: input });
    }),

  "dashboards.update": publicProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), description: z.string().optional(), isActive: z.boolean().optional(), isDefault: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.practiceKPIDashboard.update({ where: { id }, data });
    }),

  "dashboards.delete": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.practiceKPIDashboard.delete({ where: { id: input.id } });
    }),

  "dashboards.duplicate": publicProcedure
    .input(z.object({ id: z.string(), newName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const src = await ctx.db.practiceKPIDashboard.findUniqueOrThrow({ where: { id: input.id }, include: { kpis: true } });
      const dash = await ctx.db.practiceKPIDashboard.create({ data: { practiceArea: src.practiceArea, name: input.newName, description: src.description, departmentId: src.departmentId } });
      for (const kpi of src.kpis) {
        const { id: _, dashboardId: __, createdAt: ___, updatedAt: ____, snapshots: _____, ...kpiData } = kpi as any;
        await ctx.db.kPIDefinition.create({ data: { ...kpiData, dashboardId: dash.id } });
      }
      return dash;
    }),

  "dashboards.seed": publicProcedure.mutation(async ({ ctx }) => {
    const results: any[] = [];
    for (const seed of SEED_DASHBOARDS) {
      const existing = await ctx.db.practiceKPIDashboard.findFirst({ where: { practiceArea: seed.practiceArea, isDefault: true } });
      if (existing) { results.push({ practiceArea: seed.practiceArea, status: "exists", id: existing.id }); continue; }
      const dash = await ctx.db.practiceKPIDashboard.create({ data: { practiceArea: seed.practiceArea, name: seed.name, description: seed.description, isDefault: true } });
      for (let i = 0; i < seed.kpis.length; i++) {
        const k = seed.kpis[i];
        await ctx.db.kPIDefinition.create({
          data: {
            dashboardId: dash.id, name: k.name, description: k.description, kpiType: k.kpiType as any,
            category: k.category, widgetType: k.widgetType as any, widgetWidth: k.widgetWidth as any,
            targetDirection: k.targetDirection as any, industryBenchmark: k.benchmark, displayFormat: k.displayFormat,
            position: i, isVisible: true, aiInsightEnabled: true,
          },
        });
      }
      results.push({ practiceArea: seed.practiceArea, status: "created", id: dash.id, kpiCount: seed.kpis.length });
    }
    return results;
  }),

  // ── KPI Definitions (9-15) ────────────────────────────────────────
  "kpis.list": publicProcedure
    .input(z.object({ dashboardId: z.string(), category: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { dashboardId: input.dashboardId };
      if (input.category) where.category = input.category;
      return ctx.db.kPIDefinition.findMany({ where, orderBy: { position: "asc" } });
    }),

  "kpis.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.kPIDefinition.findUniqueOrThrow({ where: { id: input.id }, include: { snapshots: { orderBy: { calculatedAt: "desc" }, take: 1 } } });
    }),

  "kpis.create": publicProcedure
    .input(z.object({ dashboardId: z.string(), name: z.string(), kpiType: z.string(), category: z.string(), description: z.string().optional(), widgetType: z.string().optional(), widgetWidth: z.string().optional(), targetDirection: z.string().optional(), targetValue: z.number().optional(), industryBenchmark: z.number().optional(), displayFormat: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const maxPos = await ctx.db.kPIDefinition.aggregate({ where: { dashboardId: input.dashboardId }, _max: { position: true } });
      return ctx.db.kPIDefinition.create({ data: { ...input, kpiType: input.kpiType as any, widgetType: (input.widgetType || "KW_STAT_CARD") as any, widgetWidth: (input.widgetWidth || "WW_THIRD") as any, targetDirection: (input.targetDirection || "TD_HIGHER_IS_BETTER") as any, position: (maxPos._max.position ?? -1) + 1 } });
    }),

  "kpis.update": publicProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), description: z.string().optional(), kpiType: z.string().optional(), category: z.string().optional(), widgetType: z.string().optional(), widgetWidth: z.string().optional(), targetDirection: z.string().optional(), targetValue: z.number().optional(), industryBenchmark: z.number().optional(), displayFormat: z.string().optional(), aiInsightEnabled: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, kpiType, widgetType, widgetWidth, targetDirection, ...rest } = input;
      const data: any = { ...rest };
      if (kpiType) data.kpiType = kpiType as any;
      if (widgetType) data.widgetType = widgetType as any;
      if (widgetWidth) data.widgetWidth = widgetWidth as any;
      if (targetDirection) data.targetDirection = targetDirection as any;
      return ctx.db.kPIDefinition.update({ where: { id }, data });
    }),

  "kpis.delete": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.kPIDefinition.delete({ where: { id: input.id } });
    }),

  "kpis.reorder": publicProcedure
    .input(z.object({ items: z.array(z.object({ id: z.string(), position: z.number() })) }))
    .mutation(async ({ ctx, input }) => {
      for (const item of input.items) {
        await ctx.db.kPIDefinition.update({ where: { id: item.id }, data: { position: item.position } });
      }
      return { updated: input.items.length };
    }),

  "kpis.toggleVisibility": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const kpi = await ctx.db.kPIDefinition.findUniqueOrThrow({ where: { id: input.id } });
      return ctx.db.kPIDefinition.update({ where: { id: input.id }, data: { isVisible: !kpi.isVisible } });
    }),

  // ── Calculation (16-19) ───────────────────────────────────────────
  "calculate.single": publicProcedure
    .input(z.object({ kpiId: z.string(), period: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const kpi = await ctx.db.kPIDefinition.findUniqueOrThrow({ where: { id: input.kpiId }, include: { dashboard: true } });
      return kpiEngine.calculateKPI(kpi, input.period, kpi.dashboard.practiceArea);
    }),

  "calculate.dashboard": publicProcedure
    .input(z.object({ dashboardId: z.string(), period: z.string(), periodType: z.string().default("MONTHLY") }))
    .mutation(async ({ input }) => {
      return kpiEngine.calculateAllKPIs(input.dashboardId, input.period, input.periodType);
    }),

  "calculate.all": publicProcedure
    .input(z.object({ period: z.string(), periodType: z.string().default("MONTHLY") }))
    .mutation(async ({ ctx, input }) => {
      const dashboards = await ctx.db.practiceKPIDashboard.findMany({ where: { isActive: true } });
      const results: any[] = [];
      for (const d of dashboards) {
        const snaps = await kpiEngine.calculateAllKPIs(d.id, input.period, input.periodType);
        results.push({ dashboardId: d.id, practiceArea: d.practiceArea, snapshots: snaps.length });
      }
      return results;
    }),

  "calculate.practiceArea": publicProcedure
    .input(z.object({ practiceArea: z.string(), period: z.string(), departmentId: z.string().optional() }))
    .mutation(async ({ input }) => {
      const fns: Record<string, (p: string, d?: string) => Promise<any>> = {
        personal_injury: kpiEngine.calculatePIKPIs, family: kpiEngine.calculateFamilyKPIs,
        criminal: kpiEngine.calculateCriminalKPIs, immigration: kpiEngine.calculateImmigrationKPIs,
        corporate: kpiEngine.calculateCorporateKPIs, real_estate: kpiEngine.calculateRealEstateKPIs,
        general_litigation: kpiEngine.calculateLitigationKPIs,
      };
      const fn = fns[input.practiceArea];
      if (!fn) throw new Error(`Unknown practice area: ${input.practiceArea}`);
      return fn(input.period, input.departmentId);
    }),

  // ── Snapshots (20-23) ─────────────────────────────────────────────
  "snapshots.list": publicProcedure
    .input(z.object({ kpiId: z.string(), limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.kPISnapshot.findMany({ where: { kpiId: input.kpiId }, orderBy: { period: "desc" }, take: input.limit });
    }),

  "snapshots.getLatest": publicProcedure
    .input(z.object({ dashboardId: z.string() }))
    .query(async ({ ctx, input }) => {
      const kpis = await ctx.db.kPIDefinition.findMany({ where: { dashboardId: input.dashboardId } });
      const results: any[] = [];
      for (const kpi of kpis) {
        const snap = await ctx.db.kPISnapshot.findFirst({ where: { kpiId: kpi.id }, orderBy: { calculatedAt: "desc" } });
        results.push({ kpi, snapshot: snap });
      }
      return results;
    }),

  "snapshots.getTrend": publicProcedure
    .input(z.object({ kpiId: z.string(), periods: z.number().default(12) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.kPISnapshot.findMany({ where: { kpiId: input.kpiId }, orderBy: { period: "desc" }, take: input.periods });
    }),

  "snapshots.compare": publicProcedure
    .input(z.object({ snapshotIdA: z.string(), snapshotIdB: z.string() }))
    .query(async ({ ctx, input }) => {
      const a = await ctx.db.kPISnapshot.findUniqueOrThrow({ where: { id: input.snapshotIdA }, include: { kpi: true } });
      const b = await ctx.db.kPISnapshot.findUniqueOrThrow({ where: { id: input.snapshotIdB }, include: { kpi: true } });
      const delta = Number(a.value) - Number(b.value);
      const pct = Number(b.value) !== 0 ? (delta / Number(b.value)) * 100 : 0;
      return { a, b, delta, deltaPercent: Math.round(pct * 100) / 100 };
    }),

  // ── AI (24-29) ────────────────────────────────────────────────────
  "ai.insight": publicProcedure
    .input(z.object({ kpiId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const kpi = await ctx.db.kPIDefinition.findUniqueOrThrow({ where: { id: input.kpiId } });
      const snap = await ctx.db.kPISnapshot.findFirst({ where: { kpiId: input.kpiId }, orderBy: { calculatedAt: "desc" } });
      const history = await ctx.db.kPISnapshot.findMany({ where: { kpiId: input.kpiId }, orderBy: { period: "desc" }, take: 6 });
      return { insight: await kpiEngine.generateKPIInsight(kpi, snap, history) };
    }),

  "ai.dashboardSummary": publicProcedure
    .input(z.object({ dashboardId: z.string(), period: z.string() }))
    .mutation(async ({ input }) => {
      return { summary: await kpiEngine.generateDashboardSummary(input.dashboardId, input.period) };
    }),

  "ai.anomalies": publicProcedure
    .input(z.object({ dashboardId: z.string(), periods: z.number().default(12) }))
    .mutation(async ({ input }) => {
      return { anomalies: await kpiEngine.detectAnomalies(input.dashboardId, input.periods) };
    }),

  "ai.predict": publicProcedure
    .input(z.object({ kpiId: z.string(), periodsAhead: z.number().default(3) }))
    .mutation(async ({ input }) => {
      return { predictions: await kpiEngine.predictTrend(input.kpiId, input.periodsAhead) };
    }),

  "ai.comparePracticeAreas": publicProcedure
    .input(z.object({ period: z.string() }))
    .query(async ({ input }) => {
      return { areas: await kpiEngine.comparePracticeAreas(input.period), analysis: null };
    }),

  "ai.benchmarkAnalysis": publicProcedure
    .input(z.object({ dashboardId: z.string(), period: z.string() }))
    .mutation(async ({ input }) => {
      return { analysis: await kpiEngine.benchmarkAnalysis(input.dashboardId, input.period) };
    }),

  // ── Reports (30-33) ───────────────────────────────────────────────
  "reports.dashboard": publicProcedure
    .input(z.object({ dashboardId: z.string(), period: z.string() }))
    .query(async ({ ctx, input }) => {
      const dashboard = await ctx.db.practiceKPIDashboard.findUniqueOrThrow({ where: { id: input.dashboardId }, include: { kpis: { orderBy: { position: "asc" } } } });
      const snapshots = await ctx.db.kPISnapshot.findMany({ where: { dashboardId: input.dashboardId, period: input.period }, include: { kpi: true } });
      const summary = await kpiEngine.generateDashboardSummary(input.dashboardId, input.period);
      return { dashboard, snapshots, summary };
    }),

  "reports.executive": publicProcedure
    .input(z.object({ period: z.string() }))
    .query(async ({ ctx, input }) => {
      const dashboards = await ctx.db.practiceKPIDashboard.findMany({ where: { isActive: true }, include: { kpis: { take: 1, orderBy: { position: "asc" } } } });
      const results: any[] = [];
      for (const d of dashboards) {
        const snap = d.kpis[0] ? await ctx.db.kPISnapshot.findFirst({ where: { kpiId: d.kpis[0].id, period: input.period } }) : null;
        results.push({ practiceArea: d.practiceArea, name: d.name, keyMetric: d.kpis[0]?.name, value: snap?.value ?? null, status: snap?.status ?? "KS_NO_DATA" });
      }
      return results;
    }),

  "reports.trend": publicProcedure
    .input(z.object({ kpiIds: z.array(z.string()), periods: z.number().default(12) }))
    .query(async ({ ctx, input }) => {
      const trends: any[] = [];
      for (const kpiId of input.kpiIds) {
        const kpi = await ctx.db.kPIDefinition.findUnique({ where: { id: kpiId } });
        const snaps = await ctx.db.kPISnapshot.findMany({ where: { kpiId }, orderBy: { period: "desc" }, take: input.periods });
        trends.push({ kpi, snapshots: snaps });
      }
      return trends;
    }),

  "reports.export": publicProcedure
    .input(z.object({ dashboardId: z.string(), period: z.string(), format: z.enum(["csv", "json", "pdf"]).default("json") }))
    .query(async ({ ctx, input }) => {
      const dashboard = await ctx.db.practiceKPIDashboard.findUniqueOrThrow({ where: { id: input.dashboardId }, include: { kpis: true } });
      const snapshots = await ctx.db.kPISnapshot.findMany({ where: { dashboardId: input.dashboardId, period: input.period }, include: { kpi: true } });
      return { format: input.format, dashboard: dashboard.name, period: input.period, data: snapshots.map((s) => ({ kpi: s.kpi.name, value: s.value, status: s.status, change: s.changePercent })), exportedAt: new Date() };
    }),
});
