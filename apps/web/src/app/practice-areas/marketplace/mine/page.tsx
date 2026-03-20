"use client";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Download, MessageSquare, ArrowLeft, TrendingUp } from "lucide-react";
import Link from "next/link";

export default function MyPublishedPage() {
  const { data: templates } = trpc.practiceArea["community.search"].useQuery({ mine: true });
  const deprecateMutation = trpc.practiceArea["community.deprecate"].useMutation();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Link href="/practice-areas/marketplace"><Button variant="ghost" size="sm"><ArrowLeft className="mr-1 h-4 w-4" />Marketplace</Button></Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">My Published Templates</h1>
        <p className="text-gray-500">Manage templates you have published to the marketplace</p>
      </div>

      {(templates as any)?.templates?.length === 0 && (
        <div className="rounded-xl border border-gray-100 bg-white p-12 text-center shadow-sm">
          <p className="text-gray-400">You have not published any templates yet.</p>
          <Link href="/practice-areas/marketplace/publish">
            <Button className="mt-4">Publish Your First Template</Button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(templates as any)?.templates?.map((t: any) => (
          <div key={t.id} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{t.title}</h3>
                <Badge variant="secondary" className="mt-1">{t.practiceArea}</Badge>
              </div>
              <span className="text-xs text-gray-400">v{t.version}</span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-gray-50 p-3">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-sm font-medium">
                  <Download className="h-3.5 w-3.5 text-gray-400" />{t.downloads}
                </div>
                <p className="text-xs text-gray-400">Installs</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-sm font-medium">
                  <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />{t.rating?.toFixed(1) ?? "N/A"}
                </div>
                <p className="text-xs text-gray-400">Rating</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-sm font-medium">
                  <MessageSquare className="h-3.5 w-3.5 text-gray-400" />{t.reviewCount ?? 0}
                </div>
                <p className="text-xs text-gray-400">Reviews</p>
              </div>
            </div>

            {t.weeklyInstalls !== undefined && (
              <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                <TrendingUp className="h-3.5 w-3.5" />{t.weeklyInstalls} installs this week
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <Link href={`/practice-areas/marketplace/${t.id}`} className="flex-1">
                <Button variant="outline" size="sm" className="w-full">Update</Button>
              </Link>
              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => deprecateMutation.mutate({ templateId: t.id, reason: "Superseded by newer version" })} disabled={deprecateMutation.isPending}>
                Deprecate
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
