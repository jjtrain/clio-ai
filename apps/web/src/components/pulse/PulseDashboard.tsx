"use client";

import { useState } from "react";
import { Heart, TrendingUp, Users, AlertTriangle, Send, BarChart3, MessageCircle, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const scoreEmojis: Record<number, string> = { 1: "\uD83D\uDE20", 2: "\uD83D\uDE1F", 3: "\uD83D\uDE10", 4: "\uD83D\uDE42", 5: "\uD83D\uDE0A" };

export function PulseDashboard() {
  const { data: stats } = trpc.pulse.getDashboardStats.useQuery();
  const { data: recentFeedback } = trpc.pulse.getRecentFeedback.useQuery({ limit: 15 });
  const { data: templates } = trpc.pulse.getTemplates.useQuery({});
  const { data: triggers } = trpc.pulse.getTriggers.useQuery();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Heart className="h-7 w-7 text-pink-500" />
            Client Pulse
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track client satisfaction with micro-surveys at key milestones
          </p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Send className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalSurveys}</p>
                <p className="text-xs text-gray-500">Surveys Sent</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.responseRate}%</p>
                <p className="text-xs text-gray-500">Response Rate</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-yellow-50 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.avgScore.toFixed(1)}</p>
                <p className="text-xs text-gray-500">Avg Score</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", stats.npsScore >= 0 ? "bg-green-50" : "bg-red-50")}>
                {stats.npsScore >= 0 ? <ThumbsUp className="h-5 w-5 text-green-600" /> : <ThumbsDown className="h-5 w-5 text-red-600" />}
              </div>
              <div>
                <p className={cn("text-2xl font-bold", stats.npsScore >= 0 ? "text-green-600" : "text-red-600")}>
                  {stats.npsScore > 0 ? "+" : ""}{stats.npsScore}
                </p>
                <p className="text-xs text-gray-500">NPS Score</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.lowScoreAlerts}</p>
                <p className="text-xs text-gray-500">Low Score Alerts</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* NPS Breakdown */}
      {stats && stats.totalResponses > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">NPS Breakdown</h2>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex h-4 rounded-full overflow-hidden">
                {stats.promoters > 0 && (
                  <div className="bg-green-500" style={{ width: `${(stats.promoters / (stats.promoters + stats.passives + stats.detractors)) * 100}%` }} />
                )}
                {stats.passives > 0 && (
                  <div className="bg-yellow-400" style={{ width: `${(stats.passives / (stats.promoters + stats.passives + stats.detractors)) * 100}%` }} />
                )}
                {stats.detractors > 0 && (
                  <div className="bg-red-500" style={{ width: `${(stats.detractors / (stats.promoters + stats.passives + stats.detractors)) * 100}%` }} />
                )}
              </div>
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="text-green-600 font-medium">{stats.promoters} Promoters</span>
                <span className="text-yellow-600 font-medium">{stats.passives} Passives</span>
                <span className="text-red-600 font-medium">{stats.detractors} Detractors</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Recent Feedback */}
      {recentFeedback && recentFeedback.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Feedback</h2>
          <div className="space-y-2">
            {recentFeedback.map((survey) => (
              <Card key={survey.id} className="p-3 flex items-center gap-3">
                <div className="text-2xl flex-shrink-0">
                  {survey.questionType === "emoji_5" && survey.score ? scoreEmojis[survey.score] || "" : ""}
                  {survey.questionType === "thumbs" && (survey.score === 1 ? "\uD83D\uDC4D" : "\uD83D\uDC4E")}
                  {survey.questionType === "scale_1_5" && survey.score && `${survey.score}/5`}
                  {survey.questionType === "nps_0_10" && survey.score !== null && `${survey.score}/10`}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{survey.clientName || "Client"}</p>
                    <Badge variant="secondary" className="text-[10px]">{survey.responseLabel}</Badge>
                    {survey.practiceArea && (
                      <Badge variant="outline" className="text-[10px] capitalize">{survey.practiceArea.replace(/_/g, " ")}</Badge>
                    )}
                  </div>
                  {survey.followUpResponse && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">&ldquo;{survey.followUpResponse}&rdquo;</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {survey.triggerMilestone?.replace(/_/g, " ")} · {survey.respondedAt ? new Date(survey.respondedAt).toLocaleDateString() : ""}
                  </p>
                </div>
                {survey.score !== null && survey.score <= 2 && (
                  <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Templates & Triggers Summary */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-gray-400" />
            Active Templates
          </h2>
          {templates && templates.length > 0 ? (
            <div className="space-y-2">
              {templates.filter((t) => t.isActive).slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700 truncate">{t.name}</span>
                  <Badge variant="secondary" className="text-[10px] capitalize flex-shrink-0">
                    {t.triggerMilestone.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No templates configured</p>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            Active Triggers
          </h2>
          {triggers && triggers.length > 0 ? (
            <div className="space-y-2">
              {triggers.filter((t) => t.isActive).slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700 truncate">{t.name}</span>
                  <Badge variant="secondary" className="text-[10px] capitalize flex-shrink-0">
                    {t.triggerSource.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No triggers configured</p>
          )}
        </Card>
      </div>
    </div>
  );
}
