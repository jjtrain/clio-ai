"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Search, Phone, Printer, MapPin, Trash2, Edit } from "lucide-react";

const PROVIDER_TYPES = [
  "HOSPITAL", "ER", "PRIMARY_CARE", "SPECIALIST", "SURGEON", "CHIROPRACTOR",
  "PHYSICAL_THERAPY", "IMAGING", "PHARMACY", "AMBULANCE", "MENTAL_HEALTH", "OTHER",
];

const PROVIDER_TYPE_COLORS: Record<string, string> = {
  HOSPITAL: "bg-red-100 text-red-700",
  ER: "bg-red-100 text-red-700",
  PRIMARY_CARE: "bg-blue-100 text-blue-700",
  SPECIALIST: "bg-purple-100 text-purple-700",
  SURGEON: "bg-indigo-100 text-indigo-700",
  CHIROPRACTOR: "bg-green-100 text-green-700",
  PHYSICAL_THERAPY: "bg-teal-100 text-teal-700",
  IMAGING: "bg-cyan-100 text-cyan-700",
  PHARMACY: "bg-orange-100 text-orange-700",
  AMBULANCE: "bg-red-100 text-red-700",
  MENTAL_HEALTH: "bg-violet-100 text-violet-700",
  OTHER: "bg-gray-100 text-gray-700",
};

function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

export default function ProvidersPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: providers, isLoading } = trpc.medicalRecords.listProviders.useQuery({
    search: search || undefined,
    type: typeFilter || undefined,
  });

  const createProvider = trpc.medicalRecords.createProvider.useMutation({
    onSuccess: () => { utils.medicalRecords.listProviders.invalidate(); setDialogOpen(false); toast({ title: "Provider created" }); },
  });

  const updateProvider = trpc.medicalRecords.updateProvider.useMutation({
    onSuccess: () => { utils.medicalRecords.listProviders.invalidate(); setEditId(null); toast({ title: "Provider updated" }); },
  });

  const deleteProvider = trpc.medicalRecords.deleteProvider.useMutation({
    onSuccess: () => { utils.medicalRecords.listProviders.invalidate(); toast({ title: "Provider deleted" }); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editingProvider = editId ? providers?.find((p: any) => p.id === editId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Medical Provider Directory</h1>
          <p className="text-sm text-slate-500">Manage medical providers for injury cases</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Provider</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search providers..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Types</SelectItem>
            {PROVIDER_TYPES.map((t) => <SelectItem key={t} value={t}>{fmt(t)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Provider Cards */}
      {isLoading ? (
        <p className="text-slate-500">Loading...</p>
      ) : !providers?.length ? (
        <p className="text-slate-500">No providers found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((p: any) => (
            <Card key={p.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{p.name}</h3>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PROVIDER_TYPE_COLORS[p.type] || ""}`}>
                        {fmt(p.type)}
                      </span>
                    </div>
                    <div className="text-sm text-slate-500 space-y-0.5">
                      {p.phone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" /> {p.phone}</p>}
                      {p.fax && <p className="flex items-center gap-1"><Printer className="h-3 w-3" /> {p.fax}</p>}
                      {(p.address || p.city) && (
                        <p className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {[p.address, p.city, p.state, p.zip].filter(Boolean).join(", ")}</p>
                      )}
                      <p className="text-xs mt-1">{p._count?.records ?? 0} records &middot; {p._count?.liens ?? 0} liens</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditId(p.id)}><Edit className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => {
                      if (confirm("Delete this provider?")) deleteProvider.mutate({ id: p.id });
                    }}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Provider Dialog */}
      <ProviderDialog
        open={dialogOpen || !!editId}
        onClose={() => { setDialogOpen(false); setEditId(null); }}
        provider={editingProvider}
        onSubmit={(data: any) => {
          if (editId) {
            updateProvider.mutate({ id: editId, ...data });
          } else {
            createProvider.mutate(data);
          }
        }}
        isLoading={createProvider.isLoading || updateProvider.isLoading}
      />
    </div>
  );
}

function ProviderDialog({ open, onClose, provider, onSubmit, isLoading }: any) {
  const [form, setForm] = useState<any>(() => provider ? {
    name: provider.name || "",
    type: provider.type || "HOSPITAL",
    phone: provider.phone || "",
    fax: provider.fax || "",
    email: provider.email || "",
    address: provider.address || "",
    city: provider.city || "",
    state: provider.state || "",
    zip: provider.zip || "",
    contactPerson: provider.contactPerson || "",
    notes: provider.notes || "",
  } : {
    name: "", type: "HOSPITAL", phone: "", fax: "", email: "",
    address: "", city: "", state: "", zip: "", contactPerson: "", notes: "",
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{provider ? "Edit Provider" : "Add Provider"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROVIDER_TYPES.map((t) => <SelectItem key={t} value={t}>{fmt(t)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-2"><Label>Fax</Label><Input value={form.fax} onChange={(e) => setForm({ ...form, fax: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2"><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div className="space-y-2"><Label>State</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
            <div className="space-y-2"><Label>ZIP</Label><Input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>Contact Person</Label><Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></div>
          <div className="space-y-2"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={isLoading || !form.name} onClick={() => onSubmit({
              name: form.name,
              type: form.type,
              phone: form.phone || undefined,
              fax: form.fax || undefined,
              email: form.email || undefined,
              address: form.address || undefined,
              city: form.city || undefined,
              state: form.state || undefined,
              zip: form.zip || undefined,
              contactPerson: form.contactPerson || undefined,
              notes: form.notes || undefined,
            })}>
              {isLoading ? "Saving..." : provider ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
