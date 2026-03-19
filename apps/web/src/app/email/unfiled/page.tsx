"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Inbox, Sparkles, FolderOpen } from "lucide-react";

export default function UnfiledPage() {
  const { toast } = useToast();
  const [filingMatter, setFilingMatter] = useState<Record<string, string>>({});

  const unfiled = trpc.email["filing.unfiled"].useQuery();
  const matters = trpc.matters.list.useQuery({});
  const fileMutation = trpc.email["filing.fileToMatter"].useMutation({
    onSuccess: () => {
      toast({ title: "Email filed to matter" });
      unfiled.refetch();
    },
  });
  const autoFileAll = trpc.email["filing.autoFileAll"].useMutation({
    onSuccess: (data: any) => {
      toast({ title: `Auto-filed ${data.filed} emails` });
      unfiled.refetch();
    },
  });

  const unfiledMessages = (unfiled.data as any)?.data || unfiled.data || [];
  const grouped = (Array.isArray(unfiledMessages) ? unfiledMessages : []).reduce((acc: Record<string, any[]>, msg: any) => {
    const key = msg.threadId || msg.id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(msg);
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Inbox className="h-6 w-6" /> Unfiled Emails
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unfiledMessages?.length ?? 0} emails need to be filed to a matter
          </p>
        </div>
        <Button
          onClick={() => autoFileAll.mutate()}
          disabled={autoFileAll.isPending || !unfiledMessages?.length}
        >
          <Sparkles className="h-4 w-4 mr-2" /> Auto-File All
        </Button>
      </div>

      {unfiled.isLoading && <p className="text-muted-foreground">Loading...</p>}

      {Object.entries(grouped).length === 0 && !unfiled.isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <FolderOpen className="h-12 w-12 mx-auto mb-2 opacity-30" />
          <p>All emails are filed. Nice work!</p>
        </div>
      )}

      <div className="space-y-3">
        {Object.entries(grouped).map(([threadId, msgs]) => {
          const first = msgs[0];
          return (
            <div key={threadId} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{first.subject || "(no subject)"}</h3>
                  <p className="text-sm text-muted-foreground">
                    {first.from} &middot; {new Date(first.date).toLocaleDateString()}
                  </p>
                  {msgs.length > 1 && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      {msgs.length} messages in thread
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Select
                    value={filingMatter[threadId] || ""}
                    onValueChange={(v) => setFilingMatter((p) => ({ ...p, [threadId]: v }))}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select matter..." />
                    </SelectTrigger>
                    <SelectContent>
                      {((matters.data as any)?.matters || matters.data || []).map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={!filingMatter[threadId] || fileMutation.isPending}
                    onClick={() => {
                      for (const msg of msgs) {
                        fileMutation.mutate({ messageId: msg.id, matterId: filingMatter[threadId] });
                      }
                    }}
                  >
                    File
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
