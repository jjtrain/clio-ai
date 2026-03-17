"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { FolderOpen, Cloud, Search, Share2, AlertTriangle, RefreshCw, Settings, FileText, Wand2, HardDrive } from "lucide-react";

const PROVIDER_ICONS: Record<string, string> = { DROPBOX: "📦", BOX: "📋", GOOGLE_DRIVE: "🔵", ONEDRIVE: "☁️" };
const SYNC_COLORS: Record<string, string> = { SYNCED: "bg-green-100 text-green-700", PENDING_UPLOAD: "bg-blue-100 text-blue-700", PENDING_DOWNLOAD: "bg-amber-100 text-amber-700", CONFLICT: "bg-red-100 text-red-700", ERROR: "bg-red-100 text-red-700" };

function fmt(s: string) { return s?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || ""; }
function formatSize(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`; if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`; return `${(bytes / 1073741824).toFixed(2)} GB`; }

export default function StorageDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const { data: stats } = trpc.documentStorage.getDashboardStats.useQuery();
  const { data: integrations } = trpc.documentStorage["settings.list"].useQuery();
  const { data: files } = trpc.documentStorage["files.list"].useQuery({ limit: 20 });
  const { data: activity } = trpc.documentStorage["activity.list"].useQuery({ limit: 20 });
  const { data: conflicts } = trpc.documentStorage["sync.getConflicts"].useQuery();
  const { data: templates } = trpc.documentStorage["templates.list"].useQuery();

  const searchMut = trpc.documentStorage["files.search"].useMutation();
  const seedTemplates = trpc.documentStorage["templates.seed"].useMutation({
    onSuccess: (d) => { utils.documentStorage["templates.list"].invalidate(); toast({ title: d.seeded ? `${d.count} templates created` : "Templates exist" }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Document Storage</h1><p className="text-sm text-slate-500">Unified cloud storage across Dropbox, Box, Google Drive, and OneDrive</p></div>
        <Button variant="outline" size="icon" onClick={() => router.push("/settings/integrations")}><Settings className="h-4 w-4" /></Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><FileText className="h-4 w-4 text-blue-500" /><p className="text-xs text-slate-500">Total Files</p></div><p className="text-xl font-bold">{stats?.totalFiles ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><HardDrive className="h-4 w-4 text-purple-500" /><p className="text-xs text-slate-500">Storage Used</p></div><p className="text-xl font-bold">{formatSize(stats?.totalSize ?? 0)}</p></CardContent></Card>
        <Card className={stats?.conflicts ? "border-red-200" : ""}><CardContent className="pt-4"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /><p className="text-xs text-slate-500">Conflicts</p></div><p className="text-xl font-bold text-red-600">{stats?.conflicts ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><Share2 className="h-4 w-4 text-green-500" /><p className="text-xs text-slate-500">Active Shares</p></div><p className="text-xl font-bold">{stats?.activeShares ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-2"><Cloud className="h-4 w-4 text-teal-500" /><p className="text-xs text-slate-500">Providers</p></div><p className="text-xl font-bold">{stats?.providerCount ?? 0}</p></CardContent></Card>
      </div>

      {/* Provider Status */}
      {integrations && integrations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {integrations.filter((i: any) => i.isEnabled).map((int: any) => (
            <Card key={int.id}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{PROVIDER_ICONS[int.provider] || "📁"}</span>
                  <div>
                    <p className="font-medium text-sm">{fmt(int.provider)}</p>
                    <p className="text-xs text-slate-500">{int.accountEmail || "Connected"}</p>
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  {stats?.byProvider?.[int.provider] && (
                    <p>{stats.byProvider[int.provider].count} files · {formatSize(stats.byProvider[int.provider].size)}</p>
                  )}
                  {int.lastSyncAt && <p>Synced: {new Date(int.lastSyncAt).toLocaleString()}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search files across all providers..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchQuery && searchMut.mutate({ query: searchQuery })} />
        </div>
        <Button variant="outline" disabled={!searchQuery || searchMut.isLoading} onClick={() => searchMut.mutate({ query: searchQuery })}>Search</Button>
      </div>

      {/* Search Results */}
      {searchMut.data && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Search Results</CardTitle></CardHeader>
          <CardContent>
            {(searchMut.data as any).success && Array.isArray((searchMut.data as any).data) ? (
              (searchMut.data as any).data.map((f: any, i: number) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <FileText className="h-4 w-4 text-slate-400" />
                  <div className="flex-1"><p className="text-sm font-medium">{f.name}</p><p className="text-xs text-slate-500">{f.provider && <span>{PROVIDER_ICONS[f.provider]} </span>}{f.externalPath || ""}</p></div>
                  <span className="text-xs text-slate-400">{f.sizeBytes ? formatSize(Number(f.sizeBytes)) : ""}</span>
                </div>
              ))
            ) : <p className="text-slate-500 text-sm">{(searchMut.data as any).error || "No results"}</p>}
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Recent Files</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="templates">Folder Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card><CardContent className="pt-4">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Provider</TableHead><TableHead>Matter</TableHead><TableHead>Size</TableHead><TableHead>Modified</TableHead><TableHead>Sync</TableHead></TableRow></TableHeader>
              <TableBody>
                {(files || []).map((f: any) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell>{PROVIDER_ICONS[f.provider] || "📁"} {fmt(f.provider)}</TableCell>
                    <TableCell className="text-xs">{f.matterId?.slice(0, 8) || "—"}</TableCell>
                    <TableCell className="text-xs">{formatSize(Number(f.sizeBytes))}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{f.lastModifiedAt ? new Date(f.lastModifiedAt).toLocaleDateString() : "—"}</TableCell>
                    <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${SYNC_COLORS[f.syncStatus] || ""}`}>{f.syncStatus}</span></TableCell>
                  </TableRow>
                ))}
                {!files?.length && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">No files synced yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card><CardContent className="pt-4">
            <div className="space-y-2">
              {(activity || []).map((a: any) => (
                <div key={a.id} className="flex items-center gap-3 py-2 border-b last:border-0 text-sm">
                  <span>{PROVIDER_ICONS[a.provider] || "📁"}</span>
                  <div className="flex-1"><p>{a.description}</p>{a.performedBy && <p className="text-xs text-slate-500">{a.performedBy}</p>}</div>
                  <span className="text-xs text-slate-400 whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</span>
                </div>
              ))}
              {!activity?.length && <p className="text-slate-500 text-center py-4">No recent activity</p>}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          {(!templates || templates.length === 0) && (
            <Button variant="outline" onClick={() => seedTemplates.mutate()}><Wand2 className="h-4 w-4 mr-2" /> Create Starter Templates</Button>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(templates || []).map((t: any) => {
              const subs = JSON.parse(t.subfolders);
              return (
                <Card key={t.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <div><p className="font-medium">{t.name}</p>{t.practiceArea && <p className="text-xs text-slate-500">{t.practiceArea}</p>}</div>
                      {t.isDefault && <Badge variant="secondary">Default</Badge>}
                    </div>
                    <div className="text-xs text-slate-600 space-y-0.5">
                      {subs.map((s: any, i: number) => (
                        <div key={i}>📁 {s.name}{s.subfolders?.map((ss: any, j: number) => <span key={j} className="ml-4 block">📄 {ss.name}</span>)}</div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Conflict Alert */}
      {conflicts && conflicts.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              <p className="font-medium">{conflicts.length} file conflict(s) need resolution</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
