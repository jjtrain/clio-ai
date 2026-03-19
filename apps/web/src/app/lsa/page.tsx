"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Phone,
  MessageSquare,
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  Star,
  BarChart3,
  ArrowRight,
  Target,
  Zap,
} from "lucide-react";

const LEAD_TYPE_ICON: Record<string, React.ElementType> = {
  PHONE: Phone,
  MESSAGE: MessageSquare,
};

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-700",
  ACTIVE: "bg-green-100 text-green-700",
  CONVERTED: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-gray-100 text-gray-600",
  DISPUTED: "bg-red-100 text-red-700",
};

const CHARGE_COLORS: Record<string, string> = {
  CHARGED: "bg-yellow-100 text-yellow-700",
  NOT_CHARGED: "bg-gray-100 text-gray-600",
  CREDITED: "bg-green-100 text-green-700",
  DISPUTED: "bg-red-100 text-red-700",
};

function QualityScoreBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) return null;
  const color =
    score >= 80
      ? "bg-emerald-100 text-emerald-700"
      : score >= 50
        ? "bg-yellow-100 text-yellow-700"
        : "bg-red-100 text-red-700";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{score}</span>;
}

function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  prefix,
  suffix,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: number | null;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-500">{label}</span>
          <Icon className="h-5 w-5 text-gray-400" />
        </div>
        <div className="text-2xl font-bold text-gray-900">
          {prefix}
          {typeof value === "number" ? value.toLocaleString() : value}
          {suffix}
        </div>
        {trend !== null && trend !== undefined && (
          <div className="flex items-center gap-1 mt-1">
            {trend >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span className={`text-xs font-medium ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>
              {trend >= 0 ? "+" : ""}
              {trend}%
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LSADashboardPage() {
  const leadsQuery = trpc.lsa["leads.list"].useQuery({ limit: 10 });
  const performanceQuery = trpc.lsa["performance.getCurrent"].useQuery();
  const roiQuery = trpc.lsa["performance.getROI"].useQuery();
  const reviewsQuery = trpc.lsa["reviews.list"].useQuery({ limit: 3 });

  const leads = leadsQuery.data || [];
  const perf = performanceQuery.data;
  const roi = roiQuery.data;
  const reviews = reviewsQuery.data || [];

  const isLoading =
    leadsQuery.isLoading || performanceQuery.isLoading || roiQuery.isLoading || reviewsQuery.isLoading;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LSA Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Google Local Services Ads overview</p>
        </div>
        <div className="flex gap-2">
          <Link href="/lsa/leads">
            <Button variant="outline" size="sm">
              All Leads
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/lsa/optimization">
            <Button size="sm">
              <Zap className="mr-2 h-4 w-4" />
              Optimize
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Leads This Month"
          value={perf?.totalLeads ?? 0}
          icon={Users}
          trend={null}
        />
        <StatCard
          label="Cost Per Lead"
          value={perf?.averageCostPerLead ? Number(perf.averageCostPerLead).toFixed(2) : "0.00"}
          icon={DollarSign}
          prefix="$"
          trend={null}
        />
        <StatCard
          label="Total Spend"
          value={Number(perf?.totalSpend || 0).toFixed(2) ?? "0.00"}
          icon={DollarSign}
          prefix="$"
        />
        <StatCard
          label="Conversion Rate"
          value={`${(perf?.conversionRate ?? 0).toFixed(1)}%`}
          icon={Target}
          trend={null}
        />
        <StatCard
          label="ROI"
          value={`${((roi?.roi ?? 0) * 100).toFixed(0)}%`}
          icon={TrendingUp}
        />
        <StatCard
          label="Avg Response Time"
          value={perf?.averageResponseTime ? `${Math.round(perf.averageResponseTime / 60)}m` : "N/A"}
          icon={Clock}
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead Feed */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">Recent Leads</CardTitle>
              <Link href="/lsa/leads">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="animate-pulse flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                      <div className="h-10 w-10 rounded-full bg-gray-200" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-1/3" />
                        <div className="h-3 bg-gray-200 rounded w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : leads.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <Phone className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                  <p>No leads yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {leads.map((lead: any) => {
                    const TypeIcon = LEAD_TYPE_ICON[lead.leadType] ?? Phone;
                    return (
                      <Link
                        key={lead.id}
                        href={`/lsa/leads/${lead.id}`}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                          <TypeIcon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 truncate">
                              {lead.consumerName || "Unknown"}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {lead.categoryName}
                            </Badge>
                            <QualityScoreBadge score={lead.qualityScore} />
                          </div>
                          <p className="text-sm text-gray-500 truncate mt-0.5">
                            {lead.aiSummary || "No AI summary available"}
                          </p>
                        </div>
                        <div className="flex-shrink-0 flex flex-col items-end gap-1">
                          <Badge className={STATUS_COLORS[lead.status] ?? "bg-gray-100 text-gray-600"}>
                            {lead.status}
                          </Badge>
                          <span className="text-xs text-gray-400">
                            ${lead.cost?.toFixed(2) ?? "0.00"}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Performance Chart Placeholder */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                <div className="text-center text-gray-400">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Performance chart</p>
                  <p className="text-xs">Coming soon</p>
                </div>
              </div>
              <Link href="/lsa/performance">
                <Button variant="ghost" size="sm" className="w-full mt-3">
                  View Performance <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Recent Reviews */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">Recent Reviews</CardTitle>
              <Link href="/lsa/reviews">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Star className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No reviews yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map((review: any) => (
                    <div key={review.id} className="p-3 rounded-lg bg-gray-50">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < (review.rating ?? 0) ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                          {review.reviewerName}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{review.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
