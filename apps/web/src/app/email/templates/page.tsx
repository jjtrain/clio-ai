"use client";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { FileText, Sparkles, BarChart3 } from "lucide-react";

export default function TemplatesPage() {
  const { toast } = useToast();
  const templates = trpc.email["templates.list"].useQuery();

  const initDefaults = trpc.email["templates.initialize"].useMutation({
    onSuccess: (data: any) => {
      toast({ title: `Created ${data.created} default templates` });
      templates.refetch();
    },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" /> Email Templates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {templates.data?.length ?? 0} templates available
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => initDefaults.mutate()}
          disabled={initDefaults.isPending}
        >
          <Sparkles className="h-4 w-4 mr-2" /> Initialize Defaults
        </Button>
      </div>

      {templates.isLoading && <p className="text-muted-foreground">Loading...</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.data?.map((tpl: any) => (
          <div key={tpl.id} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-start justify-between">
              <h3 className="font-medium">{tpl.name}</h3>
              {tpl.category && (
                <Badge variant="secondary" className="text-xs">{tpl.category}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {tpl.subject || "No subject"}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <BarChart3 className="h-3 w-3" />
              Used {tpl.usageCount ?? 0} times
            </div>
          </div>
        ))}
      </div>

      {templates.data?.length === 0 && !templates.isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
          <p>No templates yet. Click "Initialize Defaults" to get started.</p>
        </div>
      )}
    </div>
  );
}
