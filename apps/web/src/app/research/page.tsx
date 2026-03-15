"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  Plus,
  Settings,
  MessageSquare,
  FileText,
  BookMarked,
  Archive,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

export default function ResearchWorkspace() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: sessions, isLoading } = trpc.research.listSessions.useQuery();
  const { data: matters } = trpc.matters.list.useQuery();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [matterId, setMatterId] = useState("");
  const [description, setDescription] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const createSession = trpc.research.createSession.useMutation({
    onSuccess: (session) => {
      router.push(`/research/${session.id}`);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateSession = trpc.research.updateSession.useMutation({
    onSuccess: () => {
      utils.research.listSessions.invalidate();
    },
  });

  const handleCreate = () => {
    if (!title.trim()) return;
    createSession.mutate({
      title: title.trim(),
      matterId: matterId || undefined,
      description: description || undefined,
    });
  };

  const activeSessions = sessions?.filter((s) => s.status === "ACTIVE") || [];
  const archivedSessions = sessions?.filter((s) => s.status !== "ACTIVE") || [];

  const timeAgo = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Legal Research</h1>
            <p className="text-gray-500">AI-powered legal research workspace</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/research/settings"><Settings className="h-4 w-4 mr-2" /> Settings</Link>
          </Button>
          <Button onClick={() => { setShowCreate(true); setTitle(""); setMatterId(""); setDescription(""); }} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4 mr-2" /> New Session
          </Button>
        </div>
      </div>

      {/* Create Session Dialog */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-indigo-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">New Research Session</h2>
            <button onClick={() => setShowCreate(false)}><X className="h-5 w-5 text-gray-400" /></button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Title <span className="text-red-500">*</span></Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Statute of Limitations Research" />
            </div>
            <div className="space-y-2">
              <Label>Link to Matter (optional)</Label>
              <Select value={matterId} onValueChange={setMatterId}>
                <SelectTrigger>
                  <SelectValue placeholder="No linked matter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked matter</SelectItem>
                  {matters?.matters?.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.matterNumber} - {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of the research topic" />
          </div>
          <Button onClick={handleCreate} disabled={!title.trim() || createSession.isPending} className="bg-indigo-600 hover:bg-indigo-700">
            {createSession.isPending ? "Creating..." : "Start Research Session"}
          </Button>
        </div>
      )}

      {/* Active Sessions */}
      {isLoading ? (
        <div className="py-12 text-center text-gray-400">Loading sessions...</div>
      ) : activeSessions.length === 0 && !showCreate ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No research sessions yet</h3>
          <p className="text-gray-500 mb-4">Start a new session to begin AI-powered legal research</p>
          <Button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4 mr-2" /> New Session
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeSessions.map((session) => (
            <Link
              key={session.id}
              href={`/research/${session.id}`}
              className="group bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-indigo-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                  {session.title}
                </h3>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    updateSession.mutate({ id: session.id, status: "ARCHIVED" });
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 transition-opacity"
                  title="Archive"
                >
                  <Archive className="h-4 w-4" />
                </button>
              </div>
              {session.matter && (
                <p className="text-xs text-indigo-600 font-medium mb-2">
                  {session.matter.matterNumber} - {session.matter.name}
                </p>
              )}
              {session.matter?.practiceArea && (
                <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 mb-2">
                  {session.matter.practiceArea}
                </span>
              )}
              {session.description && (
                <p className="text-sm text-gray-500 line-clamp-2 mb-3">{session.description}</p>
              )}
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> {session._count.messages}
                </span>
                <span className="flex items-center gap-1">
                  <BookMarked className="h-3 w-3" /> {session._count.sources}
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" /> {session._count.notes}
                </span>
                <span className="ml-auto">{timeAgo(session.updatedAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Archived Sessions */}
      {archivedSessions.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 mb-3"
          >
            {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Archived Sessions ({archivedSessions.length})
          </button>
          {showArchived && (
            <div className="space-y-2">
              {archivedSessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/research/${session.id}`}
                  className="flex items-center justify-between bg-white rounded-lg border border-gray-100 p-3 hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-gray-700">{session.title}</p>
                    <p className="text-xs text-gray-400">
                      {session.matter ? `${session.matter.matterNumber} - ${session.matter.name} · ` : ""}
                      {session._count.messages} messages · {timeAgo(session.updatedAt)}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                    {session.status === "COMPLETED" ? "Completed" : "Archived"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
