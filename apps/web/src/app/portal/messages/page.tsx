"use client";

import { useState } from "react";
import { usePortal } from "../portal-context";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { MessageSquare, Send, ArrowUpRight, ArrowDownLeft } from "lucide-react";

export default function PortalMessagesPage() {
  const { token } = usePortal();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");

  const { data: messages, isLoading } = trpc.clientPortal.portalGetMessages.useQuery(
    { token: token! },
    { enabled: !!token }
  );

  const sendMsg = trpc.clientPortal.portalSendMessage.useMutation({
    onSuccess: () => {
      toast({ title: "Message sent" });
      utils.clientPortal.portalGetMessages.invalidate();
      setSubject("");
      setContent("");
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (!token) return <div className="text-center py-12 text-gray-400">Please log in</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Messages</h1>
        <p className="text-gray-500">Communicate securely with your legal team</p>
      </div>

      {/* Compose */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold">New Message</h2>
        <div className="space-y-2">
          <Label>Subject <span className="text-xs text-gray-400">(optional)</span></Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What's this about?" />
        </div>
        <div className="space-y-2">
          <Label>Message</Label>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder="Type your message..." />
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => sendMsg.mutate({ token: token!, subject: subject || undefined, content })}
            disabled={!content || sendMsg.isPending}
          >
            <Send className="h-4 w-4 mr-2" />
            {sendMsg.isPending ? "Sending..." : "Send Message"}
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : !messages?.length ? (
          <div className="text-center py-12">
            <MessageSquare className="h-10 w-10 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No messages yet</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isFromFirm = msg.direction === "FIRM_TO_CLIENT";
            return (
              <div
                key={msg.id}
                className={`rounded-xl border p-4 ${
                  isFromFirm ? "bg-white border-gray-100 ml-0 mr-8" : "bg-blue-50 border-blue-100 ml-8 mr-0"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {isFromFirm ? (
                    <ArrowDownLeft className="h-3.5 w-3.5 text-purple-500" />
                  ) : (
                    <ArrowUpRight className="h-3.5 w-3.5 text-blue-500" />
                  )}
                  <span className="text-xs font-medium text-gray-600">
                    {isFromFirm ? "Your Legal Team" : "You"}
                  </span>
                  <span className="text-xs text-gray-400">{new Date(msg.createdAt).toLocaleString()}</span>
                </div>
                {msg.subject && <p className="text-sm font-medium mb-1">{msg.subject}</p>}
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.content}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
