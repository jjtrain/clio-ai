"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { CheckCircle, XCircle, RefreshCw, Unplug, Settings, ExternalLink } from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  CREATED: "bg-green-100 text-green-700", UPDATED: "bg-blue-100 text-blue-700",
  SKIPPED: "bg-gray-100 text-gray-700", FAILED: "bg-red-100 text-red-700",
};
const STATUS_COLORS: Record<string, string> = {
  IDLE: "bg-gray-100 text-gray-700", SYNCING: "bg-blue-100 text-blue-700", ERROR: "bg-red-100 text-red-700",
};

function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

export default function IntegrationsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: integrations } = trpc.integrations.listIntegrations.useQuery();
  const { data: qbLogs } = trpc.integrations.getSyncLogs.useQuery({ provider: "QUICKBOOKS", limit: 10 });
  const { data: xeroLogs } = trpc.integrations.getSyncLogs.useQuery({ provider: "XERO", limit: 10 });

  const getAuthUrl = trpc.integrations.getAuthUrl.useMutation({
    onSuccess: (d) => { window.location.href = d.url; },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const disconnectMut = trpc.integrations.disconnect.useMutation({
    onSuccess: () => { utils.integrations.listIntegrations.invalidate(); toast({ title: "Disconnected" }); },
  });

  const syncMut = trpc.integrations.syncAll.useMutation({
    onSuccess: (d) => { utils.integrations.listIntegrations.invalidate(); toast({ title: d.success ? "Sync complete" : `Sync error: ${d.error}` }); },
  });

  const testMut = trpc.integrations.testConnection.useMutation({
    onSuccess: (d) => toast({ title: d.connected ? `Connected! ${d.accountCount} accounts found` : `Failed: ${d.error}` }),
  });

  const qb = integrations?.find((i: any) => i.provider === "QUICKBOOKS");
  const xero = integrations?.find((i: any) => i.provider === "XERO");
  const allLogs = [...(qbLogs || []), ...(xeroLogs || [])].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 15);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
        <p className="text-sm text-slate-500">Connect Clio AI with your accounting software</p>
      </div>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* QuickBooks */}
        <Card className="border-2 border-green-100">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center text-white font-bold text-lg">QB</div>
              <div>
                <CardTitle>QuickBooks Online</CardTitle>
                <p className="text-xs text-slate-500">Sync invoices, payments, expenses & clients</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {qb?.isConnected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700 font-medium">Connected</span>
                  {qb.companyName && <span className="text-sm text-slate-500">— {qb.companyName}</span>}
                </div>
                {qb.lastSyncAt && <p className="text-xs text-slate-500">Last synced: {new Date(qb.lastSyncAt).toLocaleString()}</p>}
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[qb.syncStatus]}`}>{qb.syncStatus}</span>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={() => syncMut.mutate({ provider: "QUICKBOOKS" })} disabled={syncMut.isLoading}><RefreshCw className="h-3 w-3 mr-1" /> Sync Now</Button>
                  <Button size="sm" variant="outline" onClick={() => router.push("/integrations/QUICKBOOKS")}><Settings className="h-3 w-3 mr-1" /> Settings</Button>
                  <Button size="sm" variant="outline" className="text-red-600" onClick={() => { if (confirm("Disconnect?")) disconnectMut.mutate({ provider: "QUICKBOOKS" }); }}><Unplug className="h-3 w-3 mr-1" /> Disconnect</Button>
                </div>
              </div>
            ) : (
              <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => getAuthUrl.mutate({ provider: "QUICKBOOKS" })} disabled={getAuthUrl.isLoading}>
                <ExternalLink className="h-4 w-4 mr-2" /> Connect QuickBooks
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Xero */}
        <Card className="border-2 border-blue-100">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold text-lg">X</div>
              <div>
                <CardTitle>Xero</CardTitle>
                <p className="text-xs text-slate-500">Sync invoices, payments, expenses & contacts</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {xero?.isConnected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-blue-700 font-medium">Connected</span>
                  {xero.companyName && <span className="text-sm text-slate-500">— {xero.companyName}</span>}
                </div>
                {xero.lastSyncAt && <p className="text-xs text-slate-500">Last synced: {new Date(xero.lastSyncAt).toLocaleString()}</p>}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={() => syncMut.mutate({ provider: "XERO" })} disabled={syncMut.isLoading}><RefreshCw className="h-3 w-3 mr-1" /> Sync Now</Button>
                  <Button size="sm" variant="outline" onClick={() => router.push("/integrations/XERO")}><Settings className="h-3 w-3 mr-1" /> Settings</Button>
                  <Button size="sm" variant="outline" className="text-red-600" onClick={() => { if (confirm("Disconnect?")) disconnectMut.mutate({ provider: "XERO" }); }}><Unplug className="h-3 w-3 mr-1" /> Disconnect</Button>
                </div>
              </div>
            ) : (
              <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => getAuthUrl.mutate({ provider: "XERO" })} disabled={getAuthUrl.isLoading}>
                <ExternalLink className="h-4 w-4 mr-2" /> Connect Xero
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sync Activity */}
      {allLogs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Recent Sync Activity</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Time</TableHead><TableHead>Provider</TableHead><TableHead>Type</TableHead><TableHead>Action</TableHead><TableHead>External ID</TableHead><TableHead>Error</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {allLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="secondary">{log.integration?.provider || "—"}</Badge></TableCell>
                    <TableCell className="text-xs">{log.entityType}</TableCell>
                    <TableCell><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] || ""}`}>{log.action}</span></TableCell>
                    <TableCell className="font-mono text-xs">{log.externalId || "—"}</TableCell>
                    <TableCell className="text-xs text-red-600 max-w-[200px] truncate">{log.errorMessage || ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
