"use client";

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Package } from "lucide-react";

const STATUS_COLORS: Record<string, string> = { DRAFT: "bg-gray-100 text-gray-700", SUBMITTED: "bg-blue-100 text-blue-700", PROCESSING: "bg-amber-100 text-amber-700", COMPLETED: "bg-emerald-100 text-emerald-700", PARTIAL_FAILED: "bg-red-100 text-red-700", CANCELLED: "bg-gray-100 text-gray-500" };

export default function BatchPage() {
  const { data: batches, isLoading } = trpc.mail["batch.list"].useQuery({});

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Batch Mailings</h1><p className="text-sm text-slate-500">Bulk mailing operations</p></div>
      {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto my-8 text-blue-500" /> : (
        <Card>
          <CardContent className="pt-6">
            {(batches || []).length > 0 ? (
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="pb-2 text-left font-medium text-gray-500">Name</th><th className="pb-2 text-center font-medium text-gray-500">Jobs</th><th className="pb-2 text-center font-medium text-gray-500">Completed</th><th className="pb-2 text-center font-medium text-gray-500">Status</th><th className="pb-2 text-right font-medium text-gray-500">Cost</th></tr></thead>
                <tbody>
                  {(batches || []).map((b: any) => (
                    <tr key={b.id} className="border-b last:border-0"><td className="py-2 font-medium">{b.name}</td><td className="py-2 text-center">{b.jobCount}</td><td className="py-2 text-center">{b.completedCount}</td><td className="py-2 text-center"><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[b.status]}`}>{b.status.replace(/_/g, " ")}</span></td><td className="py-2 text-right">${Number(b.totalCost).toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="py-12 text-center text-gray-400"><Package className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>No batch mailings.</p></div>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
