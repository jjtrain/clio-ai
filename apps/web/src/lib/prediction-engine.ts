import { db } from "@/lib/db";
import * as aiRouter from "@/lib/ai-router";

// ---------------------------------------------------------------------------
// 1. Default Score Factors
// ---------------------------------------------------------------------------

export interface ScoreFactor {
  factorName: string;
  category: string;
  practiceArea: string | null;
  description: string;
  weightDefault: number;
  inputType: string;
  selectOptions?: Array<{ value: string; label: string; score: number }>;
  autoCalcSource?: string;
  sortOrder: number;
}

export const DEFAULT_FACTORS: ScoreFactor[] = [
  // Liability
  { factorName: "liability_strength", category: "liability", practiceArea: null, description: "How strong is the theory of liability? Consider evidence, witness credibility, and legal standards.", weightDefault: 0.20, inputType: "scale_1_10", sortOrder: 1 },
  { factorName: "comparative_fault", category: "liability", practiceArea: "personal_injury", description: "Degree of comparative/contributory fault attributed to plaintiff.", weightDefault: 0.10, inputType: "scale_1_10", sortOrder: 2 },

  // Damages
  { factorName: "damages_severity", category: "damages", practiceArea: null, description: "Severity and provability of damages (economic + non-economic).", weightDefault: 0.15, inputType: "scale_1_10", sortOrder: 3 },
  { factorName: "insurance_coverage", category: "damages", practiceArea: null, description: "Adequacy of available insurance coverage relative to damages.", weightDefault: 0.08, inputType: "select", selectOptions: [{ value: "excess", label: "Coverage exceeds damages", score: 90 }, { value: "adequate", label: "Coverage adequate", score: 70 }, { value: "limited", label: "Limited coverage", score: 40 }, { value: "minimal", label: "Minimal/no coverage", score: 15 }], sortOrder: 4 },

  // Procedural
  { factorName: "discovery_completeness", category: "procedural", practiceArea: null, description: "How complete is discovery? Are there outstanding demands or deficiencies?", weightDefault: 0.08, inputType: "auto_calculated", autoCalcSource: "document_review_flags", sortOrder: 5 },
  { factorName: "deadline_compliance", category: "procedural", practiceArea: null, description: "Compliance with court deadlines and filing requirements.", weightDefault: 0.05, inputType: "auto_calculated", autoCalcSource: "deadline_calculator", sortOrder: 6 },
  { factorName: "statute_of_limitations_risk", category: "procedural", practiceArea: null, description: "Risk related to statute of limitations timing.", weightDefault: 0.05, inputType: "auto_calculated", autoCalcSource: "sol_tracker", sortOrder: 7 },

  // Strategic
  { factorName: "witness_quality", category: "strategic", practiceArea: null, description: "Quality, availability, and credibility of key witnesses.", weightDefault: 0.08, inputType: "scale_1_10", sortOrder: 8 },
  { factorName: "document_strength", category: "strategic", practiceArea: null, description: "Strength of documentary evidence supporting the case.", weightDefault: 0.07, inputType: "auto_calculated", autoCalcSource: "document_review_risk", sortOrder: 9 },
  { factorName: "expert_quality", category: "strategic", practiceArea: null, description: "Quality of retained experts and their opinions.", weightDefault: 0.06, inputType: "scale_1_10", sortOrder: 10 },

  // External
  { factorName: "jurisdiction_favorability", category: "external", practiceArea: null, description: "How favorable is the jurisdiction for this type of case?", weightDefault: 0.05, inputType: "select", selectOptions: [{ value: "very_favorable", label: "Very favorable", score: 90 }, { value: "favorable", label: "Somewhat favorable", score: 70 }, { value: "neutral", label: "Neutral", score: 50 }, { value: "unfavorable", label: "Somewhat unfavorable", score: 30 }, { value: "very_unfavorable", label: "Very unfavorable", score: 10 }], sortOrder: 11 },
  { factorName: "judge_tendencies", category: "external", practiceArea: null, description: "Assigned judge's known tendencies and track record.", weightDefault: 0.03, inputType: "select", selectOptions: [{ value: "favorable", label: "Favorable track record", score: 80 }, { value: "neutral", label: "Neutral/unknown", score: 50 }, { value: "unfavorable", label: "Unfavorable track record", score: 20 }], sortOrder: 12 },
];

// ---------------------------------------------------------------------------
// 2. Default Benchmarks
// ---------------------------------------------------------------------------

export interface BenchmarkData {
  practiceArea: string;
  caseType: string;
  jurisdiction?: string;
  sampleSize: number;
  settlementRate: number;
  trialRate: number;
  dismissalRate: number;
  plaintiffWinRate?: number;
  avgSettlementAmount?: number;
  medianSettlementAmount?: number;
  settlementRangeLow?: number;
  settlementRangeHigh?: number;
  avgDurationMonths: number;
  medianDurationMonths?: number;
}

export const DEFAULT_BENCHMARKS: BenchmarkData[] = [
  { practiceArea: "personal_injury", caseType: "personal_injury_auto", sampleSize: 5200, settlementRate: 72, trialRate: 4, dismissalRate: 24, plaintiffWinRate: 52, avgSettlementAmount: 52000, medianSettlementAmount: 31000, settlementRangeLow: 10000, settlementRangeHigh: 250000, avgDurationMonths: 18, medianDurationMonths: 14 },
  { practiceArea: "personal_injury", caseType: "personal_injury_slip_fall", sampleSize: 2800, settlementRate: 65, trialRate: 5, dismissalRate: 30, plaintiffWinRate: 48, avgSettlementAmount: 45000, medianSettlementAmount: 25000, settlementRangeLow: 8000, settlementRangeHigh: 200000, avgDurationMonths: 20, medianDurationMonths: 16 },
  { practiceArea: "personal_injury", caseType: "personal_injury_med_mal", sampleSize: 1200, settlementRate: 55, trialRate: 8, dismissalRate: 37, plaintiffWinRate: 35, avgSettlementAmount: 350000, medianSettlementAmount: 150000, settlementRangeLow: 50000, settlementRangeHigh: 2000000, avgDurationMonths: 30, medianDurationMonths: 24 },
  { practiceArea: "family_law", caseType: "divorce_contested", sampleSize: 3500, settlementRate: 78, trialRate: 8, dismissalRate: 14, avgDurationMonths: 14, medianDurationMonths: 11 },
  { practiceArea: "family_law", caseType: "divorce_uncontested", sampleSize: 4200, settlementRate: 95, trialRate: 1, dismissalRate: 4, avgDurationMonths: 4, medianDurationMonths: 3 },
  { practiceArea: "family_law", caseType: "custody", sampleSize: 2100, settlementRate: 68, trialRate: 15, dismissalRate: 17, avgDurationMonths: 12, medianDurationMonths: 9 },
  { practiceArea: "corporate", caseType: "contract_dispute", sampleSize: 4100, settlementRate: 70, trialRate: 6, dismissalRate: 24, plaintiffWinRate: 55, avgSettlementAmount: 125000, medianSettlementAmount: 65000, settlementRangeLow: 15000, settlementRangeHigh: 750000, avgDurationMonths: 16, medianDurationMonths: 12 },
  { practiceArea: "litigation", caseType: "employment_discrimination", sampleSize: 1800, settlementRate: 62, trialRate: 5, dismissalRate: 33, plaintiffWinRate: 32, avgSettlementAmount: 80000, medianSettlementAmount: 40000, settlementRangeLow: 10000, settlementRangeHigh: 500000, avgDurationMonths: 22, medianDurationMonths: 18 },
  { practiceArea: "real_estate", caseType: "real_estate_closing", sampleSize: 6000, settlementRate: 92, trialRate: 1, dismissalRate: 7, avgDurationMonths: 3, medianDurationMonths: 2 },
  { practiceArea: "estate_planning", caseType: "estate_probate", sampleSize: 2400, settlementRate: 75, trialRate: 5, dismissalRate: 20, avgDurationMonths: 12, medianDurationMonths: 8 },
  { practiceArea: "criminal", caseType: "criminal_misdemeanor", sampleSize: 8000, settlementRate: 82, trialRate: 8, dismissalRate: 10, avgDurationMonths: 6, medianDurationMonths: 4 },
  { practiceArea: "criminal", caseType: "criminal_felony", sampleSize: 3200, settlementRate: 90, trialRate: 5, dismissalRate: 5, avgDurationMonths: 12, medianDurationMonths: 9 },
  { practiceArea: "immigration", caseType: "immigration_asylum", sampleSize: 1500, settlementRate: 45, trialRate: 40, dismissalRate: 15, plaintiffWinRate: 38, avgDurationMonths: 24, medianDurationMonths: 18 },
  { practiceArea: "general", caseType: "general", sampleSize: 10000, settlementRate: 70, trialRate: 5, dismissalRate: 25, plaintiffWinRate: 50, avgSettlementAmount: 75000, medianSettlementAmount: 35000, avgDurationMonths: 16, medianDurationMonths: 12 },
];

// ---------------------------------------------------------------------------
// 3. Core Scoring Functions
// ---------------------------------------------------------------------------

function scoreToLabel(score: number): string {
  if (score >= 80) return "very_favorable";
  if (score >= 60) return "favorable";
  if (score >= 40) return "neutral";
  if (score >= 20) return "unfavorable";
  return "very_unfavorable";
}

function getConfidenceLevel(dataPoints: number, factorCount: number): string {
  if (dataPoints >= 5 && factorCount >= 6) return "high";
  if (dataPoints >= 3 && factorCount >= 3) return "moderate";
  return "low";
}

interface FactorInput {
  factorName: string;
  inputValue: string;
  source: string;
  notes?: string;
}

function normalizeFactorValue(factor: ScoreFactor, inputValue: string): number {
  if (factor.inputType === "scale_1_10") {
    const val = parseFloat(inputValue) || 5;
    return Math.min(100, Math.max(0, val * 10));
  }
  if (factor.inputType === "select" && factor.selectOptions) {
    const opt = factor.selectOptions.find((o) => o.value === inputValue);
    return opt ? opt.score : 50;
  }
  if (factor.inputType === "boolean") {
    return inputValue === "true" || inputValue === "yes" ? 80 : 30;
  }
  return 50; // default for unknown
}

export function calculateScore(
  factorInputs: Array<{ factorName: string; inputValue: string; weight?: number }>,
  factors: ScoreFactor[] = DEFAULT_FACTORS,
): { overallScore: number; overallLabel: string; factorDetails: any[] } {
  let totalWeightedScore = 0;
  let totalWeight = 0;
  const factorDetails: any[] = [];

  for (const input of factorInputs) {
    const factorDef = factors.find((f) => f.factorName === input.factorName);
    if (!factorDef) continue;

    const normalizedScore = normalizeFactorValue(factorDef, input.inputValue);
    const weight = input.weight ?? factorDef.weightDefault;
    const weightedScore = normalizedScore * weight;

    totalWeightedScore += weightedScore;
    totalWeight += weight;

    factorDetails.push({
      factorName: input.factorName,
      category: factorDef.category,
      description: factorDef.description,
      inputValue: input.inputValue,
      normalizedScore,
      weight,
      weightedScore,
    });
  }

  const overallScore = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 50;
  return {
    overallScore,
    overallLabel: scoreToLabel(overallScore),
    factorDetails,
  };
}

function generateOutcomeBreakdown(overallScore: number, benchmark: BenchmarkData) {
  // Adjust benchmark probabilities based on score
  const scoreMultiplier = overallScore / 50; // 1.0 = neutral, 2.0 = very favorable, 0 = very unfavorable

  const baseSettlement = benchmark.settlementRate;
  const baseTrial = benchmark.trialRate;
  const baseDismissal = benchmark.dismissalRate;
  const baseTrialWin = benchmark.plaintiffWinRate || 50;

  // Favorable score increases settlement likelihood and trial win
  const adjSettlement = Math.min(95, baseSettlement * (0.8 + 0.4 * (overallScore / 100)));
  const adjTrialWin = Math.min(90, baseTrialWin * scoreMultiplier);
  const adjTrialLoss = Math.max(2, baseTrial * (1 - (overallScore - 50) / 100));
  const adjDismissal = Math.max(1, baseDismissal * (1 - (overallScore - 50) / 200));

  // Normalize to 100%
  const total = adjSettlement + adjTrialWin * (baseTrial / 100) + adjTrialLoss + adjDismissal;
  const scale = 100 / total;

  const settlementProb = Math.round(adjSettlement * scale);
  const trialWinProb = Math.round(adjTrialWin * (baseTrial / 100) * scale);
  const trialLossProb = Math.round(adjTrialLoss * scale);
  const dismissalProb = 100 - settlementProb - trialWinProb - trialLossProb;

  return {
    settlement: {
      probability: settlementProb,
      avgAmount: benchmark.avgSettlementAmount ? `$${(benchmark.avgSettlementAmount * scoreMultiplier).toLocaleString()}` : null,
      range: benchmark.settlementRangeLow && benchmark.settlementRangeHigh
        ? `$${Math.round(benchmark.settlementRangeLow * 0.8 * scoreMultiplier).toLocaleString()} - $${Math.round(benchmark.settlementRangeHigh * 1.2 * scoreMultiplier).toLocaleString()}`
        : null,
    },
    trial_win: { probability: Math.max(1, trialWinProb) },
    trial_loss: { probability: Math.max(1, trialLossProb) },
    dismissal: { probability: Math.max(1, Math.abs(dismissalProb)) },
  };
}

function generateSettlementRange(overallScore: number, benchmark: BenchmarkData) {
  if (!benchmark.avgSettlementAmount) return null;

  const multiplier = overallScore / 50;
  const base = benchmark.avgSettlementAmount;
  const low = Math.round(base * 0.4 * multiplier);
  const mid = Math.round(base * multiplier);
  const high = Math.round(base * 2.0 * multiplier);
  const confidence = overallScore >= 60 ? 75 : overallScore >= 40 ? 55 : 35;

  return { low, midpoint: mid, high, confidence };
}

function generateTimelineEstimate(overallScore: number, benchmark: BenchmarkData) {
  const avg = benchmark.avgDurationMonths;
  const scoreAdj = 1 + (50 - overallScore) / 200; // unfavorable = longer

  return {
    estimatedResolutionMonths: Math.round(avg * scoreAdj),
    range: [Math.round(avg * 0.5), Math.round(avg * 1.8)],
    currentPhase: "active_litigation",
    percentComplete: 35,
  };
}

// ---------------------------------------------------------------------------
// 4. AI Analysis
// ---------------------------------------------------------------------------

export async function generateAIAnalysis(params: {
  matterName: string;
  practiceArea: string;
  caseType: string;
  jurisdiction?: string;
  overallScore: number;
  factorDetails: any[];
  benchmark: BenchmarkData;
}): Promise<{
  strengthFactors: any[];
  weaknessFactors: any[];
  neutralFactors: any[];
  recommendations: any[];
  riskAlerts: any[];
}> {
  const result = await aiRouter.complete({
    feature: "prediction_analysis",
    systemPrompt: `You are an expert litigation analytics AI. Analyze case factors and provide strategic insights for attorneys.

PRACTICE AREA: ${params.practiceArea}
CASE TYPE: ${params.caseType}
JURISDICTION: ${params.jurisdiction || "Not specified"}
OVERALL SCORE: ${params.overallScore}/100

Return ONLY valid JSON:
{
  "strengthFactors": [{ "factor": "string", "impact": "positive", "weight": 0.0-1.0, "description": "why this helps", "category": "liability|damages|procedural|strategic|external" }],
  "weaknessFactors": [{ "factor": "string", "impact": "negative", "weight": 0.0-1.0, "description": "why this hurts", "category": "..." }],
  "neutralFactors": [{ "factor": "string", "impact": "neutral", "weight": 0.0-1.0, "description": "unclear impact", "category": "..." }],
  "recommendations": [{ "action": "specific action", "priority": "high|medium|low", "rationale": "why", "expectedImpact": "what it could change" }],
  "riskAlerts": [{ "alert": "short title", "severity": "critical|high|medium|low", "description": "details" }]
}`,
    userPrompt: `Analyze this case:
Matter: ${params.matterName}
Factor Scores: ${JSON.stringify(params.factorDetails.map((f: any) => ({ name: f.factorName, score: f.normalizedScore, category: f.category })))}
Benchmark: Settlement rate ${params.benchmark.settlementRate}%, Trial rate ${params.benchmark.trialRate}%, Avg duration ${params.benchmark.avgDurationMonths} months${params.benchmark.avgSettlementAmount ? `, Avg settlement $${params.benchmark.avgSettlementAmount}` : ""}

Provide strategic analysis with 2-4 strengths, 2-4 weaknesses, 1-2 neutral factors, 3-5 recommendations, and any risk alerts.`,
    maxTokens: 4096,
    temperature: 0.3,
  });

  try {
    let jsonStr = result.content;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    return JSON.parse(jsonStr.trim());
  } catch {
    return {
      strengthFactors: [],
      weaknessFactors: [],
      neutralFactors: [],
      recommendations: [{ action: "Review AI analysis output manually", priority: "medium", rationale: "Automated parsing failed", expectedImpact: "Manual review needed" }],
      riskAlerts: [],
    };
  }
}

// ---------------------------------------------------------------------------
// 5. Full Prediction Calculation
// ---------------------------------------------------------------------------

export async function calculatePrediction(params: {
  matterId: string;
  matterName: string;
  practiceArea: string;
  caseType: string;
  jurisdiction?: string;
  factorInputs: Array<{ factorName: string; inputValue: string; weight?: number; source?: string; notes?: string }>;
  userId: string;
  firmId: string;
}): Promise<any> {
  // Find matching benchmark
  let benchmark = DEFAULT_BENCHMARKS.find(
    (b) => b.practiceArea === params.practiceArea && b.caseType === params.caseType,
  );
  if (!benchmark) {
    benchmark = DEFAULT_BENCHMARKS.find((b) => b.practiceArea === params.practiceArea && b.caseType.startsWith(params.practiceArea));
  }
  if (!benchmark) {
    benchmark = DEFAULT_BENCHMARKS.find((b) => b.caseType === "general")!;
  }

  // Calculate score
  const { overallScore, overallLabel, factorDetails } = calculateScore(params.factorInputs);

  // Generate AI analysis
  let aiAnalysis;
  try {
    aiAnalysis = await generateAIAnalysis({
      matterName: params.matterName,
      practiceArea: params.practiceArea,
      caseType: params.caseType,
      jurisdiction: params.jurisdiction,
      overallScore,
      factorDetails,
      benchmark,
    });
  } catch {
    aiAnalysis = {
      strengthFactors: factorDetails.filter((f: any) => f.normalizedScore >= 70).map((f: any) => ({
        factor: f.factorName, impact: "positive", weight: f.weight, description: `Score: ${f.normalizedScore}`, category: f.category,
      })),
      weaknessFactors: factorDetails.filter((f: any) => f.normalizedScore < 40).map((f: any) => ({
        factor: f.factorName, impact: "negative", weight: f.weight, description: `Score: ${f.normalizedScore}`, category: f.category,
      })),
      neutralFactors: factorDetails.filter((f: any) => f.normalizedScore >= 40 && f.normalizedScore < 70).map((f: any) => ({
        factor: f.factorName, impact: "neutral", weight: f.weight, description: `Score: ${f.normalizedScore}`, category: f.category,
      })),
      recommendations: [],
      riskAlerts: [],
    };
  }

  const outcomeBreakdown = generateOutcomeBreakdown(overallScore, benchmark);
  const settlementRange = generateSettlementRange(overallScore, benchmark);
  const timelineEstimate = generateTimelineEstimate(overallScore, benchmark);

  // Save prediction
  const prediction = await (db as any).matterPrediction.create({
    data: {
      matterId: params.matterId,
      matterName: params.matterName,
      practiceArea: params.practiceArea,
      jurisdiction: params.jurisdiction,
      caseType: params.caseType,
      overallScore,
      overallLabel,
      outcomeBreakdown,
      strengthFactors: aiAnalysis.strengthFactors,
      weaknessFactors: aiAnalysis.weaknessFactors,
      neutralFactors: aiAnalysis.neutralFactors,
      settlementRange,
      timelineEstimate,
      comparableMetrics: {
        totalComparableCases: benchmark.sampleSize,
        avgSettlement: benchmark.avgSettlementAmount,
        avgDuration: benchmark.avgDurationMonths,
        trialRate: benchmark.trialRate,
        settlementRate: benchmark.settlementRate,
      },
      recommendations: aiAnalysis.recommendations,
      riskAlerts: aiAnalysis.riskAlerts,
      dataPointsUsed: params.factorInputs.length,
      confidenceLevel: getConfidenceLevel(benchmark.sampleSize, params.factorInputs.length),
      scoreHistory: [{ date: new Date().toISOString(), score: overallScore, trigger: "initial_calculation" }],
      userId: params.userId,
      firmId: params.firmId,
    },
  });

  // Save factor inputs
  for (const input of params.factorInputs) {
    const detail = factorDetails.find((d: any) => d.factorName === input.factorName);
    if (!detail) continue;

    await (db as any).matterFactorInput.create({
      data: {
        predictionId: prediction.id,
        matterId: params.matterId,
        factorId: input.factorName,
        factorName: input.factorName,
        inputValue: input.inputValue,
        normalizedScore: detail.normalizedScore,
        weight: detail.weight,
        weightedScore: detail.weightedScore,
        source: input.source || "attorney_input",
        notes: input.notes,
        userId: params.userId,
        firmId: params.firmId,
      },
    });
  }

  return prediction;
}

// ---------------------------------------------------------------------------
// 6. Sample Prediction for Demo
// ---------------------------------------------------------------------------

export function getSamplePrediction() {
  return {
    id: "sample-prediction-1",
    matterId: "sample-matter-1",
    matterName: "Smith v. Jones — Personal Injury (Auto Accident)",
    practiceArea: "personal_injury",
    jurisdiction: "ny_supreme",
    caseType: "personal_injury_auto",
    overallScore: 68,
    overallLabel: "favorable",
    outcomeBreakdown: {
      settlement: { probability: 76, avgAmount: "$71,000", range: "$15,000 - $340,000" },
      trial_win: { probability: 12 },
      trial_loss: { probability: 7 },
      dismissal: { probability: 5 },
    },
    strengthFactors: [
      { factor: "Clear Liability", impact: "positive", weight: 0.20, description: "Police report supports plaintiff's version. Defendant ran red light with independent witness confirmation.", category: "liability" },
      { factor: "Documented Injuries", impact: "positive", weight: 0.15, description: "Consistent medical treatment records showing herniated disc with MRI confirmation. No prior history.", category: "damages" },
      { factor: "Strong Insurance Coverage", impact: "positive", weight: 0.08, description: "Defendant has $500K policy with excess umbrella. Adequate coverage for likely damages.", category: "damages" },
    ],
    weaknessFactors: [
      { factor: "Gap in Treatment", impact: "negative", weight: 0.10, description: "3-month gap in physical therapy between months 4-7 post-accident. Defense will argue recovery during gap.", category: "damages" },
      { factor: "Social Media Activity", impact: "negative", weight: 0.05, description: "Plaintiff posted photos of physical activities during treatment period. Potential impeachment risk.", category: "client" },
    ],
    neutralFactors: [
      { factor: "Judge Assignment", impact: "neutral", weight: 0.03, description: "Judge recently assigned to part, limited track record in PI cases. Tendencies unknown.", category: "external" },
    ],
    settlementRange: { low: 25000, midpoint: 68000, high: 175000, confidence: 70 },
    timelineEstimate: { estimatedResolutionMonths: 16, range: [9, 32], currentPhase: "discovery", percentComplete: 35 },
    comparableMetrics: { totalComparableCases: 5200, avgSettlement: 52000, avgDuration: 18, trialRate: 4, settlementRate: 72 },
    recommendations: [
      { action: "Address treatment gap with supplemental affidavit from treating physician", priority: "high", rationale: "Defense will use 3-month gap to argue recovery. Physician attestation re: ongoing symptoms neutralizes this.", expectedImpact: "Could increase score by 5-8 points" },
      { action: "Preserve and review plaintiff's social media immediately", priority: "high", rationale: "Proactively address potential impeachment material before defense discovery demand.", expectedImpact: "Prevents surprise at deposition, maintains credibility score" },
      { action: "Serve supplemental bill of particulars with updated special damages", priority: "medium", rationale: "Current BoP understates lost wages. Updated figures strengthen settlement demand.", expectedImpact: "Increases settlement range midpoint by 10-15%" },
      { action: "Schedule IME preparation session with client", priority: "medium", rationale: "Defense IME scheduled next month. Proper preparation reduces risk of adverse findings.", expectedImpact: "Maintains damages scoring" },
    ],
    riskAlerts: [
      { alert: "SOL for derivative claim approaching", severity: "high", description: "Spouse's loss of consortium claim SOL expires in 45 days. File amended complaint or risk waiver." },
      { alert: "Discovery deadline in 30 days", severity: "medium", description: "Expert disclosure deadline approaching. Ensure expert report is finalized and served timely." },
    ],
    modelVersion: "v1",
    dataPointsUsed: 8,
    confidenceLevel: "moderate",
    lastCalculated: new Date().toISOString(),
    scoreHistory: [
      { date: new Date(Date.now() - 90 * 86400000).toISOString(), score: 55, trigger: "initial_calculation" },
      { date: new Date(Date.now() - 60 * 86400000).toISOString(), score: 62, trigger: "discovery_update" },
      { date: new Date().toISOString(), score: 68, trigger: "liability_evidence_update" },
    ],
    createdAt: new Date().toISOString(),
  };
}

export function getDefaultFactors(): ScoreFactor[] {
  return DEFAULT_FACTORS;
}

export function getDefaultBenchmarks(): BenchmarkData[] {
  return DEFAULT_BENCHMARKS;
}

export function getBenchmarkForCase(practiceArea: string, caseType: string): BenchmarkData {
  return DEFAULT_BENCHMARKS.find(
    (b) => b.practiceArea === practiceArea && b.caseType === caseType,
  ) || DEFAULT_BENCHMARKS.find(
    (b) => b.caseType === "general",
  )!;
}
