"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Send, CheckCircle } from "lucide-react";

const MAIL_CLASSES = ["FIRST_CLASS", "CERTIFIED", "CERTIFIED_RETURN_RECEIPT", "PRIORITY", "EXPRESS", "FEDEX_OVERNIGHT", "FEDEX_2DAY", "UPS_NEXT_DAY", "UPS_2DAY"];
const PURPOSES = ["CORRESPONDENCE", "SERVICE_OF_PROCESS", "NOTICE", "DEMAND_LETTER", "COURT_FILING", "DISCOVERY", "SUBPOENA", "LEGAL_NOTICE", "SETTLEMENT", "OTHER"];

export default function SendMailPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState({ matterId: "", recipientName: "", recipientAddress: "", recipientCity: "", recipientState: "", recipientZip: "", mailClass: "FIRST_CLASS", purpose: "CORRESPONDENCE", notes: "" });
  const [result, setResult] = useState<any>(null);

  const { data: matters } = trpc.matters.list.useQuery({});
  const sendMut = trpc.mail["jobs.create"].useMutation({
    onSuccess: (data: any) => { setResult(data); toast({ title: "Mail submitted!" }); },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (result) {
    return (
      <div className="max-w-lg mx-auto space-y-6 py-12 text-center">
        <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
        <h2 className="text-xl font-bold">Mailing Submitted</h2>
        <p className="text-gray-500">To: {result.recipientName}</p>
        <p className="text-gray-500">Status: {result.status}</p>
        {result.trackingNumber && <p className="text-sm font-mono text-blue-600">Tracking: {result.trackingNumber}</p>}
        <div className="flex gap-2 justify-center"><Button variant="outline" onClick={() => router.push("/mail")}>Dashboard</Button><Button onClick={() => { setResult(null); setForm({ ...form, recipientName: "", recipientAddress: "", recipientCity: "", recipientState: "", recipientZip: "" }); }}>Send Another</Button></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div><h1 className="text-2xl font-bold">Send Mail</h1><p className="text-sm text-slate-500">Mail legal documents via CaseMail</p></div>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div><Label>Matter</Label><Select value={form.matterId} onValueChange={(v) => setForm({ ...form, matterId: v })}><SelectTrigger><SelectValue placeholder="Select matter..." /></SelectTrigger><SelectContent>{((matters as any) || []).map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Recipient Name</Label><Input value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} /></div>
          <div><Label>Address</Label><Textarea value={form.recipientAddress} onChange={(e) => setForm({ ...form, recipientAddress: e.target.value })} rows={2} /></div>
          <div className="grid grid-cols-3 gap-4">
            <div><Label>City</Label><Input value={form.recipientCity} onChange={(e) => setForm({ ...form, recipientCity: e.target.value })} /></div>
            <div><Label>State</Label><Input value={form.recipientState} onChange={(e) => setForm({ ...form, recipientState: e.target.value })} maxLength={2} /></div>
            <div><Label>ZIP</Label><Input value={form.recipientZip} onChange={(e) => setForm({ ...form, recipientZip: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Mail Class</Label><Select value={form.mailClass} onValueChange={(v) => setForm({ ...form, mailClass: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MAIL_CLASSES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Purpose</Label><Select value={form.purpose} onValueChange={(v) => setForm({ ...form, purpose: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PURPOSES.map(p => <SelectItem key={p} value={p}>{p.replace(/_/g, " ")}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div><Label>Notes (optional)</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <Button className="w-full" onClick={() => sendMut.mutate({ matterId: form.matterId, recipientName: form.recipientName, recipientAddress: form.recipientAddress, recipientCity: form.recipientCity, recipientState: form.recipientState, recipientZip: form.recipientZip, mailClass: form.mailClass, purpose: form.purpose, documentIds: [], notes: form.notes || undefined })} disabled={!form.matterId || !form.recipientName || !form.recipientAddress || sendMut.isLoading}>
            {sendMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Send Mail
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
