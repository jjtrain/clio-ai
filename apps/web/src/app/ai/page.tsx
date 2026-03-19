"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain, Sparkles, Zap, FileSearch, Mic, AlertTriangle,
  BarChart3, Search, MessageSquare, GitCompare, ChevronRight,
  CheckCircle2, XCircle, Clock, DollarSign, Activity, FileText,
} from "lucide-react";

export default function AICommandCenterPage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = now.toISOString();

  const { data: settings } = trpc.ai["settings.list"].useQuery();
  const { data: health } = trpc.ai["usage.getHealth"].useQuery();
  const { data: todayUsage } = trpc.ai["usage.getSummary"].useQuery({ from: todayStart, to: todayEnd });
  const { data: monthUsage } = trpc.ai["usage.getSummary"].useQuery({ from: monthStart, to: todayEnd });
  const { data: embeddingStats } = trpc.ai["embeddings.getStats"].useQuery();
  const { data: budget } = trpc.ai["settings.getBudget"].useQuery();

  const requestsToday = todayUsage?.totalRequests ?? 0;
  const monthSpend = monthUsage?.totalCost ?? 0;
  const avgLatency = todayUsage?.avgLatency ?? 0;
  const docsEmbedded = embeddingStats?.documentsEmbedded ?? 0;
  const errorRate = todayUsage?.errorRate ?? 0;

  const quickLinks = [
    { label: "Search Documents", href: "/ai/search", icon: Search, color: "text-blue-500" },
    { label: "Transcribe Audio", href: "/ai/transcription", icon: Mic, color: "text-green-500" },
    { label: "Prompt Templates", href: "/ai/prompts", icon: FileText, color: "text-purple-500" },
    { label: "Compare Providers", href: "/ai/compare", icon: GitCompare, color: "text-amber-500" },
    { label: "Usage & Costs", href: "/ai/usage", icon: BarChart3, color: "text-red-500" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">AI Command Center</h1>
        <p className="text-gray-500 mt-1 text-sm">Monitor and manage AI providers, usage, and capabilities</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: "Requests Today", value: requestsToday, icon: Zap },
          { label: "Month Spend", value: `$${monthSpend.toFixed(2)}`, icon: DollarSign },
          { label: "Avg Latency", value: `${avgLatency}ms`, icon: Clock },
          { label: "Docs Embedded", value: docsEmbedded, icon: FileSearch },
          { label: "Transcriptions", value: monthUsage?.byFeature?.transcription ?? 0, icon: Mic },
          { label: "Error Rate", value: `${(errorRate * 100).toFixed(1)}%`, icon: errorRate > 0.02 ? AlertTriangle : CheckCircle2 },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">{stat.label}</span>
              <stat.icon className="h-4 w-4 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Provider Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <Brain className="h-6 w-6 text-purple-600" />
            <div>
              <h2 className="text-base font-semibold text-gray-900">Anthropic (Claude)</h2>
              <p className="text-xs text-gray-500">Primary legal reasoning engine</p>
            </div>
            <Badge className={`ml-auto ${health?.anthropic?.status === "healthy" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {health?.anthropic?.status === "healthy" ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
              {health?.anthropic?.status || "unknown"}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><span className="text-gray-500">Model</span><p className="font-medium">Claude Sonnet 4</p></div>
            <div><span className="text-gray-500">Requests</span><p className="font-medium">{health?.anthropic?.requests ?? 0}</p></div>
            <div><span className="text-gray-500">Avg Latency</span><p className="font-medium">{health?.anthropic?.avgLatency ?? 0}ms</p></div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="h-6 w-6 text-emerald-600" />
            <div>
              <h2 className="text-base font-semibold text-gray-900">OpenAI</h2>
              <p className="text-xs text-gray-500">Embeddings, transcription, images</p>
            </div>
            <Badge className={`ml-auto ${(settings as any)?.openai?.isEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {(settings as any)?.openai?.isEnabled ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
              {(settings as any)?.openai?.isEnabled ? "active" : "not configured"}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div><span className="text-gray-500">Model</span><p className="font-medium">{(settings as any)?.openai?.defaultModel || "gpt-4o"}</p></div>
            <div><span className="text-gray-500">Requests</span><p className="font-medium">{health?.openai?.requests ?? 0}</p></div>
            <div><span className="text-gray-500">Avg Latency</span><p className="font-medium">{health?.openai?.avgLatency ?? 0}ms</p></div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href} className="flex flex-col items-center gap-2 bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-blue-200 hover:shadow-md transition-all">
              <link.icon className={`h-6 w-6 ${link.color}`} />
              <span className="text-sm font-medium text-gray-700 text-center">{link.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Routing Strategy */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Routing Strategy</h2>
            <p className="text-sm text-gray-500 mt-1">Current: <Badge variant="outline" className="ml-1">{(settings as any)?.openai?.routingStrategy || "anthropic_primary"}</Badge></p>
          </div>
          <Link href="/settings/integrations">
            <Button variant="outline" size="sm">Configure <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
