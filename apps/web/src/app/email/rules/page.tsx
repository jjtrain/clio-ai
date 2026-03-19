"use client";

import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Settings, ShieldCheck } from "lucide-react";

export default function RulesPage() {
  const { toast } = useToast();
  const rules = trpc.email["rules.list"].useQuery();

  const toggleMutation = trpc.email["rules.update"].useMutation({
    onSuccess: () => {
      toast({ title: "Rule updated" });
      rules.refetch();
    },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" /> Email Rules
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Automate email filing and labeling
        </p>
      </div>

      {rules.isLoading && <p className="text-muted-foreground">Loading...</p>}

      {rules.data?.length === 0 && !rules.isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <ShieldCheck className="h-12 w-12 mx-auto mb-2 opacity-30" />
          <p>No rules configured yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {rules.data?.map((rule: any) => (
          <div key={rule.id} className="border rounded-lg p-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{rule.name}</h3>
                <Badge variant={rule.isActive ? "default" : "outline"} className="text-xs">
                  {rule.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-medium">If:</span> {rule.conditionsSummary || "—"}
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Then:</span> {rule.actionsSummary || "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Matched {rule.matchCount ?? 0} times
              </p>
            </div>
            <button
              onClick={() => toggleMutation.mutate({ id: rule.id, isEnabled: !rule.isActive })}
              disabled={toggleMutation.isPending}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                rule.isActive ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  rule.isActive ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
