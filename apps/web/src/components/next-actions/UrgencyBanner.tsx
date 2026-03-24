"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import Link from "next/link";

export function UrgencyBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { data: urgentActions } = trpc.nextActions.getUrgentActions.useQuery(undefined, {
    refetchInterval: 5 * 60 * 1000, // refresh every 5 min
  });

  // Auto-dismiss for 4 hours
  useEffect(() => {
    if (typeof window !== "undefined") {
      const dismissedAt = localStorage.getItem("urgency-banner-dismissed");
      if (dismissedAt) {
        const elapsed = Date.now() - parseInt(dismissedAt, 10);
        if (elapsed < 4 * 60 * 60 * 1000) setDismissed(true);
      }
    }
  }, []);

  const immediateCount = urgentActions?.filter((a) => a.urgency === "immediate").length || 0;

  if (dismissed || immediateCount === 0) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("urgency-banner-dismissed", String(Date.now()));
    }
  };

  return (
    <div className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 flex items-center justify-between">
      <Link href="/next-actions" className="flex items-center gap-2 text-sm font-medium hover:underline">
        <AlertTriangle className="h-4 w-4" />
        {immediateCount} {immediateCount === 1 ? "matter needs" : "matters need"} immediate attention
      </Link>
      <button onClick={handleDismiss} className="p-1 hover:bg-red-400 rounded">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
