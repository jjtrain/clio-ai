"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Send,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  Mail,
  Zap,
} from "lucide-react";

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SCHEDULED: "bg-amber-100 text-amber-700",
  SENDING: "bg-blue-100 text-blue-700",
  SENT: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const recipientStatusColors: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  SENT: "bg-green-100 text-green-700",
  DELIVERED: "bg-blue-100 text-blue-700",
  FAILED: "bg-red-100 text-red-700",
  BOUNCED: "bg-orange-100 text-orange-700",
};

export default function CampaignDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [recipientFilter, setRecipientFilter] = useState<string | undefined>(undefined);

  const { data: campaign, isLoading } = trpc.campaigns.getById.useQuery({ id });
  const { data: stats } = trpc.campaigns.getCampaignStats.useQuery({ id });
  const { data: recipientsData } = trpc.campaigns.getRecipients.useQuery({
    campaignId: id,
    status: recipientFilter as any,
  });

  const sendCampaign = trpc.campaigns.send.useMutation({
    onSuccess: () => {
      toast({ title: "Campaign sent successfully" });
      utils.campaigns.getById.invalidate({ id });
      utils.campaigns.getRecipients.invalidate({ campaignId: id });
      utils.campaigns.getCampaignStats.invalidate({ id });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const cancelCampaign = trpc.campaigns.cancel.useMutation({
    onSuccess: () => {
      toast({ title: "Campaign cancelled" });
      utils.campaigns.getById.invalidate({ id });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!campaign) {
    return <div className="text-center py-20 text-gray-500">Campaign not found</div>;
  }

  const totalRecipients = campaign.recipientCount || 0;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/campaigns">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{campaign.name}</h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[campaign.status]}`}
            >
              {campaign.status}
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                campaign.campaignType === "BLAST" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
              }`}
            >
              {campaign.campaignType === "BLAST" ? (
                <><Mail className="h-3 w-3 mr-1" /> Blast</>
              ) : (
                <><Zap className="h-3 w-3 mr-1" /> Triggered</>
              )}
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-1">Subject: {campaign.subject}</p>
        </div>
        <div className="flex gap-2">
          {campaign.status === "DRAFT" && (
            <Button
              onClick={() => sendCampaign.mutate({ id })}
              disabled={sendCampaign.isPending}
              className="bg-blue-500 hover:bg-blue-600"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Now
            </Button>
          )}
          {(campaign.status === "DRAFT" || campaign.status === "SCHEDULED") && (
            <Button
              variant="outline"
              onClick={() => cancelCampaign.mutate({ id })}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {(campaign.status === "SENT" || campaign.status === "SENDING") && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <Users className="h-5 w-5 text-gray-400 mx-auto mb-1" />
            <div className="text-2xl font-bold">{totalRecipients}</div>
            <div className="text-sm text-gray-500">Total Recipients</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto mb-1" />
            <div className="text-2xl font-bold text-green-600">{campaign.totalSent}</div>
            <div className="text-sm text-gray-500">
              Sent {totalRecipients > 0 ? `(${Math.round((campaign.totalSent / totalRecipients) * 100)}%)` : ""}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <Mail className="h-5 w-5 text-blue-500 mx-auto mb-1" />
            <div className="text-2xl font-bold text-blue-600">{campaign.totalDelivered}</div>
            <div className="text-sm text-gray-500">Delivered</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mx-auto mb-1" />
            <div className="text-2xl font-bold text-red-600">{campaign.totalFailed}</div>
            <div className="text-sm text-gray-500">Failed</div>
          </div>
        </div>
      )}

      {/* Content Preview */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">Content Preview</h2>
        <div
          className="border rounded-lg p-6 bg-gray-50 prose max-w-none"
          dangerouslySetInnerHTML={{ __html: campaign.htmlContent }}
        />
      </div>

      {/* Recipients Table */}
      {recipientsData && (recipientsData.total > 0 || campaign.status !== "DRAFT") && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Recipients ({recipientsData.total})
            </h2>
            <div className="flex gap-2">
              {["ALL", "SENT", "FAILED", "PENDING"].map((f) => (
                <button
                  key={f}
                  onClick={() => setRecipientFilter(f === "ALL" ? undefined : f)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    (f === "ALL" && !recipientFilter) || recipientFilter === f
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-white text-gray-600 border-gray-300"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {recipientsData.recipients.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No recipients found</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 font-medium text-gray-500">Name</th>
                  <th className="text-left py-2 font-medium text-gray-500">Email</th>
                  <th className="text-left py-2 font-medium text-gray-500">Status</th>
                  <th className="text-left py-2 font-medium text-gray-500">Sent At</th>
                  <th className="text-left py-2 font-medium text-gray-500">Error</th>
                </tr>
              </thead>
              <tbody>
                {recipientsData.recipients.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50">
                    <td className="py-2.5 text-gray-900">{r.name || "—"}</td>
                    <td className="py-2.5 text-gray-600">{r.email}</td>
                    <td className="py-2.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${recipientStatusColors[r.status]}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-gray-500 text-xs">
                      {r.sentAt ? new Date(r.sentAt).toLocaleString() : "—"}
                    </td>
                    <td className="py-2.5 text-red-500 text-xs truncate max-w-[200px]">
                      {r.errorMessage || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
