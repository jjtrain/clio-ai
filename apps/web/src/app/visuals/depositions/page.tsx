"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Users, Plus } from "lucide-react";

const STATUS_COLORS: Record<string, string> = { SETUP: "bg-amber-100 text-amber-700", IN_PROGRESS: "bg-blue-100 text-blue-700", COMPLETED: "bg-emerald-100 text-emerald-700", ARCHIVED: "bg-gray-100 text-gray-500" };

export default function DepositionsPage() {
  const { data: sessions, isLoading } = trpc.visuals["deposition.list"].useQuery({});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Deposition Sessions</h1><p className="text-sm text-slate-500">Manage exhibits, annotations, and presentations</p></div>
        <Link href="/visuals/depositions/prepare"><Button><Plus className="h-4 w-4 mr-2" /> Prepare Deposition</Button></Link>
      </div>

      {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto my-8 text-blue-500" /> : (
        <Card>
          <CardContent className="pt-6">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left"><th className="pb-2 font-medium text-gray-500">Date</th><th className="pb-2 font-medium text-gray-500">Deponent</th><th className="pb-2 font-medium text-gray-500">Matter</th><th className="pb-2 font-medium text-gray-500 text-center">Exhibits</th><th className="pb-2 font-medium text-gray-500 text-center">Status</th><th className="pb-2 font-medium text-gray-500">Analysis</th><th className="pb-2"></th></tr></thead>
              <tbody>
                {(sessions || []).map((s: any) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-3 text-gray-600">{new Date(s.depositionDate).toLocaleDateString()}</td>
                    <td className="py-3 font-medium">{s.deponentName}</td>
                    <td className="py-3 text-gray-600">{s.matter?.name || "—"}</td>
                    <td className="py-3 text-center">{s.exhibitCount}</td>
                    <td className="py-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[s.status]}`}>{s.status}</span></td>
                    <td className="py-3">{s.aiDepoSummary ? "✓" : "—"}</td>
                    <td className="py-3"><Link href={`/visuals/depositions/${s.id}`}><Button size="sm" variant="ghost">View</Button></Link></td>
                  </tr>
                ))}
                {(!sessions || sessions.length === 0) && <tr><td colSpan={7} className="py-8 text-center text-gray-400">No deposition sessions.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
