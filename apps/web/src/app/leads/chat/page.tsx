"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, UserCheck, MessageSquare } from "lucide-react";

function timeAgo(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_COLORS: Record<string, string> = {
  AI_HANDLING: "bg-blue-100 text-blue-700",
  WAITING_FOR_AGENT: "bg-orange-100 text-orange-700",
  AGENT_CONNECTED: "bg-emerald-100 text-emerald-700",
  ENDED: "bg-gray-100 text-gray-600",
};

export default function ChatAdminPage() {
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<string>("active");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const statusFilter = filter === "active"
    ? undefined
    : filter === "waiting"
    ? "WAITING_FOR_AGENT" as const
    : undefined;

  const { data: sessionsData, refetch: refetchSessions } = trpc.chat.listSessions.useQuery(
    statusFilter ? { status: statusFilter } : {},
    { refetchInterval: 5000 }
  );

  const { data: messages, refetch: refetchMessages } = trpc.chat.getSessionMessages.useQuery(
    { sessionId: selectedSession! },
    { enabled: !!selectedSession, refetchInterval: 3000 }
  );

  const { data: sessionDetail } = trpc.chat.getSession.useQuery(
    { sessionId: selectedSession! },
    { enabled: !!selectedSession, refetchInterval: 5000 }
  );

  const sendMutation = trpc.chat.sendAgentMessage.useMutation({
    onSuccess: () => {
      setMessage("");
      refetchMessages();
    },
  });

  const takeOverMutation = trpc.chat.takeOverSession.useMutation({
    onSuccess: () => {
      refetchSessions();
      refetchMessages();
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !selectedSession) return;
    sendMutation.mutate({ sessionId: selectedSession, content: message });
  };

  const sessions = (sessionsData?.sessions || []).filter((s) => {
    if (filter === "active") return s.status !== "ENDED";
    if (filter === "waiting") return s.status === "WAITING_FOR_AGENT";
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/leads"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Live Chat</h1>
          <p className="text-gray-500 text-sm">Manage chat conversations</p>
        </div>
      </div>

      <div className="flex gap-4 h-[calc(100vh-220px)]">
        {/* Sessions List */}
        <div className="w-80 flex-shrink-0 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col">
          <div className="p-3 border-b flex gap-1">
            {["active", "waiting", "all"].map((f) => (
              <button
                key={f}
                className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                  filter === f ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-900"
                }`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {sessions.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                No chat sessions
              </div>
            ) : (
              sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSession(s.id)}
                  className={`w-full text-left p-3 border-b border-gray-50 hover:bg-gray-50 ${
                    selectedSession === s.id ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-gray-900 truncate">
                      {s.visitorName || "Anonymous"}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[s.status]}`}>
                      {s.status === "WAITING_FOR_AGENT" ? "Waiting" : s.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  {s.messages[0] && (
                    <p className="text-xs text-gray-500 mt-1 truncate">{s.messages[0].content}</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">{timeAgo(s.updatedAt)}</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Panel */}
        <div className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col">
          {!selectedSession ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              Select a conversation
            </div>
          ) : (
            <>
              {/* Chat Header */}
              {sessionDetail && (
                <div className="p-4 border-b flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{sessionDetail.visitorName || "Anonymous"}</p>
                    <p className="text-xs text-gray-500">
                      {[sessionDetail.visitorEmail, sessionDetail.visitorPhone].filter(Boolean).join(" \u00b7 ") || "No contact info"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(sessionDetail.status === "AI_HANDLING" || sessionDetail.status === "WAITING_FOR_AGENT") && (
                      <Button
                        size="sm"
                        className={sessionDetail.status === "WAITING_FOR_AGENT" ? "bg-orange-500 hover:bg-orange-600" : ""}
                        onClick={() => takeOverMutation.mutate({ sessionId: selectedSession })}
                      >
                        <UserCheck className="mr-2 h-4 w-4" />
                        {sessionDetail.status === "WAITING_FOR_AGENT" ? "Connect Now" : "Take Over"}
                      </Button>
                    )}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[sessionDetail.status]}`}>
                      {sessionDetail.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages?.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "VISITOR" ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        msg.role === "VISITOR"
                          ? "bg-gray-100 text-gray-900"
                          : msg.role === "AI"
                          ? "bg-blue-100 text-blue-900"
                          : "bg-emerald-100 text-emerald-900"
                      }`}
                    >
                      <p className="text-[10px] font-medium mb-1 opacity-60">
                        {msg.role === "VISITOR" ? "Visitor" : msg.role === "AI" ? "AI" : "Attorney"}
                      </p>
                      <p className="text-sm">{msg.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              {sessionDetail?.status === "AGENT_CONNECTED" && (
                <form onSubmit={handleSend} className="p-4 border-t flex gap-2">
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="bg-white"
                  />
                  <Button type="submit" size="icon" disabled={sendMutation.isLoading}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
