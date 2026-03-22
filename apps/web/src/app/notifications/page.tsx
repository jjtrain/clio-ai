"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Calendar, CheckSquare, Clock, Scale, CheckCheck, RefreshCw } from "lucide-react";

const TABS = [
  { value: "all", label: "All" }, { value: "DEADLINE", label: "Deadlines" },
  { value: "COURT", label: "Court" }, { value: "SOL", label: "SOL" },
  { value: "TASK", label: "Tasks" }, { value: "OTHER", label: "Other" },
] as const;

const severityColor: Record<string, string> = { INFO: "bg-blue-500", WARNING: "bg-amber-500", URGENT: "bg-orange-500", CRITICAL: "bg-red-500" };
const ic = "h-5 w-5 text-muted-foreground";
const categoryIcon: Record<string, React.ReactNode> = {
  DEADLINE: <Calendar className={ic} />, COURT: <Scale className={ic} />,
  SOL: <Clock className={ic} />, TASK: <CheckSquare className={ic} />, OTHER: <Bell className={ic} />,
};

function timeAgo(date: string | Date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return "Yesterday";
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("all");
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.notifications["list"].useQuery({
    userId: "current-user",
    category: activeTab !== "all" ? activeTab : undefined,
  });

  const markRead = trpc.notifications["markRead"].useMutation({
    onSuccess: () => utils.notifications["list"].invalidate(),
  });
  const markAllRead = trpc.notifications["markAllRead"].useMutation({
    onSuccess: () => utils.notifications["list"].invalidate(),
  });
  const runCheck = trpc.notifications["runDeadlineCheck"].useMutation();

  const notifications = (data as any)?.items ?? [];
  const unreadCount = notifications.filter((n: any) => !n.read).length;

  const handleClick = (n: (typeof notifications)[number]) => {
    if (!n.read) markRead.mutate({ notificationId: n.id });
    if (n.url) router.push(n.url);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <Badge variant="default">{unreadCount}</Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={unreadCount === 0 || markAllRead.isPending}
          onClick={() => markAllRead.mutate({ userId: "current-user" })}
        >
          <CheckCheck className="mr-2 h-4 w-4" />
          Mark All Read
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-12">Loading...</p>
      ) : notifications.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-lg text-muted-foreground">You're all caught up! 🎉</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n: any) => (
            <Card
              key={n.id}
              className="flex cursor-pointer items-start gap-3 p-4 hover:bg-accent/50 transition-colors"
              onClick={() => handleClick(n)}
            >
              <div className={`w-1 self-stretch rounded-full ${severityColor[n.severity] ?? "bg-gray-400"}`} />
              <div className="shrink-0 pt-0.5">
                {categoryIcon[n.category] ?? categoryIcon.OTHER}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${n.read ? "font-normal" : "font-semibold"}`}>
                  {n.title}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                  {n.body}
                </p>
                {n.matterId && (
                  <Badge variant="secondary" className="mt-1.5 text-xs">
                    {n.matterName ?? n.matterId}
                  </Badge>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {timeAgo(n.createdAt)}
                </span>
                {!n.read && <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />}
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-center pt-4">
        <Button variant="ghost" size="sm" onClick={() => runCheck.mutate()} disabled={runCheck.isPending}>
          <RefreshCw className={`mr-2 h-4 w-4 ${runCheck.isPending ? "animate-spin" : ""}`} />Run Deadline Check
        </Button>
      </div>
    </div>
  );
}
