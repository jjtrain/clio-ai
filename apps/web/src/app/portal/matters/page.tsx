"use client";

import { usePortal } from "../portal-context";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Briefcase, FileText, Calendar } from "lucide-react";

const statusColors: Record<string, string> = {
  OPEN: "bg-green-50 text-green-700 border-green-200",
  CLOSED: "bg-gray-100 text-gray-500",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function PortalMattersPage() {
  const { token } = usePortal();
  const { data: matters, isLoading } = trpc.clientPortal.portalGetMatters.useQuery(
    { token: token! },
    { enabled: !!token }
  );

  if (!token) return <div className="text-center py-12 text-gray-400">Please log in</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Matters</h1>
        <p className="text-gray-500">View your legal matters and case status</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : !matters?.length ? (
        <div className="text-center py-12">
          <Briefcase className="h-10 w-10 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No matters found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {matters.map((matter) => (
            <div key={matter.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{matter.name}</h3>
                  <p className="text-sm text-gray-500">
                    {matter.matterNumber}
                    {matter.practiceArea && ` · ${matter.practiceArea}`}
                  </p>
                </div>
                <Badge className={statusColors[matter.status] || statusColors.OPEN}>
                  {matter.status}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Opened {new Date(matter.openDate).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  {matter._count.documents} documents
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {matter._count.events} events
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
