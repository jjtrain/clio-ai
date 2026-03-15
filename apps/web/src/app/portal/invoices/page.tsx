"use client";

import { usePortal } from "../portal-context";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Receipt } from "lucide-react";

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-500",
  SENT: "bg-blue-50 text-blue-700 border-blue-200",
  VIEWED: "bg-amber-50 text-amber-700 border-amber-200",
  PAID: "bg-green-50 text-green-700 border-green-200",
  OVERDUE: "bg-red-50 text-red-700 border-red-200",
  VOID: "bg-gray-100 text-gray-400",
};

export default function PortalInvoicesPage() {
  const { token } = usePortal();
  const { data: invoices, isLoading } = trpc.clientPortal.portalGetInvoices.useQuery(
    { token: token! },
    { enabled: !!token }
  );

  if (!token) return <div className="text-center py-12 text-gray-400">Please log in</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Invoices</h1>
        <p className="text-gray-500">View your billing statements and payment status</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : !invoices?.length ? (
        <div className="text-center py-12">
          <Receipt className="h-10 w-10 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No invoices found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {invoices.map((inv) => (
            <div key={inv.id} className="p-4 flex items-center gap-4">
              <div className="p-2 rounded-lg bg-amber-50">
                <Receipt className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Invoice #{inv.invoiceNumber}</p>
                <p className="text-xs text-gray-500">{inv.matter?.name}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">${Number(inv.total).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-gray-400">
                  {inv.dueDate ? `Due ${new Date(inv.dueDate).toLocaleDateString()}` : ""}
                </p>
              </div>
              <Badge className={statusColors[inv.status] || statusColors.DRAFT}>
                {inv.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
