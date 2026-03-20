"use client";

import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Briefcase, Clock, Percent, ArrowRight, Database } from "lucide-react";

const practiceAreas = [
  { key: "personal-injury", emoji: "\u2696\uFE0F", name: "Personal Injury" },
  { key: "family", emoji: "\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67", name: "Family Law" },
  { key: "criminal", emoji: "\uD83D\uDEE1\uFE0F", name: "Criminal Defense" },
  { key: "immigration", emoji: "\uD83C\uDF0D", name: "Immigration" },
  { key: "corporate", emoji: "\uD83C\uDFE2", name: "Corporate" },
  { key: "real-estate", emoji: "\uD83C\uDFE0", name: "Real Estate" },
  { key: "litigation", emoji: "\u26A1", name: "Litigation" },
];

const summaryIcons = [
  { label: "Total Revenue", icon: DollarSign, key: "totalRevenue" as const, fmt: (v: number) => `$${(v / 1000).toFixed(0)}K` },
  { label: "Active Matters", icon: Briefcase, key: "activeMatters" as const, fmt: (v: number) => String(v) },
  { label: "Avg Case Duration", icon: Clock, key: "avgCaseDuration" as const, fmt: (v: number) => `${v} days` },
  { label: "Collection Rate", icon: Percent, key: "collectionRate" as const, fmt: (v: number) => `${v}%` },
];

export default function KPIHubPage() {
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
  const executive = trpc.practiceKPIs["reports.executive"].useQuery({ period: currentPeriod });
  const seedMutation = trpc.practiceKPIs["dashboards.seed"].useMutation();

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Practice KPI Dashboards</h1>
          <p className="text-muted-foreground mt-1">
            Monitor performance across all practice areas with real-time KPI tracking.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
            <Database className="mr-2 h-4 w-4" />
            {seedMutation.isPending ? "Seeding..." : "Seed Default KPIs"}
          </Button>
          <Link href="/kpi/compare">
            <Button variant="secondary">Compare Practice Areas</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryIcons.map(({ label, icon: Icon, key, fmt }) => (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {executive.data ? fmt((executive.data as any)?.[key] ?? 0) : "--"}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Practice Areas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {practiceAreas.map((pa) => (
            <Link key={pa.key} href={`/kpi/${pa.key}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{pa.emoji}</span>
                    <CardTitle className="text-base">{pa.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <Badge variant="secondary">View Dashboard</Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
