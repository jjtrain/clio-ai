"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
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
  Search,
  Plus,
  Send,
  Check,
  CheckCheck,
  Clock,
  X,
  Archive,
  ArchiveRestore,
  MessageSquare,
  User,
  Phone,
  ExternalLink,
  RefreshCw,
  FileText,
  Settings,
} from "lucide-react";

function formatTime(date: Date | string) {
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function dateSeparator(date: Date | string) {
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "QUEUED": return <Clock className="h-3 w-3 text-gray-400" />;
    case "SENT": return <Check className="h-3 w-3 text-gray-400" />;
    case "DELIVERED": return <CheckCheck className="h-3 w-3 text-blue-500" />;
    case "FAILED": return <X className="h-3 w-3 text-red-500" />;
    default: return null;
  }
}

function MessagingContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [activeConvoId, setActiveConvoId] = useState<string | null>(searchParams.get("conversation"));
  const [tab, setTab] = useState<"all" | "unread" | "archived">("all");
  const [search, setSearch] = useState("");
  const [messageText, setMessageText] = useState("");
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [newClientId, setNewClientId] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newMatterId, setNewMatterId] = useState("");
  const [newBody, setNewBody] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);

  const { data: conversations, isLoading: convosLoading } = trpc.messaging.listConversations.useQuery({
    isArchived: tab === "archived" ? true : false,
    search: search || undefined,
  });

  const { data: convoData } = trpc.messaging.getConversation.useQuery(
    { id: activeConvoId! },
    { enabled: !!activeConvoId, refetchInterval: 5000 }
  );

  const { data: clients } = trpc.clients.list.useQuery();
  const { data: templates } = trpc.messaging.listTemplates.useQuery();

  const sendMsg = trpc.messaging.sendMessage.useMutation({
    onSuccess: () => {
      setMessageText("");
      utils.messaging.getConversation.invalidate({ id: activeConvoId! });
      utils.messaging.listConversations.invalidate();
    },
    onError: (err) => toast({ title: "Send failed", description: err.message, variant: "destructive" }),
  });

  const quickSend = trpc.messaging.quickSend.useMutation({
    onSuccess: (data) => {
      toast({ title: "Message sent" });
      setShowNewMessage(false);
      setActiveConvoId(data.conversationId);
      utils.messaging.listConversations.invalidate();
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const markRead = trpc.messaging.markConversationRead.useMutation({
    onSuccess: () => utils.messaging.listConversations.invalidate(),
  });

  const archiveConvo = trpc.messaging.archiveConversation.useMutation({
    onSuccess: () => { utils.messaging.listConversations.invalidate(); setActiveConvoId(null); },
  });

  const unarchiveConvo = trpc.messaging.unarchiveConversation.useMutation({
    onSuccess: () => utils.messaging.listConversations.invalidate(),
  });

  const applyTemplate = trpc.messaging.applyTemplate.useMutation({
    onSuccess: (data) => { setMessageText(data.content); setShowTemplates(false); },
  });

  // Mark as read when opening conversation
  useEffect(() => {
    if (activeConvoId && convoData && convoData.unreadCount > 0) {
      markRead.mutate({ id: activeConvoId });
    }
  }, [activeConvoId, convoData?.unreadCount]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [convoData?.messages]);

  const charCount = messageText.length;
  const charColor = charCount > 320 ? "text-red-500" : charCount > 160 ? "text-amber-500" : "text-green-500";

  // Unread filter
  const filteredConversations = tab === "unread"
    ? conversations?.filter(c => c.unreadCount > 0)
    : conversations;

  // Group messages by date
  const groupedMessages: { date: string; messages: any[] }[] = [];
  if (convoData?.messages) {
    let lastDate = "";
    for (const msg of convoData.messages) {
      const d = new Date(msg.createdAt).toDateString();
      if (d !== lastDate) {
        groupedMessages.push({ date: d, messages: [] });
        lastDate = d;
      }
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 -m-6">
      {/* LEFT PANEL — Conversation List */}
      <div className="w-[360px] flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold">Messages</h1>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/messaging/settings"><Settings className="h-4 w-4" /></Link>
              </Button>
              <Button size="sm" onClick={() => setShowNewMessage(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> New
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="pl-9 h-9" />
          </div>
          <div className="flex gap-1 mt-3">
            {(["all", "unread", "archived"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                  tab === t ? "bg-blue-100 text-blue-700" : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {convosLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
          ) : !filteredConversations?.length ? (
            <div className="p-8 text-center text-gray-400">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No conversations</p>
            </div>
          ) : (
            filteredConversations.map((convo) => (
              <button
                key={convo.id}
                onClick={() => setActiveConvoId(convo.id)}
                className={`w-full p-3 flex items-start gap-3 border-b border-gray-50 hover:bg-gray-50 transition-colors text-left ${
                  activeConvoId === convo.id ? "bg-blue-50" : ""
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-blue-700">{convo.client.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm truncate">{convo.client.name}</span>
                    <span className="text-[10px] text-gray-400">
                      {convo.lastMessageAt ? formatTime(convo.lastMessageAt) : ""}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{convo.lastMessagePreview || "No messages"}</p>
                  <p className="text-[10px] text-gray-400">{convo.clientPhone}</p>
                </div>
                {convo.unreadCount > 0 && (
                  <span className="bg-blue-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                    {convo.unreadCount}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* RIGHT PANEL — Conversation View */}
      <div className="flex-1 flex flex-col bg-gray-50 min-w-0">
        {!activeConvoId || !convoData ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Select a conversation or start a new message</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{convoData.client.name}</span>
                  {convoData.isOptedOut && (
                    <Badge className="bg-red-50 text-red-600 text-[10px]">Opted Out</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Phone className="h-3 w-3" /> {convoData.clientPhone}
                </div>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/clients/${convoData.client.id}`}>
                  <User className="h-3.5 w-3.5 mr-1" /> View Client
                </Link>
              </Button>
              {convoData.isArchived ? (
                <Button variant="ghost" size="sm" onClick={() => unarchiveConvo.mutate({ id: convoData.id })}>
                  <ArchiveRestore className="h-3.5 w-3.5 mr-1" /> Unarchive
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => archiveConvo.mutate({ id: convoData.id })}>
                  <Archive className="h-3.5 w-3.5 mr-1" /> Archive
                </Button>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
              {groupedMessages.map((group) => (
                <div key={group.date}>
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 font-medium">{dateSeparator(group.date)}</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                  {group.messages.map((msg: any) => {
                    const isOutbound = msg.direction === "OUTBOUND";
                    return (
                      <div key={msg.id} className={`flex mb-2 ${isOutbound ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                          isOutbound
                            ? "bg-blue-500 text-white rounded-br-md"
                            : "bg-white border border-gray-200 text-gray-800 rounded-bl-md"
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                          {msg.mediaUrl && (
                            <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline opacity-75">
                              View attachment
                            </a>
                          )}
                          <div className={`flex items-center gap-1 mt-1 ${isOutbound ? "justify-end" : ""}`}>
                            <span className={`text-[10px] ${isOutbound ? "text-blue-100" : "text-gray-400"}`}>
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {isOutbound && <StatusIcon status={msg.status} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="bg-white border-t border-gray-200 p-3">
              {convoData.isOptedOut ? (
                <div className="text-center text-sm text-red-500 py-2">
                  This client has opted out. Cannot send messages.
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <div className="flex-1 relative">
                    <Textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      placeholder="Type a message..."
                      rows={1}
                      className="min-h-[40px] max-h-[100px] resize-none pr-20"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (messageText.trim()) {
                            sendMsg.mutate({ conversationId: activeConvoId!, body: messageText.trim() });
                          }
                        }
                      }}
                    />
                    <div className="absolute right-2 bottom-2 flex items-center gap-2">
                      <span className={`text-[10px] ${charColor}`}>{charCount}</span>
                      <button
                        onClick={() => setShowTemplates(!showTemplates)}
                        className="text-gray-400 hover:text-blue-500"
                        title="Templates"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      if (messageText.trim()) {
                        sendMsg.mutate({ conversationId: activeConvoId!, body: messageText.trim() });
                      }
                    }}
                    disabled={!messageText.trim() || sendMsg.isPending}
                    className="bg-blue-500 hover:bg-blue-600 h-10 px-4"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Template Picker */}
              {showTemplates && templates && (
                <div className="mt-2 border border-gray-200 rounded-lg bg-white max-h-48 overflow-y-auto divide-y divide-gray-50">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        applyTemplate.mutate({
                          templateId: t.id,
                          clientName: convoData.client.name,
                        });
                      }}
                      className="w-full p-2.5 text-left hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Badge variant="secondary" className="text-[10px]">{t.shortcode || t.category}</Badge>
                      <span className="text-sm font-medium">{t.name}</span>
                      <span className="text-xs text-gray-400 truncate flex-1">{t.content.substring(0, 50)}...</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* New Message Dialog */}
      {showNewMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Message</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowNewMessage(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Client</Label>
                <Select value={newClientId} onValueChange={(id) => {
                  setNewClientId(id);
                  const c = clients?.clients?.find((c: any) => c.id === id);
                  if (c?.phone) setNewPhone(c.phone);
                }}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients?.clients?.filter((c: any) => c.phone).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Message</Label>
                <Textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} rows={3} placeholder="Type your message..." />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewMessage(false)}>Cancel</Button>
              <Button
                onClick={() => quickSend.mutate({ clientId: newClientId, body: newBody })}
                disabled={!newClientId || !newBody || quickSend.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                {quickSend.isPending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MessagingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px] text-gray-400">Loading...</div>}>
      <MessagingContent />
    </Suspense>
  );
}
