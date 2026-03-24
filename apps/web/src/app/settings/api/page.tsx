"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import {
  Zap, Key, Webhook, Activity, Copy, Eye, EyeOff,
  Plus, Trash2, RefreshCw, CheckCircle, AlertCircle,
  Play, Loader2, ExternalLink, X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const SCOPES = [
  { id: "LEADS_READ", label: "Leads (Read)", group: "Leads" },
  { id: "LEADS_WRITE", label: "Leads (Write)", group: "Leads" },
  { id: "MATTERS_READ", label: "Matters (Read)", group: "Matters" },
  { id: "MATTERS_WRITE", label: "Matters (Write)", group: "Matters" },
  { id: "CONTACTS_READ", label: "Contacts (Read)", group: "Contacts" },
  { id: "CONTACTS_WRITE", label: "Contacts (Write)", group: "Contacts" },
  { id: "WEBHOOKS_MANAGE", label: "Webhooks (Manage)", group: "Webhooks" },
];

const WEBHOOK_EVENTS = [
  "LEAD_CREATED", "LEAD_UPDATED", "LEAD_CONVERTED", "MATTER_OPENED",
  "MATTER_STAGE_CHANGED", "MATTER_CLOSED", "CONTACT_CREATED",
  "CONTACT_UPDATED", "INVOICE_CREATED", "INVOICE_PAID",
];

export default function ApiIntegrationsPage() {
  const keysQuery = trpc.apiIntegrations.listApiKeys.useQuery();
  const webhooksQuery = trpc.apiIntegrations.listWebhookSubscriptions.useQuery();
  const statsQuery = trpc.apiIntegrations.getAutomationStats.useQuery();
  const logsQuery = trpc.apiIntegrations.getAutomationLog.useQuery({ limit: 20 });
  const recipesQuery = trpc.apiIntegrations.getRecipeTemplates.useQuery();

  const createKeyMut = trpc.apiIntegrations.createApiKey.useMutation({ onSuccess: () => keysQuery.refetch() });
  const revokeKeyMut = trpc.apiIntegrations.revokeApiKey.useMutation({ onSuccess: () => keysQuery.refetch() });
  const deleteWebhookMut = trpc.apiIntegrations.deleteWebhookSubscription.useMutation({ onSuccess: () => webhooksQuery.refetch() });
  const testWebhookMut = trpc.apiIntegrations.testWebhookSubscription.useMutation();

  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(["LEADS_READ", "LEADS_WRITE"]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  const keys = keysQuery.data || [];
  const webhooks = webhooksQuery.data || [];
  const stats = statsQuery.data;
  const logs = logsQuery.data || [];
  const recipes = recipesQuery.data || [];

  function handleCreateKey() {
    if (!newKeyName) return;
    createKeyMut.mutate({ name: newKeyName, scopes: newKeyScopes }, {
      onSuccess: (data) => { setCreatedKey(data.rawKey); setNewKeyName(""); },
    });
  }

  function toggleScope(scope: string) {
    setNewKeyScopes((prev) => prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Zap className="h-7 w-7 text-orange-500" />
          API & Automation
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Connect Managal to Zapier, Make, and external tools via API
        </p>
      </div>

      {/* Platform Cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-5 border-l-4 border-l-orange-400">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 font-bold">Z</div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold">Zapier</h3>
              <p className="text-xs text-gray-500">Triggers + Actions for 5,000+ apps</p>
            </div>
            <a href="https://zapier.com" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm"><ExternalLink className="h-3 w-3 mr-1" /> Open</Button>
            </a>
          </div>
        </Card>
        <Card className="p-5 border-l-4 border-l-purple-400">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 font-bold">M</div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold">Make (Integromat)</h3>
              <p className="text-xs text-gray-500">Visual automation with webhooks</p>
            </div>
            <a href="https://make.com" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm"><ExternalLink className="h-3 w-3 mr-1" /> Open</Button>
            </a>
          </div>
        </Card>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4"><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-gray-500">API calls (30d)</p></Card>
          <Card className="p-4"><p className="text-2xl font-bold text-green-600">{stats.successRate}%</p><p className="text-xs text-gray-500">Success rate</p></Card>
          <Card className="p-4"><p className="text-2xl font-bold text-red-600">{stats.failures}</p><p className="text-xs text-gray-500">Failures</p></Card>
        </div>
      )}

      {/* API Keys */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Key className="h-4 w-4 text-gray-400" /> API Keys</h2>
          <Button variant="outline" size="sm" onClick={() => { setShowCreateKey(!showCreateKey); setCreatedKey(null); }}>
            <Plus className="h-3 w-3 mr-1" /> Create Key
          </Button>
        </div>

        {/* Create Key Form */}
        {showCreateKey && (
          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Key name (e.g. 'Zapier Integration')" className="h-8 text-sm" />
            <div>
              <p className="text-xs font-medium text-gray-600 mb-1">Scopes</p>
              <div className="flex flex-wrap gap-1">
                {SCOPES.map((s) => (
                  <button key={s.id} onClick={() => toggleScope(s.id)}
                    className={cn("text-xs px-2 py-1 rounded border", newKeyScopes.includes(s.id) ? "bg-blue-100 border-blue-300 text-blue-700" : "bg-white border-gray-200 text-gray-500")}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <Button size="sm" onClick={handleCreateKey} disabled={!newKeyName || createKeyMut.isLoading}>Create</Button>

            {createdKey && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-700 font-semibold mb-1">Copy this key now — it won't be shown again</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white px-2 py-1 rounded border font-mono overflow-hidden">
                    {showKey ? createdKey : "•".repeat(40)}
                  </code>
                  <button onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  <button onClick={() => navigator.clipboard.writeText(createdKey)}><Copy className="h-4 w-4 text-blue-500" /></button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Keys Table */}
        {keys.length === 0 && !showCreateKey && <p className="text-xs text-gray-400 text-center py-4">No API keys created yet</p>}
        {keys.map((key: any) => (
          <div key={key.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <div>
              <span className="text-sm font-medium text-gray-800">{key.name}</span>
              <span className="text-xs text-gray-400 font-mono ml-2">{key.keyPrefix}...</span>
              <div className="flex gap-1 mt-0.5">
                {key.scopes.split(",").slice(0, 3).map((s: string) => <Badge key={s} variant="outline" className="text-[9px]">{s}</Badge>)}
                {key.scopes.split(",").length > 3 && <Badge variant="outline" className="text-[9px]">+{key.scopes.split(",").length - 3}</Badge>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {key.lastUsedAt && <span className="text-[10px] text-gray-400">{new Date(key.lastUsedAt).toLocaleDateString()}</span>}
              <Button variant="ghost" size="sm" className="text-red-500 text-xs" onClick={() => revokeKeyMut.mutate({ id: key.id })}>Revoke</Button>
            </div>
          </div>
        ))}
      </Card>

      {/* Webhooks */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Webhook className="h-4 w-4 text-gray-400" /> Webhook Subscriptions</h2>
        </div>
        {webhooks.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No webhooks configured — create one via the API or Zapier/Make</p>}
        {webhooks.map((wh: any) => (
          <div key={wh.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="text-[10px] bg-indigo-100 text-indigo-700">{wh.event}</Badge>
                <Badge className={cn("text-[10px]", wh.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>{wh.isActive ? "Active" : "Paused"}</Badge>
              </div>
              <p className="text-xs text-gray-500 font-mono mt-0.5 truncate max-w-[300px]">{wh.targetUrl}</p>
              {wh.lastFiredAt && <span className="text-[10px] text-gray-400">Last fired: {new Date(wh.lastFiredAt).toLocaleString()}</span>}
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => testWebhookMut.mutate({ id: wh.id })} disabled={testWebhookMut.isLoading}>
                {testWebhookMut.isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              </Button>
              <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteWebhookMut.mutate({ id: wh.id })}><Trash2 className="h-3 w-3" /></Button>
            </div>
          </div>
        ))}
      </Card>

      {/* Recipe Templates */}
      {recipes.length > 0 && (
        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Quick-Start Recipes</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {recipes.map((r: any) => (
              <div key={r.id} className="p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-1 mb-1">
                  {r.platform.map((p: string) => (
                    <Badge key={p} className={cn("text-[9px]", p === "zapier" ? "bg-orange-100 text-orange-700" : "bg-purple-100 text-purple-700")}>{p}</Badge>
                  ))}
                </div>
                <h4 className="text-sm font-medium text-gray-800">{r.name}</h4>
                <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Activity Log */}
      {logs.length > 0 && (
        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Activity className="h-4 w-4 text-gray-400" /> Recent Activity</h2>
          <div className="space-y-1">
            {logs.map((log: any) => (
              <div key={log.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0 text-xs">
                <div className="flex items-center gap-2">
                  {log.success ? <CheckCircle className="h-3 w-3 text-green-500" /> : <AlertCircle className="h-3 w-3 text-red-500" />}
                  <Badge variant="outline" className="text-[9px]">{log.source}</Badge>
                  <span className="text-gray-700">{log.action}</span>
                  {log.resourceType && <span className="text-gray-400">{log.resourceType} {log.resourceId?.slice(0, 8)}</span>}
                </div>
                <span className="text-gray-400">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
