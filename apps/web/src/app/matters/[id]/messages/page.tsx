"use client";

export const dynamic = "force-dynamic";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  MessageSquare, Send, Paperclip, Pin, Smile, Reply, Pencil,
  Trash2, X, ChevronDown, Loader2, AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const QUICK_REACTIONS = ["👍", "👎", "✅", "❓", "🔥", "👀"];

function fmtTime(d: any) { if (!d) return ""; try { const dt = new Date(d); const now = new Date(); const diff = now.getTime() - dt.getTime(); if (diff < 86400000) return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); if (diff < 7 * 86400000) return dt.toLocaleDateString([], { weekday: "short" }) + " " + dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); return dt.toLocaleDateString([], { month: "short", day: "numeric" }); } catch { return ""; } }

function renderBody(body: string): string {
  // Replace @[Name](userId) with highlighted pill
  return body.replace(/@\[([^\]]+)\]\([^)]+\)/g, '<span class="bg-blue-100 text-blue-800 px-1 rounded text-xs font-medium">@$1</span>');
}

export default function MatterMessagesPage() {
  const { id: matterId } = useParams<{ id: string }>();
  const [inputText, setInputText] = useState("");
  const [replyTo, setReplyTo] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const threadQuery = trpc.matterMessaging.getOrCreateThread.useQuery(
    { matterId },
    { refetchInterval: 10000 } // Poll every 10s (matches existing app pattern)
  );

  const sendMut = trpc.matterMessaging.sendMessage.useMutation({
    onSuccess: () => { setInputText(""); setReplyTo(null); threadQuery.refetch(); },
  });
  const editMut = trpc.matterMessaging.editMessage.useMutation({
    onSuccess: () => { setInputText(""); setEditingId(null); threadQuery.refetch(); },
  });
  const deleteMut = trpc.matterMessaging.deleteMessage.useMutation({ onSuccess: () => threadQuery.refetch() });
  const addReactionMut = trpc.matterMessaging.addReaction.useMutation({ onSuccess: () => threadQuery.refetch() });
  const removeReactionMut = trpc.matterMessaging.removeReaction.useMutation({ onSuccess: () => threadQuery.refetch() });
  const pinMut = trpc.matterMessaging.pinMessage.useMutation({ onSuccess: () => threadQuery.refetch() });
  const unpinMut = trpc.matterMessaging.unpinMessage.useMutation({ onSuccess: () => threadQuery.refetch() });

  const thread = threadQuery.data?.thread;
  const messages = threadQuery.data?.messages || [];
  const readReceipt = threadQuery.data?.readReceipt;
  const currentUserId = "demo-user";

  // Auto-scroll
  useEffect(() => {
    if (isAtBottom) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isAtBottom]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 100);
  }, []);

  function handleSend() {
    if (!inputText.trim() || !thread) return;
    if (editingId) {
      editMut.mutate({ messageId: editingId, body: inputText });
    } else {
      sendMut.mutate({ threadId: thread.id, matterId, body: inputText, parentId: replyTo?.id });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function startEdit(msg: any) {
    setEditingId(msg.id);
    setInputText(msg.body);
    setReplyTo(null);
    textareaRef.current?.focus();
  }

  function cancelEdit() { setEditingId(null); setInputText(""); }

  // Find pinned message
  const pinnedMsg = messages.find((m: any) => m.isPinned);

  // Find unread divider position
  const lastReadId = readReceipt?.lastReadMessageId;
  let unreadDividerIdx = -1;
  if (lastReadId) {
    const readIdx = messages.findIndex((m: any) => m.id === lastReadId);
    if (readIdx >= 0 && readIdx < messages.length - 1) unreadDividerIdx = readIdx + 1;
  }

  // Group messages by author within 5 min
  function shouldShowAuthor(msg: any, idx: number): boolean {
    if (idx === 0) return true;
    if (msg.isSystemMessage) return false;
    const prev = messages[idx - 1];
    if (prev.isSystemMessage) return true;
    if (prev.authorId !== msg.authorId) return true;
    if (new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60000) return true;
    return false;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="p-3 border-b bg-white flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-indigo-600" />
          <h2 className="text-sm font-semibold">Team Discussion</h2>
          <Badge variant="outline" className="text-[10px]">{thread?.messageCount || 0} messages</Badge>
        </div>
        <div className="flex items-center gap-1">
          {(thread?.participantIds as string[] || []).slice(0, 5).map((pid: string, i: number) => (
            <div key={i} className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">
              {pid.slice(0, 2).toUpperCase()}
            </div>
          ))}
          {((thread?.participantIds as string[])?.length || 0) > 5 && (
            <span className="text-[10px] text-muted-foreground ml-1">+{(thread?.participantIds as string[]).length - 5}</span>
          )}
        </div>
      </div>

      {/* Pinned message bar */}
      {pinnedMsg && (
        <div className="px-3 py-2 bg-amber-50 border-b flex items-center gap-2 text-xs">
          <Pin className="h-3 w-3 text-amber-600 flex-shrink-0" />
          <span className="text-amber-800 font-medium">{pinnedMsg.author?.name}:</span>
          <span className="text-amber-700 truncate">{pinnedMsg.body.slice(0, 100)}</span>
          <Button variant="ghost" size="sm" className="h-5 text-[10px] ml-auto" onClick={() => unpinMut.mutate({ messageId: pinnedMsg.id })}>Unpin</Button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto px-4 py-3" onScroll={handleScroll}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-12 w-12 text-gray-200 mb-3" />
            <p className="text-sm text-muted-foreground">No messages yet. Start a discussion about this matter.</p>
          </div>
        )}

        {messages.map((msg: any, idx: number) => {
          const showAuthor = shouldShowAuthor(msg, idx);
          const isOwn = msg.authorId === currentUserId;
          const isDeleted = !!msg.deletedAt;
          const isSystem = msg.isSystemMessage;
          const reactions = (msg.reactions || {}) as Record<string, string[]>;
          const hasReactions = Object.keys(reactions).length > 0;

          return (
            <div key={msg.id}>
              {/* Unread divider */}
              {idx === unreadDividerIdx && (
                <div className="flex items-center gap-2 my-3"><div className="flex-1 h-px bg-red-300" /><span className="text-[10px] text-red-500 font-medium">New messages</span><div className="flex-1 h-px bg-red-300" /></div>
              )}

              {/* System message */}
              {isSystem ? (
                <div className="flex justify-center my-2">
                  <span className="text-[11px] text-muted-foreground bg-gray-50 px-3 py-1 rounded-full">{msg.body} · {fmtTime(msg.createdAt)}</span>
                </div>
              ) : (
                <div className={cn("group relative", showAuthor ? "mt-4" : "mt-0.5", isDeleted ? "opacity-50" : "")} id={`msg-${msg.id}`}>
                  {/* Reply quote */}
                  {msg.parentId && (
                    <div className="ml-10 mb-1 pl-3 border-l-2 border-gray-200">
                      <a href={`#msg-${msg.parentId}`} className="text-[11px] text-muted-foreground hover:text-gray-700">
                        {messages.find((m: any) => m.id === msg.parentId)?.author?.name}: {messages.find((m: any) => m.id === msg.parentId)?.body?.slice(0, 100) || "..."}
                      </a>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {showAuthor ? (
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">
                        {(msg.author?.name || "?").slice(0, 2).toUpperCase()}
                      </div>
                    ) : <div className="w-8 flex-shrink-0" />}

                    <div className="flex-1 min-w-0">
                      {showAuthor && (
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-gray-900">{msg.author?.name || "Unknown"}</span>
                          <span className="text-[10px] text-muted-foreground">{fmtTime(msg.createdAt)}</span>
                          {msg.editedAt && <span className="text-[10px] text-muted-foreground">(edited)</span>}
                        </div>
                      )}

                      <div className="text-sm text-gray-800 whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: isDeleted ? '<em class="text-muted-foreground">[message deleted]</em>' : renderBody(msg.body) }} />

                      {/* Attachments */}
                      {!isDeleted && Array.isArray(msg.attachmentUrls) && msg.attachmentUrls.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(msg.attachmentUrls as any[]).map((att: any, i: number) => (
                            <Badge key={i} variant="outline" className="text-[10px] gap-1"><Paperclip className="h-3 w-3" />{att.fileName || "file"}</Badge>
                          ))}
                        </div>
                      )}

                      {/* Reactions */}
                      {hasReactions && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(reactions).map(([emoji, userIds]) => (
                            <button key={emoji}
                              onClick={() => (userIds as string[]).includes(currentUserId) ? removeReactionMut.mutate({ messageId: msg.id, emoji }) : addReactionMut.mutate({ messageId: msg.id, emoji })}
                              className={cn("text-xs px-1.5 py-0.5 rounded-full border", (userIds as string[]).includes(currentUserId) ? "bg-indigo-50 border-indigo-200" : "bg-gray-50 border-gray-200")}>
                              {emoji} {(userIds as string[]).length}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Hover actions */}
                    {!isDeleted && !isSystem && (
                      <div className="hidden group-hover:flex items-center gap-0.5 absolute right-0 top-0 bg-white border rounded shadow-sm px-1 py-0.5">
                        <button onClick={() => setShowReactions(showReactions === msg.id ? null : msg.id)} className="p-1 hover:bg-gray-100 rounded" title="React"><Smile className="h-3 w-3 text-gray-400" /></button>
                        <button onClick={() => { setReplyTo(msg); textareaRef.current?.focus(); }} className="p-1 hover:bg-gray-100 rounded" title="Reply"><Reply className="h-3 w-3 text-gray-400" /></button>
                        {isOwn && <button onClick={() => startEdit(msg)} className="p-1 hover:bg-gray-100 rounded" title="Edit"><Pencil className="h-3 w-3 text-gray-400" /></button>}
                        {isOwn && <button onClick={() => { if (confirm("Delete this message?")) deleteMut.mutate({ messageId: msg.id }); }} className="p-1 hover:bg-gray-100 rounded" title="Delete"><Trash2 className="h-3 w-3 text-gray-400" /></button>}
                        <button onClick={() => msg.isPinned ? unpinMut.mutate({ messageId: msg.id }) : pinMut.mutate({ messageId: msg.id })} className="p-1 hover:bg-gray-100 rounded" title="Pin"><Pin className="h-3 w-3 text-gray-400" /></button>
                      </div>
                    )}
                  </div>

                  {/* Quick reactions picker */}
                  {showReactions === msg.id && (
                    <div className="ml-10 mt-1 flex gap-1 bg-white border rounded-lg shadow-sm px-2 py-1 w-fit">
                      {QUICK_REACTIONS.map((e) => <button key={e} onClick={() => { addReactionMut.mutate({ messageId: msg.id, emoji: e }); setShowReactions(null); }} className="text-sm hover:bg-gray-100 rounded px-1">{e}</button>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* New messages pill */}
      {!isAtBottom && messages.length > 0 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2">
          <button onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1">
            <ChevronDown className="h-3 w-3" /> New messages
          </button>
        </div>
      )}

      {/* Reply bar */}
      {replyTo && (
        <div className="px-4 py-2 border-t bg-gray-50 flex items-center gap-2">
          <Reply className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground truncate">Replying to <strong>{replyTo.author?.name}</strong>: {replyTo.body?.slice(0, 80)}</span>
          <button onClick={() => setReplyTo(null)} className="ml-auto"><X className="h-3 w-3 text-muted-foreground" /></button>
        </div>
      )}

      {/* Edit bar */}
      {editingId && (
        <div className="px-4 py-2 border-t bg-yellow-50 flex items-center gap-2">
          <Pencil className="h-3 w-3 text-yellow-600" />
          <span className="text-xs text-yellow-700">Editing message</span>
          <button onClick={cancelEdit} className="ml-auto text-xs text-yellow-600 underline">Cancel</button>
        </div>
      )}

      {/* Compose */}
      <div className={cn("p-3 border-t bg-white flex items-end gap-2", editingId ? "border-yellow-300" : "")}>
        <textarea ref={textareaRef} value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={handleKeyDown}
          placeholder="Message the team…" rows={1}
          className="flex-1 resize-none border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 max-h-[150px]"
          style={{ minHeight: "38px" }}
          onInput={(e) => { const el = e.currentTarget; el.style.height = "38px"; el.style.height = Math.min(el.scrollHeight, 150) + "px"; }}
        />
        <Button size="icon" className="h-9 w-9 bg-indigo-600 hover:bg-indigo-700" onClick={handleSend}
          disabled={(!inputText.trim() && !editingId) || sendMut.isLoading || editMut.isLoading}>
          {sendMut.isLoading || editMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
