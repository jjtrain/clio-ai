"use client";

import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  BookOpen,
  BarChart3,
} from "lucide-react";
import { ScoreGauge } from "./PredictionDashboard";

interface PredictionDetailViewProps {
  predictionId: string;
  onBack: () => void;
}

const LABEL_STYLES: Record<string, { bg: string; text: string }> = {
  very_favorable: { bg: "bg-green-100", text: "text-green-700" },
  favorable: { bg: "bg-emerald-100", text: "text-emerald-700" },
  neutral: { bg: "bg-yellow-100", text: "text-yellow-700" },
  unfavorable: { bg: "bg-orange-100", text: "text-orange-700" },
  very_unfavorable: { bg: "bg-red-100", text: "text-red-700" },
};

const LABEL_NAMES: Record<string, string> = {
  very_favorable: "Very Favorable",
  favorable: "Favorable",
  neutral: "Neutral",
  unfavorable: "Unfavorable",
  very_unfavorable: "Very Unfavorable",
};

export function PredictionDetailView({ predictionId, onBack }: PredictionDetailViewProps) {
  const predQuery = trpc.predictions.getPrediction.useQuery({ predictionId });
  const pred = predQuery.data as any;

  if (!pred) {
    return (
      <div className="flex items-center justify-center py-20">
        <Clock className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const labelStyle = LABEL_STYLES[pred.overallLabel] || LABEL_STYLES.neutral;
  const outcomes = pred.outcomeBreakdown || {};
  const settlement = pred.settlementRange || {};
  const timeline = pred.timelineEstimate || {};
  const metrics = pred.comparableMetrics || {};
  const strengths = pred.strengthFactors || [];
  const weaknesses = pred.weaknessFactors || [];
  const neutrals = pred.neutralFactors || [];
  const recommendations = pred.recommendations || [];
  const alerts = pred.riskAlerts || [];
  const history = pred.scoreHistory || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="mt-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-slate-900">{pred.matterName}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{pred.practiceArea}</span>
            {pred.caseType && <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-600">{pred.caseType}</span>}
            {pred.jurisdiction && <span className="rounded bg-slate-100 px-2 py-0.5">{pred.jurisdiction}</span>}
            <span className={`rounded-full px-2 py-0.5 font-medium ${pred.confidenceLevel === "high" ? "bg-green-100 text-green-700" : pred.confidenceLevel === "moderate" ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-600"}`}>
              {pred.confidenceLevel} confidence
            </span>
            <span>{pred.dataPointsUsed} data points</span>
          </div>
        </div>
      </div>

      {/* Score + Outcome Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Score Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col items-center text-center">
          <ScoreGauge score={pred.overallScore} size="lg" />
          <span className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${labelStyle.bg} ${labelStyle.text}`}>
            {LABEL_NAMES[pred.overallLabel]}
          </span>
          <p className="mt-2 text-xs text-slate-500">Overall Prediction Score</p>
        </div>

        {/* Outcome Probabilities */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Outcome Probabilities</h3>
          <div className="space-y-3">
            {outcomes.settlement && (
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Settlement</span>
                  <span className="font-semibold text-slate-900">{outcomes.settlement.probability}%</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-green-500 transition-all" style={{ width: `${outcomes.settlement.probability}%` }} />
                </div>
                {outcomes.settlement.range && (
                  <p className="mt-0.5 text-[10px] text-slate-400">Est. range: {outcomes.settlement.range}</p>
                )}
              </div>
            )}
            {outcomes.trial_win && (
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Trial Win</span>
                  <span className="font-semibold text-blue-600">{outcomes.trial_win.probability}%</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-blue-500" style={{ width: `${outcomes.trial_win.probability}%` }} />
                </div>
              </div>
            )}
            {outcomes.trial_loss && (
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Trial Loss</span>
                  <span className="font-semibold text-orange-600">{outcomes.trial_loss.probability}%</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-orange-500" style={{ width: `${outcomes.trial_loss.probability}%` }} />
                </div>
              </div>
            )}
            {outcomes.dismissal && (
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Dismissal</span>
                  <span className="font-semibold text-slate-600">{outcomes.dismissal.probability}%</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-slate-400" style={{ width: `${outcomes.dismissal.probability}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Settlement + Timeline */}
        <div className="space-y-4">
          {settlement.midpoint && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Settlement Estimate</h3>
              <p className="text-2xl font-bold text-slate-900">${settlement.midpoint?.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">
                Range: ${settlement.low?.toLocaleString()} — ${settlement.high?.toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">{settlement.confidence}% confidence</p>
            </div>
          )}
          {timeline.estimatedResolutionMonths && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Timeline Estimate</h3>
              <p className="text-2xl font-bold text-slate-900">{timeline.estimatedResolutionMonths} months</p>
              <p className="text-xs text-slate-500 mt-1">
                Range: {timeline.range?.[0]}—{timeline.range?.[1]} months
              </p>
              {timeline.percentComplete != null && (
                <div className="mt-2">
                  <div className="h-1.5 rounded-full bg-slate-100">
                    <div className="h-1.5 rounded-full bg-slate-900 transition-all" style={{ width: `${timeline.percentComplete}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{timeline.percentComplete}% complete</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Risk Alerts */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h3 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Risk Alerts
          </h3>
          <div className="space-y-2">
            {alerts.map((alert: any, i: number) => (
              <div key={i} className="rounded-lg bg-white border border-red-100 px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    alert.severity === "critical" ? "bg-red-100 text-red-700" :
                    alert.severity === "high" ? "bg-orange-100 text-orange-700" :
                    "bg-yellow-100 text-yellow-700"
                  }`}>{alert.severity}</span>
                  <span className="text-sm font-semibold text-slate-900">{alert.alert}</span>
                </div>
                <p className="text-xs text-slate-600">{alert.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Strengths */}
        <div className="rounded-xl border border-green-200 bg-green-50/50 p-5">
          <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Strength Factors ({strengths.length})
          </h3>
          <div className="space-y-2">
            {strengths.map((f: any, i: number) => (
              <div key={i} className="rounded-lg bg-white border border-green-100 px-4 py-3">
                <p className="text-sm font-medium text-slate-900">{f.factor}</p>
                <p className="text-xs text-slate-600 mt-0.5">{f.description}</p>
                {f.category && <span className="inline-block mt-1 rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700">{f.category}</span>}
              </div>
            ))}
            {strengths.length === 0 && <p className="text-xs text-slate-500">No strong factors identified.</p>}
          </div>
        </div>

        {/* Weaknesses */}
        <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-5">
          <h3 className="text-sm font-semibold text-orange-800 mb-3 flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Weakness Factors ({weaknesses.length})
          </h3>
          <div className="space-y-2">
            {weaknesses.map((f: any, i: number) => (
              <div key={i} className="rounded-lg bg-white border border-orange-100 px-4 py-3">
                <p className="text-sm font-medium text-slate-900">{f.factor}</p>
                <p className="text-xs text-slate-600 mt-0.5">{f.description}</p>
                {f.category && <span className="inline-block mt-1 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-700">{f.category}</span>}
              </div>
            ))}
            {weaknesses.length === 0 && <p className="text-xs text-slate-500">No significant weaknesses identified.</p>}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-blue-500" />
            AI Recommendations
          </h3>
          <div className="space-y-3">
            {recommendations.map((rec: any, i: number) => (
              <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    rec.priority === "high" ? "bg-red-100 text-red-700" :
                    rec.priority === "medium" ? "bg-yellow-100 text-yellow-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>{rec.priority}</span>
                  <span className="text-sm font-medium text-slate-900">{rec.action}</span>
                </div>
                <p className="text-xs text-slate-600">{rec.rationale}</p>
                {rec.expectedImpact && (
                  <p className="text-xs text-blue-600 mt-1">Impact: {rec.expectedImpact}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Benchmarks */}
      {metrics.totalComparableCases && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-slate-500" />
            Comparable Case Benchmarks
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 text-center">
            <div>
              <p className="text-xs text-slate-500">Sample Size</p>
              <p className="text-lg font-bold text-slate-900">{metrics.totalComparableCases?.toLocaleString()}</p>
            </div>
            {metrics.avgSettlement && (
              <div>
                <p className="text-xs text-slate-500">Avg Settlement</p>
                <p className="text-lg font-bold text-slate-900">${metrics.avgSettlement?.toLocaleString()}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-500">Settlement Rate</p>
              <p className="text-lg font-bold text-slate-900">{metrics.settlementRate}%</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Trial Rate</p>
              <p className="text-lg font-bold text-slate-900">{metrics.trialRate}%</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Avg Duration</p>
              <p className="text-lg font-bold text-slate-900">{metrics.avgDuration} mo</p>
            </div>
          </div>
        </div>
      )}

      {/* Score History */}
      {history.length > 1 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Score History</h3>
          <div className="flex items-end gap-3 h-24">
            {history.map((h: any, i: number) => {
              const height = `${h.score}%`;
              const color = h.score >= 60 ? "bg-green-500" : h.score >= 40 ? "bg-yellow-500" : "bg-red-500";
              return (
                <div key={i} className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-[10px] font-semibold text-slate-900">{h.score}</span>
                  <div className="w-full rounded-t" style={{ height }} >
                    <div className={`w-full h-full rounded-t ${color}`} />
                  </div>
                  <span className="text-[9px] text-slate-400 truncate w-full text-center">
                    {new Date(h.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
