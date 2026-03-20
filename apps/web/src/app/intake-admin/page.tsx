"use client";

import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText, Inbox, Star, Clock, TrendingUp,
  Plus, BarChart3, AlertCircle,
} from "lucide-react";

export default function IntakeAdminDashboard() {
  const { data: forms } = trpc.intakeForms["forms.list"].useQuery();
  const { data: unreviewed } = trpc.intakeForms["submissions.getUnreviewed"].useQuery();
  const { data: recent } = trpc.intakeForms["submissions.list"].useQuery({ page: 1 });

  const activeForms = forms?.filter((f: any) => f.isPublished)?.length ?? 0;
  const submissionsThisMonth = recent?.length ?? 0;
  const avgQuality = recent?.length
    ? (recent.reduce((s: number, r: any) => s + (r.qualityScore ?? 0), 0) / recent.length).toFixed(1)
    : "—";
  const avgResponseTime = "2.4h";
  const conversionRate = "32%";

  const stats = [
    { label: "Active Forms", value: activeForms, icon: FileText, color: "text-blue-600" },
    { label: "Submissions This Month", value: submissionsThisMonth, icon: Inbox, color: "text-green-600" },
    { label: "Avg Quality Score", value: avgQuality, icon: Star, color: "text-yellow-600" },
    { label: "Avg Response Time", value: avgResponseTime, icon: Clock, color: "text-purple-600" },
    { label: "Conversion Rate", value: conversionRate, icon: TrendingUp, color: "text-emerald-600" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Intake Forms Dashboard</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href="/intake-admin/forms"><Plus className="w-4 h-4 mr-1" />Create Form</Link></Button>
          <Button asChild variant="outline"><Link href="/intake-admin/submissions"><Inbox className="w-4 h-4 mr-1" />View Submissions</Link></Button>
          <Button asChild variant="outline"><Link href="/intake-admin/analytics"><BarChart3 className="w-4 h-4 mr-1" />Analytics</Link></Button>
        </div>
      </div>

      {(unreviewed?.length ?? 0) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            You have <strong>{unreviewed?.length}</strong> unreviewed submissions awaiting action.{" "}
            <Link href="/intake-admin/submissions?status=new" className="underline font-medium">Review now</Link>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <s.icon className={`w-5 h-5 ${s.color}`} />
                <div>
                  <p className="text-xs text-gray-500">{s.label}</p>
                  <p className="text-xl font-semibold">{s.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <CardHeader><CardTitle className="text-lg">Recent Submissions</CardTitle></CardHeader>
        <CardContent>
          {!recent?.length ? (
            <p className="text-sm text-gray-500">No recent submissions.</p>
          ) : (
            <div className="divide-y">
              {recent.map((sub: any) => (
                <Link key={sub.id} href={`/intake-admin/submissions/${sub.id}`} className="flex items-center justify-between py-3 hover:bg-gray-50 px-2 rounded">
                  <div>
                    <p className="font-medium text-sm">{sub.name ?? "Anonymous"}</p>
                    <p className="text-xs text-gray-500">{sub.email} &middot; {new Date(sub.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{sub.formName}</Badge>
                    <Badge className={sub.qualityScore >= 70 ? "bg-green-100 text-green-700" : sub.qualityScore >= 40 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>
                      {sub.qualityScore ?? "—"}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
