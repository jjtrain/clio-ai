"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import {
  Link2,
  Unlink,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  FileText,
  CreditCard,
  Users,
  ExternalLink,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const PROVIDERS = [
  {
    id: "QUICKBOOKS",
    name: "QuickBooks Online",
    logo: "QBO",
    color: "bg-green-600",
    description: "Sync invoices, payments, and clients with QuickBooks Online",
    implemented: true,
    sandboxUrl: "https://developer.intuit.com",
  },
  {
    id: "XERO",
    name: "Xero",
    logo: "XRO",
    color: "bg-blue-600",
    description: "Push invoices and payments to Xero accounting",
    implemented: true,
    sandboxUrl: "https://developer.xero.com",
  },
  {
    id: "FRESHBOOKS",
    name: "FreshBooks",
    logo: "FB",
    color: "bg-gray-400",
    description: "FreshBooks integration — coming soon",
    implemented: false,
    sandboxUrl: null,
  },
];

const ACTION_COLORS: Record<string, string> = {
  CREATED: "bg-green-100 text-green-700",
  UPDATED: "bg-blue-100 text-blue-700",
  SKIPPED: "bg-gray-100 text-gray-500",
  FAILED: "bg-red-100 text-red-700",
};

const ENTITY_ICONS: Record<string, any> = {
  INVOICE: FileText,
  PAYMENT: CreditCard,
  CLIENT: Users,
};

export default function AccountingSettingsPage() {
  const integrationsQuery = trpc.accountingSync.getIntegration.useQuery();
  const statsQuery = trpc.accountingSync.getSyncStats.useQuery();
  const logsQuery = trpc.accountingSync.getSyncLog.useQuery({ limit: 20 });
  const syncMut = trpc.accountingSync.syncNow.useMutation({
    onSuccess: () => {
      integrationsQuery.refetch();
      statsQuery.refetch();
      logsQuery.refetch();
    },
  });
  const disconnectMut = trpc.accountingSync.disconnectIntegration.useMutation({
    onSuccess: () => integrationsQuery.refetch(),
  });

  const [logFilter, setLogFilter] = useState("all");

  const integrations = integrationsQuery.data || [];
  const stats = statsQuery.data;
  const logs = logsQuery.data || [];

  function getIntegration(provider: string) {
    return integrations.find((i) => i.provider === provider);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Link2 className="h-7 w-7 text-green-600" />
            Accounting Integrations
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Connect QuickBooks or Xero to sync invoices and payments
          </p>
        </div>
        <Button onClick={() => syncMut.mutate()} disabled={syncMut.isLoading} className="gap-2">
          {syncMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sync Now
        </Button>
      </div>

      {syncMut.isSuccess && syncMut.data && (
        <Card className="p-3 bg-green-50 border-green-200">
          <p className="text-sm text-green-700">
            <CheckCircle className="h-4 w-4 inline mr-1" />
            Sync complete: {syncMut.data.invoicesPushed} invoices, {syncMut.data.paymentsPushed} payments pushed, {syncMut.data.paymentsUpdated} payment statuses updated
          </p>
        </Card>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <p className="text-2xl font-bold text-gray-900">{stats.syncedInvoices}</p>
            <p className="text-xs text-gray-500">Synced Invoices</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-500">Total Sync Ops</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-bold text-orange-600">{stats.pendingCount}</p>
            <p className="text-xs text-gray-500">Pending</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            <p className="text-xs text-gray-500">Failed</p>
          </Card>
        </div>
      )}

      {/* Provider Cards */}
      <div className="space-y-4">
        {PROVIDERS.map((provider) => {
          const integration = getIntegration(provider.id);
          const isConnected = integration?.isConnected;

          return (
            <Card key={provider.id} className={cn("p-5", !provider.implemented && "opacity-60")}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-sm", provider.color)}>
                    {provider.logo}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">{provider.name}</h3>
                      {isConnected && (
                        <Badge className="text-[10px] bg-green-100 text-green-700">Connected</Badge>
                      )}
                      {!provider.implemented && (
                        <Badge className="text-[10px] bg-gray-100 text-gray-500">Coming Soon</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{provider.description}</p>
                    {integration?.lastSyncAt && (
                      <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Last sync: {new Date(integration.lastSyncAt).toLocaleString()}
                      </p>
                    )}
                    {integration?.syncError && (
                      <p className="text-[10px] text-red-500 mt-0.5 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {integration.syncError}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  {isConnected ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => disconnectMut.mutate({ provider: provider.id })}
                        disabled={disconnectMut.isLoading}
                      >
                        <Unlink className="h-3 w-3 mr-1" /> Disconnect
                      </Button>
                    </>
                  ) : provider.implemented ? (
                    <a href={`/api/accounting/connect/${provider.id}`}>
                      <Button size="sm" className="gap-1">
                        <Zap className="h-3 w-3" /> Connect
                      </Button>
                    </a>
                  ) : null}
                  {provider.sandboxUrl && (
                    <a href={provider.sandboxUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="text-xs text-gray-400">
                        <ExternalLink className="h-3 w-3 mr-1" /> Sandbox
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Sync Log */}
      {logs.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Sync Log</h2>
            <Select value={logFilter} onValueChange={setLogFilter}>
              <SelectTrigger className="w-[120px] h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="CREATED">Created</SelectItem>
                <SelectItem value="UPDATED">Updated</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            {logs
              .filter((l: any) => logFilter === "all" || l.action === logFilter)
              .map((log: any) => {
                const Icon = ENTITY_ICONS[log.entityType] || FileText;
                return (
                  <div key={log.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-gray-400" />
                      <Badge className={cn("text-[10px]", ACTION_COLORS[log.action] || "")}>
                        {log.action}
                      </Badge>
                      <span className="text-xs text-gray-600">{log.entityType}</span>
                      {log.externalId && (
                        <span className="text-[10px] text-gray-400 font-mono">→ {log.externalId}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {log.errorMessage && (
                        <span className="text-[10px] text-red-500 max-w-[200px] truncate">{log.errorMessage}</span>
                      )}
                      <span className="text-[10px] text-gray-400">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>
      )}
    </div>
  );
}
