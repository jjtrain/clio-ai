"use client";
import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Send, FileText, Copy, CheckCircle2, Loader2, X, Eye } from "lucide-react";

type Signer = { name: string; phone: string; email: string; role: string };

export default function NewESignRequest() {
  const [tpl, setTpl] = useState<any>(null);
  const [vars, setVars] = useState<Record<string, string>>({});
  const [signers, setSigners] = useState<Signer[]>([{ name: "", phone: "", email: "", role: "Client" }]);
  const [delivery, setDelivery] = useState("email");
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState<any>(null);
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: tplData, isLoading: loadingTpl } = trpc.mobileSign.templates.list.useQuery();
  const send = trpc.mobileSign["createFromTemplate"].useMutation({ onSuccess: (d) => setResult(d) });
  const templates = (tplData ?? []) as any[];

  const setV = (k: string, v: string) => setVars((p) => ({ ...p, [k]: v }));
  const updateSigner = (i: number, f: keyof Signer, v: string) => setSigners((p) => p.map((s, x) => x === i ? { ...s, [f]: v } : s));
  const selectTpl = (t: any) => {
    setTpl(t);
    const av: Record<string, string> = {};
    (t.variables || []).forEach((v: any) => {
      if (v.key === "client_name") av[v.key] = signers[0]?.name || "";
      else if (v.key === "firm_name") av[v.key] = "Your Firm Name";
      else if (v.key === "attorney_name") av[v.key] = "Attorney Name";
      else if (v.key === "date_today") av[v.key] = new Date().toISOString().split("T")[0];
      else av[v.key] = "";
    });
    setVars(av);
  };
  const copyUrl = (url: string) => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); };  const inputFor = (v: any) => {
    if (v.type === "date") return <Input type="date" value={vars[v.key] || ""} onChange={(e) => setV(v.key, e.target.value)} />;
    if (v.type === "currency") return <Input type="number" step="0.01" placeholder="0.00" value={vars[v.key] || ""} onChange={(e) => setV(v.key, e.target.value)} />;
    if (v.type === "select") return (<Select value={vars[v.key] || ""} onValueChange={(val) => setV(v.key, val)}>
      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
      <SelectContent>{(v.options || []).map((o: string) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
    </Select>);
    return <Input value={vars[v.key] || ""} onChange={(e) => setV(v.key, e.target.value)} placeholder={v.placeholder || ""} />;
  };

  if (result) return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-xl border shadow-sm p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-semibold mb-2">Document Sent!</h1>
        <p className="text-gray-500 mb-6">Your signature request has been created and sent.</p>
        {result.signingUrl && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-500 mb-2">Signing URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white border rounded px-3 py-2 overflow-auto">{result.signingUrl}</code>
              <Button size="sm" variant="outline" onClick={() => copyUrl(result.signingUrl)}>
                {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
        <Button asChild><Link href="/e-sign">Back to Dashboard</Link></Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link href="/e-sign"><ArrowLeft className="h-5 w-5" /></Link></Button>
        <div><h1 className="text-2xl font-semibold">New Signature Request</h1><p className="text-gray-500">Select a template and configure signers</p></div>
      </div>

      {!tpl ? (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Choose a Template</h2>
          {loadingTpl ? <p className="text-center text-gray-400 py-8">Loading templates...</p> : templates.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No templates available. Seed templates from the dashboard.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((t: any) => (
                <div key={t.id} className="border rounded-lg p-4 hover:border-blue-300 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <Badge variant="outline" className="text-[10px]">{t.type || t.category}</Badge>
                  </div>
                  <h3 className="font-medium text-sm mb-1">{t.name}</h3>
                  {t.category && <p className="text-xs text-gray-400 mb-3">{t.category}</p>}
                  <Button size="sm" variant="outline" className="w-full" onClick={() => selectTpl(t)}>Use Template</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (<>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-blue-600" />
            <div><p className="font-medium text-sm">{tpl.name}</p><p className="text-xs text-blue-600">{tpl.type || tpl.category}</p></div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => { setTpl(null); setVars({}); }}>Change</Button>
        </div>

        {tpl.variables?.length > 0 && (
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Fill in Details</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {tpl.variables.map((v: any) => (<div key={v.key} className="space-y-1"><Label className="text-sm">{v.label || v.key}</Label>{inputFor(v)}</div>))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">Signers</h2>
          {signers.map((s, i) => (
            <div key={i} className="grid gap-3 md:grid-cols-5 mb-3 items-end">
              <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={s.name} onChange={(e) => updateSigner(i, "name", e.target.value)} placeholder="Full name" /></div>
              <div className="space-y-1"><Label className="text-xs">Email</Label><Input type="email" value={s.email} onChange={(e) => updateSigner(i, "email", e.target.value)} placeholder="email@example.com" /></div>
              <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={s.phone} onChange={(e) => updateSigner(i, "phone", e.target.value)} placeholder="+1..." /></div>
              <div className="space-y-1"><Label className="text-xs">Role</Label>
                <Select value={s.role} onValueChange={(v) => updateSigner(i, "role", v)}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Client">Client</SelectItem><SelectItem value="Attorney">Attorney</SelectItem><SelectItem value="Witness">Witness</SelectItem></SelectContent>
                </Select></div>
              <div>{signers.length > 1 && <Button variant="ghost" size="icon" onClick={() => setSigners((p) => p.filter((_, x) => x !== i))}><X className="h-4 w-4" /></Button>}</div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setSigners((p) => [...p, { name: "", phone: "", email: "", role: "Client" }])}><Plus className="h-4 w-4 mr-1" />Add Signer</Button>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold">Delivery</h2>
          <div className="flex gap-3 flex-wrap">
            {["sms", "email", "both", "link"].map((m) => (
              <label key={m} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer ${delivery === m ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}>
                <input type="radio" name="delivery" value={m} checked={delivery === m} onChange={() => setDelivery(m)} className="accent-blue-600" />
                <span className="text-sm capitalize">{m === "link" ? "Link Only" : m === "both" ? "SMS & Email" : m.toUpperCase()}</span>
              </label>
            ))}
          </div>
          <div className="space-y-1"><Label>Custom Message (optional)</Label>
            <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Add a personal message..." rows={3} /></div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={() => setPreview(true)}><Eye className="h-4 w-4 mr-2" />Preview</Button>
          <Button onClick={() => send.mutate({ templateId: tpl?.id!, fieldValues: vars, signers, deliveryMethod: delivery, customMessage: msg || undefined, firmId: "default", userId: "current-user" } as any)} disabled={send.isPending || !signers[0]?.name}>
            {send.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {send.isPending ? "Sending..." : "Create & Send"}
          </Button>
        </div>
        {send.isError && <p className="text-sm text-red-500 text-right">{send.error.message}</p>}

        {preview && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Document Preview</h2>
                <Button variant="ghost" size="icon" onClick={() => setPreview(false)}><X className="h-4 w-4" /></Button>
              </div>
              <div className="prose prose-sm max-w-none border rounded-lg p-4 bg-gray-50">
                <p className="text-gray-400 text-center">Preview renders the template with your variables.</p>
                <div className="mt-4 space-y-2 text-sm">
                  {Object.entries(vars).map(([k, v]) => (<div key={k} className="flex gap-2"><span className="font-medium text-gray-600">{k}:</span><span>{v || "--"}</span></div>))}
                </div>
              </div>
            </div>
          </div>
        )}
      </>)}
    </div>
  );
}
