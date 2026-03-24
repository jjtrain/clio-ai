"use client";

import { CheckCircle, Circle, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePortalTheme } from "./PortalThemeProvider";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  id: string;
  label: string;
  description?: string;
  priority: string;
  isCompleted: boolean;
  completedAt?: string | null;
}

interface PortalChecklistProps {
  title: string;
  items: ChecklistItem[];
  totalItems: number;
  completedItems: number;
  onToggleItem: (itemId: string, isCompleted: boolean) => void;
}

const priorityLabels: Record<string, { label: string; color: string }> = {
  asap: { label: "Need ASAP", color: "text-red-600 bg-red-50" },
  when_can: { label: "When You Can", color: "text-blue-600 bg-blue-50" },
  optional: { label: "Optional", color: "text-gray-500 bg-gray-50" },
};

export function PortalChecklist({ title, items, totalItems, completedItems, onToggleItem }: PortalChecklistProps) {
  const theme = usePortalTheme();
  const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  const groups = {
    asap: items.filter((i) => i.priority === "asap"),
    when_can: items.filter((i) => i.priority === "when_can"),
    optional: items.filter((i) => i.priority === "optional"),
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Progress Header */}
      <Card className="p-5 text-center" style={{ borderRadius: theme.borderRadius }}>
        <div className="relative h-20 w-20 mx-auto mb-3">
          <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="16" fill="none" stroke="#E5E7EB" strokeWidth="2" />
            <circle
              cx="18" cy="18" r="16" fill="none"
              stroke={theme.colorPrimary}
              strokeWidth="2"
              strokeDasharray={`${progress} 100`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-lg font-bold" style={{ color: theme.colorText }}>
            {completedItems}/{totalItems}
          </span>
        </div>
        <p className="text-sm font-medium" style={{ color: theme.colorText }}>
          {progress === 100
            ? "All done! You've provided everything we need."
            : progress > 50
              ? "Great progress! A few more items to go."
              : "Let's get started on gathering your documents."}
        </p>
      </Card>

      {/* Grouped Items */}
      {(["asap", "when_can", "optional"] as const).map((priority) => {
        const group = groups[priority];
        if (group.length === 0) return null;
        const pl = priorityLabels[priority];

        return (
          <div key={priority}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: theme.colorMuted }}>
              {pl.label}
            </h3>
            <div className="space-y-2">
              {group.map((item) => (
                <Card
                  key={item.id}
                  className={cn("p-3 flex items-start gap-3 cursor-pointer transition-all hover:shadow-sm", item.isCompleted && "opacity-60")}
                  style={{ borderRadius: theme.borderRadius }}
                  onClick={() => onToggleItem(item.id, !item.isCompleted)}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {item.isCompleted ? (
                      <CheckCircle className="h-5 w-5" style={{ color: theme.colorPrimary }} />
                    ) : (
                      <Circle className="h-5 w-5" style={{ color: theme.colorMuted }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm", item.isCompleted && "line-through")} style={{ color: theme.colorText }}>
                      {item.label}
                    </p>
                    {item.description && (
                      <p className="text-xs mt-0.5" style={{ color: theme.colorMuted }}>{item.description}</p>
                    )}
                  </div>
                  {!item.isCompleted && (
                    <Upload className="h-4 w-4 flex-shrink-0" style={{ color: theme.colorMuted }} />
                  )}
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
