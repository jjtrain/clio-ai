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
import { Shield, Plus, Pencil, Users } from "lucide-react";

export default function AccessControlPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [roleLevel, setRoleLevel] = useState("");
  const [dataScope, setDataScope] = useState("");

  const { data: policies, isLoading } = trpc.security["access.listPolicies"].useQuery();

  const createPolicy = trpc.security["access.createPolicy"].useMutation({
    onSuccess: () => {
      toast({ title: "Access policy created" });
      utils.security["access.listPolicies"].invalidate();
      setDialogOpen(false);
      setName("");
      setRoleLevel("");
      setDataScope("");
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createPolicy.mutate({ name, roleLevel, dataAccessScope: dataScope });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Access Control</h1>
          <p className="text-gray-500 mt-1">Manage role-based access policies and permissions</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-500 hover:bg-blue-600 shadow-sm">
              <Plus className="mr-2 h-4 w-4" />
              Create Policy
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Access Policy</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Policy Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Partner Access" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role Level</Label>
                  <Input value={roleLevel} onChange={(e) => setRoleLevel(e.target.value)} placeholder="e.g. Admin" required />
                </div>
                <div className="space-y-2">
                  <Label>Data Scope</Label>
                  <Input value={dataScope} onChange={(e) => setDataScope(e.target.value)} placeholder="e.g. All Matters" required />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createPolicy.isLoading}>
                  {createPolicy.isLoading ? "Creating..." : "Create Policy"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Access Policies</h2>
        </div>
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-gray-500 mt-3">Loading policies...</p>
          </div>
        ) : !policies?.length ? (
          <div className="p-12 text-center">
            <Shield className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No access policies configured</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-left text-sm text-gray-500">
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Role Level</th>
                <th className="px-6 py-3 font-medium">Data Scope</th>
                <th className="px-6 py-3 font-medium">Financial</th>
                <th className="px-6 py-3 font-medium">Admin</th>
                <th className="px-6 py-3 font-medium">Users</th>
                <th className="px-6 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {policies.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{p.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{p.roleLevel}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{p.dataAccessScope}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${p.financialAccess ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {p.financialAccess ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${p.adminAccess ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                      {p.adminAccess ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                      <Users className="h-3.5 w-3.5" /> {p.userCount}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Button variant="ghost" size="sm">
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
