"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Plus,
  FileText,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Zap,
  MoreHorizontal,
  Trash2,
  Eye,
  Edit,
} from "lucide-react";

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SCHEDULED: "bg-amber-100 text-amber-700",
  SENDING: "bg-blue-100 text-blue-700",
  SENT: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const typeColors: Record<string, string> = {
  BLAST: "bg-blue-100 text-blue-700",
  TRIGGERED: "bg-purple-100 text-purple-700",
};

export default function CampaignsPage() {
  const [tab, setTab] = useState<"campaigns" | "triggers">("campaigns");
  const utils = trpc.useUtils();

  const { data: campaigns, isLoading } = trpc.campaigns.list.useQuery();
  const { data: triggers } = trpc.campaigns.listTriggers.useQuery();
  const deleteCampaign = trpc.campaigns.delete.useMutation({
    onSuccess: () => utils.campaigns.list.invalidate(),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Email Campaigns</h1>
          <p className="text-gray-500">Send targeted emails to clients and leads</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link href="/campaigns/templates">
              <FileText className="h-4 w-4 mr-2" />
              Templates
            </Link>
          </Button>
          <Button asChild className="bg-blue-500 hover:bg-blue-600">
            <Link href="/campaigns/new">
              <Plus className="h-4 w-4 mr-2" />
              New Campaign
            </Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          <button
            onClick={() => setTab("campaigns")}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              tab === "campaigns"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Mail className="h-4 w-4 inline mr-1.5" />
            Campaigns
          </button>
          <button
            onClick={() => setTab("triggers")}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              tab === "triggers"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Zap className="h-4 w-4 inline mr-1.5" />
            Triggered Rules
          </button>
        </div>
      </div>

      {/* Campaigns Tab */}
      {tab === "campaigns" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          ) : !campaigns || campaigns.length === 0 ? (
            <div className="p-12 text-center">
              <Mail className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No campaigns yet</h3>
              <p className="text-gray-500 mb-4">Create your first email campaign</p>
              <Button asChild className="bg-blue-500 hover:bg-blue-600">
                <Link href="/campaigns/new">
                  <Plus className="h-4 w-4 mr-2" />
                  New Campaign
                </Link>
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Recipients</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Sent</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <Link href={`/campaigns/${c.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                        {c.name}
                      </Link>
                      <p className="text-gray-400 text-xs truncate max-w-[250px]">{c.subject}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[c.campaignType]}`}>
                        {c.campaignType}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[c.status]}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600">{c.recipientCount}</td>
                    <td className="py-3 px-4 text-gray-500 text-xs">
                      {c.sentAt ? new Date(c.sentAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/campaigns/${c.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        {c.status === "DRAFT" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm("Delete this campaign?")) {
                                deleteCampaign.mutate({ id: c.id });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Triggers Tab */}
      {tab === "triggers" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {!triggers || triggers.length === 0 ? (
            <div className="p-12 text-center">
              <Zap className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No triggered rules</h3>
              <p className="text-gray-500 mb-4">Set up automatic emails based on events</p>
              <Button asChild className="bg-blue-500 hover:bg-blue-600">
                <Link href="/campaigns/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Triggered Campaign
                </Link>
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Trigger Event</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Condition</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Times Fired</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {triggers.map((t) => {
                  let condSummary = "—";
                  if (t.triggerCondition) {
                    try {
                      const cond = JSON.parse(t.triggerCondition);
                      condSummary = Object.entries(cond)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ");
                    } catch {}
                  }
                  return (
                    <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <Link href={`/campaigns/${t.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                          {t.name}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          {t.triggerEvent?.replace(/_/g, " ") || "—"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{condSummary}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{t.recipientCount}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[t.status]}`}>
                          {t.status === "SENT" ? "ACTIVE" : t.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
