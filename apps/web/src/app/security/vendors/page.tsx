"use client";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Building2, ShieldCheck, ClipboardCheck, AlertTriangle } from "lucide-react";

const riskColors: Record<string, string> = {
  low: "bg-green-50 text-green-700",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-red-50 text-red-700",
  critical: "bg-red-100 text-red-800",
};

const certBadge = (cert: string) => {
  const colors: Record<string, string> = {
    SOC2: "bg-blue-50 text-blue-700",
    ISO27001: "bg-indigo-50 text-indigo-700",
    HIPAA: "bg-purple-50 text-purple-700",
  };
  return colors[cert] ?? "bg-gray-100 text-gray-600";
};

export default function VendorRiskPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: vendors, isLoading } = trpc.security["vendors.list"].useQuery();

  const assess = trpc.security["vendors.assess"].useMutation({
    onSuccess: () => {
      toast({ title: "Vendor assessment started" });
      utils.security["vendors.list"].invalidate();
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const riskCounts = vendors?.reduce((acc, v) => {
    acc[v.riskLevel] = (acc[v.riskLevel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) ?? {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Vendor Risk Management</h1>
        <p className="text-gray-500 mt-1">Assess and monitor third-party vendor security posture</p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-6 md:grid-cols-4">
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Vendors</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{vendors?.length ?? 0}</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
        {(["low", "medium", "high"] as const).map((level) => (
          <div key={level} className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 capitalize">{level} Risk</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{riskCounts[level] || 0}</p>
              </div>
              <div className={`p-3 rounded-lg ${level === "low" ? "bg-green-50" : level === "medium" ? "bg-amber-50" : "bg-red-50"}`}>
                {level === "high" ? <AlertTriangle className="h-6 w-6 text-red-600" /> : <ShieldCheck className={`h-6 w-6 ${level === "low" ? "text-green-600" : "text-amber-600"}`} />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Vendor Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Vendors</h2>
        </div>
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-gray-500 mt-3">Loading vendors...</p>
          </div>
        ) : !vendors?.length ? (
          <div className="p-12 text-center">
            <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No vendors registered</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-left text-sm text-gray-500">
                <th className="px-6 py-3 font-medium">Vendor</th>
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium">Risk</th>
                <th className="px-6 py-3 font-medium">Certifications</th>
                <th className="px-6 py-3 font-medium">BAA</th>
                <th className="px-6 py-3 font-medium">Approved</th>
                <th className="px-6 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vendors.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{v.vendorName}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{v.vendorCategory}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${riskColors[v.riskLevel] ?? "bg-gray-100 text-gray-500"}`}>
                      {v.riskLevel}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {v.soc2Certified && <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${certBadge("SOC2")}`}>SOC2</span>}
                      {v.iso27001Certified && <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${certBadge("ISO27001")}`}>ISO27001</span>}
                      {v.hipaaCompliant && <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${certBadge("HIPAA")}`}>HIPAA</span>}
                      {!v.soc2Certified && !v.iso27001Certified && !v.hipaaCompliant && <span className="text-xs text-gray-400">None</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${v.hasBAA ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {v.hasBAA ? "Signed" : "N/A"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${v.isApproved ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                      {v.isApproved ? "Approved" : "Pending"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Button variant="ghost" size="sm" onClick={() => assess.mutate({ vendorId: v.id })} disabled={assess.isLoading}>
                      <ClipboardCheck className="h-3.5 w-3.5 mr-1" /> Assess
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
