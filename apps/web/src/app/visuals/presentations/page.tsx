"use client";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Presentation, Plus } from "lucide-react";
import Link from "next/link";

const TYPE_COLORS: Record<string, string> = { TRIAL: "bg-red-100 text-red-700", MEDIATION: "bg-blue-100 text-blue-700", STRATEGY: "bg-purple-100 text-purple-700", CLIENT_PRESENTATION: "bg-green-100 text-green-700", SETTLEMENT: "bg-amber-100 text-amber-700", OPENING_STATEMENT: "bg-teal-100 text-teal-700", CLOSING_ARGUMENT: "bg-indigo-100 text-indigo-700", CUSTOM: "bg-gray-100 text-gray-700" };
const STATUS_COLORS: Record<string, string> = { DRAFT: "bg-gray-100 text-gray-700", READY: "bg-blue-100 text-blue-700", PRESENTING: "bg-green-100 text-green-700", COMPLETED: "bg-emerald-100 text-emerald-700" };

export default function PresentationsPage() {
  const { data: boards, isLoading } = trpc.visuals["presentations.list"].useQuery({});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Presentations</h1><p className="text-sm text-slate-500">Trial boards, mediation decks, and strategy presentations</p></div>
      </div>

      {isLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto my-8 text-blue-500" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(boards || []).map((b: any) => (
            <Card key={b.id} className="hover:border-blue-300 transition-colors">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[b.boardType]}`}>{b.boardType.replace(/_/g, " ")}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[b.status]}`}>{b.status}</span>
                </div>
                <p className="font-medium mb-1">{b.title}</p>
                <p className="text-xs text-gray-500">{b.slideCount} slides</p>
                {b.lastPresentedAt && <p className="text-xs text-gray-400 mt-1">Last presented: {new Date(b.lastPresentedAt).toLocaleDateString()}</p>}
              </CardContent>
            </Card>
          ))}
          {(!boards || boards.length === 0) && <Card className="col-span-full"><CardContent className="py-12 text-center text-gray-400"><Presentation className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>No presentations. Create one from a timeline or start fresh.</p></CardContent></Card>}
        </div>
      )}
    </div>
  );
}
