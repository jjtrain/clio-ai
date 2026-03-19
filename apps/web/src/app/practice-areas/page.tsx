"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Star, Plus, ChevronRight } from "lucide-react";

export default function PracticeAreasPage() {
  const [activePracticeArea, setActivePracticeArea] = useState<string>("");

  const configs = trpc.practiceArea["config.list"].useQuery();
  const enabledList = trpc.practiceArea["config.getEnabledList"].useQuery();
  const enableMutation = trpc.practiceArea["config.enable"].useMutation({
    onSuccess: () => { configs.refetch(); enabledList.refetch(); },
  });
  const disableMutation = trpc.practiceArea["config.disable"].useMutation({
    onSuccess: () => { configs.refetch(); enabledList.refetch(); },
  });
  const setPrimaryMutation = trpc.practiceArea["config.setPrimary"].useMutation({
    onSuccess: () => configs.refetch(),
  });

  const handleToggle = (practiceArea: string, enabled: boolean) => {
    if (enabled) {
      disableMutation.mutate({ practiceArea });
    } else {
      enableMutation.mutate({ practiceArea });
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Practice Area Configuration</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure how Clio AI adapts to each practice area
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={activePracticeArea} onValueChange={setActivePracticeArea}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Active practice area" />
            </SelectTrigger>
            <SelectContent>
              {enabledList.data?.map((area) => (
                <SelectItem key={area.practiceArea} value={area.practiceArea}>
                  {area.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Custom
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {configs.data?.map((config) => (
          <div
            key={config.practiceArea}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{config.displayName}</h3>
              <Switch
                checked={config.isEnabled}
                onCheckedChange={() => handleToggle(config.practiceArea, config.isEnabled)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Badge
                style={{ backgroundColor: config.color || "#6366f1", color: "#fff" }}
                className="text-xs"
              >
                {config.color}
              </Badge>
              {config.isPrimary && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Star className="w-3 h-3" /> Primary
                </Badge>
              )}
              {!config.isEnabled && (
                <Badge variant="outline" className="text-xs text-gray-400">
                  Disabled
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-gray-50">
              <Link href={`/practice-areas/${config.practiceArea}`} className="flex-1">
                <Button variant="outline" size="sm" className="w-full gap-1">
                  <Settings className="w-3.5 h-3.5" /> Configure
                  <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                </Button>
              </Link>
              {!config.isPrimary && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPrimaryMutation.mutate({ practiceArea: config.practiceArea })}
                >
                  <Star className="w-3.5 h-3.5 mr-1" /> Set Primary
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {configs.isLoading && (
        <p className="text-center text-gray-400 py-12">Loading practice areas...</p>
      )}
    </div>
  );
}
