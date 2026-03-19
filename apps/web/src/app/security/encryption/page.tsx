"use client";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { KeyRound, Lock, ShieldCheck, RefreshCw } from "lucide-react";

export default function EncryptionPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: keys, isLoading } = trpc.security["encryption.listKeys"].useQuery();

  const rotateKey = trpc.security["encryption.rotateKey"].useMutation({
    onSuccess: () => {
      toast({ title: "Key rotated successfully" });
      utils.security["encryption.listKeys"].invalidate();
    },
    onError: (error) => {
      toast({ title: "Rotation failed", description: error.message, variant: "destructive" });
    },
  });

  const activeKeys = keys?.filter((k) => k.status === "KEY_ACTIVE") ?? [];
  const needsRotation = (key: any) => {
    if (!key.nextRotationDateDate) return false;
    return new Date(key.nextRotationDateDate) <= new Date();
  };
  const soonRotation = (key: any) => {
    if (!key.nextRotationDateDate) return false;
    const days = (new Date(key.nextRotationDateDate).getTime() - Date.now()) / 86400000;
    return days > 0 && days <= 30;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Encryption Management</h1>
        <p className="text-gray-500 mt-1">Monitor encryption status and manage cryptographic keys</p>
      </div>

      {/* Status Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">At-Rest Encryption</p>
              <p className="text-2xl font-bold text-green-600 mt-2">Enabled</p>
              <p className="text-xs text-gray-500 mt-1">AES-256-GCM</p>
            </div>
            <div className="p-3 rounded-lg bg-green-50">
              <Lock className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">In-Transit Encryption</p>
              <p className="text-2xl font-bold text-green-600 mt-2">TLS 1.3</p>
              <p className="text-xs text-gray-500 mt-1">All connections encrypted</p>
            </div>
            <div className="p-3 rounded-lg bg-green-50">
              <ShieldCheck className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Active Keys</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{activeKeys.length}</p>
              <p className="text-xs text-gray-500 mt-1">Cryptographic keys in use</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50">
              <KeyRound className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Key Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Encryption Keys</h2>
        </div>
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-gray-500 mt-3">Loading keys...</p>
          </div>
        ) : !keys?.length ? (
          <div className="p-12 text-center">
            <KeyRound className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No encryption keys found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-left text-sm text-gray-500">
                <th className="px-6 py-3 font-medium">Alias</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Algorithm</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Created</th>
                <th className="px-6 py-3 font-medium">Last Rotated</th>
                <th className="px-6 py-3 font-medium">Next Rotation</th>
                <th className="px-6 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keys.map((key) => {
                const overdue = needsRotation(key);
                const soon = soonRotation(key);
                return (
                  <tr key={key.id} className={`transition-colors ${overdue ? "bg-red-50/50" : soon ? "bg-amber-50/50" : "hover:bg-gray-50/50"}`}>
                    <td className="px-6 py-4 font-medium text-gray-900">{key.keyAlias}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{key.keyType}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">{key.algorithm}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        key.status === "KEY_ACTIVE" ? "bg-green-50 text-green-700" :
                        key.status === "KEY_ROTATING" ? "bg-amber-50 text-amber-700" :
                        "bg-gray-100 text-gray-500"
                      }`}>
                        {key.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{new Date(key.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{key.rotatedAt ? new Date(key.rotatedAt).toLocaleDateString() : "Never"}</td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-medium ${overdue ? "text-red-600" : soon ? "text-amber-600" : "text-gray-600"}`}>
                        {key.nextRotationDate ? new Date(key.nextRotationDate).toLocaleDateString() : "N/A"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => rotateKey.mutate({ keyId: key.id })}
                        disabled={rotateKey.isLoading}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 mr-1 ${rotateKey.isLoading ? "animate-spin" : ""}`} />
                        Rotate
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
