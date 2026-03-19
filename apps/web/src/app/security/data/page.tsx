"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Tags, Clock, Scale, Plus, ShieldAlert } from "lucide-react";

const levelColors: Record<string, string> = {
  public: "bg-gray-100 text-gray-600",
  internal: "bg-blue-50 text-blue-700",
  confidential: "bg-amber-50 text-amber-700",
  restricted: "bg-red-50 text-red-700",
};

export default function DataGovernancePage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [holdDialog, setHoldDialog] = useState(false);
  const [holdName, setHoldName] = useState("");
  const [holdMatterId, setHoldMatterId] = useState("");
  const [holdReason, setHoldReason] = useState("");

  const { data: classification } = trpc.security["classification.getSummary"].useQuery();
  const { data: retentionPolicies } = trpc.security["retention.listPolicies"].useQuery();
  const { data: holds } = trpc.security["holds.list"].useQuery();

  const createHold = trpc.security["holds.create"].useMutation({
    onSuccess: () => {
      toast({ title: "Legal hold created" });
      utils.security["holds.list"].invalidate();
      setHoldDialog(false);
      setHoldName("");
      setHoldMatterId("");
      setHoldReason("");
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Data Governance</h1>
        <p className="text-gray-500 mt-1">Classification, retention policies, and legal holds</p>
      </div>

      {/* Classification Summary */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-6 border-b border-gray-100 flex items-center gap-2">
          <Tags className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Data Classification</h2>
        </div>
        <div className="p-6 grid gap-4 md:grid-cols-4">
          {(classification as any)?.byClassification?.map((level: any) => (
            <div key={level.classification} className="rounded-lg border border-gray-100 p-4 text-center">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${levelColors[level.classification?.toLowerCase()] ?? "bg-gray-100 text-gray-600"}`}>
                {level.classification}
              </span>
              <p className="text-2xl font-bold text-gray-900 mt-2">{(level._count || 0).toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">records</p>
            </div>
          )) ?? (
            <p className="text-gray-500 col-span-4 text-center py-4">No classification data yet</p>
          )}
        </div>
      </div>

      {/* Retention Policies */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-6 border-b border-gray-100 flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Retention Policies</h2>
        </div>
        {!retentionPolicies?.length ? (
          <div className="p-8 text-center text-gray-500">No retention policies configured</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-left text-sm text-gray-500">
                <th className="px-6 py-3 font-medium">Policy</th>
                <th className="px-6 py-3 font-medium">Data Type</th>
                <th className="px-6 py-3 font-medium">Retention Period</th>
                <th className="px-6 py-3 font-medium">Action</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {retentionPolicies.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{p.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{p.resource}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{p.retentionDays + " days"}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{p.actionOnExpiry}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${p.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Legal Holds */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Legal Holds</h2>
          </div>
          <Dialog open={holdDialog} onOpenChange={setHoldDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-blue-500 hover:bg-blue-600 shadow-sm">
                <Plus className="mr-2 h-4 w-4" /> Create Hold
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Legal Hold</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createHold.mutate({ name: holdName, matterId: holdMatterId, reason: holdReason }); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Hold Name</Label>
                  <Input value={holdName} onChange={(e) => setHoldName(e.target.value)} placeholder="e.g. Smith v. Jones Litigation Hold" required />
                </div>
                <div className="space-y-2">
                  <Label>Matter ID</Label>
                  <Input value={holdMatterId} onChange={(e) => setHoldMatterId(e.target.value)} placeholder="Matter identifier" required />
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Input value={holdReason} onChange={(e) => setHoldReason(e.target.value)} placeholder="Reason for legal hold" required />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setHoldDialog(false)}>Cancel</Button>
                  <Button type="submit" disabled={createHold.isLoading}>{createHold.isLoading ? "Creating..." : "Create Hold"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        {!holds?.length ? (
          <div className="p-8 text-center">
            <ShieldAlert className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No active legal holds</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {holds.map((h) => (
              <div key={h.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                <div>
                  <p className="font-medium text-gray-900">{h.holdName}</p>
                  <p className="text-sm text-gray-500">{h.reason} &middot; Matter: {h.matterId}</p>
                </div>
                <div className="text-right text-sm text-gray-500">
                  <p>Created {new Date(h.createdAt).toLocaleDateString()}</p>
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-50 text-red-700">Active</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
