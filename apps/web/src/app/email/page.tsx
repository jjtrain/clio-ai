"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Inbox,
  Send,
  FileText,
  Archive,
  HelpCircle,
  Mail,
  Plus,
  Search,
  Paperclip,
  Reply,
  Forward,
  Star,
} from "lucide-react";

const FOLDERS = [
  { key: "INBOX", label: "Inbox", icon: Inbox },
  { key: "SENT", label: "Sent", icon: Send },
  { key: "DRAFTS", label: "Drafts", icon: FileText },
  { key: "ARCHIVE", label: "Archive", icon: Archive },
  { key: "UNFILED", label: "Unfiled", icon: HelpCircle },
] as const;

type FilterKey = "unread" | "hasAttachments" | "filed" | "unfiled";

function formatDate(d: string | Date) {
  const date = new Date(d);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diff === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diff === 1) return "Yesterday";
  if (diff < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function EmailPage() {
  const { toast } = useToast();
  const [folder, setFolder] = useState("INBOX");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set());

  const messages = trpc.email["messages.list"].useQuery({
    folder: folder !== "ALL" ? folder : undefined,
    subject: search || undefined,
    isRead: filters.has("unread") ? false : undefined,
    hasAttachments: filters.has("hasAttachments") ? true : undefined,
  });

  const selected = messages.data?.find((m: any) => m.id === selectedId);

  const toggleFilter = (f: FilterKey) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else {
        if (f === "filed") next.delete("unfiled");
        if (f === "unfiled") next.delete("filed");
        next.add(f);
      }
      return next;
    });
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left: Folders */}
      <div className="w-56 border-r bg-muted/30 p-3 flex flex-col gap-1">
        <Link href="/email/compose">
          <Button className="w-full mb-3" size="sm">
            <Plus className="h-4 w-4 mr-2" /> Compose
          </Button>
        </Link>
        {FOLDERS.map((f) => (
          <button
            key={f.key}
            onClick={() => { setFolder(f.key); setSelectedId(null); }}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
              folder === f.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            <f.icon className="h-4 w-4" />
            {f.label}
          </button>
        ))}

        <div className="mt-4 border-t pt-3 space-y-1 text-xs">
          <Link href="/email/unfiled" className="block px-3 py-1.5 hover:bg-muted rounded">Unfiled Queue</Link>
          <Link href="/email/templates" className="block px-3 py-1.5 hover:bg-muted rounded">Templates</Link>
          <Link href="/email/rules" className="block px-3 py-1.5 hover:bg-muted rounded">Rules</Link>
          <Link href="/email/scheduled" className="block px-3 py-1.5 hover:bg-muted rounded">Scheduled</Link>
          <Link href="/email/reports" className="block px-3 py-1.5 hover:bg-muted rounded">Reports</Link>
        </div>
      </div>

      {/* Center: Message List */}
      <div className="w-96 border-r flex flex-col">
        <div className="p-3 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search emails..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(["unread", "hasAttachments", "filed", "unfiled"] as FilterKey[]).map((f) => (
              <Badge
                key={f}
                variant={filters.has(f) ? "default" : "outline"}
                className="cursor-pointer text-xs"
                onClick={() => toggleFilter(f)}
              >
                {f === "hasAttachments" ? "Has Attachments" : f.charAt(0).toUpperCase() + f.slice(1)}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {messages.isLoading && <p className="p-4 text-sm text-muted-foreground">Loading...</p>}
          {messages.data?.length === 0 && <p className="p-4 text-sm text-muted-foreground">No messages</p>}
          {messages.data?.map((msg: any) => (
            <button
              key={msg.id}
              onClick={() => setSelectedId(msg.id)}
              className={`w-full text-left px-3 py-2.5 border-b hover:bg-muted/50 ${
                selectedId === msg.id ? "bg-muted" : ""
              } ${!msg.isRead ? "font-semibold" : ""}`}
            >
              <div className="flex justify-between items-start">
                <span className="text-sm truncate flex-1">{msg.from || "Unknown"}</span>
                <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                  {formatDate(msg.date)}
                </span>
              </div>
              <div className="text-sm truncate">{msg.subject || "(no subject)"}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-muted-foreground truncate flex-1">
                  {msg.snippet}
                </span>
                {msg.matterId && (
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {msg.matterName || "Filed"}
                  </Badge>
                )}
                {msg.hasAttachments && <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Message Viewer */}
      <div className="flex-1 flex flex-col">
        {selected ? (
          <>
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">{selected.subject || "(no subject)"}</h2>
              <div className="text-sm text-muted-foreground mt-1">
                <span>From: {selected.from}</span>
                {selected.to && <span className="ml-4">To: {selected.to}</span>}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {new Date(selected.date).toLocaleString()}
              </div>
            </div>
            <div
              className="flex-1 overflow-y-auto p-4 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: selected.bodyHtml || selected.bodyText || "" }}
            />
            <div className="p-3 border-t flex gap-2">
              <Button size="sm" variant="outline">
                <Reply className="h-4 w-4 mr-1" /> Reply
              </Button>
              <Button size="sm" variant="outline">
                <Forward className="h-4 w-4 mr-1" /> Forward
              </Button>
              <Button size="sm" variant="outline">
                <Archive className="h-4 w-4 mr-1" /> Archive
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Mail className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>Select a message to read</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
