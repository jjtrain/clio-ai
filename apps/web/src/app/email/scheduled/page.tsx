"use client";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Clock, X, Send } from "lucide-react";

function statusColor(status: string) {
  switch (status) {
    case "PENDING": return "default";
    case "SENT": return "secondary";
    case "FAILED": return "destructive";
    case "CANCELLED": return "outline";
    default: return "outline" as const;
  }
}

export default function ScheduledPage() {
  const { toast } = useToast();
  const scheduled = trpc.email["scheduled.list"].useQuery();

  const cancelMutation = trpc.email["scheduled.cancel"].useMutation({
    onSuccess: () => {
      toast({ title: "Scheduled email cancelled" });
      scheduled.refetch();
    },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Clock className="h-6 w-6" /> Scheduled Emails
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {scheduled.data?.filter((s: any) => s.status === "PENDING").length ?? 0} emails pending
        </p>
      </div>

      {scheduled.isLoading && <p className="text-muted-foreground">Loading...</p>}

      {scheduled.data?.length === 0 && !scheduled.isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <Send className="h-12 w-12 mx-auto mb-2 opacity-30" />
          <p>No scheduled emails.</p>
        </div>
      )}

      <div className="space-y-3">
        {scheduled.data?.map((sched: any) => (
          <div key={sched.id} className="border rounded-lg p-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{sched.subject || "(no subject)"}</span>
                <Badge variant={statusColor(sched.status) as any} className="text-xs">
                  {sched.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                To: {sched.to}
              </p>
              <p className="text-xs text-muted-foreground">
                Scheduled: {new Date(sched.scheduledFor).toLocaleString()}
              </p>
            </div>
            {sched.status === "PENDING" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => cancelMutation.mutate({ id: sched.id })}
                disabled={cancelMutation.isPending}
              >
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
