"use client";

import { Receipt, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePortalTheme } from "./PortalThemeProvider";

interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  total: any;
  amountPaid: any;
  status: string;
}

interface PortalBillingProps {
  invoices: InvoiceSummary[];
  billingType?: string; // 'hourly', 'contingency', 'flat_fee'
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SENT: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-400",
};

export function PortalBilling({ invoices, billingType }: PortalBillingProps) {
  const theme = usePortalTheme();

  const totalOutstanding = invoices
    .filter((i) => i.status === "SENT" || i.status === "OVERDUE")
    .reduce((sum, i) => sum + (Number(i.total) - Number(i.amountPaid)), 0);

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Contingency notice */}
      {billingType === "contingency" && (
        <Card className="p-4" style={{ backgroundColor: theme.colorPrimary + "08", borderRadius: theme.borderRadius }}>
          <p className="text-sm" style={{ color: theme.colorPrimary }}>
            Your case is handled on a contingency fee basis — there are no attorney fees unless we recover for you.
            Below are case-related expenses only.
          </p>
        </Card>
      )}

      {/* Outstanding Balance */}
      {totalOutstanding > 0 && (
        <Card className="p-5 text-center" style={{ borderRadius: theme.borderRadius }}>
          <p className="text-xs font-medium" style={{ color: theme.colorMuted }}>Total Outstanding</p>
          <p className="text-2xl font-bold mt-1" style={{ color: theme.colorText }}>
            ${totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </Card>
      )}

      {/* Invoice List */}
      {invoices.length > 0 ? (
        <div className="space-y-2">
          {invoices.map((invoice) => (
            <Card key={invoice.id} className="p-4" style={{ borderRadius: theme.borderRadius }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center"
                       style={{ backgroundColor: theme.colorPrimary + "15" }}>
                    <Receipt className="h-5 w-5" style={{ color: theme.colorPrimary }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: theme.colorText }}>
                      Invoice #{invoice.invoiceNumber}
                    </p>
                    <p className="text-xs" style={{ color: theme.colorMuted }}>
                      {new Date(invoice.issueDate).toLocaleDateString()} — Due {new Date(invoice.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: theme.colorText }}>
                      ${Number(invoice.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <Badge className={`text-[10px] ${statusColors[invoice.status] || statusColors.SENT}`}>
                      {invoice.status}
                    </Badge>
                  </div>
                  <Download className="h-4 w-4 cursor-pointer" style={{ color: theme.colorMuted }} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center" style={{ borderRadius: theme.borderRadius }}>
          <Receipt className="h-12 w-12 mx-auto mb-3" style={{ color: theme.colorMuted + "40" }} />
          <p className="text-sm" style={{ color: theme.colorMuted }}>No invoices yet</p>
        </Card>
      )}
    </div>
  );
}
