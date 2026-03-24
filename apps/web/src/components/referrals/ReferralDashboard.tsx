"use client";

import { Share2, TrendingUp, DollarSign, Users, Heart, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function ReferralDashboard() {
  const { data: stats } = trpc.referralTracking.getDashboardStats.useQuery();
  const { data: sources } = trpc.referralTracking.getSources.useQuery({ limit: 10 });
  const { data: referrals } = trpc.referralTracking.getReferrals.useQuery({ limit: 10 });
  const { data: channels } = trpc.referralTracking.getChannelBreakdown.useQuery();
  const { data: funnel } = trpc.referralTracking.getFunnelData.useQuery();
  const { data: thankYous } = trpc.referralTracking.getThankYous.useQuery({ status: "scheduled" });

  const statusColors: Record<string, string> = {
    lead: "bg-blue-100 text-blue-700", contacted: "bg-cyan-100 text-cyan-700",
    consultation_scheduled: "bg-purple-100 text-purple-700", retained: "bg-green-100 text-green-700",
    active_matter: "bg-green-100 text-green-700", matter_closed: "bg-gray-100 text-gray-600",
    lost_lead: "bg-red-100 text-red-500",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Share2 className="h-7 w-7 text-blue-600" />
          Referral Tracking
        </h1>
        <p className="text-sm text-gray-500 mt-1">Track referral sources, attribution, and ROI</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center"><Users className="h-5 w-5 text-blue-600" /></div>
              <div><p className="text-2xl font-bold text-gray-900">{stats.totalReferrals}</p><p className="text-xs text-gray-500">This Quarter</p></div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-green-600" /></div>
              <div><p className="text-2xl font-bold text-gray-900">{stats.conversionRate}%</p><p className="text-xs text-gray-500">Conversion Rate</p></div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center"><DollarSign className="h-5 w-5 text-emerald-600" /></div>
              <div><p className="text-2xl font-bold text-gray-900">${Number(stats.revenue).toLocaleString()}</p><p className="text-xs text-gray-500">Revenue</p></div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", stats.overdueThankYous > 0 ? "bg-orange-50" : "bg-pink-50")}>
                <Heart className={cn("h-5 w-5", stats.overdueThankYous > 0 ? "text-orange-600" : "text-pink-600")} />
              </div>
              <div><p className="text-2xl font-bold text-gray-900">{stats.overdueThankYous}</p><p className="text-xs text-gray-500">Thank-Yous Due</p></div>
            </div>
          </Card>
        </div>
      )}

      {/* Funnel */}
      {funnel && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Referral Funnel</h2>
          <div className="flex items-end gap-2 h-24">
            {Object.entries(funnel).map(([stage, count]) => {
              const maxCount = Math.max(...Object.values(funnel), 1);
              const height = Math.max((Number(count) / maxCount) * 100, 10);
              return (
                <div key={stage} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-bold text-gray-700">{count}</span>
                  <div className="w-full bg-blue-500 rounded-t-md" style={{ height: `${height}%`, opacity: 0.3 + (Number(count) / maxCount) * 0.7 }} />
                  <span className="text-[9px] text-gray-400 text-center">{stage.replace(/_/g, " ").split(" ").slice(0, 2).join(" ")}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Source Leaderboard */}
      {sources && sources.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Top Referral Sources</h2>
          <div className="space-y-2">
            {sources.slice(0, 5).map((source, i) => (
              <Card key={source.id} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={cn("h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold",
                    i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-gray-100 text-gray-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-gray-50 text-gray-400"
                  )}>
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{source.contactName || source.name}</p>
                    <Badge variant="secondary" className="text-[10px] capitalize">{source.sourceType.replace(/_/g, " ")}</Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">${source.totalRevenue.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400">{source.totalReferrals} referrals · {source.totalConverted} converted</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recent Referrals */}
      {referrals && referrals.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Referrals</h2>
          <div className="space-y-1.5">
            {referrals.map((ref) => (
              <Card key={ref.id} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{ref.clientName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">{ref.source?.contactName || ref.source?.name}</span>
                      {ref.practiceArea && <Badge variant="outline" className="text-[10px] capitalize">{ref.practiceArea.replace(/_/g, " ")}</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn("text-[10px] capitalize", statusColors[ref.status] || "bg-gray-100 text-gray-600")}>
                    {ref.status.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-[10px] text-gray-400">{new Date(ref.referralDate).toLocaleDateString()}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
