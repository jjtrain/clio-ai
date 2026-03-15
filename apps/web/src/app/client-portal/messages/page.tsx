"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Send,
  MessageSquare,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCheck,
  X,
} from "lucide-react";

export default function PortalMessagesPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [showCompose, setShowCompose] = useState(false);
  const [composeUserId, setComposeUserId] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeContent, setComposeContent] = useState("");

  const { data: messages, isLoading } = trpc.clientPortal.listMessages.useQuery({});
  const { data: portalUsers } = trpc.clientPortal.listPortalUsers.useQuery();
  const markRead = trpc.clientPortal.markMessageRead.useMutation({
    onSuccess: () => utils.clientPortal.listMessages.invalidate(),
  });
  const sendMsg = trpc.clientPortal.sendMessage.useMutation({
    onSuccess: () => {
      toast({ title: "Message sent" });
      utils.clientPortal.listMessages.invalidate();
      setShowCompose(false);
      setComposeUserId("");
      setComposeSubject("");
      setComposeContent("");
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/client-portal"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Portal Messages</h1>
          <p className="text-gray-500">View and respond to client messages</p>
        </div>
        <Button onClick={() => setShowCompose(true)}>
          <Send className="h-4 w-4 mr-2" />
          Compose
        </Button>
      </div>

      {/* Compose */}
      {showCompose && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Compose Message</h2>
            <Button variant="ghost" size="icon" onClick={() => setShowCompose(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>To (Portal User)</Label>
              <Select value={composeUserId} onValueChange={setComposeUserId}>
                <SelectTrigger><SelectValue placeholder="Select recipient" /></SelectTrigger>
                <SelectContent>
                  {portalUsers?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} placeholder="Optional subject" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea value={composeContent} onChange={(e) => setComposeContent(e.target.value)} rows={4} placeholder="Type your message..." />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => sendMsg.mutate({ portalUserId: composeUserId, subject: composeSubject || undefined, content: composeContent })}
              disabled={!composeUserId || !composeContent || sendMsg.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              {sendMsg.isPending ? "Sending..." : "Send Message"}
            </Button>
          </div>
        </div>
      )}

      {/* Messages List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : !messages?.length ? (
          <div className="p-8 text-center text-gray-400">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No messages yet</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isFromClient = msg.direction === "CLIENT_TO_FIRM";
            return (
              <div
                key={msg.id}
                className={`p-4 flex items-start gap-3 ${!msg.isRead && isFromClient ? "bg-blue-50/50" : ""}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isFromClient ? "bg-blue-100" : "bg-purple-100"
                }`}>
                  {isFromClient ? (
                    <ArrowDownLeft className="h-3.5 w-3.5 text-blue-600" />
                  ) : (
                    <ArrowUpRight className="h-3.5 w-3.5 text-purple-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm">{msg.portalUser.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {isFromClient ? "Client" : "Firm"}
                    </Badge>
                    {msg.matter && (
                      <Badge variant="outline" className="text-[10px]">{msg.matter.name}</Badge>
                    )}
                    {!msg.isRead && isFromClient && (
                      <Badge className="bg-blue-500 text-white text-[10px]">New</Badge>
                    )}
                  </div>
                  {msg.subject && <p className="text-sm font-medium text-gray-700">{msg.subject}</p>}
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{msg.content}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{new Date(msg.createdAt).toLocaleString()}</span>
                  {!msg.isRead && isFromClient && (
                    <Button variant="ghost" size="sm" onClick={() => markRead.mutate({ id: msg.id })}>
                      <CheckCheck className="h-3.5 w-3.5 mr-1" /> Read
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
