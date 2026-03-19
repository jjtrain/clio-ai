"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  DollarSign,
  ArrowLeft,
  Zap,
  TrendingUp,
  Lightbulb,
  CheckCircle,
  AlertCircle,
  Save,
  Brain,
} from "lucide-react";

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-green-100 text-green-700",
};

export default function LSAOptimizationPage() {
  const { toast } = useToast();
  const [newBudget, setNewBudget] = useState("");

  const settingsQuery = trpc.lsa["settings.getAccount"].useQuery();
  const optimizeMut = trpc.lsa["performance.optimizeBudget"].useMutation();
  const updateBudgetMutation = trpc.lsa["settings.updateBudget"].useMutation({
    onSuccess: () => {
      toast({ title: "Budget Updated", description: "Your LSA budget has been updated successfully." });
      settingsQuery.refetch();
      setNewBudget("");
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.message || "Failed to update budget.",
        variant: "destructive",
      });
    },
  });

  const account = settingsQuery.data;
  const recommendations = optimizeMut.data?.recommendations ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/lsa">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budget & Optimization</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your LSA budget and view AI recommendations</p>
        </div>
      </div>

      {/* Current Budget */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            Current Budget
          </CardTitle>
        </CardHeader>
        <CardContent>
          {settingsQuery.isLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-10 bg-gray-200 rounded w-1/3" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Weekly Budget</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${account?.weeklyBudget?.toFixed(2) ?? "0.00"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Spent This Week</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${account?.spentThisWeek?.toFixed(2) ?? "0.00"}
                </p>
                {account?.weeklyBudget && account?.spentThisWeek != null && (
                  <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        (account.spentThisWeek / account.weeklyBudget) > 0.9
                          ? "bg-red-500"
                          : (account.spentThisWeek / account.weeklyBudget) > 0.7
                            ? "bg-yellow-500"
                            : "bg-green-500"
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          ((account.spentThisWeek / account.weeklyBudget) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Budget Status</p>
                {account?.budgetPaused ? (
                  <Badge className="bg-red-100 text-red-700">Paused</Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-700">Active</Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update Budget */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Save className="h-5 w-5 text-blue-500" />
            Update Budget
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-xs">
              <Label className="text-sm text-gray-500">New Weekly Budget ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={newBudget}
                onChange={(e) => setNewBudget(e.target.value)}
                placeholder={account?.weeklyBudget?.toFixed(2) ?? "0.00"}
              />
            </div>
            <Button
              disabled={!newBudget || updateBudgetMutation.isLoading}
              onClick={() => {
                const amount = parseFloat(newBudget);
                if (isNaN(amount) || amount < 0) {
                  toast({
                    title: "Invalid amount",
                    description: "Please enter a valid budget amount.",
                    variant: "destructive",
                  });
                  return;
                }
                updateBudgetMutation.mutate({ budgetAmountMicros: amount * 1000000 });
              }}
            >
              {updateBudgetMutation.isLoading ? "Updating..." : "Update Budget"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI Optimization Recommendations */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            AI Optimization Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {optimizeMut.isPending ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse p-4 rounded-lg bg-gray-50 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : recommendations.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <Lightbulb className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p>No optimization recommendations at this time</p>
              <p className="text-sm text-gray-400 mt-1">Check back as more data becomes available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recommendations.map((rec: any, idx: number) => (
                <div
                  key={idx}
                  className="p-4 rounded-lg border border-gray-100 bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {rec.type === "increase" ? (
                        <TrendingUp className="h-5 w-5 text-green-500" />
                      ) : rec.type === "warning" ? (
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                      ) : (
                        <Zap className="h-5 w-5 text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">{rec.title}</span>
                        {rec.priority && (
                          <Badge className={PRIORITY_COLORS[rec.priority] ?? "bg-gray-100 text-gray-600"}>
                            {rec.priority}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{rec.description}</p>
                      {rec.impact && (
                        <p className="text-xs text-gray-400 mt-1">
                          Estimated impact: {rec.impact}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
