"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  UserPlus,
  Search,
  MoreHorizontal,
  Power,
  PowerOff,
  Key,
  Trash2,
  X,
} from "lucide-react";

export default function PortalUsersPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // Create form
  const [newClientId, setNewClientId] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPwd, setNewPwd] = useState("");

  const { data: users, isLoading } = trpc.clientPortal.listPortalUsers.useQuery({ search: search || undefined });
  const { data: clients } = trpc.clients.list.useQuery();

  const createUser = trpc.clientPortal.createPortalUser.useMutation({
    onSuccess: () => {
      toast({ title: "Portal user created" });
      utils.clientPortal.listPortalUsers.invalidate();
      setShowCreate(false);
      setNewClientId("");
      setNewEmail("");
      setNewName("");
      setNewPwd("");
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deactivate = trpc.clientPortal.deactivateUser.useMutation({
    onSuccess: () => { toast({ title: "User deactivated" }); utils.clientPortal.listPortalUsers.invalidate(); },
  });
  const activate = trpc.clientPortal.activateUser.useMutation({
    onSuccess: () => { toast({ title: "User activated" }); utils.clientPortal.listPortalUsers.invalidate(); },
  });
  const resetPwd = trpc.clientPortal.resetPassword.useMutation({
    onSuccess: () => { toast({ title: "Password reset" }); setResetUserId(null); setNewPassword(""); },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const deleteUser = trpc.clientPortal.deletePortalUser.useMutation({
    onSuccess: () => { toast({ title: "User deleted" }); utils.clientPortal.listPortalUsers.invalidate(); },
  });

  const handleClientChange = (clientId: string) => {
    setNewClientId(clientId);
    if (clients?.clients) {
      const client = clients.clients.find((c: any) => c.id === clientId);
      if (client) {
        setNewName(client.name || "");
        if (client.email) setNewEmail(client.email);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/client-portal"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Portal Users</h1>
          <p className="text-gray-500">Manage client portal access</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Create User Dialog */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Create Portal User</h2>
            <Button variant="ghost" size="icon" onClick={() => setShowCreate(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Client <span className="text-red-500">*</span></Label>
              <Select value={newClientId} onValueChange={handleClientChange}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients?.clients?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Client's full name" />
            </div>
            <div className="space-y-2">
              <Label>Email <span className="text-red-500">*</span></Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="client@email.com" />
            </div>
            <div className="space-y-2">
              <Label>Password <span className="text-red-500">*</span> <span className="text-xs text-gray-400">(min 8 chars)</span></Label>
              <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Temporary password" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => createUser.mutate({ clientId: newClientId, email: newEmail, name: newName, password: newPwd })}
              disabled={!newClientId || !newEmail || !newName || newPwd.length < 8 || createUser.isPending}
            >
              {createUser.isPending ? "Creating..." : "Create User"}
            </Button>
          </div>
        </div>
      )}

      {/* Reset Password Dialog */}
      {resetUserId && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Reset Password</h2>
            <Button variant="ghost" size="icon" onClick={() => setResetUserId(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-3">
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 8 characters)"
              className="max-w-sm"
            />
            <Button
              onClick={() => resetPwd.mutate({ id: resetUserId, newPassword })}
              disabled={newPassword.length < 8 || resetPwd.isPending}
            >
              {resetPwd.isPending ? "Resetting..." : "Reset"}
            </Button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          className="pl-10"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Messages</TableHead>
              <TableHead className="w-[150px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
              </TableRow>
            ) : !users?.length ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                  No portal users yet. Click &quot;Add User&quot; to create one.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-sm text-gray-500">{user.email}</TableCell>
                  <TableCell className="text-sm">
                    <Link href={`/clients/${user.client.id}`} className="text-blue-600 hover:underline">
                      {user.client.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge className={user.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-500"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"}
                  </TableCell>
                  <TableCell className="text-sm">{user._count.messages}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {user.isActive ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Deactivate"
                          onClick={() => deactivate.mutate({ id: user.id })}
                        >
                          <PowerOff className="h-4 w-4 text-amber-500" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Activate"
                          onClick={() => activate.mutate({ id: user.id })}
                        >
                          <Power className="h-4 w-4 text-green-500" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Reset Password"
                        onClick={() => { setResetUserId(user.id); setNewPassword(""); }}
                      >
                        <Key className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() => {
                          if (confirm("Delete this portal user? This cannot be undone.")) {
                            deleteUser.mutate({ id: user.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
