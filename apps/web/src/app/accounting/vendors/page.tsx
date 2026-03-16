"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Plus } from "lucide-react";

function cur(n: number) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 }); }

export default function VendorsPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [addOpen, setAddOpen] = useState(false);

  const { data: vendors } = trpc.accounting.listVendors.useQuery();
  const createMut = trpc.accounting.createVendor.useMutation({
    onSuccess: () => { utils.accounting.listVendors.invalidate(); setAddOpen(false); toast({ title: "Vendor created" }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vendor Directory</h1>
        <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Vendor</Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Company</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Total Paid</TableHead><TableHead>1099</TableHead><TableHead>Contact</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(vendors || []).map((v: any) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell>{v.company || "—"}</TableCell>
                  <TableCell>{v.category || "—"}</TableCell>
                  <TableCell className="text-right font-mono">{cur(Number(v.totalPaid))}</TableCell>
                  <TableCell>{v.is1099Eligible ? <Badge variant="secondary">1099</Badge> : "—"}</TableCell>
                  <TableCell className="text-sm">{v.email || v.phone || "—"}</TableCell>
                </TableRow>
              ))}
              {!vendors?.length && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">No vendors</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Vendor</DialogTitle></DialogHeader>
          <VendorForm onSubmit={(d: any) => createMut.mutate(d)} isLoading={createMut.isLoading} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VendorForm({ onSubmit, isLoading }: any) {
  const [form, setForm] = useState<any>({ name: "", company: "", email: "", phone: "", category: "", is1099Eligible: false });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="space-y-2"><Label>Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
      </div>
      <div className="space-y-2"><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Court, Expert, etc." /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is1099Eligible} onChange={(e) => setForm({ ...form, is1099Eligible: e.target.checked })} className="rounded" /> 1099 Eligible</label>
      <Button className="w-full" disabled={!form.name || isLoading} onClick={() => onSubmit({ ...form, company: form.company || undefined, email: form.email || undefined, phone: form.phone || undefined, category: form.category || undefined })}>
        {isLoading ? "Creating..." : "Add Vendor"}
      </Button>
    </div>
  );
}
