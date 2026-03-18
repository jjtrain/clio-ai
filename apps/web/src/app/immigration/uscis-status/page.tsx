"use client";

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Search } from "lucide-react";
import Link from "next/link";

export default function USCISStatusPage() {
  const { data: cases } = trpc.immigration["cases.list"].useQuery({ status: "PENDING" });
  const checkStatus = trpc.immigration["status.checkForCase"].useMutation();
  const utils = trpc.useUtils();

  const handleCheck = async (caseId: string) => {
    await checkStatus.mutateAsync({ caseId });
    utils.immigration["cases.list"].invalidate();
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold flex items-center gap-3">
        <Search className="h-8 w-8" /> USCIS Status Tracker
      </h1>

      <div className="space-y-3">
        {cases?.map((c: any) => (
          <Card key={c.id}>
            <CardContent className="flex items-center justify-between py-4">
              <Link href={`/immigration/cases/${c.caseId}`} className="flex-1">
                <p className="font-medium">{c.beneficiaryName}</p>
                <p className="text-sm text-muted-foreground">{c.caseType} &mdash; <span className="font-mono">{c.receiptNumber}</span></p>
              </Link>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <Badge variant={c.uscisStatus === "Case Was Approved" ? "default" : "secondary"}>
                    {c.uscisStatus ?? "Unknown"}
                  </Badge>
                  {c.lastChecked && <p className="text-xs text-muted-foreground mt-1">Checked: {c.lastChecked}</p>}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={checkStatus.isPending}
                  onClick={() => handleCheck(c.id)}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {cases?.length === 0 && <p className="text-muted-foreground">No cases with receipt numbers.</p>}
      </div>
    </div>
  );
}
