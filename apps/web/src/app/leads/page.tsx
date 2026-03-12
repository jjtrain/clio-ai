"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  UserPlus,
  MessageSquare,
  FileText,
  Phone as PhoneIcon,
  Globe,
  User,
  MoreHorizontal,
  Inbox,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

const STATUSES = [
  { value: "NEW", label: "New", color: "bg-blue-100 text-blue-700" },
  { value: "CONTACTED", label: "Contacted", color: "bg-yellow-100 text-yellow-700" },
  { value: "QUALIFYING", label: "Qualifying", color: "bg-orange-100 text-orange-700" },
  { value: "QUALIFIED", label: "Qualified", color: "bg-purple-100 text-purple-700" },
  { value: "PROPOSAL_SENT", label: "Proposal Sent", color: "bg-indigo-100 text-indigo-700" },
  { value: "CONVERTED", label: "Converted", color: "bg-emerald-100 text-emerald-700" },
  { value: "DECLINED", label: "Declined", color: "bg-red-100 text-red-700" },
  { value: "ARCHIVED", label: "Archived", color: "bg-gray-100 text-gray-600" },
];

const KANBAN_STATUSES = ["NEW", "CONTACTED", "QUALIFYING", "QUALIFIED", "PROPOSAL_SENT"];

const SOURCE_ICONS: Record<string, any> = {
  INTAKE_FORM: FileText,
  LIVE_CHAT: MessageSquare,
  CONTACT_FORM: FileText,
  MANUAL: User,
  REFERRAL: UserPlus,
  WEBSITE: Globe,
  PHONE: PhoneIcon,
  OTHER: MoreHorizontal,
};

const PRIORITIES = [
  { value: "LOW", color: "border-gray-300" },
  { value: "MEDIUM", color: "border-blue-400" },
  { value: "HIGH", color: "border-orange-400" },
  { value: "URGENT", color: "border-red-500" },
];

function timeAgo(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

function statusColor(status: string) {
  return STATUSES.find((s) => s.value === status)?.color || "bg-gray-100 text-gray-600";
}

function priorityColor(priority: string) {
  return PRIORITIES.find((p) => p.value === priority)?.color || "border-gray-300";
}

export default function LeadInboxPage() {
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [dragStatus, setDragStatus] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: leadsData, refetch } = trpc.leads.list.useQuery({
    search: search || undefined,
    status: statusFilter && statusFilter !== "all" ? (statusFilter as any) : undefined,
    source: sourceFilter && sourceFilter !== "all" ? (sourceFilter as any) : undefined,
  });

  const { data: stats } = trpc.leads.getStats.useQuery();
  const { data: selectedLead, refetch: refetchLead } = trpc.leads.getById.useQuery(
    { id: selectedLeadId! },
    { enabled: !!selectedLeadId }
  );

  const updateStatusMutation = trpc.leads.updateStatus.useMutation({
    onSuccess: () => { refetch(); refetchLead(); },
  });
  const updateMutation = trpc.leads.update.useMutation({
    onSuccess: () => { refetch(); refetchLead(); },
  });
  const addNoteMutation = trpc.leads.addNote.useMutation({
    onSuccess: () => refetchLead(),
  });
  const convertMutation = trpc.leads.convertToClient.useMutation({
    onSuccess: (client) => {
      toast({ title: "Client created", description: `${client.name} has been added.` });
      refetch();
      refetchLead();
    },
  });
  const deleteMutation = trpc.leads.delete.useMutation({
    onSuccess: () => { refetch(); setSelectedLeadId(null); },
  });

  const leads = leadsData?.leads || [];

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData("text/plain", leadId);
  };

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    setDragStatus(status);
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    setDragStatus(null);
    const leadId = e.dataTransfer.getData("text/plain");
    if (leadId) {
      updateStatusMutation.mutate({ id: leadId, status: status as any });
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Lead Inbox</h1>
          <p className="text-gray-500 mt-1 text-sm">Manage and track all incoming leads</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild className="bg-blue-500 hover:bg-blue-600 shadow-sm">
            <Link href="/leads/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Lead
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/leads/chat">
              <MessageSquare className="mr-2 h-4 w-4" />
              Chat
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="flex flex-wrap gap-2">
          {STATUSES.filter((s) => !["ARCHIVED"].includes(s.value)).map((s) => (
            <span
              key={s.value}
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${s.color}`}
            >
              {s.label}: {(stats.byStatus as any)[s.value] || 0}
            </span>
          ))}
        </div>
      )}

      {/* Filters & View Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white border-gray-200"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[150px] bg-white">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {Object.keys(SOURCE_ICONS).map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            className={`p-2 rounded-md ${view === "kanban" ? "bg-white shadow-sm" : "text-gray-500"}`}
            onClick={() => setView("kanban")}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            className={`p-2 rounded-md ${view === "table" ? "bg-white shadow-sm" : "text-gray-500"}`}
            onClick={() => setView("table")}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Kanban View */}
      {view === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KANBAN_STATUSES.map((status) => {
            const statusInfo = STATUSES.find((s) => s.value === status)!;
            const columnLeads = leads.filter((l) => l.status === status);
            return (
              <div
                key={status}
                className={`flex-shrink-0 w-72 rounded-xl border ${
                  dragStatus === status ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-gray-50"
                }`}
                onDragOver={(e) => handleDragOver(e, status)}
                onDragLeave={() => setDragStatus(null)}
                onDrop={(e) => handleDrop(e, status)}
              >
                <div className="p-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                    <span className="text-xs text-gray-500">{columnLeads.length}</span>
                  </div>
                </div>
                <div className="p-2 space-y-2 min-h-[200px]">
                  {columnLeads.map((lead) => {
                    const SourceIcon = SOURCE_ICONS[lead.source] || MoreHorizontal;
                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        onClick={() => setSelectedLeadId(lead.id)}
                        className={`bg-white rounded-lg border-l-4 ${priorityColor(lead.priority)} border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-shadow`}
                      >
                        <div className="flex items-start justify-between">
                          <p className="font-medium text-gray-900 text-sm">{lead.name}</p>
                          <SourceIcon className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        </div>
                        {lead.practiceArea && (
                          <p className="text-xs text-gray-500 mt-1">{lead.practiceArea}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">{timeAgo(lead.createdAt)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {view === "table" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead className="font-semibold text-gray-600">Name</TableHead>
                  <TableHead className="font-semibold text-gray-600">Email</TableHead>
                  <TableHead className="font-semibold text-gray-600">Source</TableHead>
                  <TableHead className="font-semibold text-gray-600">Status</TableHead>
                  <TableHead className="font-semibold text-gray-600">Priority</TableHead>
                  <TableHead className="font-semibold text-gray-600">Practice Area</TableHead>
                  <TableHead className="font-semibold text-gray-600">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <Inbox className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No leads found</p>
                      <Button asChild className="mt-4" variant="outline" size="sm">
                        <Link href="/leads/new">
                          <Plus className="mr-2 h-4 w-4" />
                          Add Lead
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="hover:bg-gray-50/50 cursor-pointer"
                      onClick={() => setSelectedLeadId(lead.id)}
                    >
                      <TableCell className="font-medium text-gray-900">{lead.name}</TableCell>
                      <TableCell className="text-gray-600">{lead.email || "-"}</TableCell>
                      <TableCell>
                        <span className="text-xs text-gray-500">{lead.source.replace(/_/g, " ")}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(lead.status)}`}>
                          {lead.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          lead.priority === "URGENT" ? "bg-red-100 text-red-700" :
                          lead.priority === "HIGH" ? "bg-orange-100 text-orange-700" :
                          lead.priority === "MEDIUM" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {lead.priority}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-600">{lead.practiceArea || "-"}</TableCell>
                      <TableCell className="text-gray-500 text-sm">{timeAgo(lead.createdAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Lead Detail Panel */}
      <Dialog open={!!selectedLeadId} onOpenChange={(open) => !open && setSelectedLeadId(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lead Details</DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4">
              {/* Editable fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input
                    defaultValue={selectedLead.name}
                    onBlur={(e) => {
                      if (e.target.value !== selectedLead.name) {
                        updateMutation.mutate({ id: selectedLead.id, name: e.target.value });
                      }
                    }}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input
                    defaultValue={selectedLead.email || ""}
                    onBlur={(e) => updateMutation.mutate({ id: selectedLead.id, email: e.target.value })}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input
                    defaultValue={selectedLead.phone || ""}
                    onBlur={(e) => updateMutation.mutate({ id: selectedLead.id, phone: e.target.value })}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Practice Area</Label>
                  <Input
                    defaultValue={selectedLead.practiceArea || ""}
                    onBlur={(e) => updateMutation.mutate({ id: selectedLead.id, practiceArea: e.target.value })}
                    className="bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={selectedLead.status}
                    onValueChange={(v) => updateStatusMutation.mutate({ id: selectedLead.id, status: v as any })}
                  >
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Priority</Label>
                  <Select
                    value={selectedLead.priority}
                    onValueChange={(v) => updateMutation.mutate({ id: selectedLead.id, priority: v as any })}
                  >
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedLead.description && (
                <div>
                  <Label className="text-xs">Description</Label>
                  <p className="text-sm text-gray-700 mt-1">{selectedLead.description}</p>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Textarea
                  defaultValue={selectedLead.notes || ""}
                  onBlur={(e) => addNoteMutation.mutate({ id: selectedLead.id, notes: e.target.value })}
                  placeholder="Add internal notes..."
                  className="bg-white"
                />
              </div>

              <div className="text-xs text-gray-500">
                Source: {selectedLead.source.replace(/_/g, " ")} &middot; Created {timeAgo(selectedLead.createdAt)}
              </div>

              {/* Activity Timeline */}
              {selectedLead.activities.length > 0 && (
                <div className="border-t pt-3">
                  <Label className="text-xs">Activity</Label>
                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                    {selectedLead.activities.map((a) => (
                      <div key={a.id} className="flex items-start gap-2 text-xs">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                        <div>
                          <p className="text-gray-700">{a.description}</p>
                          <p className="text-gray-400">{timeAgo(a.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="border-t pt-3 flex gap-2">
                {selectedLead.clientId ? (
                  <div className="text-sm text-emerald-600">
                    Converted &middot;{" "}
                    <Link href={`/clients/${selectedLead.clientId}`} className="underline">View Client</Link>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => convertMutation.mutate({ id: selectedLead.id, createMatter: true })}
                    disabled={convertMutation.isLoading}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Convert to Client
                  </Button>
                )}
                {selectedLead.chatSession && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/leads/chat">
                      <MessageSquare className="mr-2 h-4 w-4" />
                      View Chat
                    </Link>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-700"
                  onClick={() => deleteMutation.mutate({ id: selectedLead.id })}
                >
                  Archive
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
