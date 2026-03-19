"use client";

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, DollarSign, Clock, AlertTriangle, Star, Users, Wallet } from "lucide-react";

const REPORTS = [
  { id: "leads", name: "Lead Report", desc: "Comprehensive lead data", icon: Users },
  { id: "roi", name: "ROI Report", desc: "Return on investment by category", icon: DollarSign },
  { id: "responseTime", name: "Response Time", desc: "Response time analysis", icon: Clock },
  { id: "disputes", name: "Dispute Report", desc: "Disputes filed and outcomes", icon: AlertTriangle },
  { id: "reviews", name: "Review Report", desc: "Review volume and ratings", icon: Star },
  { id: "conversion", name: "Conversion Report", desc: "Lead-to-client funnel", icon: Users },
  { id: "budget", name: "Budget Report", desc: "Spend pacing and utilization", icon: Wallet },
];

export default function LSAReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">LSA Reports</h1>
        <p className="text-sm text-slate-500">Google Local Services advertising reports</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map((r) => (
          <Card key={r.id} className="hover:border-blue-300 transition-colors">
            <CardContent className="pt-6">
              <r.icon className="h-8 w-8 text-blue-500 mb-3" />
              <p className="font-medium">{r.name}</p>
              <p className="text-xs text-gray-500 mt-1">{r.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
