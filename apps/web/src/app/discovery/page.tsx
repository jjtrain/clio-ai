"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { FileText, Sparkles, Info, Copy, Download } from "lucide-react";

const REQUEST_TYPES = [
  { value: "interrogatory", label: "Interrogatories" },
  { value: "rfa", label: "Requests for Admission" },
  { value: "rfp", label: "Requests for Production" },
  { value: "rog", label: "Requests for Identification (Rogatory)" },
];

const STRATEGIES = [
  { value: "object_to_all", label: "Object to all — Maximum objections" },
  { value: "respond_selectively", label: "Respond selectively — Object where possible" },
  { value: "full_cooperation", label: "Full cooperation — Respond with minimal objections" },
  { value: "custom", label: "Custom — Provide instructions" },
];

export default function DiscoveryPage() {
  const { toast } = useToast();

  const [documentText, setDocumentText] = useState("");
  const [requestType, setRequestType] = useState("interrogatory");
  const [strategy, setStrategy] = useState("respond_selectively");
  const [customInstructions, setCustomInstructions] = useState("");
  const [responses, setResponses] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);

  const { data: mattersData } = trpc.matters.list.useQuery({ limit: 100 });
  const [matterId, setMatterId] = useState("");
  const matters = mattersData?.matters || [];

  const analyzeMut = trpc.legalTools["discovery.analyze"].useMutation({
    onSuccess: (d) => { if (d.success) setAnalysis((d as any).data); else toast({ title: (d as any).error, variant: "destructive" }); },
    onError: (e) => toast({ title: e.message, variant: "destructive" }),
  });

  const generateMut = trpc.legalTools["discovery.generateResponses"].useMutation({
    onSuccess: (d) => {
      if (d.success) setResponses((d as any).data);
      else toast({ title: (d as any).error, variant: "destructive" });
    },
    onError: (e) => toast({ title: e.message, variant: "destructive" }),
  });

  const { data: briefpointConfig } = trpc.legalTools["settings.get"].useQuery({ provider: "BRIEFPOINT" });
  const isBriefpointConfigured = briefpointConfig?.isEnabled && briefpointConfig?.apiKey;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Discovery Assistant</h1>
        <p className="text-sm text-slate-500">AI-powered discovery response generation{isBriefpointConfigured ? " — Powered by Briefpoint" : ""}</p>
      </div>

      {!isBriefpointConfigured && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2 text-sm text-blue-800">
          <Info className="h-4 w-4 flex-shrink-0" />
          <span>Connect Briefpoint for AI-powered discovery responses. <a href="/settings/integrations" className="underline font-medium">Configure in Settings</a>. Built-in AI will be used in the meantime.</span>
        </div>
      )}

      {/* Input Section */}
      <Card>
        <CardHeader><CardTitle>Analyze Discovery Request</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Matter</Label>
              <Select value={matterId || "__none__"} onValueChange={(v) => setMatterId(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select matter" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {matters.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Request Type</Label>
              <Select value={requestType} onValueChange={setRequestType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REQUEST_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Discovery Request Text</Label>
            <Textarea rows={8} placeholder="Paste the discovery request text here..." value={documentText} onChange={(e) => setDocumentText(e.target.value)} />
          </div>

          <Button variant="outline" disabled={!documentText || analyzeMut.isLoading} onClick={() => analyzeMut.mutate({ documentText })}>
            <Sparkles className="h-4 w-4 mr-2" /> {analyzeMut.isLoading ? "Analyzing..." : "Analyze Request"}
          </Button>
        </CardContent>
      </Card>

      {/* Generate Responses */}
      <Card>
        <CardHeader><CardTitle>Generate Responses</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Response Strategy</Label>
            <div className="space-y-2">
              {STRATEGIES.map((s) => (
                <label key={s.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${strategy === s.value ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}>
                  <input type="radio" name="strategy" checked={strategy === s.value} onChange={() => setStrategy(s.value)} />
                  <span className="text-sm">{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          {strategy === "custom" && (
            <div className="space-y-2">
              <Label>Custom Instructions</Label>
              <Textarea rows={3} value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} placeholder="Provide specific instructions..." />
            </div>
          )}

          <Button disabled={!documentText || !matterId || generateMut.isLoading} onClick={() => {
            generateMut.mutate({
              matterId, documentText, requestType: requestType as any,
              responseStrategy: strategy === "custom" ? customInstructions : strategy,
            });
          }}>
            <FileText className="h-4 w-4 mr-2" /> {generateMut.isLoading ? "Generating..." : "Generate Responses"}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {responses && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Generated Responses</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  const text = responses.responses.map((r: any) => `Request #${r.requestNumber}:\n${r.requestText}\n\nResponse:\n${r.response}\n${r.objections?.length ? `\nObjections:\n${r.objections.join("\n")}` : ""}`).join("\n\n---\n\n");
                  navigator.clipboard?.writeText(text);
                  toast({ title: "Copied to clipboard" });
                }}>
                  <Copy className="h-3 w-3 mr-1" /> Copy All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {responses.responses.map((r: any) => (
              <div key={r.requestNumber} className="space-y-2">
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-xs font-medium text-slate-500 mb-1">Request #{r.requestNumber}</p>
                  <p className="text-sm">{r.requestText}</p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="text-xs font-medium text-green-600 mb-1">Response</p>
                  <p className="text-sm whitespace-pre-wrap">{r.response}</p>
                </div>
                {r.objections?.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs font-medium text-amber-700 mb-1">Objections</p>
                    {r.objections.map((obj: string, i: number) => (
                      <p key={i} className="text-sm text-amber-800">• {obj}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
