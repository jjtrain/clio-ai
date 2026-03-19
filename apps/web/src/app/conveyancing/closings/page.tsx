"use client";

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { CalendarDays, CheckCircle, AlertTriangle, Clock } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  INTAKE: "Intake", CONTRACT_REVIEW: "Contract Review", DUE_DILIGENCE: "Due Diligence",
  TITLE_SEARCH: "Title Search", TITLE_CLEARANCE: "Title Clearance",
  MORTGAGE_PROCESSING: "Mortgage Processing", SURVEY: "Survey", INSPECTIONS: "Inspections",
  CLOSING_PREP: "Closing Prep", CLOSING_SCHEDULED: "Closing Scheduled", CLOSED: "Closed",
  POST_CLOSING: "Post-Closing", RECORDED: "Recorded", COMPLETED: "Completed", CANCELLED: "Cancelled",
};

const TYPE_LABELS: Record<string, string> = {
  PURCHASE: "Purchase", SALE: "Sale", REFINANCE: "Refinance", TRANSFER: "Transfer",
  LEASE: "Lease", COMMERCIAL_PURCHASE: "Commercial Purchase", COMMERCIAL_SALE: "Commercial Sale",
  COMMERCIAL_LEASE: "Commercial Lease", NEW_CONSTRUCTION: "New Construction",
  SHORT_SALE: "Short Sale", FORECLOSURE: "Foreclosure", ESTATE_SALE: "Estate Sale",
  AUCTION: "Auction", EXCHANGE_1031: "1031 Exchange",
};

const ROLE_LABELS: Record<string, string> = {
  BUYER_ATTORNEY: "Buyer Attorney", SELLER_ATTORNEY: "Seller Attorney",
  LENDER_ATTORNEY: "Lender Attorney", DUAL_REPRESENTATION: "Dual Rep",
};

function readinessScore(c: any) {
  const checks = [
    !!c.contractDate,
    !!c.titleSearchReceived,
    (c.titleExceptions || []).every((te: any) => te.status !== "OPEN" && te.status !== "IN_PROGRESS"),
    !!c.mortgageCommitmentDate,
    !!c.clearToCloseDate,
    !!c.closingDate,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function readinessColor(pct: number) {
  if (pct >= 80) return "text-green-600";
  if (pct >= 50) return "text-yellow-600";
  return "text-red-600";
}

function readinessIcon(pct: number) {
  if (pct >= 80) return CheckCircle;
  if (pct >= 50) return Clock;
  return AlertTriangle;
}

export default function ClosingsCalendarPage() {
  const { data: matters } = trpc.conveyancing["matters.list"].useQuery({});
  const all = (matters as any)?.items || matters || [];

  const now = new Date();
  const upcoming = all
    .filter(
      (c: any) =>
        c.closingDate &&
        new Date(c.closingDate) >= now &&
        !["COMPLETED", "CANCELLED", "RECORDED"].includes(c.status)
    )
    .sort((a: any, b: any) => new Date(a.closingDate).getTime() - new Date(b.closingDate).getTime());

  // Group by date
  const grouped: Record<string, any[]> = {};
  for (const c of upcoming) {
    const dateKey = new Date(c.closingDate).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(c);
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Upcoming Closings</h1>

      {upcoming.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No upcoming closings scheduled.
          </CardContent>
        </Card>
      )}

      {Object.entries(grouped).map(([dateLabel, closings]) => (
        <div key={dateLabel} className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            {dateLabel}
          </h2>
          {closings.map((c: any) => {
            const pct = readinessScore(c);
            const Icon = readinessIcon(pct);
            return (
              <Link key={c.id} href={`/conveyancing/matters/${c.id}`}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="space-y-1">
                      <p className="font-medium">{c.propertyAddress}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{TYPE_LABELS[c.transactionType] || c.transactionType}</Badge>
                        <Badge variant="secondary">{ROLE_LABELS[c.role] || c.role}</Badge>
                        {c.closingTime && (
                          <span className="text-sm text-muted-foreground">{c.closingTime}</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{c.matter?.name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center gap-1 text-sm font-medium ${readinessColor(pct)}`}>
                        <Icon className="h-4 w-4" />
                        {pct}% ready
                      </div>
                      <Badge variant={
                        ["CLOSING_SCHEDULED", "CLOSING_PREP"].includes(c.status) ? "default" : "outline"
                      }>
                        {STATUS_LABELS[c.status] || c.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
