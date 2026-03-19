"use client";

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, ListChecks, Plus } from "lucide-react";

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

export default function ChecklistTemplatesPage() {
  const { data: templates } = trpc.conveyancing["templates.list"].useQuery({});
  const initDefaults = trpc.conveyancing["templates.initialize"].useMutation();

  const all = (templates as any)?.items || templates || [];

  const getItemCount = (t: any) => {
    try {
      return JSON.parse(t.items || "[]").length;
    } catch {
      return 0;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Checklist Templates</h1>
        <Button
          variant="outline"
          disabled={initDefaults.isPending}
          onClick={() => initDefaults.mutate()}
        >
          <Plus className="mr-2 h-4 w-4" />
          {initDefaults.isPending ? "Initializing..." : "Initialize Defaults"}
        </Button>
      </div>

      {all.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <ClipboardList className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No checklist templates found.</p>
            <p className="text-sm mt-1">Click Initialize Defaults to create standard templates.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {all.map((t: any) => (
          <Card key={t.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-4 w-4" />
                {t.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge>{TYPE_LABELS[t.transactionType] || t.transactionType}</Badge>
                <Badge variant="secondary">{ROLE_LABELS[t.role] || t.role}</Badge>
                {t.propertyType && <Badge variant="outline">{t.propertyType}</Badge>}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{getItemCount(t)} items</span>
                <div className="flex gap-2">
                  {t.isDefault && <Badge variant="outline">Default</Badge>}
                  {t.isActive ? (
                    <Badge variant="default">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </div>
              </div>
              {t.jurisdiction && (
                <p className="text-xs text-muted-foreground">Jurisdiction: {t.jurisdiction}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
