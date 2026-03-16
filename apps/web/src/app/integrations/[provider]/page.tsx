"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, RefreshCw, Unplug, CheckCircle } from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  CREATED: "bg-green-100 text-green-700", UPDATED: "bg-blue-100 text-blue-700",
  SKIPPED: "bg-gray-100 text-gray-700", FAILED: "bg-red-100 text-red-700",
};

function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

export default function IntegrationDetailPage() {
  const { provider } = useParams<{ provider: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const prov = provider as "QUICKBOOKS" | "XERO";
  const { data: integration } = trpc.integrations.getIntegration.useQuery({ provider: prov });
  const { data: logs } = trpc.integrations.getSyncLogs.useQuery({ provider: prov, limit: 30 });
  const { data: stats } = trpc.integrations.getSyncStats.useQuery({ provider: prov });
  const { data: externalAccounts } = trpc.integrations.getExternalAccounts.useQuery({ provider: prov });
  const { data: firmAccounts } = trpc.accounting.listAccounts.useQuery();
  const { data: currentMapping } = trpc.integrations.getAccountMapping.useQuery({ provider: prov });

  const [syncDirection, setSyncDirection] = useState("BIDIRECTIONAL");
  const [autoSync, setAutoSync] = useState(false);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  useEffect(() => {
    if (integration) {
      setSyncDirection(integration.syncDirection || "BIDIRECTIONAL");
      setAutoSync(integration.autoSyncEnabled || false);
    }
    if (currentMapping) setMapping(currentMapping as any);
  }, [integration, currentMapping]);

  const updateMut = trpc.integrations.updateSettings.useMutation({
    onSuccess: () => { utils.integrations.getIntegration.invalidate({ provider: prov }); toast({ title: "Settings saved" }); },
  });
  const saveMappingMut = trpc.integrations.saveAccountMapping.useMutation({
    onSuccess: () => toast({ title: "Mapping saved" }),
  });
  const syncMut = trpc.integrations.syncAll.useMutation({
    onSuccess: () => { utils.integrations.getIntegration.invalidate({ provider: prov }); toast({ title: "Sync complete" }); },
  });
  const testMut = trpc.integrations.testConnection.useMutation({
    onSuccess: (d) => toast({ title: d.connected ? `Connected! ${d.accountCount} accounts` : d.error || "Failed" }),
  });
  const disconnectMut = trpc.integrations.disconnect.useMutation({
    onSuccess: () => { toast({ title: "Disconnected" }); router.push("/integrations"); },
  });

  const syncClientsMut = trpc.integrations.syncClients.useMutation({
    onSuccess: (d) => { utils.integrations.getSyncLogs.invalidate(); toast({ title: `Clients: ${d.created} created, ${d.skipped} skipped, ${d.failed} failed` }); },
  });
  const syncInvoicesMut = trpc.integrations.syncInvoices.useMutation({
    onSuccess: (d) => { utils.integrations.getSyncLogs.invalidate(); toast({ title: `Invoices: ${d.created} created, ${d.skipped} skipped, ${d.failed} failed` }); },
  });

  const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <button type="button" className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? "bg-blue-600" : "bg-gray-200"}`} onClick={() => onChange(!checked)}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </label>
  );

  if (!integration) return <div className="p-6">Loading...</div>;

  const providerLabel = prov === "QUICKBOOKS" ? "QuickBooks Online" : "Xero";
  const providerColor = prov === "QUICKBOOKS" ? "bg-green-500" : "bg-blue-500";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/integrations"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg ${providerColor} flex items-center justify-center text-white font-bold text-sm`}>{prov === "QUICKBOOKS" ? "QB" : "X"}</div>
          <h1 className="text-2xl font-bold">{providerLabel}</h1>
          {integration.isConnected && <CheckCircle className="h-5 w-5 text-green-500" />}
        </div>
      </div>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="mapping">Account Mapping</TabsTrigger>
          <TabsTrigger value="history">Sync History</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Sync Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              <div className="space-y-2">
                <Label>Sync Direction</Label>
                <Select value={syncDirection} onValueChange={setSyncDirection}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TO_EXTERNAL">To {providerLabel} Only</SelectItem>
                    <SelectItem value="FROM_EXTERNAL">From {providerLabel} Only</SelectItem>
                    <SelectItem value="BIDIRECTIONAL">Bidirectional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Toggle label="Auto-Sync" checked={autoSync} onChange={setAutoSync} />
              <Button onClick={() => updateMut.mutate({ provider: prov, syncDirection: syncDirection as any, autoSyncEnabled: autoSync })}>Save Settings</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Manual Sync</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => syncClientsMut.mutate({ provider: prov })} disabled={syncClientsMut.isLoading}>Sync Clients</Button>
              <Button size="sm" onClick={() => syncInvoicesMut.mutate({ provider: prov })} disabled={syncInvoicesMut.isLoading}>Sync Invoices</Button>
              <Button size="sm" onClick={() => syncMut.mutate({ provider: prov })} disabled={syncMut.isLoading}><RefreshCw className="h-3 w-3 mr-1" /> Sync All</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Connection</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">Company: <strong>{integration.companyName || "—"}</strong></p>
              <p className="text-sm">Last synced: {integration.lastSyncAt ? new Date(integration.lastSyncAt).toLocaleString() : "Never"}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => testMut.mutate({ provider: prov })}>Test Connection</Button>
                <Button size="sm" variant="outline" className="text-red-600" onClick={() => { if (confirm("Disconnect?")) disconnectMut.mutate({ provider: prov }); }}><Unplug className="h-3 w-3 mr-1" /> Disconnect</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapping" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Account Mapping</CardTitle>
                <Button size="sm" onClick={() => saveMappingMut.mutate({ provider: prov, mapping: JSON.stringify(mapping) })}>Save Mapping</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4 text-xs font-medium text-slate-500 pb-2 border-b">
                  <span>Clio AI Account</span>
                  <span>{providerLabel} Account</span>
                </div>
                {(firmAccounts || []).slice(0, 30).map((acct: any) => (
                  <div key={acct.id} className="grid grid-cols-2 gap-4 items-center py-1">
                    <span className="text-sm"><span className="font-mono text-xs text-slate-400 mr-2">{acct.accountNumber}</span>{acct.name}</span>
                    <Select value={mapping[acct.id] || "__none__"} onValueChange={(v) => setMapping({ ...mapping, [acct.id]: v === "__none__" ? "" : v })}>
                      <SelectTrigger className="text-sm"><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Not Mapped —</SelectItem>
                        {(externalAccounts || []).map((ea: any) => <SelectItem key={ea.id} value={ea.id}>{ea.name} ({ea.type})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Sync History</CardTitle>
                {stats && <p className="text-sm text-slate-500">Total: {stats.totalSynced} | Created: {stats.created} | Failed: {stats.failed}</p>}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Time</TableHead><TableHead>Direction</TableHead><TableHead>Type</TableHead><TableHead>Action</TableHead><TableHead>External ID</TableHead><TableHead>Error</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(logs || []).map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{log.direction}</TableCell>
                      <TableCell className="text-xs">{log.entityType}</TableCell>
                      <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] || ""}`}>{log.action}</span></TableCell>
                      <TableCell className="font-mono text-xs">{log.externalId || "—"}</TableCell>
                      <TableCell className="text-xs text-red-600 max-w-[200px] truncate">{log.errorMessage || ""}</TableCell>
                    </TableRow>
                  ))}
                  {!logs?.length && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">No sync history</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
