"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button"; import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Save, Wifi, WifiOff, RefreshCw, Download, Trash2, CloudOff } from "lucide-react";

export default function OfflineSettingsPage() {
  const matters = trpc.offlineSync["getMattersForCache"].useQuery();
  const config = trpc.offlineSync["getConfig"].useQuery();
  const syncStatus = trpc.offlineSync["getSyncStatus"].useQuery({ userId: "current-user" });
  const updateConfig = trpc.offlineSync["updateConfig"].useMutation({ onSuccess: () => config.refetch() });

  const [isOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [form, setForm] = useState({
    maxCachedMatters: 10, cacheStrategy: "recent", autoSyncOnReconnect: true,
    syncIntervalMinutes: 15, cacheExpirationHours: 72, conflictStrategy: "ask",
    cacheSizeLimitMB: 100, cacheDocuments: false, cacheVoiceNotes: true, syncNotifications: true,
  });

  useEffect(() => {
    if (config.data) setForm((prev) => ({ ...prev, ...(config.data as any) }));
  }, [config.data]);

  const set = <K extends keyof typeof form>(key: K, val: (typeof form)[K]) => setForm((p) => ({ ...p, [key]: val }));

  return (
    <div className="container mx-auto max-w-3xl space-y-6 py-8">
      <div className="flex items-center gap-2">
        <CloudOff className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Offline &amp; Sync</h1>
          <p className="text-muted-foreground">Manage offline caching, sync preferences, and conflict resolution</p>
        </div>
      </div>

      {/* Cache Status */}
      <Card>
        <CardHeader><CardTitle>Cache Status</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isOnline ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-red-500" />}
              <span>{isOnline ? "Online" : "Offline"}</span>
            </div>
            <Badge variant={isOnline ? "default" : "destructive"}>{isOnline ? "Connected" : "Disconnected"}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Last Sync</p>
              <p className="font-medium">{syncStatus.data?.lastSync ? new Date(syncStatus.data.lastSync).toLocaleString() : "Never"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Pending Changes</p>
              <p className="font-medium">{syncStatus.data?.pendingChanges ?? 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cache Size</p>
              <p className="font-medium">24 MB / 100 MB</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => alert("Sync triggered (placeholder)")}>
            <RefreshCw className="mr-2 h-4 w-4" /> Sync Now
          </Button>
        </CardContent>
      </Card>

      {/* Cached Matters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Cached Matters</CardTitle>
            <Button variant="outline" size="sm" onClick={() => matters.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {matters.data?.length === 0 && <p className="text-sm text-muted-foreground">No matters available for caching.</p>}
          <div className="space-y-2">
            {matters.data?.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-sm text-muted-foreground">{m.client?.name ?? "No client"}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => alert(`Caching matter ${m.id} (placeholder)`)}>
                  <Download className="mr-2 h-4 w-4" /> Cache
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Max Cached Matters</Label>
              <Input type="number" value={form.maxCachedMatters} onChange={(e) => set("maxCachedMatters", +e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Cache Strategy</Label>
              <Select value={form.cacheStrategy} onValueChange={(v) => set("cacheStrategy", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Recent</SelectItem>
                  <SelectItem value="pinned">Pinned</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Sync Interval (minutes)</Label>
              <Input type="number" value={form.syncIntervalMinutes} onChange={(e) => set("syncIntervalMinutes", +e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Cache Expiration (hours)</Label>
              <Input type="number" value={form.cacheExpirationHours} onChange={(e) => set("cacheExpirationHours", +e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Conflict Strategy</Label>
              <Select value={form.conflictStrategy} onValueChange={(v) => set("conflictStrategy", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ask">Ask</SelectItem>
                  <SelectItem value="local_wins">Local Wins</SelectItem>
                  <SelectItem value="server_wins">Server Wins</SelectItem>
                  <SelectItem value="newest_wins">Newest Wins</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Cache Size Limit (MB)</Label>
              <Input type="number" value={form.cacheSizeLimitMB} onChange={(e) => set("cacheSizeLimitMB", +e.target.value)} />
            </div>
          </div>
          {[
            { key: "autoSyncOnReconnect" as const, label: "Auto-sync on Reconnect" },
            { key: "cacheDocuments" as const, label: "Cache Documents" },
            { key: "cacheVoiceNotes" as const, label: "Cache Voice Notes" },
            { key: "syncNotifications" as const, label: "Sync Notifications" },
          ].map((t) => (
            <div key={t.key} className="flex items-center justify-between rounded-md border p-3">
              <Label>{t.label}</Label>
              <Switch checked={form[t.key] as boolean} onCheckedChange={(v) => set(t.key, v)} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Sync History */}
      <Card>
        <CardHeader><CardTitle>Sync History</CardTitle></CardHeader>
        <CardContent>
          <div className="text-sm">
            <p><span className="text-muted-foreground">Last Sync:</span> {syncStatus.data?.lastSync ? new Date(syncStatus.data.lastSync).toLocaleString() : "Never"}</p>
            <p><span className="text-muted-foreground">Pending:</span> {syncStatus.data?.pendingChanges ?? 0} changes</p>
            <p><span className="text-muted-foreground">Conflicts:</span> {syncStatus.data?.conflicts ?? 0}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="destructive" onClick={() => { if (window.confirm("Clear all cached data? This cannot be undone.")) alert("Cache cleared (placeholder)"); }}>
          <Trash2 className="mr-2 h-4 w-4" /> Clear Cache
        </Button>
        <Button onClick={() => updateConfig.mutate(form)} disabled={updateConfig.isPending}>
          <Save className="mr-2 h-4 w-4" /> {updateConfig.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
