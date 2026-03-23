"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  TrendingUp,
  BarChart3,
  Target,
  ChevronRight,
  Plus,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { PredictionDetailView } from "./PredictionDetailView";
import { NewPredictionForm } from "./NewPredictionForm";

type View = "dashboard" | "detail" | "new";

const LABEL_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  very_favorable: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  favorable: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  neutral: { bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-500" },
  unfavorable: { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" },
  very_unfavorable: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
};

const LABEL_NAMES: Record<string, string> = {
  very_favorable: "Very Favorable",
  favorable: "Favorable",
  neutral: "Neutral",
  unfavorable: "Unfavorable",
  very_unfavorable: "Very Unfavorable",
};

function ScoreGauge({ score, size = "lg" }: { score: number; size?: "sm" | "lg" }) {
  const radius = size === "lg" ? 45 : 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#10b981" : score >= 40 ? "#eab308" : score >= 20 ? "#f97316" : "#ef4444";
  const dim = size === "lg" ? 120 : 70;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: dim, height: dim }}>
      <svg className="transform -rotate-90" width={dim} height={dim}>
        <circle cx={dim / 2} cy={dim / 2} r={radius} strokeWidth={size === "lg" ? 8 : 5} fill="none" stroke="#e2e8f0" />
        <circle cx={dim / 2} cy={dim / 2} r={radius} strokeWidth={size === "lg" ? 8 : 5} fill="none" stroke={color}
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" className="transition-all duration-1000" />
      </svg>
      <span className={`absolute font-bold ${size === "lg" ? "text-2xl" : "text-sm"} text-slate-900`}>
        {score}
      </span>
    </div>
  );
}

export { ScoreGauge };

export default function PredictionDashboard() {
  const [view, setView] = useState<View>("dashboard");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const predictionsQuery = trpc.predictions.getAllPredictions.useQuery({});
  const predictions = predictionsQuery.data ?? [];

  if (view === "detail" && selectedId) {
    return (
      <PredictionDetailView
        predictionId={selectedId}
        onBack={() => { setSelectedId(null); setView("dashboard"); predictionsQuery.refetch(); }}
      />
    );
  }

  if (view === "new") {
    return (
      <NewPredictionForm
        onBack={() => setView("dashboard")}
        onComplete={(id) => { setSelectedId(id); setView("detail"); predictionsQuery.refetch(); }}
      />
    );
  }

  // Group by label
  const byLabel: Record<string, number> = {};
  for (const p of predictions) {
    byLabel[(p as any).overallLabel] = (byLabel[(p as any).overallLabel] || 0) + 1;
  }

  const avgScore = predictions.length > 0
    ? Math.round(predictions.reduce((s, p: any) => s + p.overallScore, 0) / predictions.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Target className="h-4 w-4" />
            Total Predictions
          </div>
          <p className="mt-1 text-2xl font-bold text-slate-900">{predictions.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <TrendingUp className="h-4 w-4" />
            Avg Score
          </div>
          <p className="mt-1 text-2xl font-bold text-slate-900">{avgScore}/100</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-green-600">
            <BarChart3 className="h-4 w-4" />
            Favorable+
          </div>
          <p className="mt-1 text-2xl font-bold text-green-600">
            {(byLabel.very_favorable || 0) + (byLabel.favorable || 0)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-orange-600">
            <AlertTriangle className="h-4 w-4" />
            At Risk
          </div>
          <p className="mt-1 text-2xl font-bold text-orange-600">
            {(byLabel.unfavorable || 0) + (byLabel.very_unfavorable || 0)}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Matter Predictions</h2>
        <button
          onClick={() => setView("new")}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          New Prediction
        </button>
      </div>

      {/* Predictions List */}
      <div className="space-y-3">
        {predictions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <Target className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <h3 className="text-base font-semibold text-slate-700">No predictions yet</h3>
            <p className="mt-1 text-sm text-slate-500">
              Create a prediction to analyze a matter&apos;s likely outcome.
            </p>
            <button
              onClick={() => setView("new")}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Create Prediction
            </button>
          </div>
        ) : (
          predictions.map((pred: any) => {
            const labelStyle = LABEL_STYLES[pred.overallLabel] || LABEL_STYLES.neutral;
            const outcomeData = pred.outcomeBreakdown || {};
            return (
              <button
                key={pred.id}
                onClick={() => { setSelectedId(pred.id); setView("detail"); }}
                className="w-full rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-slate-300 hover:shadow"
              >
                <div className="flex items-center gap-5">
                  <ScoreGauge score={pred.overallScore} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900 truncate">
                        {pred.matterName || `Matter ${pred.matterId}`}
                      </h3>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${labelStyle.bg} ${labelStyle.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${labelStyle.dot}`} />
                        {LABEL_NAMES[pred.overallLabel] || pred.overallLabel}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        pred.confidenceLevel === "high" ? "bg-green-100 text-green-700" :
                        pred.confidenceLevel === "moderate" ? "bg-yellow-100 text-yellow-700" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {pred.confidenceLevel} confidence
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                        {pred.practiceArea}
                      </span>
                      {pred.caseType && (
                        <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-600">
                          {pred.caseType}
                        </span>
                      )}
                      {outcomeData.settlement && (
                        <span>Settlement: {outcomeData.settlement.probability}%</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(pred.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0" />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
