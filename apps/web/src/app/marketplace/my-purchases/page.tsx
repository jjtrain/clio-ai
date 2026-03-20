"use client";

import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Download, PackagePlus, ShoppingBag } from "lucide-react";

export default function MyPurchasesPage() {
  const { toast } = useToast();
  const { data: purchases, isLoading } = trpc.marketplace["getPurchases"].useQuery({
    buyerId: "current-user",
  });

  const download = trpc.marketplace["downloadPackage"].useMutation({
    onSuccess: () => {
      toast({ title: "Download started", description: "Your templates are being prepared." });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        <ShoppingBag className="h-6 w-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">My Purchases</h1>
      </div>

      {isLoading && <p className="text-sm text-gray-400">Loading...</p>}

      {!isLoading && (!purchases || purchases.length === 0) && (
        <div className="text-center py-16 text-gray-400">
          <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No purchases yet. Browse the marketplace to get started.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {purchases?.map((item: any) => (
          <div
            key={item.id}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col"
          >
            <h3 className="font-semibold text-gray-900 mb-1">{item.packageName}</h3>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="text-xs">{item.practiceArea}</Badge>
              <span className="text-xs text-gray-400">
                Purchased {new Date(item.purchasedAt).toLocaleDateString()}
              </span>
            </div>
            <div className="mt-auto flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => download.mutate({ purchaseId: item.id })}
                disabled={download.isPending}
              >
                <Download className="h-3.5 w-3.5 mr-1" /> Download
              </Button>
              <Button size="sm" className="flex-1 text-xs">
                <PackagePlus className="h-3.5 w-3.5 mr-1" /> Install
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
