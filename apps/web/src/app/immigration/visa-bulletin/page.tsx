"use client";

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Globe, Users } from "lucide-react";
import Link from "next/link";

export default function VisaBulletinPage() {
  const { data: bulletin, isLoading } = trpc.immigration["visaBulletin.getCurrent"].useQuery();
  const { data: impacted } = trpc.immigration["visaBulletin.checkImpact"].useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Visa Bulletin</h1>
        <p className="text-sm text-slate-500">Current visa bulletin and case impact</p>
      </div>

      {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto my-8 text-blue-500" /> : (
        <>
          <Card>
            <CardHeader><CardTitle className="text-sm">Current Bulletin</CardTitle></CardHeader>
            <CardContent>
              {bulletin?.success && bulletin.data ? (
                <pre className="text-xs bg-gray-50 p-4 rounded overflow-auto max-h-96">{JSON.stringify(bulletin.data, null, 2)}</pre>
              ) : (
                <p className="text-sm text-gray-500">No bulletin data available. {bulletin?.error || "Connect Docketwise for automatic visa bulletin tracking."}</p>
              )}
            </CardContent>
          </Card>

          {impacted && ((impacted as any)?.affectedCases || []).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Cases Affected by Current Bulletin</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-left"><th className="pb-2 font-medium text-gray-500">Beneficiary</th><th className="pb-2 font-medium text-gray-500">Category</th><th className="pb-2 font-medium text-gray-500">Country</th><th className="pb-2 font-medium text-gray-500">Priority Date</th><th className="pb-2 text-center font-medium text-gray-500">Current?</th></tr></thead>
                  <tbody>
                    {((impacted as any)?.affectedCases || []).map((c: any) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-2"><Link href={`/immigration/cases/${c.id}`} className="text-blue-600 hover:underline font-medium">{c.beneficiaryName}</Link></td>
                        <td className="py-2">{c.visaBulletinCategory || "—"}</td>
                        <td className="py-2">{c.visaBulletinCountry || "All"}</td>
                        <td className="py-2">{c.priorityDate ? new Date(c.priorityDate).toLocaleDateString() : "—"}</td>
                        <td className="py-2 text-center">{c.isCurrent ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Current</span> : <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Not Current</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
