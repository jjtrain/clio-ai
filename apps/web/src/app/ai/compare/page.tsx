"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Sparkles, Loader2, Clock, DollarSign, Zap, ThumbsUp, ThumbsDown } from "lucide-react";

export default function ProviderComparisonPage() {
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful legal assistant.");
  const [userPrompt, setUserPrompt] = useState("");
  const [result, setResult] = useState<any>(null);
  const [comparing, setComparing] = useState(false);

  const compareMut = trpc.ai["completions.compare"].useMutation();

  const runComparison = async () => {
    if (!userPrompt.trim()) return;
    setComparing(true);
    try {
      const res = await compareMut.mutateAsync({ systemPrompt, userPrompt });
      setResult(res);
    } finally { setComparing(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Provider Comparison</h1>
        <p className="text-gray-500 mt-1 text-sm">Compare Anthropic and OpenAI responses side-by-side</p>
      </div>

      {/* Input */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
        <div>
          <label className="text-sm font-medium text-gray-700">System Prompt</label>
          <textarea className="w-full min-h-[60px] rounded-md border p-3 text-sm mt-1" value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">User Prompt</label>
          <textarea className="w-full min-h-[100px] rounded-md border p-3 text-sm mt-1" value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} placeholder="Enter a prompt to compare responses from both providers..." />
        </div>
        <Button onClick={runComparison} disabled={comparing || !userPrompt.trim()} className="bg-blue-500 hover:bg-blue-600">
          {comparing ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Comparing...</> : <><Zap className="h-4 w-4 mr-1" /> Run Comparison</>}
        </Button>
      </div>

      {/* Results */}
      {result && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Anthropic */}
            <div className="bg-white rounded-xl border border-purple-200 shadow-sm">
              <div className="flex items-center gap-2 p-4 border-b border-purple-100 bg-purple-50 rounded-t-xl">
                <Brain className="h-5 w-5 text-purple-600" />
                <h3 className="text-sm font-semibold text-purple-900">Anthropic (Claude)</h3>
                <Badge className="ml-auto bg-purple-100 text-purple-700">{result.anthropic?.model || "claude-sonnet-4"}</Badge>
              </div>
              <div className="p-4">
                {result.anthropic?.error ? (
                  <p className="text-sm text-red-600">{result.anthropic.error}</p>
                ) : (
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{result.anthropic?.content}</p>
                )}
              </div>
              <div className="flex items-center gap-4 p-4 border-t text-xs text-gray-500">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{result.anthropic?.latencyMs || result.anthropic?.usage?.totalTokens || "-"}ms</span>
                <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{result.anthropic?.usage?.totalTokens || 0} tokens</span>
              </div>
            </div>

            {/* OpenAI */}
            <div className="bg-white rounded-xl border border-green-200 shadow-sm">
              <div className="flex items-center gap-2 p-4 border-b border-green-100 bg-green-50 rounded-t-xl">
                <Sparkles className="h-5 w-5 text-green-600" />
                <h3 className="text-sm font-semibold text-green-900">OpenAI</h3>
                <Badge className="ml-auto bg-green-100 text-green-700">{result.openai?.model || "gpt-4o"}</Badge>
              </div>
              <div className="p-4">
                {result.openai?.error ? (
                  <p className="text-sm text-red-600">{result.openai.error}</p>
                ) : (
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{result.openai?.content}</p>
                )}
              </div>
              <div className="flex items-center gap-4 p-4 border-t text-xs text-gray-500">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{result.openai?.latencyMs || "-"}ms</span>
                <span className="flex items-center gap-1"><Zap className="h-3 w-3" />{result.openai?.usage?.totalTokens || 0} tokens</span>
              </div>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b"><th className="text-left p-3 font-medium text-gray-700">Metric</th><th className="text-center p-3 font-medium text-purple-700">Anthropic</th><th className="text-center p-3 font-medium text-green-700">OpenAI</th></tr></thead>
              <tbody>
                <tr className="border-b"><td className="p-3 text-gray-600">Tokens</td><td className="p-3 text-center">{result.anthropic?.usage?.totalTokens || 0}</td><td className="p-3 text-center">{result.openai?.usage?.totalTokens || 0}</td></tr>
                <tr className="border-b"><td className="p-3 text-gray-600">Response Length</td><td className="p-3 text-center">{(result.anthropic?.content || "").length} chars</td><td className="p-3 text-center">{(result.openai?.content || "").length} chars</td></tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
