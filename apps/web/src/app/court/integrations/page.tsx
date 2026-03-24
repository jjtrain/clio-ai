"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import {
  Plug,
  Plus,
  Trash2,
  RefreshCw,
  Upload,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export default function CourtIntegrationsPage() {
  const adaptersQuery = trpc.courtCalendar.listAdapters.useQuery();
  const watchedQuery = trpc.courtCalendar.listWatchedCases.useQuery();
  const syncMut = trpc.courtCalendar.syncNow.useMutation({ onSuccess: () => watchedQuery.refetch() });
  const addCaseMut = trpc.courtCalendar.addWatchedCase.useMutation({ onSuccess: () => watchedQuery.refetch() });
  const removeCaseMut = trpc.courtCalendar.removeWatchedCase.useMutation({ onSuccess: () => watchedQuery.refetch() });
  const importICSMut = trpc.courtCalendar.importICS.useMutation();
  const courtListenerMut = trpc.courtCalendar.connectCourtListener.useMutation();

  const adapters = adaptersQuery.data || [];
  const watched = watchedQuery.data || [];

  const [addProvider, setAddProvider] = useState("COURTLISTENER");
  const [addCaseNumber, setAddCaseNumber] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [icsResult, setIcsResult] = useState<{ created: number; skipped: number } | null>(null);
  const [clResult, setClResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);
  const [clSearch, setClSearch] = useState("");

  function handleAddCase() {
    if (!addCaseNumber) return;
    addCaseMut.mutate({ provider: addProvider, caseNumber: addCaseNumber });
    setAddCaseNumber("");
    setShowAddForm(false);
  }

  function handleICSUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      importICSMut.mutate({ icsContent: content }, {
        onSuccess: (data) => setIcsResult(data),
      });
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleCourtListenerSearch() {
    if (!clSearch) return;
    courtListenerMut.mutate({ caseNumber: clSearch }, {
      onSuccess: (data) => setClResult(data),
    });
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Plug className="h-7 w-7 text-indigo-600" />
            Court Integrations
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Connect court systems, import calendars, and watch case dockets
          </p>
        </div>
        <Button onClick={() => syncMut.mutate()} disabled={syncMut.isLoading} className="gap-2">
          {syncMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sync All Now
        </Button>
      </div>

      {syncMut.isSuccess && syncMut.data && (
        <Card className="p-3 bg-green-50 border-green-200">
          <p className="text-sm text-green-700">
            <CheckCircle className="h-4 w-4 inline mr-1" />
            Sync complete: {syncMut.data.totalCreated} created, {syncMut.data.totalUpdated} updated
            {syncMut.data.errors.length > 0 && ` (${syncMut.data.errors.length} errors)`}
          </p>
        </Card>
      )}

      {/* Available Providers */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Available Providers</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {adapters.map((adapter) => (
            <Card key={adapter.name} className={cn("p-4", adapter.implemented ? "border-green-200" : "border-gray-200 opacity-70")}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-gray-900">{adapter.name}</span>
                <Badge className={cn("text-[9px]", adapter.implemented ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                  {adapter.implemented ? "Ready" : "Coming Soon"}
                </Badge>
              </div>
              <p className="text-xs text-gray-500">{adapter.description}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* CourtListener Search */}
      <Card className="p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Search className="h-4 w-4 text-gray-400" /> CourtListener — Federal Court Search
        </h2>
        <p className="text-xs text-gray-500">Search by case number or case name. Covers all federal courts (SDNY, EDNY, all circuits, bankruptcy).</p>
        <div className="flex gap-2">
          <Input
            value={clSearch}
            onChange={(e) => setClSearch(e.target.value)}
            placeholder="e.g. 1:23-cv-01234 or 'Smith v. Jones'"
            className="h-9 text-sm flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleCourtListenerSearch()}
          />
          <Button size="sm" onClick={handleCourtListenerSearch} disabled={!clSearch || courtListenerMut.isLoading}>
            {courtListenerMut.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        {clResult && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            <CheckCircle className="h-4 w-4 inline mr-1" />
            Found {clResult.created} new events, {clResult.updated} updated
            {clResult.errors.length > 0 && (
              <div className="mt-1 text-xs text-red-600">
                {clResult.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ICS Import */}
      <Card className="p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Upload className="h-4 w-4 text-gray-400" /> Import .ics Calendar File
        </h2>
        <p className="text-xs text-gray-500">
          Upload .ics files exported from NYSCEF, local court websites, or any calendar system.
        </p>
        <div className="flex items-center gap-3">
          <label className="cursor-pointer">
            <input type="file" accept=".ics,.ical" onChange={handleICSUpload} className="hidden" />
            <span className="inline-flex items-center gap-1 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
              <Upload className="h-4 w-4" /> Choose .ics File
            </span>
          </label>
          {importICSMut.isLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
        </div>
        {icsResult && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            <CheckCircle className="h-4 w-4 inline mr-1" />
            Imported {icsResult.created} events ({icsResult.skipped} duplicates skipped)
          </div>
        )}
      </Card>

      {/* Watched Cases */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Watched Case Numbers</h2>
          <Button variant="outline" size="sm" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="h-3 w-3 mr-1" /> Add Case
          </Button>
        </div>

        {showAddForm && (
          <div className="flex gap-2 items-end p-3 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <label className="text-xs text-gray-500">Case Number</label>
              <Input
                value={addCaseNumber}
                onChange={(e) => setAddCaseNumber(e.target.value)}
                placeholder="e.g. 1:24-cv-00123"
                className="h-8 text-sm mt-0.5"
              />
            </div>
            <Button size="sm" onClick={handleAddCase} disabled={!addCaseNumber || addCaseMut.isLoading}>
              Add
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {watched.length === 0 && (
          <p className="text-xs text-gray-400 py-4 text-center">
            No watched cases yet. Add a case number to start syncing court events automatically.
          </p>
        )}

        {watched.map((integration: any) => (
          <div key={integration.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className="text-[10px] bg-indigo-100 text-indigo-700">{integration.provider}</Badge>
                <Badge className={cn("text-[10px]",
                  integration.status === "active" ? "bg-green-100 text-green-700"
                  : integration.status === "error" ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-500"
                )}>
                  {integration.status}
                </Badge>
              </div>
              {integration.lastSyncAt && (
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Last sync: {new Date(integration.lastSyncAt).toLocaleString()}
                </span>
              )}
            </div>

            {(integration.caseNumbers as any[]).length === 0 && (
              <p className="text-xs text-gray-400">No case numbers configured</p>
            )}

            {(integration.caseNumbers as any[]).map((entry: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-1 px-2 bg-gray-50 rounded text-sm">
                <span className="font-mono text-gray-700">{entry.caseNumber}</span>
                <button
                  onClick={() => removeCaseMut.mutate({ provider: integration.provider, caseNumber: entry.caseNumber })}
                  className="text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ))}
      </Card>
    </div>
  );
}
