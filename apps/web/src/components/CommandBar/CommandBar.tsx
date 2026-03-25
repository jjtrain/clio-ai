"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Sparkles, Clock, ArrowRight, FileText, Briefcase, Users,
  Calendar, Settings, Hash, Loader2, Zap, X, Command,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  detectMode, detectIntent, SLASH_COMMANDS, QUICK_ACTIONS,
  getRecentItems, addRecentItem, type InputMode,
} from "@/lib/commandBar/intents";
import { trpc } from "@/lib/trpc";

const MODE_LABELS: Record<InputMode, { label: string; icon: any; color: string }> = {
  search: { label: "Search", icon: Search, color: "text-muted-foreground" },
  ai: { label: "AI", icon: Sparkles, color: "text-primary" },
  slash: { label: "Command", icon: Zap, color: "text-warning" },
};

const ACTION_ICONS: Record<string, any> = { Clock, Briefcase, FileText, Users, Calendar, Settings };

export function CommandBar() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<InputMode>("search");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const searchQuery = trpc.search.quickSearch.useQuery(
    { query: input, limit: 5 },
    { enabled: mode === "search" && input.length >= 2 && isOpen }
  );

  // Cmd+K handler
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setInput("");
      setMode("search");
      setSelectedIdx(0);
      setAiResponse(null);
    }
  }, [isOpen]);

  // Detect mode on input change
  useEffect(() => {
    setMode(detectMode(input));
    setSelectedIdx(0);
    setAiResponse(null);
  }, [input]);

  // Build items list based on mode
  const items = useCallback(() => {
    if (mode === "slash") {
      const search = input.slice(1).toLowerCase();
      return SLASH_COMMANDS.filter((c) => c.command.includes(search) || c.label.toLowerCase().includes(search))
        .map((c) => ({ id: c.command, label: c.label, description: c.description, href: c.href, type: "command" }));
    }

    if (mode === "ai") {
      const intent = detectIntent(input);
      return intent ? [{ id: "ai-intent", label: intent.displayLabel, description: input, href: "", type: "ai" }] : [];
    }

    // Search mode
    const results: Array<{ id: string; label: string; description?: string; href: string; type: string }> = [];

    if (input.length < 2) {
      // Show recent + quick actions
      const recent = getRecentItems();
      recent.forEach((r) => results.push({ id: `recent-${r.href}`, label: r.label, href: r.href, type: "recent" }));
      QUICK_ACTIONS.forEach((a) => results.push({ id: `action-${a.href}`, label: a.label, description: a.description, href: a.href, type: "action" }));
    } else {
      // Show search results
      (searchQuery.data?.results || []).forEach((r: any) => {
        results.push({ id: `${r.entityType}-${r.id}`, label: r.title, description: r.subtitle, href: r.url || `/search?q=${encodeURIComponent(input)}`, type: r.entityType });
      });
    }

    return results;
  }, [mode, input, searchQuery.data])();

  function handleSelect(item: typeof items[number]) {
    if (item.type === "ai") {
      executeAI();
      return;
    }
    addRecentItem({ label: item.label, href: item.href, type: item.type });
    router.push(item.href);
    setIsOpen(false);
  }

  async function executeAI() {
    setAiLoading(true);
    setAiResponse(null);
    try {
      const intent = detectIntent(input);
      const res = await fetch("/api/ai/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, intent: intent?.type || "answer_question" }),
      });
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const data = JSON.parse(line.slice(6));
          if (data.type === "action" && data.href) {
            setAiResponse(data.message);
            setTimeout(() => { router.push(data.href); setIsOpen(false); }, 800);
          } else if (data.type === "answer") {
            setAiResponse(data.message);
          } else if (data.type === "thinking") {
            setAiResponse(data.message);
          }
        }
      }
    } catch {
      setAiResponse("Something went wrong. Try again.");
    }
    setAiLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, items.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter") {
      e.preventDefault();
      if (mode === "ai") executeAI();
      else if (items[selectedIdx]) handleSelect(items[selectedIdx]);
      else if (input.trim()) { router.push(`/search?q=${encodeURIComponent(input)}`); setIsOpen(false); }
    }
  }

  if (!isOpen) return null;

  const ModeInfo = MODE_LABELS[mode];

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => setIsOpen(false)} />

      {/* Panel */}
      <div className="relative mx-auto mt-[15vh] w-full max-w-[560px] px-4">
        <div ref={overlayRef} className="bg-card rounded-xl border shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden">
          {/* Input row */}
          <div className="flex items-center gap-3 px-4 h-[52px] border-b">
            <ModeInfo.icon className={cn("h-4 w-4 flex-shrink-0", ModeInfo.color)} />
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={mode === "slash" ? "Type a command..." : "Search, ask AI, or type / for commands..."}
              className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            {input && <button onClick={() => setInput("")} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
            <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border">esc</kbd>
          </div>

          {/* Mode indicator */}
          {mode !== "search" && (
            <div className="px-4 py-1.5 bg-secondary/50 border-b flex items-center gap-2">
              <div className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", mode === "ai" ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning")}>
                {mode === "ai" ? "AI Mode" : "Command Mode"}
              </div>
              <span className="text-[11px] text-muted-foreground">
                {mode === "ai" ? "Press Enter to send to AI" : "Select a command below"}
              </span>
            </div>
          )}

          {/* AI response */}
          {(aiResponse || aiLoading) && (
            <div className="px-4 py-3 border-b bg-primary/5">
              <div className="flex items-start gap-2">
                {aiLoading ? <Loader2 className="h-4 w-4 text-primary animate-spin mt-0.5" /> : <Sparkles className="h-4 w-4 text-primary mt-0.5" />}
                <p className="text-[13px] text-foreground">{aiResponse || "Thinking..."}</p>
              </div>
            </div>
          )}

          {/* Results */}
          <div className="max-h-[360px] overflow-y-auto">
            {items.length === 0 && input.length >= 2 && mode === "search" && (
              <div className="px-4 py-6 text-center">
                <Search className="h-5 w-5 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-[12px] text-muted-foreground">No results for "{input}"</p>
              </div>
            )}

            {/* Group: Recent */}
            {input.length < 2 && mode === "search" && getRecentItems().length > 0 && (
              <div className="px-3 pt-2 pb-1">
                <span className="text-[10px] font-medium uppercase tracking-[0.04em] text-muted-foreground px-1">Recent</span>
              </div>
            )}

            {items.filter((i) => i.type === "recent").map((item, i) => (
              <button key={item.id} onClick={() => handleSelect(item)}
                className={cn("flex items-center gap-3 w-full px-4 py-2 text-left transition-colors duration-75",
                  selectedIdx === i ? "bg-accent" : "hover:bg-accent/50"
                )}>
                <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-[13px] text-foreground truncate">{item.label}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100" />
              </button>
            ))}

            {/* Group: Actions */}
            {input.length < 2 && mode === "search" && (
              <div className="px-3 pt-3 pb-1">
                <span className="text-[10px] font-medium uppercase tracking-[0.04em] text-muted-foreground px-1">Quick actions</span>
              </div>
            )}

            {items.filter((i) => i.type === "action").map((item, idx) => {
              const globalIdx = items.indexOf(item);
              return (
                <button key={item.id} onClick={() => handleSelect(item)}
                  className={cn("flex items-center gap-3 w-full px-4 py-2 text-left transition-colors duration-75",
                    selectedIdx === globalIdx ? "bg-accent" : "hover:bg-accent/50"
                  )}>
                  <Zap className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] text-foreground">{item.label}</span>
                    {item.description && <span className="text-[11px] text-muted-foreground ml-2">{item.description}</span>}
                  </div>
                </button>
              );
            })}

            {/* Search results / commands / AI intents */}
            {items.filter((i) => !["recent", "action"].includes(i.type)).length > 0 && input.length >= 2 && (
              <div className="px-3 pt-2 pb-1">
                <span className="text-[10px] font-medium uppercase tracking-[0.04em] text-muted-foreground px-1">
                  {mode === "slash" ? "Commands" : mode === "ai" ? "AI Action" : "Results"}
                </span>
              </div>
            )}

            {items.filter((i) => !["recent", "action"].includes(i.type)).map((item) => {
              const globalIdx = items.indexOf(item);
              return (
                <button key={item.id} onClick={() => handleSelect(item)}
                  className={cn("flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors duration-75",
                    selectedIdx === globalIdx ? "bg-accent" : "hover:bg-accent/50"
                  )}>
                  {item.type === "ai" ? <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    : item.type === "command" ? <Hash className="h-3.5 w-3.5 text-warning flex-shrink-0" />
                    : <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium text-foreground">{item.label}</span>
                    {item.description && <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>}
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t bg-secondary/30 flex items-center justify-between">
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><kbd className="bg-secondary px-1 rounded border text-[9px]">↑↓</kbd> navigate</span>
              <span className="flex items-center gap-1"><kbd className="bg-secondary px-1 rounded border text-[9px]">↵</kbd> select</span>
              <span className="flex items-center gap-1"><kbd className="bg-secondary px-1 rounded border text-[9px]">/</kbd> commands</span>
            </div>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Command className="h-3 w-3" />K
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mobile FAB trigger for command bar */
export function CommandBarFAB({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="fixed bottom-6 right-6 z-50 lg:hidden h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
      aria-label="Open command bar"
    >
      <Search className="h-5 w-5" />
    </button>
  );
}
