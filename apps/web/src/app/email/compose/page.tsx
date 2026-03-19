"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, ArrowLeft } from "lucide-react";

export default function ComposePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [matterId, setMatterId] = useState("");
  const [templateId, setTemplateId] = useState("");

  const matters = trpc.matters.list.useQuery({});
  const templates = trpc.email["templates.list"].useQuery();

  const sendMutation = trpc.email["messages.send"].useMutation({
    onSuccess: () => {
      toast({ title: "Email sent" });
      router.push("/email");
    },
    onError: (err) => {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    },
  });

  const handleSend = () => {
    if (!to || !subject) {
      toast({ title: "To and Subject are required", variant: "destructive" });
      return;
    }
    sendMutation.mutate({
      to,
      cc: cc || undefined,
      subject,
      body,
      matterId: matterId || undefined,
      templateId: templateId || undefined,
    });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/email")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Compose Email</h1>
      </div>

      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="to">To</Label>
          <Input id="to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@example.com" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="cc">CC</Label>
          <Input id="cc" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="cc@example.com" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="subject">Subject</Label>
          <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Matter</Label>
            <Select value={matterId} onValueChange={setMatterId}>
              <SelectTrigger>
                <SelectValue placeholder="Select matter..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {((matters.data as any)?.matters || matters.data || []).map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Select template..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {templates.data?.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="body">Body</Label>
          <Textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            placeholder="Write your email..."
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.push("/email")}>Cancel</Button>
          <Button onClick={handleSend} disabled={sendMutation.isPending}>
            <Send className="h-4 w-4 mr-2" />
            {sendMutation.isPending ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
