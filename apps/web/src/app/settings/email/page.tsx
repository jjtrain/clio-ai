"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import {
  Mail,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Unlink,
  Loader2,
  Clock,
  Plus,
  Trash2,
  GripVertical,
  Send,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export default function EmailSettingsPage() {
  const syncStatusQuery = trpc.email["sync.status"].useQuery();
  const rulesQuery = trpc.email["rules.list"].useQuery();
  const syncMut = trpc.email["sync.run"].useMutation({
    onSuccess: () => syncStatusQuery.refetch(),
  });
  const syncAllMut = trpc.email["sync.runAll"].useMutation({
    onSuccess: () => syncStatusQuery.refetch(),
  });
  const deleteRuleMut = trpc.email["rules.delete"].useMutation({
    onSuccess: () => rulesQuery.refetch(),
  });

  const [showAddRule, setShowAddRule] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [ruleFrom, setRuleFrom] = useState("");
  const [ruleSubject, setRuleSubject] = useState("");

  const createRuleMut = trpc.email["rules.create"].useMutation({
    onSuccess: () => { rulesQuery.refetch(); setShowAddRule(false); setRuleName(""); setRuleFrom(""); setRuleSubject(""); },
  });

  const integrations = (syncStatusQuery.data || []) as any[];
  const gmailIntegration = integrations.find((i: any) => i.provider === "GMAIL");
  const rules = rulesQuery.data || [];

  const isGmailConnected = gmailIntegration?.isEnabled;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Mail className="h-7 w-7 text-blue-600" />
          Email Settings
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Connect Gmail, manage sync, and configure auto-filing rules
        </p>
      </div>

      {/* Gmail Connection */}
      <Card className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-red-500 flex items-center justify-center text-white font-bold text-lg">G</div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">Gmail</h3>
                {isGmailConnected ? (
                  <Badge className="text-[10px] bg-green-100 text-green-700">Connected</Badge>
                ) : (
                  <Badge className="text-[10px] bg-gray-100 text-gray-500">Not Connected</Badge>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {isGmailConnected
                  ? `Two-way sync with ${gmailIntegration?.emailAddress || "your Gmail"}`
                  : "Connect your Gmail to sync emails, auto-file, and send from Managal"
                }
              </p>
              {gmailIntegration?.lastSyncAt && (
                <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Last sync: {new Date(gmailIntegration.lastSyncAt).toLocaleString()}
                  {gmailIntegration.lastSyncStatus === "error" && (
                    <span className="text-red-500 ml-1">
                      <AlertCircle className="h-3 w-3 inline" /> {gmailIntegration.lastSyncError}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {isGmailConnected ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncMut.mutate({ provider: "GMAIL" })}
                  disabled={syncMut.isLoading}
                >
                  {syncMut.isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                  Full Sync
                </Button>
                <a href="/api/gmail/disconnect">
                  <Button variant="outline" size="sm" className="text-red-600">
                    <Unlink className="h-3 w-3 mr-1" /> Disconnect
                  </Button>
                </a>
              </>
            ) : (
              <a href="/api/gmail/connect">
                <Button size="sm" className="gap-1">
                  <Zap className="h-3 w-3" /> Connect Gmail
                </Button>
              </a>
            )}
          </div>
        </div>
      </Card>

      {/* Sync Status */}
      {syncMut.isSuccess && (
        <Card className="p-3 bg-green-50 border-green-200">
          <p className="text-sm text-green-700">
            <CheckCircle className="h-4 w-4 inline mr-1" />
            Sync complete: {(syncMut.data as any)?.synced || 0} messages synced
          </p>
        </Card>
      )}

      {/* Auto-Filing Preferences */}
      <Card className="p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Send className="h-4 w-4 text-gray-400" /> Auto-Filing
        </h2>
        <div className="space-y-2">
          <label className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer">
            <div>
              <span className="text-sm font-medium text-gray-800">Auto-file emails from known clients</span>
              <p className="text-xs text-gray-500 mt-0.5">When a client has exactly one open matter, file their emails automatically</p>
            </div>
            <div className="h-5 w-5 rounded border-2 bg-blue-600 border-blue-600 flex items-center justify-center">
              <CheckCircle className="h-3 w-3 text-white" />
            </div>
          </label>
          <label className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer">
            <div>
              <span className="text-sm font-medium text-gray-800">Auto-file emails to matter addresses</span>
              <p className="text-xs text-gray-500 mt-0.5">Emails sent to matter-slug@mail.managal.app are filed automatically</p>
            </div>
            <div className="h-5 w-5 rounded border-2 bg-blue-600 border-blue-600 flex items-center justify-center">
              <CheckCircle className="h-3 w-3 text-white" />
            </div>
          </label>
        </div>
      </Card>

      {/* Filing Rules */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Filing Rules</h2>
          <Button variant="outline" size="sm" onClick={() => setShowAddRule(!showAddRule)}>
            <Plus className="h-3 w-3 mr-1" /> Add Rule
          </Button>
        </div>

        {showAddRule && (
          <div className="p-3 bg-gray-50 rounded-lg space-y-2">
            <Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="Rule name" className="h-8 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={ruleFrom} onChange={(e) => setRuleFrom(e.target.value)} placeholder="From address or domain" className="h-8 text-sm" />
              <Input value={ruleSubject} onChange={(e) => setRuleSubject(e.target.value)} placeholder="Subject contains" className="h-8 text-sm" />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => createRuleMut.mutate({
                  name: ruleName,
                  conditions: { from: ruleFrom || undefined, subject: ruleSubject || undefined },
                  actions: { file: true },
                })}
                disabled={!ruleName || createRuleMut.isLoading}
              >
                Save Rule
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddRule(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {(rules as any[]).length === 0 && !showAddRule && (
          <p className="text-xs text-gray-400 py-3 text-center">No filing rules configured</p>
        )}

        {(rules as any[]).map((rule: any) => (
          <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-gray-300" />
              <div>
                <span className="text-sm font-medium text-gray-800">{rule.name}</span>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Priority: {rule.priority} · Matches: {rule.matchCount || 0}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={cn("text-[10px]", rule.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                {rule.isActive ? "Active" : "Paused"}
              </Badge>
              <button
                onClick={() => deleteRuleMut.mutate({ id: rule.id })}
                className="text-gray-400 hover:text-red-500"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </Card>

      {/* Setup Notes */}
      <Card className="p-5 bg-gray-50">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Setup Requirements</h3>
        <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
          <li>Google Cloud Console project with Gmail API enabled</li>
          <li>OAuth 2.0 credentials (Web app type) with redirect URI: <code className="bg-gray-200 px-1 rounded">/api/gmail/callback</code></li>
          <li>Set <code className="bg-gray-200 px-1 rounded">GOOGLE_CLIENT_ID</code> and <code className="bg-gray-200 px-1 rounded">GOOGLE_CLIENT_SECRET</code> env vars</li>
          <li>For push notifications: Google Pub/Sub API + topic + grant gmail-api-push@system.gserviceaccount.com Publisher role</li>
          <li>QBO sandbox: <a href="https://developer.intuit.com" className="text-blue-500 underline">developer.intuit.com</a> · Xero demo: <a href="https://developer.xero.com" className="text-blue-500 underline">developer.xero.com</a></li>
        </ul>
      </Card>
    </div>
  );
}
