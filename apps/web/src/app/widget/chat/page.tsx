"use client";

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { MessageSquare, Send, X, Minimize2 } from "lucide-react";

export default function ChatWidgetPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: widgetSettings } = trpc.chat.getWidgetSettings.useQuery();

  const startMutation = trpc.chat.startSession.useMutation({
    onSuccess: (data) => {
      setSessionId(data.sessionId);
    },
  });

  const { data: session, refetch: refetchSession } = trpc.chat.getSession.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId, refetchInterval: 3000 }
  );

  const sendMutation = trpc.chat.sendMessage.useMutation({
    onSuccess: () => {
      setIsTyping(false);
      refetchSession();
    },
    onError: () => setIsTyping(false),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages]);

  const handleOpen = () => {
    setIsOpen(true);
    if (!sessionId) {
      startMutation.mutate({
        referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
        pageUrl: typeof window !== "undefined" ? window.location.href : undefined,
      });
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !sessionId) return;
    setIsTyping(true);
    sendMutation.mutate({ sessionId, content: message });
    setMessage("");
  };

  if (!widgetSettings?.isEnabled) return null;

  const color = widgetSettings.widgetColor || "#3B82F6";
  const position = widgetSettings.widgetPosition || "bottom-right";

  return (
    <div
      className="fixed z-50"
      style={{
        [position === "bottom-right" ? "right" : "left"]: "20px",
        bottom: "20px",
      }}
    >
      {/* Chat Window */}
      {isOpen && (
        <div
          className="mb-4 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col"
          style={{ width: "380px", height: "520px" }}
        >
          {/* Header */}
          <div
            className="rounded-t-2xl px-4 py-3 flex items-center justify-between"
            style={{ backgroundColor: color }}
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-white" />
              <span className="text-white font-medium text-sm">Chat with us</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
              <Minimize2 className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {session?.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "VISITOR" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                    msg.role === "VISITOR"
                      ? "text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                  style={msg.role === "VISITOR" ? { backgroundColor: color } : {}}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl px-4 py-2 text-sm text-gray-500">
                  <span className="inline-flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-3 border-t flex gap-2">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="rounded-full p-2 text-white"
              style={{ backgroundColor: color }}
              disabled={sendMutation.isLoading}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      {/* Chat Bubble */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="rounded-full p-4 text-white shadow-lg hover:scale-105 transition-transform"
          style={{ backgroundColor: color }}
        >
          <MessageSquare className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
