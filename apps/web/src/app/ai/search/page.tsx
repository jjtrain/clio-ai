"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FileText, Database, MessageSquare, Loader2, FileSearch } from "lucide-react";

export default function SemanticSearchPage() {
  const [query, setQuery] = useState("");
  const [matterId, setMatterId] = useState<string>("");
  const [mode, setMode] = useState<"search" | "ask">("search");
  const [results, setResults] = useState<any[]>([]);
  const [answer, setAnswer] = useState<any>(null);
  const [searching, setSearching] = useState(false);

  const { data: matters } = trpc.matters.list.useQuery({} as any, { retry: false });
  const { data: stats } = trpc.ai["embeddings.getStats"].useQuery();
  const searchMut = trpc.ai["embeddings.search"].useMutation();
  const answerMut = trpc.ai["embeddings.answerFromDocs"].useMutation();
  const embedMut = trpc.ai["embeddings.embedMatter"].useMutation();

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setAnswer(null);
    try {
      if (mode === "ask" && matterId) {
        const result = await answerMut.mutateAsync({ question: query, matterId });
        setAnswer(result);
        setResults(result.citations || []);
      } else {
        const result = await searchMut.mutateAsync({ query, matterId: matterId || undefined, topK: 20 });
        setResults(result.results || []);
      }
    } finally { setSearching(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Semantic Document Search</h1>
        <p className="text-gray-500 mt-1 text-sm">Search case documents using natural language — powered by AI embeddings</p>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex gap-3 mb-3">
          <Button variant={mode === "search" ? "default" : "outline"} size="sm" onClick={() => setMode("search")} className={mode === "search" ? "bg-blue-500" : ""}>
            <Search className="h-4 w-4 mr-1" /> Search
          </Button>
          <Button variant={mode === "ask" ? "default" : "outline"} size="sm" onClick={() => setMode("ask")} className={mode === "ask" ? "bg-blue-500" : ""}>
            <MessageSquare className="h-4 w-4 mr-1" /> Ask a Question
          </Button>
        </div>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input placeholder={mode === "search" ? "Search documents by meaning..." : "Ask a question about your case documents..."} value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10" onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
          </div>
          <Select value={matterId} onValueChange={setMatterId}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Matters" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Matters</SelectItem>
              {((matters as any)?.matters || []).map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={handleSearch} disabled={searching || !query.trim()} className="bg-blue-500 hover:bg-blue-600">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </div>
      </div>

      {/* Answer (RAG mode) */}
      {answer && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-5">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">AI Answer</h3>
          <p className="text-sm text-blue-800 whitespace-pre-wrap">{answer.answer}</p>
          {answer.provider && <p className="text-xs text-blue-500 mt-2">Answered by {answer.provider} ({answer.model})</p>}
        </div>
      )}

      {/* Results */}
      <div className="space-y-3">
        {results.map((result: any, i: number) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-blue-200 transition-all">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium text-gray-900">{result.documentName || "Document"}</span>
                {result.pageNumber && <Badge variant="outline" className="text-xs">p.{result.pageNumber}</Badge>}
              </div>
              <Badge className="bg-blue-100 text-blue-700">{((result.similarity || 0) * 100).toFixed(0)}% match</Badge>
            </div>
            <p className="text-sm text-gray-600 line-clamp-3">{result.chunkText}</p>
          </div>
        ))}
        {!searching && results.length === 0 && query && <p className="text-center text-gray-400 py-8">No results found. Try embedding your documents first.</p>}
      </div>

      {/* Sidebar stats */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-3">Embedding Stats</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-500">Documents</span><p className="font-semibold">{stats?.documentsEmbedded ?? 0}</p></div>
          <div><span className="text-gray-500">Chunks</span><p className="font-semibold">{stats?.totalChunks ?? 0}</p></div>
          <div><span className="text-gray-500">Tokens</span><p className="font-semibold">{(stats?.totalTokens ?? 0).toLocaleString()}</p></div>
          <div><span className="text-gray-500">Last Updated</span><p className="font-semibold">{stats?.lastEmbeddedAt ? new Date(stats.lastEmbeddedAt).toLocaleDateString() : "-"}</p></div>
        </div>
        {matterId && (
          <Button variant="outline" size="sm" className="mt-3" onClick={() => embedMut.mutate({ matterId })} disabled={embedMut.isPending}>
            <Database className="h-4 w-4 mr-1" /> {embedMut.isPending ? "Embedding..." : "Embed Matter Documents"}
          </Button>
        )}
      </div>
    </div>
  );
}
