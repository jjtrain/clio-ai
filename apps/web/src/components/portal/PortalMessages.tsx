"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePortalTheme } from "./PortalThemeProvider";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  direction: "CLIENT_TO_FIRM" | "FIRM_TO_CLIENT";
  subject?: string | null;
  content: string;
  isRead: boolean;
  createdAt: Date;
}

interface PortalMessagesProps {
  messages: Message[];
  onSend: (body: string) => void;
  isSending?: boolean;
}

export function PortalMessages({ messages, onSend, isSending }: PortalMessagesProps) {
  const theme = usePortalTheme();
  const [newMessage, setNewMessage] = useState("");

  const handleSend = () => {
    if (newMessage.trim()) {
      onSend(newMessage.trim());
      setNewMessage("");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {messages.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm" style={{ color: theme.colorMuted }}>
              No messages yet. Send your attorney a message any time.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isClient = msg.direction === "CLIENT_TO_FIRM";
            return (
              <div key={msg.id} className={cn("flex", isClient ? "justify-end" : "justify-start")}>
                <div
                  className={cn("max-w-[80%] rounded-2xl px-4 py-2.5", isClient ? "rounded-br-sm" : "rounded-bl-sm")}
                  style={{
                    backgroundColor: isClient ? theme.colorPrimary : theme.colorSurface,
                    color: isClient ? "white" : theme.colorText,
                    border: isClient ? "none" : "1px solid #E5E7EB",
                  }}
                >
                  {msg.subject && (
                    <p className={cn("text-xs font-semibold mb-1", isClient ? "text-white/80" : "")}
                       style={{ color: isClient ? undefined : theme.colorPrimary }}>
                      {msg.subject}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className={cn("text-[10px] mt-1", isClient ? "text-white/50" : "")}
                     style={{ color: isClient ? undefined : theme.colorMuted }}>
                    {new Date(msg.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="border-t p-4" style={{ backgroundColor: theme.colorSurface }}>
        <div className="flex items-end gap-2">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 resize-none rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2"
            style={{ borderColor: "#E5E7EB", borderRadius: theme.borderRadius }}
            rows={2}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || isSending}
            className="h-10 w-10 rounded-xl p-0"
            style={{ backgroundColor: theme.colorPrimary }}
          >
            <Send className="h-4 w-4 text-white" />
          </Button>
        </div>
      </div>
    </div>
  );
}
