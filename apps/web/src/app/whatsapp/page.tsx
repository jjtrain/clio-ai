"use client";

export const dynamic = "force-dynamic";

import { useState, useRef, useEffect } from "react";
import {
  MessageCircle, Send, Paperclip, Phone, Search,
  CheckCheck, Check, Clock, AlertCircle, Archive,
  FileText, Image, X, Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const STATUS_ICON: Record<string, any> = {
  SENT: Check,
  DELIVERED: CheckCheck,
  READ: CheckCheck,
  FAILED: AlertCircle,
  QUEUED: Clock,
};

export default function WhatsAppPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState<"all" | "unread" | "unfiled" | "resolved">("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const connQuery = trpc.whatsapp.getConnectionStatus.useQuery();
  const convsQuery = trpc.whatsapp.listConversations.useQuery(
    tab === "unfiled" ? { status: "PENDING" } : tab === "resolved" ? { status: "RESOLVED" } : undefined
  );
  const convQuery = trpc.whatsapp.getConversation.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId, refetchInterval: 5000 }
  );
  const windowQuery = trpc.whatsapp.getWindowStatus.useQuery(
    { conversationId: selectedId! },
    { enabled: !!selectedId }
  );

  const sendMut = trpc.whatsapp.sendMessage.useMutation({
    onSuccess: () => { setMessageText(""); convQuery.refetch(); convsQuery.refetch(); },
  });
  const markReadMut = trpc.whatsapp.markAsRead.useMutation({ onSuccess: () => convsQuery.refetch() });
  const fileMut = trpc.whatsapp.fileConversation.useMutation({ onSuccess: () => { convQuery.refetch(); convsQuery.refetch(); } });
  const resolveMut = trpc.whatsapp.resolveConversation.useMutation({ onSuccess: () => convsQuery.refetch() });

  const conversations = (convsQuery.data || []).filter((c: any) =>
    !searchQuery || c.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) || c.clientPhone.includes(searchQuery)
  );
  const conversation = convQuery.data;
  const windowStatus = windowQuery.data;

  useEffect(() => {
    if (selectedId) markReadMut.mutate({ conversationId: selectedId });
  }, [selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages]);

  function handleSend() {
    if (!messageText.trim() || !selectedId) return;
    sendMut.mutate({ conversationId: selectedId, type: "text", text: messageText });
  }

  if (!connQuery.data) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card className="p-12 text-center">
          <MessageCircle className="h-16 w-16 text-green-200 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-800">WhatsApp Not Connected</h2>
          <p className="text-sm text-gray-500 mt-2">Connect your WhatsApp Business account to start messaging clients.</p>
          <a href="/settings/whatsapp"><Button className="mt-4 bg-green-600 hover:bg-green-700">Set Up WhatsApp</Button></a>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Left: Conversation List */}
      <div className="w-[340px] border-r border-gray-200 flex flex-col bg-white">
        <div className="p-3 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            <h2 className="text-sm font-semibold text-gray-900">WhatsApp</h2>
          </div>
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2 text-gray-400" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="pl-8 h-7 text-xs" />
          </div>
          <div className="flex gap-1 mt-2">
            {(["all", "unread", "unfiled", "resolved"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={cn("text-[10px] px-2 py-1 rounded-full", tab === t ? "bg-green-100 text-green-700 font-medium" : "text-gray-500 hover:bg-gray-100")}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {conversations.map((c: any) => (
            <button key={c.id} onClick={() => setSelectedId(c.id)}
              className={cn("w-full text-left p-3 border-b border-gray-50 hover:bg-gray-50", selectedId === c.id && "bg-green-50")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold",
                    c.windowExpiresAt && new Date(c.windowExpiresAt) > new Date() ? "bg-green-500" : "bg-gray-400")}>
                    {(c.clientName || c.clientPhone).slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[160px]">{c.clientName || c.clientPhone}</p>
                    <p className="text-[10px] text-gray-400">{c.clientPhone}</p>
                  </div>
                </div>
                <div className="text-right">
                  {c.lastMessageAt && <p className="text-[10px] text-gray-400">{new Date(c.lastMessageAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>}
                  {c.unreadCount > 0 && <Badge className="text-[9px] bg-green-500 text-white mt-0.5">{c.unreadCount}</Badge>}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1 truncate">{c.lastMessageSnippet}</p>
              <div className="flex gap-1 mt-1">
                {c.matterId ? <Badge className="text-[9px] bg-blue-100 text-blue-700">Filed</Badge>
                  : <Badge className="text-[9px] bg-amber-100 text-amber-700">Unfiled</Badge>}
                {c.status === "RESOLVED" && <Badge className="text-[9px] bg-gray-100 text-gray-500">Resolved</Badge>}
              </div>
            </button>
          ))}
          {conversations.length === 0 && <p className="text-xs text-gray-400 text-center py-8">No conversations</p>}
        </div>
      </div>

      {/* Right: Messages */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Select a conversation</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-3 bg-white border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">
                  {(conversation?.clientName || "?").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{conversation?.clientName || conversation?.clientPhone}</p>
                  <p className="text-[10px] text-gray-400 flex items-center gap-1"><Phone className="h-3 w-3" />{conversation?.clientPhone}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {!conversation?.matterId && (
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => { /* TODO: matter picker */ }}>File to Matter</Button>
                )}
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => resolveMut.mutate({ conversationId: selectedId })}>
                  <Archive className="h-3 w-3 mr-1" /> Resolve
                </Button>
              </div>
            </div>

            {/* Window Status Banner */}
            {windowStatus && (
              <div className={cn("px-3 py-2 text-xs flex items-center gap-2",
                windowStatus.isOpen && windowStatus.minutesRemaining! > 120 ? "bg-green-50 text-green-700"
                : windowStatus.isOpen ? "bg-amber-50 text-amber-700"
                : "bg-red-50 text-red-700")}>
                <Clock className="h-3 w-3" />
                {windowStatus.isOpen
                  ? `Window open — ${Math.floor(windowStatus.minutesRemaining! / 60)}h ${windowStatus.minutesRemaining! % 60}m remaining`
                  : "Window closed — use a template to restart"}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-auto p-4 space-y-2">
              {conversation?.messages?.map((msg: any) => {
                const isOutbound = msg.direction === "OUTBOUND";
                const StatusIcon = STATUS_ICON[msg.status] || Check;
                return (
                  <div key={msg.id} className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[70%] rounded-lg px-3 py-2", isOutbound ? "bg-green-100 text-gray-900" : "bg-white border border-gray-200 text-gray-900")}>
                      {msg.messageType === "IMAGE" && msg.mediaUrl && (
                        <div className="mb-1"><Image className="h-4 w-4 text-gray-400 inline mr-1" /><span className="text-xs text-blue-500">[Image]</span></div>
                      )}
                      {msg.messageType === "DOCUMENT" && (
                        <div className="mb-1 flex items-center gap-1"><FileText className="h-4 w-4 text-gray-400" /><span className="text-xs text-blue-500">{msg.mediaFilename || "Document"}</span></div>
                      )}
                      {msg.bodyText && <p className="text-sm whitespace-pre-wrap">{msg.bodyText}</p>}
                      {msg.templateName && <p className="text-xs italic text-gray-500">[Template: {msg.templateName}]</p>}
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-[10px] text-gray-400">{new Date(msg.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        {isOutbound && <StatusIcon className={cn("h-3 w-3", msg.status === "READ" ? "text-blue-500" : msg.status === "FAILED" ? "text-red-500" : "text-gray-400")} />}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Compose */}
            <div className="p-3 bg-white border-t border-gray-200">
              {windowStatus?.canSendFreeForm ? (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8"><Paperclip className="h-4 w-4 text-gray-400" /></Button>
                  <Input value={messageText} onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type a message..." className="flex-1 h-9 text-sm"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
                  <Button size="icon" className="h-8 w-8 bg-green-600 hover:bg-green-700" onClick={handleSend}
                    disabled={!messageText.trim() || sendMut.isLoading}>
                    {sendMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-xs text-gray-500 mb-2">Window closed — select a template to restart</p>
                  <div className="flex flex-wrap gap-1 justify-center">
                    {windowStatus?.suggestedTemplates?.slice(0, 4).map((t: any) => (
                      <Button key={t.id} variant="outline" size="sm" className="text-xs"
                        onClick={() => sendMut.mutate({ conversationId: selectedId, type: "template", templateName: t.name })}>
                        {t.name.replace(/_/g, " ")}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
