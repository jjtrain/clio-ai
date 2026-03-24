"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import {
  MessageCircle, CheckCircle, AlertCircle, RefreshCw,
  Unlink, Loader2, Shield, Clock, Plus, Copy,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const QUALITY_COLORS: Record<string, string> = {
  GREEN: "bg-green-100 text-green-700",
  YELLOW: "bg-yellow-100 text-yellow-700",
  RED: "bg-red-100 text-red-700",
};

export default function WhatsAppSettingsPage() {
  const connQuery = trpc.whatsapp.getConnectionStatus.useQuery();
  const templatesQuery = trpc.whatsapp.listTemplates.useQuery();
  const connectMut = trpc.whatsapp.connect.useMutation({ onSuccess: () => connQuery.refetch() });
  const disconnectMut = trpc.whatsapp.disconnect.useMutation({ onSuccess: () => connQuery.refetch() });
  const syncMut = trpc.whatsapp.syncTemplates.useMutation({ onSuccess: () => templatesQuery.refetch() });

  const [showSetup, setShowSetup] = useState(false);
  const [wabaId, setWabaId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const conn = connQuery.data;
  const templates = templatesQuery.data || [];

  function handleConnect() {
    if (!wabaId || !phoneNumberId || !phoneNumber || !accessToken) return;
    connectMut.mutate({ wabaId, phoneNumberId, phoneNumber, displayName: displayName || phoneNumber, accessToken });
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MessageCircle className="h-7 w-7 text-green-600" />
          WhatsApp Business
        </h1>
        <p className="text-sm text-gray-500 mt-1">Connect WhatsApp to message clients directly from Managal</p>
      </div>

      {/* Connection Status */}
      <Card className="p-5">
        {conn ? (
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center text-white text-xl">W</div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">{conn.displayName}</h3>
                  <Badge className="text-[10px] bg-green-100 text-green-700">Connected</Badge>
                  {conn.qualityRating && (
                    <Badge className={cn("text-[10px]", QUALITY_COLORS[conn.qualityRating] || "bg-gray-100 text-gray-500")}>
                      {conn.qualityRating}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{conn.phoneNumber}</p>
                {conn.lastSyncAt && (
                  <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Last sync: {new Date(conn.lastSyncAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" className="text-red-600" onClick={() => disconnectMut.mutate()}>
              <Unlink className="h-3 w-3 mr-1" /> Disconnect
            </Button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Connect WhatsApp Business</h3>
                <p className="text-xs text-gray-500 mt-0.5">Link your WhatsApp Business Account to start messaging</p>
              </div>
              <Button size="sm" onClick={() => setShowSetup(!showSetup)} className="bg-green-600 hover:bg-green-700">
                <Plus className="h-3 w-3 mr-1" /> Set Up
              </Button>
            </div>

            {showSetup && (
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className="text-xs font-medium text-gray-600">WABA ID</label><Input value={wabaId} onChange={(e) => setWabaId(e.target.value)} placeholder="WhatsApp Business Account ID" className="h-8 text-sm mt-1" /></div>
                  <div><label className="text-xs font-medium text-gray-600">Phone Number ID</label><Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="Meta phone number ID" className="h-8 text-sm mt-1" /></div>
                  <div><label className="text-xs font-medium text-gray-600">Phone Number (E.164)</label><Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+12125551234" className="h-8 text-sm mt-1" /></div>
                  <div><label className="text-xs font-medium text-gray-600">Display Name</label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Law Firm Name" className="h-8 text-sm mt-1" /></div>
                </div>
                <div><label className="text-xs font-medium text-gray-600">System User Access Token</label><Input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="Token from Meta Business Manager" className="h-8 text-sm mt-1" /></div>
                <Button size="sm" onClick={handleConnect} disabled={connectMut.isLoading} className="bg-green-600 hover:bg-green-700">
                  {connectMut.isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />} Connect
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Templates */}
      {conn && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Message Templates</h2>
            <Button variant="outline" size="sm" onClick={() => syncMut.mutate()} disabled={syncMut.isLoading}>
              {syncMut.isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />} Sync from Meta
            </Button>
          </div>
          {templates.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No templates synced yet</p>}
          {templates.map((t: any) => (
            <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">{t.name.replace(/_/g, " ")}</span>
                  <Badge className={cn("text-[10px]",
                    t.status === "APPROVED" ? "bg-green-100 text-green-700"
                    : t.status === "PENDING" ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
                  )}>{t.status}</Badge>
                  <Badge variant="outline" className="text-[9px]">{t.category}</Badge>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{t.language}</p>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Auto-Filing */}
      {conn && (
        <Card className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Shield className="h-4 w-4 text-gray-400" /> Auto-Filing</h2>
          <div className="space-y-2">
            {[
              { label: "Auto-file from known contacts", desc: "When a client's phone matches a contact with one active matter", enabled: true },
              { label: "Create stub contact for unknown numbers", desc: "Automatically create a contact record for new phone numbers", enabled: true },
              { label: "Auto-save received documents to matter", desc: "PDFs and documents sent via WhatsApp are saved to the matter", enabled: false },
            ].map((rule) => (
              <div key={rule.label} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                <div><span className="text-sm text-gray-800">{rule.label}</span><p className="text-xs text-gray-500 mt-0.5">{rule.desc}</p></div>
                <div className={cn("h-5 w-5 rounded border-2 flex items-center justify-center", rule.enabled ? "bg-green-600 border-green-600" : "border-gray-300")}>
                  {rule.enabled && <CheckCircle className="h-3 w-3 text-white" />}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Setup Guide */}
      <Card className="p-5 bg-gray-50">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Setup Checklist</h3>
        <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
          <li>Create app at developers.facebook.com (Business type)</li>
          <li>Add WhatsApp product to your Meta app</li>
          <li>Note WABA ID and Phone Number ID from Getting Started page</li>
          <li>Create System User in Meta Business Manager with whatsapp_business_messaging permission</li>
          <li>Configure webhook URL: <code className="bg-gray-200 px-1 rounded">/api/webhooks/whatsapp</code></li>
          <li>Submit message templates for approval (UTILITY category, 24-48h)</li>
          <li>For production: complete Meta Business Verification</li>
        </ol>
      </Card>
    </div>
  );
}
