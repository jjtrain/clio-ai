"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  BookOpen,
  FileText,
  BookMarked,
  Plus,
  Trash2,
  Pin,
  PinOff,
  X,
  Search,
  Scale,
  Gavel,
  FileSearch,
  ScrollText,
  StickyNote,
  Globe,
  Wrench,
  Sparkles,
  ChevronDown,
} from "lucide-react";

const SOURCE_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  CASE_LAW: { label: "Case Law", color: "bg-blue-100 text-blue-700" },
  STATUTE: { label: "Statute", color: "bg-purple-100 text-purple-700" },
  REGULATION: { label: "Regulation", color: "bg-amber-100 text-amber-700" },
  SECONDARY: { label: "Secondary", color: "bg-teal-100 text-teal-700" },
  WEB: { label: "Web", color: "bg-gray-100 text-gray-600" },
  MANUAL: { label: "Manual", color: "bg-emerald-100 text-emerald-700" },
};

const ANALYSIS_TYPES = [
  { value: "research", label: "Legal Research", icon: Search },
  { value: "case_analysis", label: "Case Analysis", icon: Gavel },
  { value: "comparison", label: "Compare Authorities", icon: Scale },
  { value: "memo", label: "Draft Memo", icon: ScrollText },
  { value: "search_queries", label: "Search Queries", icon: FileSearch },
];

export default function ResearchSessionPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: session, isLoading } = trpc.research.getSession.useQuery({ id: sessionId });

  const [message, setMessage] = useState("");
  const [analysisType, setAnalysisType] = useState("research");
  const [showAddSource, setShowAddSource] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);

  // Source form
  const [srcTitle, setSrcTitle] = useState("");
  const [srcCitation, setSrcCitation] = useState("");
  const [srcUrl, setSrcUrl] = useState("");
  const [srcType, setSrcType] = useState<string>("CASE_LAW");
  const [srcSummary, setSrcSummary] = useState("");
  const [srcContent, setSrcContent] = useState("");

  // Note form
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteTags, setNoteTags] = useState("");

  // Inline title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  const sendMessage = trpc.research.sendMessage.useMutation({
    onSuccess: () => {
      utils.research.getSession.invalidate({ id: sessionId });
      setMessage("");
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateSession = trpc.research.updateSession.useMutation({
    onSuccess: () => {
      utils.research.getSession.invalidate({ id: sessionId });
      setEditingTitle(false);
    },
  });

  const addSource = trpc.research.addSource.useMutation({
    onSuccess: () => {
      utils.research.getSession.invalidate({ id: sessionId });
      setShowAddSource(false);
      setSrcTitle(""); setSrcCitation(""); setSrcUrl(""); setSrcType("CASE_LAW"); setSrcSummary(""); setSrcContent("");
    },
  });

  const deleteSource = trpc.research.deleteSource.useMutation({
    onSuccess: () => utils.research.getSession.invalidate({ id: sessionId }),
  });

  const createNote = trpc.research.createNote.useMutation({
    onSuccess: () => {
      utils.research.getSession.invalidate({ id: sessionId });
      setShowAddNote(false);
      setNoteTitle(""); setNoteContent(""); setNoteTags("");
    },
  });

  const updateNote = trpc.research.updateNote.useMutation({
    onSuccess: () => utils.research.getSession.invalidate({ id: sessionId }),
  });

  const deleteNote = trpc.research.deleteNote.useMutation({
    onSuccess: () => utils.research.getSession.invalidate({ id: sessionId }),
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages.length]);

  const handleSend = () => {
    if (!message.trim() || sendMessage.isPending) return;
    sendMessage.mutate({ sessionId, content: message.trim(), analysisType: analysisType as any });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading session...</div>;
  if (!session) return <div className="py-20 text-center text-gray-500">Session not found</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Top Bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/research"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <Input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                className="h-8 text-sm font-semibold"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") updateSession.mutate({ id: sessionId, title: titleDraft });
                  if (e.key === "Escape") setEditingTitle(false);
                }}
              />
              <Button size="sm" variant="ghost" onClick={() => updateSession.mutate({ id: sessionId, title: titleDraft })}>Save</Button>
            </div>
          ) : (
            <h1
              className="text-lg font-semibold cursor-pointer hover:text-indigo-600 transition-colors truncate"
              onClick={() => { setEditingTitle(true); setTitleDraft(session.title); }}
              title="Click to rename"
            >
              {session.title}
            </h1>
          )}
          {session.matter && (
            <Link href={`/matters/${session.matter.id}`} className="text-xs text-indigo-600 hover:underline">
              {session.matter.matterNumber} - {session.matter.name}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            session.status === "ACTIVE" ? "bg-green-100 text-green-700" :
            session.status === "COMPLETED" ? "bg-blue-100 text-blue-700" :
            "bg-gray-100 text-gray-500"
          }`}>
            {session.status}
          </span>
          {session.status === "ACTIVE" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateSession.mutate({ id: sessionId, status: "COMPLETED" })}
            >
              Mark Complete
            </Button>
          )}
        </div>
      </div>

      {/* Three Panel Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL — Sources */}
        <div className="w-72 border-r border-gray-100 bg-gray-50 flex flex-col shrink-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <BookMarked className="h-4 w-4" /> Sources ({session.sources.length})
            </h2>
            <button
              onClick={() => setShowAddSource(!showAddSource)}
              className="p-1 text-gray-400 hover:text-indigo-600 rounded"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {showAddSource && (
            <div className="p-3 border-b border-gray-200 space-y-2 bg-white">
              <Input value={srcTitle} onChange={(e) => setSrcTitle(e.target.value)} placeholder="Title" className="h-8 text-xs" />
              <Input value={srcCitation} onChange={(e) => setSrcCitation(e.target.value)} placeholder="Citation (optional)" className="h-8 text-xs" />
              <Select value={srcType} onValueChange={setSrcType}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SOURCE_TYPE_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea value={srcSummary} onChange={(e) => setSrcSummary(e.target.value)} placeholder="Summary (optional)" rows={2} className="text-xs" />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="text-xs h-7 bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => addSource.mutate({
                    sessionId,
                    title: srcTitle,
                    citation: srcCitation || undefined,
                    url: srcUrl || undefined,
                    sourceType: srcType as any,
                    summary: srcSummary || undefined,
                    content: srcContent || undefined,
                  })}
                  disabled={!srcTitle.trim()}
                >
                  Add
                </Button>
                <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setShowAddSource(false)}>Cancel</Button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {session.sources.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">
                <BookMarked className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Sources will appear here</p>
                <p className="mt-1">AI will auto-add cited cases</p>
              </div>
            ) : (
              session.sources.map((source) => {
                const config = SOURCE_TYPE_CONFIG[source.sourceType] || { label: source.sourceType, color: "bg-gray-100 text-gray-600" };
                return (
                  <div key={source.id} className="bg-white rounded-lg border border-gray-200 p-2.5 group">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs font-medium text-gray-900 line-clamp-2">{source.title}</p>
                      <button
                        onClick={() => deleteSource.mutate({ id: source.id })}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 shrink-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    {source.citation && (
                      <p className="text-[10px] text-gray-500 mt-0.5 font-mono">{source.citation}</p>
                    )}
                    <span className={`inline-block mt-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${config.color}`}>
                      {config.label}
                    </span>
                    {source.summary && (
                      <p className="text-[11px] text-gray-500 mt-1 line-clamp-3">{source.summary}</p>
                    )}
                    {source.relevanceScore && (
                      <div className="flex mt-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <span key={s} className={`text-[10px] ${s <= source.relevanceScore! ? "text-yellow-400" : "text-gray-200"}`}>★</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* CENTER PANEL — Chat */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {session.messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "USER" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
                  msg.role === "USER"
                    ? "bg-indigo-600 text-white"
                    : msg.role === "SYSTEM"
                    ? "bg-gray-100 text-gray-600 text-sm italic"
                    : "bg-white border border-gray-200 shadow-sm"
                }`}>
                  {msg.role === "AI" ? (
                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: msg.content }} />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                  <p className={`text-[10px] mt-2 ${msg.role === "USER" ? "text-indigo-200" : "text-gray-400"}`}>
                    {new Date(msg.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            {sendMessage.isPending && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Sparkles className="h-4 w-4 animate-spin text-indigo-500" />
                    Researching...
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-100 bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500">Analysis type:</span>
              {ANALYSIS_TYPES.map((at) => (
                <button
                  key={at.value}
                  onClick={() => setAnalysisType(at.value)}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors ${
                    analysisType === at.value
                      ? "bg-indigo-100 text-indigo-700 font-medium"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  <at.icon className="h-3 w-3" />
                  {at.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  analysisType === "research" ? "Ask a legal research question..." :
                  analysisType === "case_analysis" ? "Paste case text for analysis..." :
                  analysisType === "comparison" ? "Describe the issue to compare sources against..." :
                  analysisType === "memo" ? "Describe the question for the memo..." :
                  "Describe the legal issue to get search queries..."
                }
                rows={2}
                className="resize-none"
              />
              <Button
                onClick={handleSend}
                disabled={!message.trim() || sendMessage.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 self-end"
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — Notes */}
        <div className="w-72 border-l border-gray-100 bg-gray-50 flex flex-col shrink-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <StickyNote className="h-4 w-4" /> Notes ({session.notes.length})
            </h2>
            <button
              onClick={() => setShowAddNote(!showAddNote)}
              className="p-1 text-gray-400 hover:text-indigo-600 rounded"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {showAddNote && (
            <div className="p-3 border-b border-gray-200 space-y-2 bg-white">
              <Input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Note title" className="h-8 text-xs" />
              <Textarea value={noteContent} onChange={(e) => setNoteContent(e.target.value)} placeholder="Note content" rows={3} className="text-xs" />
              <Input value={noteTags} onChange={(e) => setNoteTags(e.target.value)} placeholder="Tags (comma separated)" className="h-8 text-xs" />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="text-xs h-7 bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => createNote.mutate({
                    sessionId,
                    title: noteTitle,
                    content: noteContent,
                    tags: noteTags ? JSON.stringify(noteTags.split(",").map((t) => t.trim()).filter(Boolean)) : undefined,
                  })}
                  disabled={!noteTitle.trim()}
                >
                  Add Note
                </Button>
                <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setShowAddNote(false)}>Cancel</Button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {session.notes.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">
                <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>No notes yet</p>
                <p className="mt-1">Save research findings here</p>
              </div>
            ) : (
              session.notes.map((note) => {
                let tags: string[] = [];
                try { tags = note.tags ? JSON.parse(note.tags) : []; } catch {}
                return (
                  <div key={note.id} className={`bg-white rounded-lg border p-2.5 group ${note.isPinned ? "border-indigo-200" : "border-gray-200"}`}>
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs font-medium text-gray-900 line-clamp-1">{note.title}</p>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
                        <button
                          onClick={() => updateNote.mutate({ id: note.id, isPinned: !note.isPinned })}
                          className="p-0.5 text-gray-400 hover:text-indigo-600"
                          title={note.isPinned ? "Unpin" : "Pin"}
                        >
                          {note.isPinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                        </button>
                        <button
                          onClick={() => deleteNote.mutate({ id: note.id })}
                          className="p-0.5 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="text-[11px] text-gray-600 mt-1 line-clamp-4 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: note.content }} />
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {tags.map((tag, i) => (
                          <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{tag}</span>
                        ))}
                      </div>
                    )}
                    {note.isPinned && (
                      <Pin className="h-3 w-3 text-indigo-400 mt-1" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
