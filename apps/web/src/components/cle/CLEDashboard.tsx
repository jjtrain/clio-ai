"use client";

import { GraduationCap, Plus, AlertTriangle, CheckCircle, Clock, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const urgencyColors: Record<string, string> = { ok: "bg-green-100 text-green-700", warning: "bg-yellow-100 text-yellow-700", urgent: "bg-orange-100 text-orange-700", critical: "bg-red-100 text-red-700", overdue: "bg-red-200 text-red-800" };
const statusColors: Record<string, string> = { IN_PROGRESS: "bg-blue-100 text-blue-700", COMPLETE: "bg-green-100 text-green-700", FILED: "bg-emerald-100 text-emerald-700", OVERDUE: "bg-red-100 text-red-700", GRACE_PERIOD: "bg-orange-100 text-orange-700", EXEMPT: "bg-gray-100 text-gray-500" };

export function CLEDashboard() {
  const { data: summary } = trpc.cleTracking.getSummary.useQuery();
  const { data: jurisdictions } = trpc.cleTracking.getJurisdictions.useQuery();

  const bannerColor = !summary ? "bg-gray-50" : summary.overallStatus === "compliant" ? "bg-green-50 border-green-200" : summary.overallStatus === "at_risk" ? "bg-yellow-50 border-yellow-200" : summary.overallStatus === "critical" ? "bg-orange-50 border-orange-200" : "bg-red-50 border-red-200";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-blue-600" />
            CLE Tracker
          </h1>
          <p className="text-sm text-gray-500 mt-1">Track continuing legal education credits across jurisdictions</p>
        </div>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Add Credits</Button>
      </div>

      {/* Status Banner */}
      {summary && (
        <Card className={cn("p-4 border", bannerColor)}>
          <div className="flex items-center gap-3">
            {summary.overallStatus === "compliant" ? <CheckCircle className="h-6 w-6 text-green-600" /> : <AlertTriangle className="h-6 w-6 text-red-600" />}
            <div>
              <p className="text-sm font-semibold">
                {summary.overallStatus === "compliant" ? "All jurisdictions current" : summary.overallStatus === "overdue" ? "CLE deadline passed — action required" : "CLE attention needed"}
              </p>
              {summary.nextDeadline && (
                <p className="text-xs text-gray-600">
                  Next deadline: {summary.nextDeadlineJurisdiction} — {new Date(summary.nextDeadline).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Jurisdiction Cards */}
      {summary?.jurisdictions && summary.jurisdictions.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          {summary.jurisdictions.map((j: any) => (
            <Card key={j.requirement.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold text-gray-900">{j.jurisdiction.code}</p>
                    <p className="text-sm text-gray-600">{j.jurisdiction.name}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{j.requirement.periodLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn("text-[10px]", urgencyColors[j.urgencyLevel])}>
                    {j.daysUntilDeadline > 0 ? `${j.daysUntilDeadline} days` : "OVERDUE"}
                  </Badge>
                  <Badge className={cn("text-[10px]", statusColors[j.requirement.status])}>{j.requirement.status.replace(/_/g, " ")}</Badge>
                </div>
              </div>

              {/* Progress Ring */}
              <div className="flex items-center gap-4 mb-3">
                <div className="relative h-16 w-16 flex-shrink-0">
                  <svg className="h-16 w-16 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="16" fill="none" stroke="#E5E7EB" strokeWidth="2.5" />
                    <circle cx="18" cy="18" r="16" fill="none"
                      stroke={j.requirement.pctComplete >= 100 ? "#10B981" : j.requirement.pctComplete >= 50 ? "#F59E0B" : "#EF4444"}
                      strokeWidth="2.5" strokeDasharray={`${j.requirement.pctComplete} 100`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{j.requirement.pctComplete}%</span>
                </div>
                <div>
                  <p className="text-sm font-semibold">{j.requirement.totalEarned} / {j.requirement.totalRequired} credits</p>
                  <p className="text-xs text-gray-500">{j.requirement.creditsRemaining} remaining</p>
                  {j.suggestedHoursPerWeek > 0 && (
                    <p className="text-[10px] text-gray-400">{j.suggestedHoursPerWeek} credits/week needed</p>
                  )}
                </div>
              </div>

              {/* Category Bars */}
              {j.categoryGaps.length > 0 && (
                <div className="space-y-1.5">
                  {j.categoryGaps.map((gap: any) => (
                    <div key={gap.category} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 w-24 truncate capitalize">{gap.category.replace(/_/g, " ").toLowerCase()}</span>
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", gap.remaining <= 0 ? "bg-green-500" : "bg-blue-500")}
                          style={{ width: `${gap.required > 0 ? Math.min(100, (gap.earned / gap.required) * 100) : 100}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-400 w-14 text-right">{gap.earned}/{gap.required}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <GraduationCap className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">No CLE jurisdictions set up</p>
          <p className="text-xs text-gray-400 mt-1">Add your bar admissions to start tracking CLE credits</p>
          <Button className="mt-4 gap-2"><Plus className="h-4 w-4" /> Set Up Jurisdictions</Button>
        </Card>
      )}

      {/* Available Jurisdictions */}
      {jurisdictions && jurisdictions.length > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Available Jurisdictions ({jurisdictions.length})</h2>
          <div className="flex flex-wrap gap-2">
            {jurisdictions.map((j) => (
              <Badge key={j.id} variant="secondary" className="text-xs">
                {j.code}: {j.totalCreditsRequired} credits / {j.reportingPeriodMonths}mo
              </Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
